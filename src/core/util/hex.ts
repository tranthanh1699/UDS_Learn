/** Định dạng số nguyên thành chuỗi hex viết hoa, đệm 0 bên trái. */
export const hex = (n: number, width = 2): string => n.toString(16).toUpperCase().padStart(width, '0');

/** "0x22" */
export const hex0x = (n: number, width = 2): string => `0x${hex(n, width)}`;

/** [0x22, 0xF1, 0x90] → "22 F1 90" */
export const hexBytes = (bytes: readonly number[]): string => bytes.map((b) => hex(b)).join(' ');

/** "22 F1 90" / "22f190" → [0x22, 0xF1, 0x90]; trả về null nếu chuỗi không hợp lệ. */
export function parseHexBytes(text: string): number[] | null {
  const clean = text.replace(/0x/gi, '').replace(/[\s,]+/g, '');
  if (clean.length === 0) return [];
  if (clean.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(clean)) return null;
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 2) out.push(parseInt(clean.slice(i, i + 2), 16));
  return out;
}

export const asciiBytes = (s: string): number[] => [...s].map((c) => c.charCodeAt(0) & 0xff);
