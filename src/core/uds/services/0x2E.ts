import { vi } from '../../../i18n/vi';
import { hex } from '../../util/hex';
import { findDid } from '../did';
import { NRC } from '../nrc';
import { isLevelUnlocked } from '../security';
import { NON_DEFAULT_SESSIONS } from '../session';
import type { ServiceDefinition } from '../types';

const t = vi.uds.service2E;

/** Khoảng điện áp ECU chấp nhận ghi bộ nhớ. */
export const WRITE_MIN_VOLTAGE = 11.0;
export const WRITE_MAX_VOLTAGE = 15.5;

/**
 * 0x2E WriteDataByIdentifier (ISO 14229-1, mục 11.7).
 * Request: 2E DID_hi DID_lo data...; response: 6E DID_hi DID_lo.
 * Thứ tự kiểm tra riêng: DID ghi được (0x31) → security (0x33) → độ dài dữ liệu (0x13) → điện áp (0x93/0x92).
 */
export const writeDataByIdentifier: ServiceDefinition = {
  sid: 0x2e,
  name: 'WriteDataByIdentifier',
  minLength: 4,
  sessions: NON_DEFAULT_SESSIONS,
  securityLevel: null,
  handle(ctx) {
    const { request, config, state, conditions } = ctx;
    const did = (request[1]! << 8) | request[2]!;
    const id = hex(did, 4);
    const def = findDid(config.dids, did);
    if (!def) return ctx.fail(t.supportTitle, NRC.requestOutOfRange, t.unknownDid(id));
    if (!def.writable) return ctx.fail(t.supportTitle, NRC.requestOutOfRange, t.readOnly(id));
    if (!def.writeSessions.includes(state.session)) {
      const allowed = def.writeSessions.map((s) => vi.session[s]).join(', ');
      return ctx.fail(t.supportTitle, NRC.requestOutOfRange, t.wrongSession(id, vi.session[state.session], allowed));
    }
    ctx.pass(t.supportTitle, t.supportPass(id, def.name));

    if (!isLevelUnlocked(state, def.writeSecurityLevel)) {
      return ctx.fail(t.securityTitle, NRC.securityAccessDenied, t.securityFail(id, def.writeSecurityLevel!));
    }
    ctx.pass(t.securityTitle, def.writeSecurityLevel === null ? t.securityNone : t.securityPass(def.writeSecurityLevel));

    const data = request.slice(3);
    if (data.length !== def.length) return ctx.fail(t.lengthTitle, NRC.incorrectMessageLengthOrInvalidFormat, t.lengthFail(data.length, def.length));
    ctx.pass(t.lengthTitle, t.lengthPass(data.length));

    const v = conditions.batteryVoltage;
    const [vs, min, max] = [v.toFixed(1), WRITE_MIN_VOLTAGE.toFixed(1), WRITE_MAX_VOLTAGE.toFixed(1)];
    if (v < WRITE_MIN_VOLTAGE) return ctx.fail(t.voltageTitle, NRC.voltageTooLow, t.voltageLow(vs, min));
    if (v > WRITE_MAX_VOLTAGE) return ctx.fail(t.voltageTitle, NRC.voltageTooHigh, t.voltageHigh(vs, max));
    ctx.pass(t.voltageTitle, t.voltagePass(vs, min, max));

    ctx.pass(t.writeTitle, t.writePass(id));
    return { kind: 'positive', response: [0x6e, request[1]!, request[2]!], effects: [{ type: 'writeDid', did, data }] };
  },
};
