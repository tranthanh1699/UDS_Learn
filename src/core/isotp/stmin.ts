/**
 * Giải mã STmin (ISO 15765-2):
 * 0x00–0x7F → 0–127 ms; 0xF1–0xF9 → 100–900 µs; các giá trị khác là reserved,
 * bên nhận coi như 0x7F (127 ms).
 */
export interface StMinInfo {
  microseconds: number;
  reserved: boolean;
}

export function decodeStMin(value: number): StMinInfo {
  if (value >= 0x00 && value <= 0x7f) return { microseconds: value * 1000, reserved: false };
  if (value >= 0xf1 && value <= 0xf9) return { microseconds: (value - 0xf0) * 100, reserved: false };
  return { microseconds: 127_000, reserved: true };
}
