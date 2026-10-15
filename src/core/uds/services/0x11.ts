import { vi } from '../../../i18n/vi';
import { NRC } from '../nrc';
import { ALL_SESSIONS } from '../session';
import type { ServiceDefinition, SubFunctionDefinition } from '../types';

const t = vi.uds.service11;

const RESET_TYPES: SubFunctionDefinition[] = [
  { id: 0x01, name: 'hardReset', sessions: ALL_SESSIONS, securityLevel: null },
  { id: 0x02, name: 'keyOffOnReset', sessions: ALL_SESSIONS, securityLevel: null },
  { id: 0x03, name: 'softReset', sessions: ALL_SESSIONS, securityLevel: null },
];

/**
 * 0x11 ECUReset (ISO 14229-1, mục 10.3).
 * Simulator hỗ trợ 01 hardReset, 02 keyOffOnReset, 03 softReset; 04/05 (rapid power shutdown) → NRC 0x12.
 * Positive response được gửi trước, sau đó ECU khởi động lại.
 */
export const ecuReset: ServiceDefinition = {
  sid: 0x11,
  name: 'ECUReset',
  minLength: 2,
  sessions: ALL_SESSIONS,
  securityLevel: null,
  subFunctions: RESET_TYPES,
  handle(ctx) {
    const { request, conditions, config } = ctx;
    if (request.length !== 2) return ctx.fail(t.lengthTitle, NRC.incorrectMessageLengthOrInvalidFormat, t.lengthFail(request.length));
    ctx.pass(t.lengthTitle, t.lengthPass);

    if (!config.ecuReset.requireStandstill) ctx.pass(t.speedTitle, t.speedNotRequired);
    else if (conditions.speedValid === false) return ctx.fail(t.speedTitle, NRC.conditionsNotCorrect, t.speedInvalid);
    else if (conditions.speedKmh > 0) return ctx.fail(t.speedTitle, NRC.vehicleSpeedTooHigh, t.speedFail(conditions.speedKmh));
    else ctx.pass(t.speedTitle, t.speedPass);

    if (!config.ecuReset.requireEngineOff) ctx.pass(t.engineTitle, t.engineNotRequired);
    else if (conditions.engineRunning) return ctx.fail(t.engineTitle, NRC.engineIsRunning, t.engineFail(conditions.rpm));
    else ctx.pass(t.engineTitle, t.enginePass);

    const sub = ctx.subFunction!;
    ctx.pass(t.executeTitle, t.executePass(RESET_TYPES.find((s) => s.id === sub)!.name));
    return { kind: 'positive', response: [0x51, sub], effects: [{ type: 'ecuReset', resetType: sub }] };
  },
};
