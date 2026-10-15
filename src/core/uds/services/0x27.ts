import { vi } from '../../../i18n/vi';
import { hexBytes } from '../../util/hex';
import type { VehicleConfig } from '../../vehicle/types';
import { computeKey } from '../keyAlgorithm';
import { NRC } from '../nrc';
import { NON_DEFAULT_SESSIONS } from '../session';
import type { ServiceDefinition, SubFunctionDefinition } from '../types';

const t = vi.uds.service27;

/** Level tương ứng với sub-function: lẻ = requestSeed của chính level đó, chẵn = sendKey của level (sub − 1). */
export const levelOfSubFunction = (sub: number) => (sub % 2 === 1 ? sub : sub - 1);

function subFunctionsFor(config: VehicleConfig): SubFunctionDefinition[] {
  return config.security.levels.flatMap((l) => [
    { id: l.level, name: t.subRequestSeed(l.level), sessions: NON_DEFAULT_SESSIONS, securityLevel: null },
    { id: l.level + 1, name: t.subSendKey(l.level), sessions: NON_DEFAULT_SESSIONS, securityLevel: null },
  ]);
}

/**
 * 0x27 SecurityAccess (ISO 14229-1, mục 10.4).
 * requestSeed: 27 <lẻ> → 67 <lẻ> <seed>; sendKey: 27 <chẵn> <key> → 67 <chẵn>.
 */
export const securityAccess: ServiceDefinition = {
  sid: 0x27,
  name: 'SecurityAccess',
  minLength: 2,
  sessions: NON_DEFAULT_SESSIONS,
  securityLevel: null,
  subFunctions: subFunctionsFor,

  checkSequence(ctx) {
    const sub = ctx.subFunction!;
    if (sub % 2 === 1) return { passed: true, reason: t.sequenceNotNeeded };
    const level = levelOfSubFunction(sub);
    const pending = ctx.state.security.pendingSeed;
    if (!pending) return { passed: false, nrc: NRC.requestSequenceError, reason: t.sequenceNoSeed };
    if (pending.level !== level) return { passed: false, nrc: NRC.requestSequenceError, reason: t.sequenceOtherLevel(pending.level, level) };
    return { passed: true, reason: t.sequencePass(level) };
  },

  handle(ctx) {
    const { request, state, config, now } = ctx;
    const sub = ctx.subFunction!;
    const level = levelOfSubFunction(sub);
    const cfg = config.security.levels.find((l) => l.level === level);
    if (!cfg) return ctx.fail(t.seedTitle, NRC.generalReject, t.noLevelConfig);

    if (sub % 2 === 1) {
      // requestSeed
      if (request.length !== 2) return ctx.fail(t.lengthTitle, NRC.incorrectMessageLengthOrInvalidFormat, t.seedLengthFail(request.length));
      ctx.pass(t.lengthTitle, t.seedLengthPass);
      const until = state.security.delayUntil[level];
      if (until !== undefined && now < until) {
        return ctx.fail(t.delayTitle, NRC.requiredTimeDelayNotExpired, t.delayFail(((until - now) / 1000).toFixed(1)));
      }
      ctx.pass(t.delayTitle, t.delayPass);
      if (state.unlockedLevel === level) {
        ctx.pass(t.seedTitle, t.alreadyUnlocked(level));
        return { kind: 'positive', response: [0x67, sub, ...new Array<number>(cfg.seedLength).fill(0)] };
      }
      const seed = ctx.randomBytes(cfg.seedLength);
      // Seed toàn 0 có nghĩa "đã mở khóa" nên không được dùng làm seed thật
      if (!seed.some((b) => b !== 0)) seed[seed.length - 1] = 0x01;
      ctx.pass(t.seedTitle, t.seedIssued(hexBytes(seed)));
      return { kind: 'positive', response: [0x67, sub, ...seed], effects: [{ type: 'storeSeed', level, seed }] };
    }

    // sendKey
    const wantLength = 2 + cfg.seedLength;
    if (request.length !== wantLength) return ctx.fail(t.lengthTitle, NRC.incorrectMessageLengthOrInvalidFormat, t.keyLengthFail(request.length, wantLength));
    ctx.pass(t.lengthTitle, t.keyLengthPass(cfg.seedLength));

    const expected = computeKey(state.security.pendingSeed!.seed, cfg);
    const key = request.slice(2);
    if (expected.ok && expected.key.every((b, i) => b === key[i])) {
      ctx.pass(t.keyTitle, t.keyPass(level));
      return { kind: 'positive', response: [0x67, sub], effects: [{ type: 'unlock', level }] };
    }
    const attempts = (state.security.failedAttempts[level] ?? 0) + 1;
    const effects = [{ type: 'keyFailed' as const, level }];
    const expectedText = hexBytes(expected.key);
    if (attempts >= cfg.maxAttempts) {
      return ctx.fail(t.keyTitle, NRC.exceededNumberOfAttempts, t.keyExceeded(cfg.maxAttempts, cfg.delayMs / 1000, expectedText), effects);
    }
    return ctx.fail(t.keyTitle, NRC.invalidKey, t.keyFail(attempts, cfg.maxAttempts, expectedText), effects);
  },
};
