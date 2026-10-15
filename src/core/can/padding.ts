import { maxFrameLength, roundUpToValidLength } from './dlc';

/** Byte padding; null = không padding (frame chỉ dài đúng số byte cần thiết). */
export type PaddingByte = number | null;

export const DEFAULT_PADDING: PaddingByte = 0xcc;
export const PADDING_OPTIONS: readonly PaddingByte[] = [0xcc, 0x00, 0x55, 0xaa, null];

/**
 * Với CAN FD, frame > 8 byte phải có độ dài rời rạc (12, 16, ..., 64). Khi người dùng chọn "không padding"
 * mà vẫn phải lấp chỗ trống, dùng 0xCC (giá trị khuyến nghị của ISO 15765-2).
 */
export const FD_FALLBACK_PADDING = 0xcc;

export interface PaddedData {
  data: number[];
  /** Chỉ số byte padding đầu tiên; bằng data.length nếu không có padding. */
  padStart: number;
}

/**
 * Thêm padding cho dữ liệu frame.
 * - Có padding: Classic CAN → luôn 8 byte; CAN FD → tối thiểu 8 byte, làm tròn lên độ dài hợp lệ.
 * - Không padding: giữ nguyên độ dài (CAN FD vẫn phải làm tròn lên nếu > 8 byte).
 */
export function padFrameData(payload: readonly number[], fd: boolean, padding: PaddingByte): PaddedData {
  if (payload.length > maxFrameLength(fd)) {
    throw new RangeError(`Dữ liệu ${payload.length} byte không vừa một frame ${fd ? 'CAN FD' : 'Classic CAN'}`);
  }
  const target = roundUpToValidLength(padding === null ? payload.length : Math.max(payload.length, 8), fd);
  const fill = padding ?? FD_FALLBACK_PADDING;
  const data = [...payload];
  while (data.length < target) data.push(fill);
  return { data, padStart: payload.length };
}
