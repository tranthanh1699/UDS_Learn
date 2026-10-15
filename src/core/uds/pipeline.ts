import { vi } from '../../i18n/vi';
import { hex } from '../util/hex';
import type { SessionKind } from '../vehicle/types';
import { NRC } from './nrc';
import { isLevelUnlocked } from './security';
import {
  resolveSubFunctions,
  type CheckResult,
  type HandlerResult,
  type PipelineStep,
  type ServiceContext,
  type ServiceDefinition,
  type StepId,
  type StepStatus,
} from './types';

const r = vi.uds.reasons;
const titles = vi.uds.stepTitles;

const sessionList = (sessions: readonly SessionKind[]) => sessions.map((s) => vi.session[s]).join(', ');

type GenericCheck = { id: StepId; order: number; run(): CheckResult | { notApplicable: string } };

export interface PipelineRun {
  steps: PipelineStep[];
  result: HandlerResult;
}

/** Ngữ cảnh pipeline: như ServiceContext nhưng pipeline tự gắn pass/fail. */
export type PipelineInput = Omit<ServiceContext, 'pass' | 'fail' | 'subFunction' | 'suppressPosRsp'>;

/**
 * Chạy các bước kiểm tra NRC theo thứ tự (đã đơn giản hóa từ quy tắc chung của ISO 14229-1):
 * 1 SID → 2 session của SID → 3 security của SID → 4 độ dài tối thiểu → 5 sub-function →
 * 6 session của sub-function → 7 security của sub-function → 8 thứ tự request → 9 kiểm tra riêng + thực thi.
 * Bước đầu tiên thất bại quyết định NRC; các bước sau được đánh dấu "skipped".
 */
export function runPipeline(def: ServiceDefinition | undefined, input: PipelineInput): PipelineRun {
  const { request, state } = input;
  const sid = request[0]!;
  const sidHex = hex(sid);
  const hasSub = def?.subFunctions !== undefined;
  const rawSub = hasSub && request.length >= 2 ? request[1]! : null;
  const subFunction = rawSub === null ? null : rawSub & 0x7f;
  const suppressPosRsp = rawSub !== null && (rawSub & 0x80) !== 0;
  const subDef = subFunction === null ? undefined : resolveSubFunctions(def, input.config).find((s) => s.id === subFunction);

  const steps: PipelineStep[] = [];
  const ctx: ServiceContext = {
    ...input,
    subFunction,
    suppressPosRsp,
    pass(title, reason) {
      steps.push({ id: 'serviceSpecific', order: 9, title, status: 'passed', reason });
    },
    fail(title, nrc, reason, effects) {
      steps.push({ id: 'serviceSpecific', order: 9, title, status: 'failed', reason, nrc });
      return { kind: 'negative', nrc, reason, effects };
    },
  };

  const securityCheck = (level: number | null): CheckResult =>
    level === null
      ? { passed: true, reason: r.securityNotRequired }
      : isLevelUnlocked(state, level)
        ? { passed: true, reason: r.securityPass(level) }
        : { passed: false, nrc: NRC.securityAccessDenied, reason: r.securityFail(level) };

  const checks: GenericCheck[] = [
    {
      id: 'sidSupported',
      order: 1,
      run: () =>
        def
          ? { passed: true, reason: r.sidSupportedPass(sidHex, def.name) }
          : { passed: false, nrc: NRC.serviceNotSupported, reason: r.sidSupportedFail(sidHex) },
    },
    {
      id: 'sidSession',
      order: 2,
      run: () =>
        def!.sessions.includes(state.session)
          ? { passed: true, reason: r.sidSessionPass(sidHex, vi.session[state.session]) }
          : {
              passed: false,
              nrc: NRC.serviceNotSupportedInActiveSession,
              reason: r.sidSessionFail(sidHex, vi.session[state.session], sessionList(def!.sessions)),
            },
    },
    { id: 'sidSecurity', order: 3, run: () => securityCheck(def!.securityLevel) },
    {
      id: 'minLength',
      order: 4,
      run: () =>
        request.length >= def!.minLength
          ? { passed: true, reason: r.minLengthPass(request.length, def!.minLength) }
          : {
              passed: false,
              nrc: NRC.incorrectMessageLengthOrInvalidFormat,
              reason: r.minLengthFail(request.length, def!.minLength),
            },
    },
    {
      id: 'subFunctionSupported',
      order: 5,
      run: () => {
        if (!hasSub) return { notApplicable: r.noSubFunction(def!.name) };
        const subHex = hex(subFunction!);
        return subDef
          ? { passed: true, reason: r.subFunctionPass(subHex, subDef.name) }
          : { passed: false, nrc: NRC.subFunctionNotSupported, reason: r.subFunctionFail(subHex) };
      },
    },
    {
      id: 'subFunctionSession',
      order: 6,
      run: () => {
        if (!hasSub) return { notApplicable: r.noSubFunction(def!.name) };
        const subHex = hex(subFunction!);
        return subDef!.sessions.includes(state.session)
          ? { passed: true, reason: r.subFunctionSessionPass(subHex, vi.session[state.session]) }
          : {
              passed: false,
              nrc: NRC.subFunctionNotSupportedInActiveSession,
              reason: r.subFunctionSessionFail(subHex, vi.session[state.session], sessionList(subDef!.sessions)),
            };
      },
    },
    {
      id: 'subFunctionSecurity',
      order: 7,
      run: () => (hasSub ? securityCheck(subDef!.securityLevel) : { notApplicable: r.noSubFunction(def!.name) }),
    },
    {
      id: 'sequence',
      order: 8,
      run: () => (def!.checkSequence ? def!.checkSequence(ctx) : { notApplicable: r.sequenceNotRequired }),
    },
  ];

  for (const [i, check] of checks.entries()) {
    const res = check.run();
    const title = titles[check.id];
    if ('notApplicable' in res) {
      steps.push({ id: check.id, order: check.order, title, status: 'notApplicable', reason: res.notApplicable });
      continue;
    }
    if (res.passed) {
      steps.push({ id: check.id, order: check.order, title, status: 'passed', reason: res.reason });
      continue;
    }
    const nrc = res.nrc ?? NRC.generalReject;
    steps.push({ id: check.id, order: check.order, title, status: 'failed', reason: res.reason, nrc });
    for (const rest of checks.slice(i + 1)) steps.push(skipped(rest.id, rest.order));
    steps.push(skipped('serviceSpecific', 9));
    return { steps, result: { kind: 'negative', nrc, reason: res.reason } };
  }

  return { steps, result: def!.handle(ctx) };
}

function skipped(id: StepId, order: number): PipelineStep {
  const status: StepStatus = 'skipped';
  return { id, order, title: titles[id], status, reason: r.skipped };
}
