import { vi } from '../../../i18n/vi';
import { NRC } from '../nrc';
import { ALL_SESSIONS } from '../session';
import type { ServiceDefinition } from '../types';

const t = vi.uds.service3E;

/** 0x3E TesterPresent (ISO 14229-1:2020, mục 10.7). Engine tự khởi động lại S3 sau mỗi request. */
export const testerPresent: ServiceDefinition = {
  sid: 0x3e,
  name: 'TesterPresent',
  minLength: 2,
  sessions: ALL_SESSIONS,
  securityLevel: null,
  subFunctions: [{ id: 0x00, name: 'zeroSubFunction', sessions: ALL_SESSIONS, securityLevel: null }],
  handle(ctx) {
    if (ctx.request.length !== 2) {
      return ctx.fail(t.lengthTitle, NRC.incorrectMessageLengthOrInvalidFormat, t.lengthFail(ctx.request.length));
    }
    ctx.pass(t.lengthTitle, t.lengthPass);
    ctx.pass(t.executeTitle, t.executePass);
    return { kind: 'positive', response: [0x7e, ctx.subFunction!] };
  },
};
