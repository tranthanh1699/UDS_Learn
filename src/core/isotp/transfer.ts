import { decodeStMin } from './stmin';
import { encodeFlowControl } from './pci';
import { segment } from './segment';
import { FlowStatus, type FrameKind, type IsoTpConfig } from './types';

export interface TransferFrame {
  /** sender = bên gửi bản tin; receiver = bên nhận (chỉ gửi Flow Control). */
  from: 'sender' | 'receiver';
  kind: FrameKind;
  data: number[];
  pciLength: number;
  padStart: number;
  sn?: number;
  /** Khoảng chờ tối thiểu (µs) trước frame này theo STmin; chỉ có ở Consecutive Frame. */
  minGapUs?: number;
}

/**
 * Lập trình tự frame của một lần truyền ISO-TP hoàn chỉnh, gồm cả Flow Control của bên nhận:
 * FF → FC(CTS) → CF ... và sau mỗi BS Consecutive Frame lại có một FC (khi BS > 0).
 */
export function planTransfer(
  payload: readonly number[],
  cfg: IsoTpConfig,
  fc: { bs: number; stMin: number },
): TransferFrame[] {
  const fcFrame = (): TransferFrame => {
    const { data, padStart } = encodeFlowControl({ status: FlowStatus.CTS, bs: fc.bs, stMin: fc.stMin }, cfg);
    return { from: 'receiver', kind: 'FC', data, pciLength: 3, padStart };
  };
  const gapUs = decodeStMin(fc.stMin).microseconds;

  const frames: TransferFrame[] = [];
  let cfInBlock = 0;
  for (const s of segment(payload, cfg)) {
    if (s.kind === 'CF') {
      if (fc.bs > 0 && cfInBlock === fc.bs) {
        frames.push(fcFrame());
        cfInBlock = 0;
      }
      cfInBlock++;
    }
    const frame: TransferFrame = { from: 'sender', kind: s.kind, data: s.data, pciLength: s.pciLength, padStart: s.padStart };
    if (s.sn !== undefined) {
      frame.sn = s.sn;
      frame.minGapUs = gapUs;
    }
    frames.push(frame);
    if (s.kind === 'FF') frames.push(fcFrame());
  }
  return frames;
}
