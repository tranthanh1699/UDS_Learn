/** Định dạng số dùng chung cho giao diện. */
export const hex = (n: number, width = 2): string => n.toString(16).toUpperCase().padStart(width, '0');

export const formatNumber = (n: number, digits = 0): string =>
  n.toLocaleString('vi-VN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
