import { padFrameData } from '../can/padding';
import { MAX_FF_DL_12BIT, MAX_MESSAGE_LENGTH, maxSingleFramePayload } from './config';
import type { DecodedPci, FlowControlParams, FlowStatus, IsoTpConfig } from './types';

/** PCI của Single Frame: 0x0N, hoặc 0x00 LL (CAN FD, payload > 7 byte). */
export function singleFramePci(length: number, cfg: IsoTpConfig): number[] {
  if (length < 1 || length > maxSingleFramePayload(cfg)) throw new RangeError(`Payload ${length} byte không vừa Single Frame`);
  return length <= 7 ? [length] : [0x00, length];
}

/** PCI của First Frame: 0x1N NN (≤ 4095 byte) hoặc 0x10 0x00 + 4 byte độ dài (> 4095 byte). */
export function firstFramePci(length: number): number[] {
  if (length > MAX_MESSAGE_LENGTH) throw new RangeError(`Bản tin ${length} byte vượt giới hạn ISO-TP`);
  if (length <= MAX_FF_DL_12BIT) return [0x10 | (length >> 8), length & 0xff];
  return [0x10, 0x00, (length >>> 24) & 0xff, (length >>> 16) & 0xff, (length >>> 8) & 0xff, length & 0xff];
}

export function consecutiveFramePci(sn: number): number[] {
  return [0x20 | (sn & 0x0f)];
}

export function encodeFlowControl(fc: FlowControlParams, cfg: IsoTpConfig): { data: number[]; padStart: number } {
  return padFrameData([0x30 | fc.status, fc.bs & 0xff, fc.stMin & 0xff], cfg.fd, cfg.padding);
}

/** Giải mã PCI ở đầu dữ liệu frame. `fd` cho biết frame là CAN FD. */
export function decodePci(data: readonly number[], fd: boolean): DecodedPci {
  const b0 = data[0];
  if (b0 === undefined) return { kind: 'error', code: 'emptyFrame' };
  const low = b0 & 0x0f;
  switch (b0 >> 4) {
    case 0x0: {
      if (low !== 0) {
        // Với CAN_DL > 8 bắt buộc dùng dạng escape 0x00 LL
        if (low > 7 || low > data.length - 1 || (fd && data.length > 8)) return { kind: 'error', code: 'invalidSfLength' };
        return { kind: 'SF', length: low, pciLength: 1, escape: false };
      }
      if (!fd || data.length <= 8) return { kind: 'error', code: 'invalidSfLength' };
      const ll = data[1] ?? 0;
      if (ll < 1 || ll > data.length - 2) return { kind: 'error', code: 'invalidSfLength' };
      return { kind: 'SF', length: ll, pciLength: 2, escape: true };
    }
    case 0x1: {
      if (data.length < 8) return { kind: 'error', code: 'frameTooShort' };
      const ffDl = (low << 8) | data[1]!;
      if (ffDl !== 0) return { kind: 'FF', length: ffDl, pciLength: 2, escape: false };
      const len = data[2]! * 0x1000000 + (data[3]! << 16) + (data[4]! << 8) + data[5]!;
      if (len <= MAX_FF_DL_12BIT) return { kind: 'error', code: 'invalidFfLength' };
      return { kind: 'FF', length: len, pciLength: 6, escape: true };
    }
    case 0x2:
      return { kind: 'CF', sn: low, pciLength: 1 };
    case 0x3:
      if (data.length < 3) return { kind: 'error', code: 'frameTooShort' };
      if (low > 2) return { kind: 'error', code: 'invalidFlowStatus' };
      return { kind: 'FC', status: low as FlowStatus, bs: data[1]!, stMin: data[2]!, pciLength: 3 };
    default:
      return { kind: 'error', code: 'unknownPciType' };
  }
}
