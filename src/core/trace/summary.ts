import { vi } from '../../i18n/vi';
import { formatCanId } from '../can/frame';
import { decodePci } from '../isotp/pci';
import { decodeStMin } from '../isotp/stmin';
import { nrcName } from '../uds/nrc';
import { serviceName } from '../uds/serviceNames';
import { hex, hexBytes } from '../util/hex';
import type { Exchange, TraceFrame } from './exchange';

const t = vi.trace.info;

/** Mô tả ngắn một frame cho cột "Thông tin" của trace. */
export function frameInfo(frame: TraceFrame, exchange: Exchange): string {
  const r = exchange.result;
  const name = (r.sid !== null && serviceName(r.sid)) || t.unknown;
  const pci = decodePci(frame.data, frame.fd);
  if (pci.kind === 'FC') {
    const st = decodeStMin(pci.stMin);
    return t.fc(vi.trace.fcStatus[pci.status] ?? '?', pci.bs, vi.annotate.meanings.stMinValue(st.microseconds, st.reserved));
  }
  if (pci.kind === 'CF') return t.cf(pci.sn);
  if (frame.role === 'pending') return t.pending;
  if (frame.role === 'request') {
    const extra = r.outcome === 'suppressed' ? ` ${t.suppressed}` : r.outcome === 'noResponse' ? ` ${t.noResponse}` : '';
    return t.request(name) + (r.addressing === 'functional' ? ` (${t.functional})` : '') + extra;
  }
  if (r.outcome === 'negative' && r.nrc !== null) return t.negative(hex(r.nrc), nrcName(r.nrc));
  return t.positive(name);
}

/** Một dòng CSV có trích dẫn an toàn. */
const csvRow = (cells: readonly (string | number)[]) => cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',');

/** Xuất các frame ra CSV (UTF-8 có BOM để Excel đọc đúng tiếng Việt). */
export function framesToCsv(rows: { frame: TraceFrame; exchange: Exchange }[], startTime: number): string {
  const lines = [csvRow(vi.trace.csvHeader)];
  for (const { frame, exchange } of rows) {
    lines.push(
      csvRow([
        ((frame.t - startTime) / 1000).toFixed(3),
        frame.dir,
        formatCanId(frame.canId, frame.idType),
        frame.idType === 'standard' ? '11-bit' : '29-bit',
        vi.isotp.frameKind[frame.kind],
        frame.dlc,
        hexBytes(frame.data),
        frameInfo(frame, exchange),
      ]),
    );
  }
  return '﻿' + lines.join('\r\n');
}
