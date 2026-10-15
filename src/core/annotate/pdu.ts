import { vi } from '../../i18n/vi';
import { formatDtc } from '../dtc/catalog';
import { STATUS_BIT_NAMES } from '../dtc/types';
import { NEGATIVE_RESPONSE_SID, nrcName } from '../uds/nrc';
import { NRC_ISO_REF, SERVICE_ISO_REFS, serviceName } from '../uds/serviceNames';
import { DEFAULT_SERVICES } from '../uds/services';
import { levelOfSubFunction } from '../uds/services/0x27';
import { resolveSubFunctions } from '../uds/types';
import { hex, hexBytes } from '../util/hex';
import type { DidDefinition, VehicleConfig } from '../vehicle/types';
import type { BitInfo, PduField } from './types';

const f = vi.annotate.fields;
const m = vi.annotate.meanings;
const b = vi.annotate.bits;

export interface PduContext {
  direction: 'request' | 'response';
  config: VehicleConfig;
}

const bin = (n: number, width: number) => n.toString(2).padStart(width, '0');

function subFunctionName(sid: number, sub: number, config: VehicleConfig): string | undefined {
  return resolveSubFunctions(DEFAULT_SERVICES.find((s) => s.sid === sid), config).find((s) => s.id === sub)?.name;
}

function hasSubFunction(sid: number): boolean {
  return DEFAULT_SERVICES.find((s) => s.sid === sid)?.subFunctions !== undefined;
}

/** Hiển thị dữ liệu DID theo định dạng khai báo. */
export function decodeDidValue(def: DidDefinition, data: readonly number[]): string {
  switch (def.format) {
    case 'ascii':
      return `"${data.map((c) => (c >= 0x20 && c < 0x7f ? String.fromCharCode(c) : '.')).join('')}"`;
    case 'uint': {
      const raw = data.reduce((acc, x) => acc * 256 + x, 0);
      const value = raw * (def.factor ?? 1);
      return `${Number(value.toFixed(3))}${def.unit ? ` ${def.unit}` : ''}`;
    }
    case 'bcd':
      return data.map((x) => hex(x)).join(' ');
    case 'hex':
      return hexBytes(data);
  }
}

function sidField(pdu: readonly number[], ctx: PduContext): PduField {
  const sid = pdu[0]!;
  if (ctx.direction === 'request') {
    const name = serviceName(sid);
    return {
      start: 0,
      length: 1,
      kind: 'sid',
      fieldId: 'sid',
      field: f.sid,
      meaning: name ? m.requestSid(hex(sid), name) : m.unknownSid(hex(sid)),
      isoRef: SERVICE_ISO_REFS[sid],
    };
  }
  if (sid === NEGATIVE_RESPONSE_SID) {
    return { start: 0, length: 1, kind: 'sid', fieldId: 'sid', field: f.negativeSid, meaning: m.negativeSid, isoRef: NRC_ISO_REF };
  }
  const reqSid = sid - 0x40;
  return {
    start: 0,
    length: 1,
    kind: 'sid',
    fieldId: 'sid',
    field: f.responseSid,
    meaning: m.positiveSid(hex(sid), hex(reqSid), serviceName(reqSid) ?? '?'),
    bits: [{ range: '6', name: b.responseBit, value: bin((sid >> 6) & 1, 1), meaning: b.responseOn }],
    isoRef: SERVICE_ISO_REFS[reqSid],
  };
}

function subFunctionField(sid: number, raw: number, echo: boolean, config: VehicleConfig): PduField {
  const sub = raw & 0x7f;
  const name = subFunctionName(sid, sub, config);
  const bits: BitInfo[] = [];
  if (!echo) {
    bits.push({
      range: '7',
      name: b.suppressBit,
      value: bin(raw >> 7, 1),
      meaning: raw & 0x80 ? b.suppressOn : b.suppressOff,
    });
  }
  bits.push({ range: '6–0', name: b.subValue, value: bin(sub, 7), meaning: `0x${hex(sub)}${name ? ` = ${name}` : ''}` });
  return {
    start: 1,
    length: 1,
    kind: 'sub',
    fieldId: 'sub',
    field: f.subFunction,
    meaning: name
      ? echo
        ? m.subFunctionEcho(hex(sub), name)
        : m.subFunction(hex(sub), name)
      : m.unknownSubFunction(hex(sub)),
    bits,
    isoRef: SERVICE_ISO_REFS[sid],
  };
}

function didField(start: number, did: number, config: VehicleConfig, id: string, sid = 0x22): { field: PduField; def?: DidDefinition } {
  const def = config.dids.find((d) => d.did === did);
  return {
    def,
    field: {
      start,
      length: 2,
      kind: 'did',
      fieldId: id,
      field: f.did,
      meaning: def ? m.did(hex(did, 4), def.name) : m.unknownDid(hex(did, 4)),
      isoRef: SERVICE_ISO_REFS[sid],
    },
  };
}

function rest(pdu: readonly number[], start: number, kind: 'data' | 'extra' = 'data'): PduField[] {
  if (start >= pdu.length) return [];
  return [
    {
      start,
      length: pdu.length - start,
      kind: 'data',
      fieldId: `rest-${start}`,
      field: kind === 'extra' ? f.extra : f.data,
      meaning: kind === 'extra' ? m.extra : m.data,
    },
  ];
}

/** Chia PDU UDS thành các trường có chú thích tiếng Việt. */
export function annotatePdu(pdu: readonly number[], ctx: PduContext): PduField[] {
  if (pdu.length === 0) return [];
  const fields: PduField[] = [sidField(pdu, ctx)];
  const sid = pdu[0]!;

  // Negative response: 7F SID NRC
  if (ctx.direction === 'response' && sid === NEGATIVE_RESPONSE_SID) {
    if (pdu.length > 1) {
      const rej = pdu[1]!;
      fields.push({
        start: 1,
        length: 1,
        kind: 'sid',
        fieldId: 'rejectedSid',
        field: f.rejectedSid,
        meaning: m.rejectedSid(hex(rej), serviceName(rej) ?? '?'),
      });
    }
    if (pdu.length > 2) {
      const nrc = pdu[2]!;
      fields.push({
        start: 2,
        length: 1,
        kind: 'nrc',
        fieldId: 'nrc',
        field: f.nrc,
        meaning: m.nrc(hex(nrc), nrcName(nrc), vi.nrc[nrc]?.meaning ?? ''),
        isoRef: NRC_ISO_REF,
      });
    }
    return [...fields, ...rest(pdu, 3, 'extra')];
  }

  const reqSid = ctx.direction === 'request' ? sid : sid - 0x40;
  let pos = 1;
  if (hasSubFunction(reqSid) && pdu.length > 1) {
    fields.push(subFunctionField(reqSid, pdu[1]!, ctx.direction === 'response', ctx.config));
    pos = 2;
  }

  // Phần tham số riêng của từng service
  if (reqSid === 0x10 && ctx.direction === 'response' && pdu.length >= 6) {
    const p2 = (pdu[2]! << 8) | pdu[3]!;
    const p2Star = ((pdu[4]! << 8) | pdu[5]!) * 10;
    fields.push(
      { start: 2, length: 2, kind: 'data', fieldId: 'p2', field: f.p2, meaning: m.p2(p2), isoRef: SERVICE_ISO_REFS[0x10] },
      { start: 4, length: 2, kind: 'data', fieldId: 'p2star', field: f.p2Star, meaning: m.p2Star(p2Star), isoRef: SERVICE_ISO_REFS[0x10] },
    );
    return [...fields, ...rest(pdu, 6, 'extra')];
  }

  if (reqSid === 0x22 && ctx.direction === 'request') {
    for (; pos + 1 < pdu.length; pos += 2) {
      fields.push(didField(pos, (pdu[pos]! << 8) | pdu[pos + 1]!, ctx.config, `did-${pos}`).field);
    }
    return [...fields, ...rest(pdu, pos, 'extra')];
  }

  if (reqSid === 0x22 && ctx.direction === 'response') {
    while (pos + 1 < pdu.length) {
      const did = (pdu[pos]! << 8) | pdu[pos + 1]!;
      const { field, def } = didField(pos, did, ctx.config, `did-${pos}`);
      fields.push(field);
      pos += 2;
      if (!def) return [...fields, ...rest(pdu, pos)];
      const len = Math.min(def.length, pdu.length - pos);
      const data = pdu.slice(pos, pos + len);
      fields.push({
        start: pos,
        length: len,
        kind: 'data',
        fieldId: `data-${pos}`,
        field: f.didData,
        meaning: m.didData(def.name, decodeDidValue(def, data)),
        byteNotes: def.format === 'ascii' ? data.map((c) => m.asciiChar(String.fromCharCode(c))) : undefined,
        isoRef: SERVICE_ISO_REFS[0x22],
      });
      pos += len;
    }
    return [...fields, ...rest(pdu, pos)];
  }

  // 0x27: seed trong response requestSeed, key trong request sendKey
  if (reqSid === 0x27 && pos === 2 && pdu.length > 2) {
    const sub = pdu[1]! & 0x7f;
    const level = levelOfSubFunction(sub);
    const isSeedResponse = ctx.direction === 'response' && sub % 2 === 1;
    const isKeyRequest = ctx.direction === 'request' && sub % 2 === 0;
    if (isSeedResponse || isKeyRequest) {
      const value = pdu.slice(2);
      fields.push({
        start: 2,
        length: value.length,
        kind: 'data',
        fieldId: isSeedResponse ? 'seed' : 'key',
        field: isSeedResponse ? f.seed : f.key,
        meaning: isSeedResponse ? (value.every((x) => x === 0) ? m.seedZero(level) : m.seed(level)) : m.key(level),
        isoRef: SERVICE_ISO_REFS[0x27],
      });
      return fields;
    }
  }

  // 0x2E: request 2E DID data..., response 6E DID
  if (reqSid === 0x2e && pdu.length >= 3) {
    const { field, def } = didField(1, (pdu[1]! << 8) | pdu[2]!, ctx.config, 'did', 0x2e);
    fields.push(field);
    if (ctx.direction === 'response') return [...fields, ...rest(pdu, 3, 'extra')];
    if (pdu.length > 3) {
      const data = pdu.slice(3);
      fields.push({
        start: 3,
        length: data.length,
        kind: 'data',
        fieldId: 'writeData',
        field: f.writeData,
        meaning: def ? m.writeData(def.name, decodeDidValue(def, data)) : m.data,
        byteNotes: def?.format === 'ascii' ? data.map((c) => m.asciiChar(String.fromCharCode(c))) : undefined,
        isoRef: SERVICE_ISO_REFS[0x2e],
      });
    }
    return fields;
  }

  if (reqSid === 0x19 && pos === 2) return [...fields, ...annotate19(pdu, ctx)];

  const extra = (reqSid === 0x10 || reqSid === 0x3e || reqSid === 0x11) && (ctx.direction === 'request' || reqSid === 0x11);
  return [...fields, ...rest(pdu, pos, extra ? 'extra' : 'data')];
}


/** Phân tích 8 bit của một status byte / status mask. */
function statusBits(value: number): BitInfo[] {
  return [7, 6, 5, 4, 3, 2, 1, 0].map((bit) => ({
    range: String(bit),
    name: STATUS_BIT_NAMES[bit]!,
    value: String((value >> bit) & 1),
    meaning: vi.dtc.bits[bit]!,
  }));
}

const ISO19 = SERVICE_ISO_REFS[0x19];

/** Trường riêng của 0x19 ReadDTCInformation (sau SID và sub-function). */
function annotate19(pdu: readonly number[], ctx: PduContext): PduField[] {
  const sub = pdu[1]! & 0x7f;
  const out: PduField[] = [];
  const one = (start: number, fieldId: string, field: string, meaning: string, kind: PduField['kind'] = 'data', bits?: BitInfo[]): void => {
    if (start < pdu.length) out.push({ start, length: 1, kind, fieldId, field, meaning, bits, isoRef: ISO19 });
  };
  const dtcAt = (start: number, id: string): void => {
    if (start + 2 >= pdu.length) return;
    const dtc = (pdu[start]! << 16) | (pdu[start + 1]! << 8) | pdu[start + 2]!;
    out.push({ start, length: 3, kind: 'did', fieldId: id, field: f.dtc, meaning: m.dtcCode(formatDtc(dtc)), isoRef: ISO19 });
  };
  const statusAt = (start: number, id: string): void => one(start, id, f.dtcStatus, m.dtcStatus(hex(pdu[start] ?? 0)), 'data', statusBits(pdu[start] ?? 0));

  if (ctx.direction === 'request') {
    if (sub === 0x01 || sub === 0x02) one(2, 'mask', f.statusMask, m.statusMask(hex(pdu[2] ?? 0)), 'data', statusBits(pdu[2] ?? 0));
    if (sub === 0x04 || sub === 0x06) {
      dtcAt(2, 'dtc');
      const rec = hex(pdu[5] ?? 0);
      one(5, 'record', f.recordNumber, sub === 0x04 ? m.snapshotRecordReq(rec) : m.extRecordReq(rec));
    }
    return out;
  }

  if (sub === 0x01) {
    one(2, 'avail', f.availabilityMask, m.availabilityMask(hex(pdu[2] ?? 0)), 'data', statusBits(pdu[2] ?? 0));
    one(3, 'format', f.formatId, m.formatId(hex(pdu[3] ?? 0)));
    if (pdu.length >= 6) out.push({ start: 4, length: 2, kind: 'data', fieldId: 'count', field: f.dtcCount, meaning: m.dtcCount((pdu[4]! << 8) | pdu[5]!), isoRef: ISO19 });
    return out;
  }
  if (sub === 0x02 || sub === 0x0a) {
    one(2, 'avail', f.availabilityMask, m.availabilityMask(hex(pdu[2] ?? 0)), 'data', statusBits(pdu[2] ?? 0));
    for (let p = 3; p + 3 < pdu.length; p += 4) {
      dtcAt(p, `dtc-${p}`);
      statusAt(p + 3, `status-${p}`);
    }
    return out;
  }
  if (sub === 0x04 || sub === 0x06) {
    dtcAt(2, 'dtc');
    statusAt(5, 'status');
    let p = 6;
    if (sub === 0x04 && p < pdu.length) {
      one(p, 'snapRec', f.recordNumber, m.snapshotRecord(hex(pdu[p]!)));
      const count = pdu[p + 1] ?? 0;
      one(p + 1, 'snapCount', f.numberOfIdentifiers, m.numberOfIdentifiers(count));
      p += 2;
      for (let i = 0; i < count && p + 1 < pdu.length; i++) {
        const did = (pdu[p]! << 8) | pdu[p + 1]!;
        const def = ctx.config.dids.find((d) => d.did === did);
        const len = def?.length ?? 1;
        out.push({ start: p, length: 2, kind: 'did', fieldId: `sdid-${p}`, field: f.snapshotDid, meaning: m.snapshotDid(hex(did, 4), def?.name ?? '?'), isoRef: ISO19 });
        const data = pdu.slice(p + 2, p + 2 + len);
        out.push({
          start: p + 2,
          length: data.length,
          kind: 'data',
          fieldId: `sdata-${p}`,
          field: f.snapshotData,
          meaning: m.snapshotData(def ? decodeDidValue(def, data) : hexBytes(data)),
          isoRef: ISO19,
        });
        p += 2 + len;
      }
    }
    if (sub === 0x06) {
      for (; p + 1 < pdu.length; p += 2) {
        const rec = pdu[p]!;
        one(p, `ext-${p}`, f.recordNumber, m.extRecordNumber(hex(rec)));
        one(p + 1, `extd-${p}`, f.extData, rec === 0x01 ? m.extOccurrence(pdu[p + 1]!) : m.extAging(pdu[p + 1]!));
      }
    }
  }
  return out;
}
