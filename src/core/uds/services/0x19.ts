import { vi } from '../../../i18n/vi';
import { formatDtc } from '../../dtc/catalog';
import { hex } from '../../util/hex';
import type { VehicleConditions } from '../../vehicle/types';
import { NRC } from '../nrc';
import { ALL_SESSIONS } from '../session';
import type { DtcRecordView, HandlerResult, ServiceContext, ServiceDefinition, SubFunctionDefinition } from '../types';

const t = vi.uds.service19;

/** ECU mô phỏng hỗ trợ cả 8 bit của status byte. */
export const DTC_STATUS_AVAILABILITY_MASK = 0xff;
/**
 * DTCFormatIdentifier trong response 59 01: 0x01 = ISO_14229-1_DTCFormat.
 * TODO: verify against ISO 14229-1 (bảng giá trị DTCFormatIdentifier).
 */
export const DTC_FORMAT_ISO14229 = 0x01;
export const SNAPSHOT_RECORD = 0x01;
export const EXT_RECORD_OCCURRENCE = 0x01;
export const EXT_RECORD_AGING = 0x02;
const ALL_RECORDS = 0xff;

/** DID chứa trong snapshot (cùng định dạng với DID dữ liệu sống của 0x22). */
export const SNAPSHOT_DIDS = [0x0100, 0x0101, 0x0102] as const;

export function encodeSnapshot(c: VehicleConditions): { did: number; data: number[] }[] {
  const rpm = Math.min(0xffff, Math.max(0, Math.round(c.rpm)));
  return [
    { did: 0x0100, data: [c.speedValid === false ? 0xff : Math.min(0xfe, Math.max(0, Math.round(c.speedKmh)))] },
    { did: 0x0101, data: [rpm >> 8, rpm & 0xff] },
    { did: 0x0102, data: [Math.min(0xff, Math.max(0, Math.round(c.batteryVoltage * 10)))] },
  ];
}

const dtcBytes = (dtc: number) => [(dtc >> 16) & 0xff, (dtc >> 8) & 0xff, dtc & 0xff];

const SUBS: SubFunctionDefinition[] = [
  { id: 0x01, name: 'reportNumberOfDTCByStatusMask', sessions: ALL_SESSIONS, securityLevel: null },
  { id: 0x02, name: 'reportDTCByStatusMask', sessions: ALL_SESSIONS, securityLevel: null },
  { id: 0x04, name: 'reportDTCSnapshotRecordByDTCNumber', sessions: ALL_SESSIONS, securityLevel: null },
  { id: 0x06, name: 'reportDTCExtDataRecordByDTCNumber', sessions: ALL_SESSIONS, securityLevel: null },
  { id: 0x0a, name: 'reportSupportedDTC', sessions: ALL_SESSIONS, securityLevel: null },
];

/** Độ dài request đúng cho từng sub-function. */
const REQUEST_LENGTH: Record<number, number> = { 0x01: 3, 0x02: 3, 0x04: 6, 0x06: 6, 0x0a: 2 };

function finish(ctx: ServiceContext, response: number[]): HandlerResult {
  const max = ctx.config.limits.maxResponseLength;
  if (response.length > max) return ctx.fail(t.responseTitle, NRC.responseTooLong, t.responseFail(response.length, max));
  ctx.pass(t.responseTitle, t.responsePass(response.length));
  return { kind: 'positive', response };
}

function findDtc(ctx: ServiceContext): DtcRecordView | HandlerResult {
  const r = ctx.request;
  const dtc = (r[2]! << 16) | (r[3]! << 8) | r[4]!;
  const rec = ctx.dtcs.find((d) => d.dtc === dtc);
  if (!rec) return ctx.fail(t.dtcTitle, NRC.requestOutOfRange, t.dtcFail(formatDtc(dtc)));
  ctx.pass(t.dtcTitle, t.dtcPass(formatDtc(dtc)));
  return rec;
}

/**
 * 0x19 ReadDTCInformation (ISO 14229-1:2020, mục 12.3 — TODO: verify against ISO 14229-1).
 * Simulator hỗ trợ sub-function 01, 02, 04, 06, 0A; dữ liệu lấy từ bộ nhớ DTC (Dem) của ECU.
 */
export const readDtcInformation: ServiceDefinition = {
  sid: 0x19,
  name: 'ReadDTCInformation',
  minLength: 2,
  sessions: ALL_SESSIONS,
  securityLevel: null,
  subFunctions: SUBS,
  handle(ctx) {
    const { request: r, dtcs } = ctx;
    const sub = ctx.subFunction!;
    const want = REQUEST_LENGTH[sub]!;
    if (r.length !== want) return ctx.fail(t.lengthTitle, NRC.incorrectMessageLengthOrInvalidFormat, t.lengthFail(r.length, want));
    ctx.pass(t.lengthTitle, t.lengthPass(want));

    switch (sub) {
      case 0x01:
      case 0x02: {
        const mask = r[2]!;
        const matched = dtcs.filter((d) => (d.status & mask & DTC_STATUS_AVAILABILITY_MASK) !== 0);
        ctx.pass(t.filterTitle, t.filterPass(hex(mask), matched.length, dtcs.length));
        if (sub === 0x01) {
          return finish(ctx, [0x59, 0x01, DTC_STATUS_AVAILABILITY_MASK, DTC_FORMAT_ISO14229, matched.length >> 8, matched.length & 0xff]);
        }
        return finish(ctx, [0x59, 0x02, DTC_STATUS_AVAILABILITY_MASK, ...matched.flatMap((d) => [...dtcBytes(d.dtc), d.status])]);
      }
      case 0x0a:
        ctx.pass(t.filterTitle, t.supportedPass(dtcs.length));
        return finish(ctx, [0x59, 0x0a, DTC_STATUS_AVAILABILITY_MASK, ...dtcs.flatMap((d) => [...dtcBytes(d.dtc), d.status])]);
      case 0x04: {
        const found = findDtc(ctx);
        if ('kind' in found) return found;
        const rec = r[5]!;
        if (rec !== SNAPSHOT_RECORD && rec !== ALL_RECORDS) return ctx.fail(t.recordTitle, NRC.requestOutOfRange, t.snapshotRecordFail(hex(rec)));
        const response = [0x59, 0x04, ...dtcBytes(found.dtc), found.status];
        if (found.snapshot) {
          const dids = encodeSnapshot(found.snapshot);
          response.push(SNAPSHOT_RECORD, dids.length, ...dids.flatMap((d) => [d.did >> 8, d.did & 0xff, ...d.data]));
          ctx.pass(t.recordTitle, t.snapshotPresent);
        } else {
          ctx.pass(t.recordTitle, t.snapshotNone);
        }
        return finish(ctx, response);
      }
      case 0x06: {
        const found = findDtc(ctx);
        if ('kind' in found) return found;
        const rec = r[5]!;
        if (rec !== EXT_RECORD_OCCURRENCE && rec !== EXT_RECORD_AGING && rec !== ALL_RECORDS) {
          return ctx.fail(t.recordTitle, NRC.requestOutOfRange, t.extRecordFail(hex(rec)));
        }
        const response = [0x59, 0x06, ...dtcBytes(found.dtc), found.status];
        const list: string[] = [];
        if (rec === EXT_RECORD_OCCURRENCE || rec === ALL_RECORDS) {
          response.push(EXT_RECORD_OCCURRENCE, Math.min(0xff, found.occurrence));
          list.push('0x01');
        }
        if (rec === EXT_RECORD_AGING || rec === ALL_RECORDS) {
          response.push(EXT_RECORD_AGING, Math.min(0xff, found.agingCounter));
          list.push('0x02');
        }
        ctx.pass(t.recordTitle, t.extPass(list.join(', ')));
        return finish(ctx, response);
      }
    }
    // Không xảy ra: pipeline đã chặn sub-function không có trong danh sách
    return ctx.fail(t.lengthTitle, NRC.subFunctionNotSupported, vi.uds.reasons.subFunctionFail(hex(sub)));
  },
};
