import { vi } from '../../../i18n/vi';
import { hex } from '../../util/hex';
import { findDid, readDidData } from '../did';
import { NRC } from '../nrc';
import { isLevelUnlocked } from '../security';
import { ALL_SESSIONS } from '../session';
import type { ServiceDefinition } from '../types';

const t = vi.uds.service22;
const didList = (dids: readonly number[]) => dids.map((d) => `0x${hex(d, 4)}`).join(', ');

/**
 * 0x22 ReadDataByIdentifier (ISO 14229-1, mục 11.2).
 * Request: 22 DID_hi DID_lo [DID_hi DID_lo ...]; response: 62 DID data [DID data ...].
 * DID không hỗ trợ trong session hiện tại bị bỏ qua; nếu không còn DID nào → NRC 0x31.
 */
export const readDataByIdentifier: ServiceDefinition = {
  sid: 0x22,
  name: 'ReadDataByIdentifier',
  minLength: 3,
  sessions: ALL_SESSIONS,
  securityLevel: null,
  handle(ctx) {
    const { request, config, state, conditions } = ctx;

    // Độ dài / định dạng
    const paramBytes = request.length - 1;
    if (paramBytes % 2 !== 0) {
      return ctx.fail(t.formatTitle, NRC.incorrectMessageLengthOrInvalidFormat, t.formatOdd(paramBytes));
    }
    const requested: number[] = [];
    for (let i = 1; i < request.length; i += 2) requested.push((request[i]! << 8) | request[i + 1]!);
    if (requested.length > config.limits.maxDidsPerRead) {
      return ctx.fail(
        t.formatTitle,
        NRC.incorrectMessageLengthOrInvalidFormat,
        t.formatTooMany(requested.length, config.limits.maxDidsPerRead),
      );
    }
    ctx.pass(t.formatTitle, t.formatPass(requested.length));

    // DID có hỗ trợ trong session hiện tại?
    const supported = requested
      .map((did) => findDid(config.dids, did))
      .filter((d) => d !== undefined && d.readSessions.includes(state.session))
      .map((d) => d!);
    if (supported.length === 0) {
      return ctx.fail(t.supportTitle, NRC.requestOutOfRange, t.supportFail(didList(requested), vi.session[state.session]));
    }
    const supportedIds = supported.map((d) => d.did);
    const skipped = requested.filter((d) => !supportedIds.includes(d));
    ctx.pass(
      t.supportTitle,
      skipped.length > 0 ? t.supportPartial(didList(supportedIds), didList(skipped)) : t.supportPass(didList(supportedIds)),
    );

    // Security của từng DID
    const locked = supported.find((d) => !isLevelUnlocked(state, d.readSecurityLevel));
    if (locked) {
      return ctx.fail(t.securityTitle, NRC.securityAccessDenied, t.securityFail(hex(locked.did, 4), locked.readSecurityLevel!));
    }
    ctx.pass(t.securityTitle, supported.some((d) => d.readSecurityLevel !== null) ? t.securityPass : t.securityNone);

    // Ghép response
    const response = [0x62];
    for (const def of supported) response.push(def.did >> 8, def.did & 0xff, ...readDidData(def, state, conditions));
    if (response.length > config.limits.maxResponseLength) {
      return ctx.fail(t.lengthTitle, NRC.responseTooLong, t.lengthFail(response.length, config.limits.maxResponseLength));
    }
    ctx.pass(t.lengthTitle, t.lengthPass(response.length));
    return { kind: 'positive', response };
  },
};
