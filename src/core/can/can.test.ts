import { describe, expect, it } from 'vitest';
import {
  createCanFrame,
  dlcToLength,
  formatCanId,
  isValidCanId,
  isValidFrameLength,
  lengthToDlc,
  padFrameData,
  roundUpToValidLength,
} from './index';

describe('DLC Classic CAN', () => {
  it('DLC 0–8 = 0–8 byte, DLC 9–15 vẫn là 8 byte', () => {
    for (let d = 0; d <= 8; d++) expect(dlcToLength(d, false)).toBe(d);
    for (let d = 9; d <= 15; d++) expect(dlcToLength(d, false)).toBe(8);
  });
  it('không cho phép quá 8 byte', () => {
    expect(() => lengthToDlc(9, false)).toThrow(RangeError);
    expect(isValidFrameLength(9, false)).toBe(false);
  });
});

describe('DLC CAN FD', () => {
  it.each([
    [9, 12],
    [10, 16],
    [11, 20],
    [12, 24],
    [13, 32],
    [14, 48],
    [15, 64],
  ])('DLC %i → %i byte', (dlc, len) => {
    expect(dlcToLength(dlc, true)).toBe(len);
    expect(lengthToDlc(len, true)).toBe(dlc);
  });
  it('làm tròn lên độ dài hợp lệ', () => {
    expect(roundUpToValidLength(9, true)).toBe(12);
    expect(roundUpToValidLength(22, true)).toBe(24);
    expect(roundUpToValidLength(49, true)).toBe(64);
    expect(lengthToDlc(13, true)).toBe(10);
  });
  it('13 byte không phải độ dài CAN FD hợp lệ', () => {
    expect(isValidFrameLength(13, true)).toBe(false);
    expect(isValidFrameLength(16, true)).toBe(true);
  });
  it('DLC ngoài 0–15 bị từ chối', () => {
    expect(() => dlcToLength(16, true)).toThrow(RangeError);
  });
});

describe('padding', () => {
  it('Classic: padding 0xCC lên 8 byte', () => {
    expect(padFrameData([0x02, 0x10, 0x03], false, 0xcc)).toEqual({
      data: [0x02, 0x10, 0x03, 0xcc, 0xcc, 0xcc, 0xcc, 0xcc],
      padStart: 3,
    });
  });
  it('Classic: không padding giữ nguyên độ dài', () => {
    expect(padFrameData([0x02, 0x10, 0x03], false, null).data).toEqual([0x02, 0x10, 0x03]);
  });
  it('dùng byte padding đã chọn', () => {
    expect(padFrameData([0x01], false, 0x55).data).toEqual([0x01, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55]);
  });
  it('CAN FD > 8 byte làm tròn lên dù không chọn padding (lấp bằng 0xCC)', () => {
    const r = padFrameData(new Array(10).fill(0x11), true, null);
    expect(r.data).toHaveLength(12);
    expect(r.data.slice(10)).toEqual([0xcc, 0xcc]);
    expect(r.padStart).toBe(10);
  });
  it('CAN FD có padding: tối thiểu 8 byte', () => {
    expect(padFrameData([0x01, 0x3e], true, 0x00).data).toHaveLength(8);
  });
});

describe('CAN ID và CanFrame', () => {
  it('kiểm tra phạm vi 11-bit / 29-bit', () => {
    expect(isValidCanId(0x7ff, 'standard')).toBe(true);
    expect(isValidCanId(0x800, 'standard')).toBe(false);
    expect(isValidCanId(0x18da00f1, 'extended')).toBe(true);
    expect(isValidCanId(0x20000000, 'extended')).toBe(false);
  });
  it('định dạng CAN ID', () => {
    expect(formatCanId(0x7e0, 'standard')).toBe('7E0');
    expect(formatCanId(0x18da00f1, 'extended')).toBe('18DA00F1');
  });
  it('tính DLC từ dữ liệu', () => {
    expect(createCanFrame(0x7e0, 'standard', false, [1, 2, 3, 4, 5, 6, 7, 8]).dlc).toBe(8);
    expect(createCanFrame(0x7e8, 'standard', true, new Array(24).fill(0)).dlc).toBe(12);
  });
  it('từ chối dữ liệu hoặc ID sai', () => {
    expect(() => createCanFrame(0x800, 'standard', false, [0])).toThrow(RangeError);
    expect(() => createCanFrame(0x7e0, 'standard', true, new Array(13).fill(0))).toThrow(RangeError);
    expect(() => createCanFrame(0x7e0, 'standard', false, [256])).toThrow(RangeError);
  });
});
