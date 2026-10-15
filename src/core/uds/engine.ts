import { vi } from '../../i18n/vi';
import { hex, hexBytes } from '../util/hex';
import type { VehicleConfig } from '../vehicle/types';
import { NEGATIVE_RESPONSE_SID, NRC, NRC_SUPPRESSED_ON_FUNCTIONAL, nrcName } from './nrc';
import { runPipeline } from './pipeline';
import { isS3Expired, nextS3Deadline } from './session';
import { DEFAULT_SERVICES } from './services';
import type { Effect, EcuState, RequestContext, ServiceDefinition, StateChange, UdsResult } from './types';

const o = vi.uds.outcome;
const sc = vi.uds.stateChange;

/** Thời gian ECU khởi động lại sau 0x11 (ms); trong thời gian này ECU không trả lời. */
export const REBOOT_MS = 1500;

export function initialEcuState(): EcuState {
  return {
    session: 'default',
    unlockedLevel: null,
    s3Deadline: null,
    didValues: {},
    security: { pendingSeed: null, failedAttempts: {}, delayUntil: {} },
    rebootUntil: null,
  };
}

export interface UdsServerOptions {
  services?: readonly ServiceDefinition[];
  /** Nguồn số ngẫu nhiên [0, 1) để sinh seed; mặc định Math.random. */
  random?: () => number;
}

/**
 * ECU mô phỏng phía server UDS: request PDU → pipeline NRC → handler → response.
 * Không phụ thuộc React; thời gian được truyền vào qua `now` để chạy tất định.
 */
export class UdsServer {
  private state: EcuState = initialEcuState();
  private readonly services: Map<number, ServiceDefinition>;
  private readonly random: () => number;

  constructor(
    private config: VehicleConfig,
    options: UdsServerOptions = {},
  ) {
    this.services = new Map((options.services ?? DEFAULT_SERVICES).map((s) => [s.sid, s]));
    this.random = options.random ?? Math.random;
  }

  getState(): Readonly<EcuState> {
    return this.state;
  }

  getConfig(): Readonly<VehicleConfig> {
    return this.config;
  }

  setConfig(config: VehicleConfig): void {
    this.config = config;
  }

  getService(sid: number): ServiceDefinition | undefined {
    return this.services.get(sid);
  }

  /** Ghi đè trực tiếp trạng thái (dùng cho test và công cụ thiết lập nhanh). */
  patchState(patch: Partial<EcuState>): void {
    this.state = { ...this.state, ...patch };
  }

  /** Xử lý các sự kiện theo thời gian: khởi động lại xong, S3 hết hạn. */
  tick(now: number): StateChange[] {
    const changes: StateChange[] = [];
    if (this.state.rebootUntil !== null && now >= this.state.rebootUntil) {
      this.state = { ...this.state, rebootUntil: null };
      changes.push({ kind: 'reboot', phase: 'done', message: sc.rebootDone });
    }
    if (isS3Expired(this.state.s3Deadline, now)) {
      changes.push({ kind: 'session', from: this.state.session, to: 'default', message: sc.s3Timeout(this.config.timing.s3Ms) });
      this.state = { ...this.state, session: 'default', s3Deadline: null };
      changes.push(...this.lockSecurity());
    }
    return changes;
  }

  handleRequest(request: readonly number[], ctx: RequestContext): UdsResult {
    const stateChanges = this.tick(ctx.now);
    const base = {
      request: [...request],
      addressing: ctx.addressing,
      pendingResponses: [] as number[][],
      notes: [] as string[],
      stateChanges,
    };
    const silent = (explanation: string): UdsResult => ({
      ...base,
      sid: request[0] ?? null,
      serviceName: null,
      subFunction: null,
      suppressPosRsp: false,
      steps: [],
      outcome: 'noResponse',
      response: null,
      nrc: null,
      explanation,
    });

    if (request.length === 0) return silent(o.emptyRequest);
    if (this.state.rebootUntil !== null) return silent(o.rebooting);

    const sid = request[0]!;
    const def = this.services.get(sid);
    const { steps, result } = runPipeline(def, {
      request,
      addressing: ctx.addressing,
      now: ctx.now,
      conditions: ctx.conditions,
      config: this.config,
      state: this.state,
      randomBytes: (n) => Array.from({ length: n }, () => Math.floor(this.random() * 256) & 0xff),
      dtcs: ctx.dtcs ?? [],
    });

    const hasSub = def?.subFunctions !== undefined && request.length >= 2;
    const subFunction = hasSub ? request[1]! & 0x7f : null;
    const suppressPosRsp = hasSub && (request[1]! & 0x80) !== 0;

    stateChanges.push(...this.applyEffects(result.effects ?? [], ctx.now));

    let outcome: UdsResult['outcome'];
    let response: number[] | null;
    let nrc: number | null = null;
    let explanation: string;
    const notes = base.notes;

    if (result.kind === 'positive') {
      response = result.response;
      outcome = suppressPosRsp ? 'suppressed' : 'positive';
      explanation = suppressPosRsp ? o.suppressed : o.positive(hex(sid + 0x40), hex(sid), def!.name);
      if (suppressPosRsp) response = null;
      if (ctx.simulateResponsePending) {
        base.pendingResponses.push([NEGATIVE_RESPONSE_SID, sid, NRC.requestCorrectlyReceivedResponsePending]);
        notes.push(o.responsePending(this.config.timing.p2StarMs));
        if (suppressPosRsp) {
          // Đã gửi 0x78 thì response cuối bắt buộc phải gửi
          outcome = 'positive';
          response = result.response;
          notes.push(o.pendingOverridesSuppress);
          explanation = o.positive(hex(sid + 0x40), hex(sid), def!.name);
        }
      }
    } else {
      nrc = result.nrc;
      const negative = o.negative(hex(nrc), nrcName(nrc), result.reason);
      if (ctx.addressing === 'functional' && NRC_SUPPRESSED_ON_FUNCTIONAL.includes(nrc)) {
        outcome = 'noResponse';
        response = null;
        explanation = o.functionalNrcSuppressed(hex(nrc), nrcName(nrc));
        notes.push(negative);
      } else {
        outcome = 'negative';
        response = [NEGATIVE_RESPONSE_SID, sid, nrc];
        explanation = negative;
        if (ctx.simulateResponsePending) {
          base.pendingResponses.push([NEGATIVE_RESPONSE_SID, sid, NRC.requestCorrectlyReceivedResponsePending]);
          notes.push(o.responsePending(this.config.timing.p2StarMs));
        }
      }
    }

    // S3 khởi động lại sau mỗi request khi ECU ở session khác default
    this.state = { ...this.state, s3Deadline: nextS3Deadline(this.state.session, ctx.now, this.config.timing) };

    return {
      ...base,
      sid,
      serviceName: def?.name ?? null,
      subFunction,
      suppressPosRsp,
      steps,
      outcome,
      response,
      nrc,
      explanation,
    };
  }

  private applyEffects(effects: readonly Effect[], now: number): StateChange[] {
    const changes: StateChange[] = [];
    const sec = () => this.state.security;
    const setSec = (patch: Partial<EcuState['security']>) => {
      this.state = { ...this.state, security: { ...this.state.security, ...patch } };
    };
    for (const effect of effects) {
      switch (effect.type) {
        case 'setSession': {
          const from = this.state.session;
          if (from === effect.to) break;
          changes.push({ kind: 'session', from, to: effect.to, message: sc.session(vi.session[from], vi.session[effect.to]) });
          this.state = { ...this.state, session: effect.to };
          // Đổi session thì security bị khóa lại và seed đang chờ không còn giá trị
          changes.push(...this.lockSecurity());
          break;
        }
        case 'lockSecurity':
          changes.push(...this.lockSecurity());
          break;
        case 'writeDid':
          this.state = { ...this.state, didValues: { ...this.state.didValues, [effect.did]: [...effect.data] } };
          changes.push({
            kind: 'didWritten',
            did: effect.did,
            data: [...effect.data],
            message: sc.didWritten(hex(effect.did, 4), hexBytes(effect.data)),
          });
          break;
        case 'storeSeed':
          setSec({ pendingSeed: { level: effect.level, seed: [...effect.seed] } });
          break;
        case 'unlock': {
          const from = this.state.unlockedLevel;
          this.state = { ...this.state, unlockedLevel: effect.level };
          setSec({ pendingSeed: null, failedAttempts: { ...sec().failedAttempts, [effect.level]: 0 } });
          changes.push({ kind: 'security', from, to: effect.level, message: sc.unlocked(effect.level) });
          break;
        }
        case 'keyFailed': {
          const cfg = this.config.security.levels.find((l) => l.level === effect.level);
          const max = cfg?.maxAttempts ?? 3;
          const attempts = (sec().failedAttempts[effect.level] ?? 0) + 1;
          if (attempts >= max) {
            const delay = cfg?.delayMs ?? 10000;
            setSec({
              pendingSeed: null,
              failedAttempts: { ...sec().failedAttempts, [effect.level]: 0 },
              delayUntil: { ...sec().delayUntil, [effect.level]: now + delay },
            });
            changes.push({ kind: 'securityAttempt', level: effect.level, attempts, max, message: sc.delayStarted(effect.level, delay) });
          } else {
            setSec({ pendingSeed: null, failedAttempts: { ...sec().failedAttempts, [effect.level]: attempts } });
            changes.push({ kind: 'securityAttempt', level: effect.level, attempts, max, message: sc.keyFailed(attempts, max) });
          }
          break;
        }
        case 'ecuReset': {
          const from = this.state.session;
          changes.push(...this.lockSecurity());
          this.state = { ...this.state, session: 'default', s3Deadline: null, rebootUntil: now + REBOOT_MS };
          if (from !== 'default') changes.push({ kind: 'session', from, to: 'default', message: sc.session(vi.session[from], vi.session.default) });
          changes.push({ kind: 'reboot', phase: 'start', message: sc.rebootStart(REBOOT_MS) });
          break;
        }
      }
    }
    return changes;
  }

  private lockSecurity(): StateChange[] {
    const from = this.state.unlockedLevel;
    this.state = { ...this.state, unlockedLevel: null, security: { ...this.state.security, pendingSeed: null } };
    return from === null ? [] : [{ kind: 'security', from, to: null, message: sc.securityLocked }];
  }
}
