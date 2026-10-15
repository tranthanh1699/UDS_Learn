import { vi } from '../../../i18n/vi';
import { NRC } from '../nrc';
import { ALL_SESSIONS, encodeSessionTiming, sessionFromId } from '../session';
import type { ServiceDefinition } from '../types';

const t = vi.uds.service10;

/** 0x10 DiagnosticSessionControl (ISO 14229-1, mục 10.2). */
export const diagnosticSessionControl: ServiceDefinition = {
  sid: 0x10,
  name: 'DiagnosticSessionControl',
  minLength: 2,
  sessions: ALL_SESSIONS,
  securityLevel: null,
  subFunctions: [
    { id: 0x01, name: 'defaultSession', sessions: ALL_SESSIONS, securityLevel: null },
    { id: 0x02, name: 'programmingSession', sessions: ALL_SESSIONS, securityLevel: null },
    { id: 0x03, name: 'extendedDiagnosticSession', sessions: ALL_SESSIONS, securityLevel: null },
  ],
  handle(ctx) {
    if (ctx.request.length !== 2) {
      return ctx.fail(t.lengthTitle, NRC.incorrectMessageLengthOrInvalidFormat, t.lengthFail(ctx.request.length));
    }
    ctx.pass(t.lengthTitle, t.lengthPass);

    const to = sessionFromId(ctx.subFunction!)!;
    const { timing } = ctx.config;
    ctx.pass(t.executeTitle, t.executePass(vi.session[to], timing.p2Ms, timing.p2StarMs));
    return {
      kind: 'positive',
      response: [0x50, ctx.subFunction!, ...encodeSessionTiming(timing)],
      effects: [{ type: 'setSession', to }],
    };
  },
};
