import { describe, expect, it } from 'vitest';
import { hex } from './format';

describe('hex', () => {
  it('định dạng byte 2 ký tự viết hoa', () => {
    expect(hex(0x7)).toBe('07');
    expect(hex(0xf1)).toBe('F1');
  });
  it('hỗ trợ độ rộng tùy chọn', () => {
    expect(hex(0x7e0, 3)).toBe('7E0');
    expect(hex(0x18da00f1, 8)).toBe('18DA00F1');
  });
});
