import { describe, expect, it } from 'vitest';
import { DEFAULT_VEHICLE } from '../../data/defaultVehicle';
import { computeKey, parseKeyExpression } from '../uds/keyAlgorithm';
import { parseVehicleConfig, validateVehicleConfig, validateVin } from './validate';

const clone = () => structuredClone(DEFAULT_VEHICLE);

describe('computeKey', () => {
  it('XOR hằng số', () => {
    const r = computeKey([0x12, 0x34, 0x56, 0x78], { algorithm: 'xor', constant: 0x5a5a5a5a, expression: '', seedLength: 4 });
    expect(r.key).toEqual([0x48, 0x6e, 0x0c, 0x22]);
    expect(r.steps).toHaveLength(1);
  });

  it('cộng hằng số tràn 32-bit', () => {
    const r = computeKey([0xff, 0xff, 0xff, 0xff], { algorithm: 'add', constant: 2, expression: '', seedLength: 4 });
    expect(r.key).toEqual([0x00, 0x00, 0x00, 0x01]);
  });

  it('seed 2 byte: kết quả được cắt còn 2 byte', () => {
    expect(computeKey([0xab, 0xcd], { algorithm: 'add', constant: 0x1234, expression: '', seedLength: 2 }).key).toEqual([0xbe, 0x01]);
    const r = computeKey([0xff, 0xff], { algorithm: 'add', constant: 0x0002, expression: '', seedLength: 2 });
    expect(r.key).toEqual([0x00, 0x01]);
    expect(r.steps.at(-1)!.expr).toContain('& 0x0000FFFF');
  });

  it('biểu thức có ưu tiên toán tử và ngoặc', () => {
    const cfg = { algorithm: 'expression' as const, constant: 0, seedLength: 4 };
    expect(computeKey([0, 0, 0, 2], { ...cfg, expression: '1 + seed * 3' }).key).toEqual([0, 0, 0, 7]);
    expect(computeKey([0, 0, 0, 2], { ...cfg, expression: '(1 + seed) * 3' }).key).toEqual([0, 0, 0, 9]);
    expect(computeKey([0x80, 0, 0, 1], { ...cfg, expression: '(seed << 1) | (seed >> 31)' }).key).toEqual([0, 0, 0, 3]);
    expect(computeKey([0, 0, 0, 0], { ...cfg, expression: '~seed' }).key).toEqual([0xff, 0xff, 0xff, 0xff]);
    expect(computeKey([0x12, 0x34, 0x56, 0x78], { ...cfg, expression: '(seed ^ 0x5A5A5A5A) + 0x1234' }).key).toEqual([0x48, 0x6e, 0x1e, 0x56]);
  });

  it('báo lỗi biểu thức sai bằng tiếng Việt', () => {
    expect(parseKeyExpression('seed +')).toMatchObject({ ok: false });
    expect(parseKeyExpression('(seed')).toMatchObject({ ok: false, error: expect.stringContaining('ngoặc') });
    expect(parseKeyExpression('seed $ 1')).toMatchObject({ ok: false, error: expect.stringContaining("'$'") });
    expect(parseKeyExpression('eval(1)')).toMatchObject({ ok: false });
    expect(parseKeyExpression('')).toMatchObject({ ok: false });
    expect(parseKeyExpression('0x1FFFFFFFF')).toMatchObject({ ok: false });
  });
});

describe('validate', () => {
  it('cấu hình mặc định hợp lệ', () => {
    expect(validateVehicleConfig(clone())).toEqual([]);
  });

  it('VIN', () => {
    expect(validateVin('VNLAB2026UDS00001')).toEqual([]);
    expect(validateVin('ABC')).toHaveLength(1);
    expect(validateVin('VNLAB2026UDS0000O')).toHaveLength(1);
    expect(validateVin('vnlab2026uds00001')).toHaveLength(1);
  });

  it('CAN ID vượt 11-bit, trùng request/response', () => {
    const c = clone();
    c.can.requestId = 0x800;
    expect(validateVehicleConfig(c).length).toBeGreaterThan(0);
    const d = clone();
    d.can.responseId = d.can.requestId;
    expect(validateVehicleConfig(d).length).toBeGreaterThan(0);
  });

  it('DID trùng, sai độ dài dữ liệu, DID sống không được ghi', () => {
    const c = clone();
    c.dids.push({ ...c.dids[1]! });
    c.dids[2]!.data = [1];
    c.dids.find((d) => d.source === 'vehicleSpeed')!.writable = true;
    const errors = validateVehicleConfig(c);
    expect(errors.some((e) => e.includes('trùng'))).toBe(true);
    expect(errors.some((e) => e.includes('độ dài khai báo'))).toBe(true);
    expect(errors.some((e) => e.includes('không thể cho phép ghi'))).toBe(true);
  });

  it('security: level chẵn và biểu thức sai', () => {
    const c = clone();
    c.security.levels[0]!.level = 2;
    c.security.levels[1]!.algorithm = 'expression';
    c.security.levels[1]!.expression = 'seed +';
    expect(validateVehicleConfig(c)).toHaveLength(2);
  });
});

describe('parseVehicleConfig', () => {
  it('JSON xuất ra nhập lại được', () => {
    const json = JSON.parse(JSON.stringify(DEFAULT_VEHICLE));
    const r = parseVehicleConfig(json, DEFAULT_VEHICLE);
    expect(r.ok && r.config).toEqual(DEFAULT_VEHICLE);
  });

  it('bổ sung trường thiếu từ mặc định', () => {
    const r = parseVehicleConfig({ schemaVersion: 1, ecuName: 'ABS ECU', can: { requestId: 0x7e1, responseId: 0x7e9 } }, DEFAULT_VEHICLE);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.config.ecuName).toBe('ABS ECU');
      expect(r.config.can.functionalId).toBe(0x7df);
      expect(r.config.dids).toEqual(DEFAULT_VEHICLE.dids);
    }
  });

  it('từ chối nội dung sai', () => {
    expect(parseVehicleConfig([], DEFAULT_VEHICLE).ok).toBe(false);
    expect(parseVehicleConfig({ schemaVersion: 2 }, DEFAULT_VEHICLE).ok).toBe(false);
    expect(parseVehicleConfig({ schemaVersion: 1, dids: [{ did: 'x' }] }, DEFAULT_VEHICLE).ok).toBe(false);
    expect(parseVehicleConfig({ schemaVersion: 1, can: { requestId: 0x7e8 } }, DEFAULT_VEHICLE).ok).toBe(false);
  });
});
