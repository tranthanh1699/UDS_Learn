import { vi } from '../../i18n/vi';
import { NEGATIVE_RESPONSE_SID, nrcName } from '../uds/nrc';
import { NRC_ISO_REF, SERVICE_ISO_REFS, serviceName } from '../uds/serviceNames';
import { DEFAULT_SERVICES } from '../uds/services';
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

function subFunctionName(sid: number, sub: number): string | undefined {
  return DEFAULT_SERVICES.find((s) => s.sid === sid)?.subFunctions?.find((s) => s.id === sub)?.name;
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

function subFunctionField(sid: number, raw: number, echo: boolean): PduField {
  const sub = raw & 0x7f;
  const name = subFunctionName(sid, sub);
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

function didField(start: number, did: number, config: VehicleConfig, id: string): { field: PduField; def?: DidDefinition } {
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
      isoRef: SERVICE_ISO_REFS[0x22],
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
    fields.push(subFunctionField(reqSid, pdu[1]!, ctx.direction === 'response'));
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

  const extra = (reqSid === 0x10 || reqSid === 0x3e) && ctx.direction === 'request';
  return [...fields, ...rest(pdu, pos, extra ? 'extra' : 'data')];
}

