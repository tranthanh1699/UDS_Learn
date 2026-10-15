import { vi } from '../../i18n/vi';
import { decodePci } from '../isotp/pci';
import { decodeStMin } from '../isotp/stmin';
import type { FrameKind } from '../isotp/types';
import { ISOTP_ISO_REF } from '../uds/serviceNames';
import { hex } from '../util/hex';
import type { BitInfo, ByteAnnotation, PduField } from './types';

const f = vi.annotate.fields;
const m = vi.annotate.meanings;
const b = vi.annotate.bits;

export interface FrameAnnotationInput {
  data: readonly number[];
  kind: FrameKind;
  fd: boolean;
  pciLength: number;
  padStart: number;
  /** Vị trí byte payload đầu tiên của frame trong PDU. */
  payloadOffset?: number;
}

const bin = (n: number, width: number) => n.toString(2).padStart(width, '0');

function nibbleBits(byte: number, lowName: string, lowMeaning: string, kind: FrameKind): BitInfo[] {
  return [
    { range: '7–4', name: b.frameType, value: bin(byte >> 4, 4), meaning: `${byte >> 4} ${b.frameTypeValue(vi.isotp.frameKind[kind])}` },
    { range: '3–0', name: lowName, value: bin(byte & 0x0f, 4), meaning: lowMeaning },
  ];
}

function pciAnnotations(input: FrameAnnotationInput): ByteAnnotation[] {
  const { data, fd } = input;
  const pci = decodePci(data, fd);
  const at = (index: number, a: Omit<ByteAnnotation, 'index' | 'value' | 'kind' | 'isoRef'>): ByteAnnotation => ({
    index,
    value: data[index]!,
    kind: 'pci',
    isoRef: ISOTP_ISO_REF,
    ...a,
  });
  switch (pci.kind) {
    case 'SF':
      return pci.escape
        ? [
            at(0, { fieldId: 'pci', field: f.pciSf, meaning: m.sfEscapePci, bits: nibbleBits(data[0]!, b.length, '0 → escape', 'SF') }),
            at(1, { fieldId: 'pci-len', field: f.pciSfLength, meaning: m.sfEscapeLength(pci.length) }),
          ]
        : [at(0, { fieldId: 'pci', field: f.pciSf, meaning: m.sfPci(pci.length), bits: nibbleBits(data[0]!, b.length, `${pci.length} byte`, 'SF') })];
    case 'FF': {
      const meaning = pci.escape ? m.ffEscapePci(pci.length) : m.ffPci(pci.length);
      return Array.from({ length: pci.pciLength }, (_, i) =>
        at(i, {
          fieldId: 'pci',
          field: i === 0 ? f.pciFf : f.pciFfLength,
          meaning,
          bits: i === 0 ? nibbleBits(data[0]!, b.length, pci.escape ? '0 → escape' : `0x${hex(data[0]! & 0x0f, 1)} (4 bit cao của độ dài)`, 'FF') : undefined,
        }),
      );
    }
    case 'CF':
      return [at(0, { fieldId: 'pci', field: f.pciCf, meaning: m.cfPci(pci.sn), bits: nibbleBits(data[0]!, b.sn, `SN = ${pci.sn}`, 'CF') })];
    case 'FC': {
      const st = decodeStMin(pci.stMin);
      return [
        at(0, {
          fieldId: 'fc-fs',
          field: f.fcStatus,
          meaning: m.fcStatus(vi.isotp.flowStatus[pci.status]),
          bits: nibbleBits(data[0]!, b.flowStatus, vi.isotp.flowStatus[pci.status], 'FC'),
        }),
        at(1, { fieldId: 'fc-bs', field: f.fcBs, meaning: m.fcBs(pci.bs) }),
        at(2, { fieldId: 'fc-stmin', field: f.fcStMin, meaning: m.fcStMin(m.stMinValue(st.microseconds, st.reserved)) }),
      ];
    }
    case 'error':
      return Array.from({ length: Math.min(input.pciLength, data.length) }, (_, i) =>
        at(i, { fieldId: 'pci', field: f.pciSf, meaning: vi.isotp.errors[pci.code] }),
      );
  }
}

/**
 * Chú thích từng byte của một CAN frame: PCI (ISO-TP) + phần payload ánh xạ về trường PDU + padding.
 */
export function annotateFrame(input: FrameAnnotationInput, pduFields: readonly PduField[]): ByteAnnotation[] {
  const { data, pciLength, padStart } = input;
  const out: ByteAnnotation[] = pciLength > 0 ? pciAnnotations(input) : [];
  const offset = input.payloadOffset ?? 0;

  for (let i = pciLength; i < data.length; i++) {
    if (i >= padStart) {
      out.push({
        index: i,
        value: data[i]!,
        kind: 'pad',
        fieldId: 'pad',
        field: f.padding,
        meaning: m.padding(hex(data[i]!)),
        isoRef: ISOTP_ISO_REF,
      });
      continue;
    }
    const pduIndex = offset + i - pciLength;
    const field = pduFields.find((p) => pduIndex >= p.start && pduIndex < p.start + p.length);
    out.push({
      index: i,
      value: data[i]!,
      kind: field?.kind ?? 'data',
      fieldId: field?.fieldId ?? `byte-${pduIndex}`,
      field: field?.field ?? f.data,
      meaning: field?.meaning ?? m.data,
      byteNote: field?.byteNotes?.[pduIndex - field.start],
      bits: field?.bits,
      isoRef: field?.isoRef,
    });
  }
  return out;
}

/** Chú thích PDU không có PCI (dùng cho xem trước request). */
export function annotatePduBytes(pdu: readonly number[], pduFields: readonly PduField[]): ByteAnnotation[] {
  return annotateFrame({ data: pdu, kind: 'SF', fd: false, pciLength: 0, padStart: pdu.length }, pduFields);
}
