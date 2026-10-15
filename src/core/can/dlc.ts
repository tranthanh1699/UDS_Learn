/**
 * Ánh xạ DLC ↔ số byte dữ liệu.
 * Classic CAN: DLC 0–8 = 0–8 byte; DLC 9–15 vẫn chỉ mang 8 byte.
 * CAN FD: DLC 9→12, 10→16, 11→20, 12→24, 13→32, 14→48, 15→64 byte.
 */

export const CLASSIC_MAX_LENGTH = 8;
export const FD_MAX_LENGTH = 64;

/** Số byte dữ liệu theo DLC của CAN FD (chỉ số = DLC). */
export const FD_DLC_LENGTHS: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 12, 16, 20, 24, 32, 48, 64];

export function maxFrameLength(fd: boolean): number {
  return fd ? FD_MAX_LENGTH : CLASSIC_MAX_LENGTH;
}

export function dlcToLength(dlc: number, fd: boolean): number {
  if (!Number.isInteger(dlc) || dlc < 0 || dlc > 15) throw new RangeError(`DLC không hợp lệ: ${dlc}`);
  return fd ? FD_DLC_LENGTHS[dlc]! : Math.min(dlc, CLASSIC_MAX_LENGTH);
}

/** DLC nhỏ nhất chứa được `length` byte. */
export function lengthToDlc(length: number, fd: boolean): number {
  if (!Number.isInteger(length) || length < 0 || length > maxFrameLength(fd)) {
    throw new RangeError(`Độ dài dữ liệu ${length} vượt quá giới hạn của ${fd ? 'CAN FD' : 'Classic CAN'}`);
  }
  if (!fd) return length;
  return FD_DLC_LENGTHS.findIndex((l) => l >= length);
}

/** Làm tròn lên độ dài hợp lệ gần nhất (CAN FD chỉ có các độ dài rời rạc khi > 8 byte). */
export function roundUpToValidLength(length: number, fd: boolean): number {
  return dlcToLength(lengthToDlc(length, fd), fd);
}

export function isValidFrameLength(length: number, fd: boolean): boolean {
  if (!Number.isInteger(length) || length < 0 || length > maxFrameLength(fd)) return false;
  return !fd || FD_DLC_LENGTHS.includes(length);
}
