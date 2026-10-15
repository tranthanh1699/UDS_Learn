import type { PaddingByte } from '../can/padding';

export type FrameKind = 'SF' | 'FF' | 'CF' | 'FC';

/** Flow status trong Flow Control: 0 = ContinueToSend (CTS), 1 = Wait, 2 = Overflow. */
export const FlowStatus = { CTS: 0, WAIT: 1, OVERFLOW: 2 } as const;
export type FlowStatus = (typeof FlowStatus)[keyof typeof FlowStatus];

export interface IsoTpConfig {
  fd: boolean;
  padding: PaddingByte;
  /** TX_DL: độ dài tối đa mỗi frame. Mặc định 8 (Classic) hoặc 64 (CAN FD). */
  txDl?: number;
}

export interface FlowControlParams {
  status: FlowStatus;
  /** BS: số Consecutive Frame được gửi trước khi chờ Flow Control kế tiếp; 0 = gửi hết không chờ. */
  bs: number;
  /** STmin dạng byte thô (0x00–0x7F ms, 0xF1–0xF9 = 100–900 µs). */
  stMin: number;
}

/** Mã lỗi khi giải mã / ghép ISO-TP. Câu giải thích tiếng Việt nằm ở vi.isotp.errors. */
export type IsoTpErrorCode =
  | 'emptyFrame'
  | 'unknownPciType'
  | 'invalidSfLength'
  | 'invalidFfLength'
  | 'invalidFlowStatus'
  | 'frameTooShort'
  | 'unexpectedConsecutiveFrame'
  | 'wrongSequenceNumber';

export type DecodedPci =
  | { kind: 'SF'; length: number; pciLength: number; escape: boolean }
  | { kind: 'FF'; length: number; pciLength: number; escape: boolean }
  | { kind: 'CF'; sn: number; pciLength: 1 }
  | { kind: 'FC'; status: FlowStatus; bs: number; stMin: number; pciLength: 3 }
  | { kind: 'error'; code: IsoTpErrorCode };

/** Một frame do bên gửi tạo ra khi chia bản tin. */
export interface IsoTpSegment {
  kind: 'SF' | 'FF' | 'CF';
  data: number[];
  pciLength: number;
  /** Vị trí của phần payload trong bản tin gốc. */
  payloadOffset: number;
  payloadLength: number;
  padStart: number;
  sn?: number;
}
