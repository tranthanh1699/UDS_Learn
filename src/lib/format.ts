/** Định dạng số dùng chung cho giao diện. */
export { hex, hex0x, hexBytes } from '@/core/util/hex';

export const formatNumber = (n: number, digits = 0): string =>
  n.toLocaleString('vi-VN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
