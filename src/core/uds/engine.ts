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

export function initialEcuState(): EcuState {
  return { session: 'default', unlockedLevel: null, s3Deadline: null, didValues: {} };
}

/**
 * ECU mô phỏng phía server UDS: request PDU → pipeline NRC → handler → response.
 * Không phụ thuộc React; thời gian được truyền vào qua `now` để chạy tất định.
 */
export class UdsServer {
  private state: EcuState = initialEcuState();
  private readonly services: Map<number, ServiceDefinition>;

  constructor(
    private config: VehicleConfig,
    services: readonly ServiceDefinition[] = DEFAULT_SERVICES,
  ) {
    this.services = new Map(services.map((s) => [s.sid, s]));
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

  /** Kiểm tra S3: nếu hết hạn thì quay về default session và khóa security. */
  tick(now: number): StateChange[] {
    if (!isS3Expired(this.state.s3Deadline, now)) return [];
    const changes: StateChange[] = [
      { kind: 'session', from: this.state.session, to: 'default', message: sc.s3Timeout(this.config.timing.s3Ms) },
    ];
    if (this.state.unlockedLevel !== null) {
      changes.push({ kind: 'security', from: this.state.unlockedLevel, to: null, message: sc.securityLocked });
    }
    this.state = { ...this.state, session: 'default', unlockedLevel: null, s3Deadline: null };
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

    if (request.length === 0) {
      return {
        ...base,
        sid: null,
        serviceName: null,
        subFunction: null,
        suppressPosRsp: false,
        steps: [],
        outcome: 'noResponse',
        response: null,
        nrc: null,
        explanation: o.emptyRequest,
      };
    }

    const sid = request[0]!;
    const def = this.services.get(sid);
    const { steps, result } = runPipeline(def, {
      request,
      addressing: ctx.addressing,
      now: ctx.now,
      conditions: ctx.conditions,
      config: this.config,
      state: this.state,
    });

    const hasSub = def?.subFunctions !== undefined && request.length >= 2;
    const subFunction = hasSub ? request[1]! & 0x7f : null;
    const suppressPosRsp = hasSub && (request[1]! & 0x80) !== 0;

    stateChanges.push(...this.applyEffects(result.effects ?? []));

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

  private applyEffects(effects: readonly Effect[]): StateChange[] {
    const changes: StateChange[] = [];
    for (const effect of effects) {
      switch (effect.type) {
        case 'setSession': {
          const from = this.state.session;
          if (from === effect.to) break;
          changes.push({ kind: 'session', from, to: effect.to, message: sc.session(vi.session[from], vi.session[effect.to]) });
          this.state = { ...this.state, session: effect.to };
          // Đổi session thì security bị khóa lại
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
      }
    }
    return changes;
  }

  private lockSecurity(): StateChange[] {
    const from = this.state.unlockedLevel;
    if (from === null) return [];
    this.state = { ...this.state, unlockedLevel: null };
    return [{ kind: 'security', from, to: null, message: sc.securityLocked }];
  }
}
