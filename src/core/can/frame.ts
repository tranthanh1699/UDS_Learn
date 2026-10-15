import { isValidFrameLength, lengthToDlc } from './dlc';

/** standard = CAN ID 11-bit, extended = CAN ID 29-bit. */
export type CanIdType = 'standard' | 'extended';

export interface CanFrame {
  id: number;
  idType: CanIdType;
  fd: boolean;
  dlc: number;
  data: number[];
}

export const MAX_STANDARD_ID = 0x7ff;
export const MAX_EXTENDED_ID = 0x1fffffff;

export function isValidCanId(id: number, idType: CanIdType): boolean {
  return Number.isInteger(id) && id >= 0 && id <= (idType === 'standard' ? MAX_STANDARD_ID : MAX_EXTENDED_ID);
}

export function isByte(n: number): boolean {
  return Number.isInteger(n) && n >= 0 && n <= 0xff;
}

export function formatCanId(id: number, idType: CanIdType): string {
  return id.toString(16).toUpperCase().padStart(idType === 'standard' ? 3 : 8, '0');
}

/** Tạo CAN frame; DLC được tính từ độ dài dữ liệu. Dữ liệu phải đã có độ dài hợp lệ (xem padFrameData). */
export function createCanFrame(id: number, idType: CanIdType, fd: boolean, data: readonly number[]): CanFrame {
  if (!isValidCanId(id, idType)) throw new RangeError(`CAN ID 0x${id.toString(16)} không hợp lệ cho ID ${idType === 'standard' ? '11-bit' : '29-bit'}`);
  if (!isValidFrameLength(data.length, fd)) throw new RangeError(`Độ dài ${data.length} byte không hợp lệ cho ${fd ? 'CAN FD' : 'Classic CAN'}`);
  if (!data.every(isByte)) throw new RangeError('Dữ liệu frame chứa giá trị không phải byte');
  return { id, idType, fd, dlc: lengthToDlc(data.length, fd), data: [...data] };
}
