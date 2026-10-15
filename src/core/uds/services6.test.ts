import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_VEHICLE } from '../../data/defaultVehicle';
import { annotatePdu } from '../annotate';
import { asciiBytes } from '../util/hex';
import type { Addressing, VehicleConditions, VehicleConfig } from '../vehicle/types';
import { REBOOT_MS, UdsServer } from './engine';
import { computeKey } from './keyAlgorithm';
import type { UdsResult } from './types';

// random() = 0.5 → mọi byte seed = 0x80
const SEED = [0x80, 0x80, 0x80, 0x80];
const L1 = DEFAULT_VEHICLE.security.levels[0]!;
const L3 = DEFAULT_VEHICLE.security.levels[1]!;
const KEY_L1 = computeKey(SEED, L1).key;
const WRONG_KEY = KEY_L1.map((b, i) => (i === 3 ? b ^ 0xff : b));
const NEW_VIN = asciiBytes('VNTEST0000ABC1234');

let ecu: UdsServer;
let now: number;
let config: VehicleConfig;

beforeEach(() => {
  config = structuredClone(DEFAULT_VEHICLE);
  ecu = new UdsServer(config, { random: () => 0.5 });
  now = 1_000;
});

function send(request: number[], opts: { at?: number; conditions?: Partial<VehicleConditions>; addressing?: Addressing } = {}): UdsResult {
  if (opts.at !== undefined) now = opts.at;
  return ecu.handleRequest(request, { addressing: opts.addressing ?? 'physical', now, conditions: { ...config.conditions, ...opts.conditions } });
}

const extended = () => send([0x10, 0x03]);
const unlock = () => {
  send([0x27, 0x01]);
  return send([0x27, 0x02, ...KEY_L1]);
};

describe('0x27 SecurityAccess', () => {
  it('không được phép trong default session → 7F 27 7F', () => {
    expect(send([0x27, 0x01]).response).toEqual([0x7f, 0x27, 0x7f]);
  });

  it('27 02 trước 27 01 → 7F 27 24', () => {
    extended();
    const r = send([0x27, 0x02, ...KEY_L1]);
    expect(r.response).toEqual([0x7f, 0x27, 0x24]);
    expect(r.steps.find((s) => s.status === 'failed')?.id).toBe('sequence');
  });

  it('requestSeed → 67 01 + seed; key đúng → 67 02 và mở level 1', () => {
    extended();
    expect(send([0x27, 0x01]).response).toEqual([0x67, 0x01, ...SEED]);
    const r = send([0x27, 0x02, ...KEY_L1]);
    expect(r.response).toEqual([0x67, 0x02]);
    expect(ecu.getState().unlockedLevel).toBe(1);
    expect(r.stateChanges.map((c) => c.kind)).toEqual(['security']);
  });

  it('27 01 khi level đã mở → seed toàn 0', () => {
    extended();
    unlock();
    expect(send([0x27, 0x01]).response).toEqual([0x67, 0x01, 0x00, 0x00, 0x00, 0x00]);
  });

  it('key sai → 35, 35, rồi 36; trong thời gian khóa → 37; hết khóa → requestSeed lại được', () => {
    extended();
    send([0x27, 0x01]);
    expect(send([0x27, 0x02, ...WRONG_KEY]).response).toEqual([0x7f, 0x27, 0x35]);
    // Key sai làm seed bị hủy: gửi lại key mà không xin seed mới → 0x24
    expect(send([0x27, 0x02, ...KEY_L1]).response).toEqual([0x7f, 0x27, 0x24]);
    send([0x27, 0x01]);
    expect(send([0x27, 0x02, ...WRONG_KEY]).response).toEqual([0x7f, 0x27, 0x35]);
    send([0x27, 0x01]);
    const third = send([0x27, 0x02, ...WRONG_KEY]);
    expect(third.response).toEqual([0x7f, 0x27, 0x36]);
    expect(ecu.getState().security.delayUntil[1]).toBe(now + L1.delayMs);

    const lockedAt = now;
    send([0x3e, 0x80], { at: lockedAt + 3000 });
    expect(send([0x27, 0x01], { at: lockedAt + 4000 }).response).toEqual([0x7f, 0x27, 0x37]);
    send([0x3e, 0x80], { at: lockedAt + 8000 });
    expect(send([0x27, 0x01], { at: lockedAt + L1.delayMs }).response).toEqual([0x67, 0x01, ...SEED]);
    expect(send([0x27, 0x02, ...KEY_L1]).response).toEqual([0x67, 0x02]);
  });

  it('sendKey sai độ dài → 7F 27 13', () => {
    extended();
    send([0x27, 0x01]);
    expect(send([0x27, 0x02, 0x01, 0x02]).response).toEqual([0x7f, 0x27, 0x13]);
  });

  it('level 3 dùng thuật toán cộng hằng số', () => {
    extended();
    expect(send([0x27, 0x03]).response).toEqual([0x67, 0x03, ...SEED]);
    expect(send([0x27, 0x04, ...computeKey(SEED, L3).key]).response).toEqual([0x67, 0x04]);
    expect(ecu.getState().unlockedLevel).toBe(3);
  });

  it('sendKey cho level khác với seed đang chờ → 24', () => {
    extended();
    send([0x27, 0x01]);
    expect(send([0x27, 0x04, ...KEY_L1]).response).toEqual([0x7f, 0x27, 0x24]);
  });

  it('sub-function không cấu hình → 7F 27 12; level sinh theo cấu hình', () => {
    extended();
    expect(send([0x27, 0x05]).response).toEqual([0x7f, 0x27, 0x12]);
    config.security.levels.push({ ...L1, level: 5 });
    ecu.setConfig(config);
    expect(send([0x27, 0x05]).response?.slice(0, 2)).toEqual([0x67, 0x05]);
  });

  it('đổi session xóa seed đang chờ và khóa security', () => {
    extended();
    unlock();
    send([0x27, 0x01]);
    send([0x10, 0x02]);
    expect(ecu.getState().unlockedLevel).toBeNull();
    expect(send([0x27, 0x02, ...KEY_L1]).response).toEqual([0x7f, 0x27, 0x24]);
  });
});

describe('0x2E WriteDataByIdentifier', () => {
  const writeVin = (vin = NEW_VIN) => [0x2e, 0xf1, 0x90, ...vin];

  it('default session → 7F 2E 7F', () => {
    expect(send(writeVin()).response).toEqual([0x7f, 0x2e, 0x7f]);
  });

  it('extended nhưng chưa unlock → 7F 2E 33', () => {
    extended();
    expect(send(writeVin()).response).toEqual([0x7f, 0x2e, 0x33]);
  });

  it('extended + unlock → 6E F1 90, đọc lại bằng 0x22 thấy VIN mới', () => {
    extended();
    unlock();
    const r = send(writeVin());
    expect(r.response).toEqual([0x6e, 0xf1, 0x90]);
    expect(r.stateChanges[0]).toMatchObject({ kind: 'didWritten', did: 0xf190 });
    expect(send([0x22, 0xf1, 0x90]).response).toEqual([0x62, 0xf1, 0x90, ...NEW_VIN]);
  });

  it('điện áp ắc quy thấp → 7F 2E 93; quá cao → 7F 2E 92', () => {
    extended();
    unlock();
    expect(send(writeVin(), { conditions: { batteryVoltage: 10.5 } }).response).toEqual([0x7f, 0x2e, 0x93]);
    expect(send(writeVin(), { conditions: { batteryVoltage: 16 } }).response).toEqual([0x7f, 0x2e, 0x92]);
  });

  it('sai độ dài dữ liệu → 13; DID chỉ đọc → 31; DID không tồn tại → 31; thiếu dữ liệu → 13', () => {
    extended();
    unlock();
    expect(send(writeVin(NEW_VIN.slice(0, 10))).response).toEqual([0x7f, 0x2e, 0x13]);
    expect(send([0x2e, 0xf1, 0x87, ...asciiBytes('ABCDEFGHIJ')]).response).toEqual([0x7f, 0x2e, 0x31]);
    expect(send([0x2e, 0x12, 0x34, 0x00]).response).toEqual([0x7f, 0x2e, 0x31]);
    expect(send([0x2e, 0xf1, 0x90]).response).toEqual([0x7f, 0x2e, 0x13]);
  });

  it('thứ tự kiểm tra: DID chỉ đọc (0x31) được báo trước security (0x33)', () => {
    extended();
    expect(send([0x2e, 0xf1, 0x87, ...asciiBytes('ABCDEFGHIJ')]).response).toEqual([0x7f, 0x2e, 0x31]);
  });
});

describe('0x11 ECUReset', () => {
  it('xe đang chạy → 7F 11 88; động cơ chạy → 7F 11 83', () => {
    expect(send([0x11, 0x01], { conditions: { speedKmh: 30 } }).response).toEqual([0x7f, 0x11, 0x88]);
    expect(send([0x11, 0x01], { conditions: { engineRunning: true, rpm: 800 } }).response).toEqual([0x7f, 0x11, 0x83]);
  });

  it('điều kiện có thể tắt trong cấu hình', () => {
    config.ecuReset = { requireStandstill: false, requireEngineOff: false };
    ecu.setConfig(config);
    expect(send([0x11, 0x01], { conditions: { speedKmh: 30, engineRunning: true } }).response).toEqual([0x51, 0x01]);
  });

  it('positive → 51 01, về default session, khóa security, khởi động lại', () => {
    extended();
    unlock();
    const r = send([0x11, 0x01]);
    expect(r.response).toEqual([0x51, 0x01]);
    const s = ecu.getState();
    expect(s.session).toBe('default');
    expect(s.unlockedLevel).toBeNull();
    expect(s.s3Deadline).toBeNull();
    expect(s.rebootUntil).toBe(now + REBOOT_MS);
    expect(r.stateChanges.map((c) => c.kind)).toEqual(['security', 'session', 'reboot']);
  });

  it('trong lúc khởi động lại ECU không trả lời; xong thì hoạt động lại', () => {
    send([0x11, 0x03]);
    const during = send([0x3e, 0x00], { at: now + 500 });
    expect(during.outcome).toBe('noResponse');
    expect(during.response).toBeNull();
    const after = send([0x3e, 0x00], { at: now + REBOOT_MS });
    expect(after.stateChanges[0]).toMatchObject({ kind: 'reboot', phase: 'done' });
    expect(after.response).toEqual([0x7e, 0x00]);
  });

  it('11 04 → 7F 11 12; 11 81 → không response nhưng vẫn reset', () => {
    expect(send([0x11, 0x04]).response).toEqual([0x7f, 0x11, 0x12]);
    const r = send([0x11, 0x81]);
    expect(r.outcome).toBe('suppressed');
    expect(ecu.getState().rebootUntil).not.toBeNull();
  });

  it('giá trị DID đã ghi được giữ qua ECU reset', () => {
    extended();
    unlock();
    send([0x2e, 0x02, 0x00, 0x00]);
    send([0x11, 0x01]);
    expect(send([0x22, 0x02, 0x00], { at: now + REBOOT_MS }).response).toEqual([0x62, 0x02, 0x00, 0x00]);
  });
});

describe('chú thích byte cho 0x27 / 0x2E / 0x11', () => {
  it('seed, key, dữ liệu ghi', () => {
    const seedFields = annotatePdu([0x67, 0x01, ...SEED], { direction: 'response', config });
    expect(seedFields.map((f) => f.fieldId)).toEqual(['sid', 'sub', 'seed']);
    expect(seedFields[1]!.meaning).toContain('requestSeed (level 1)');
    expect(annotatePdu([0x67, 0x01, 0, 0, 0, 0], { direction: 'response', config })[2]!.meaning).toContain('đã mở');
    expect(annotatePdu([0x27, 0x02, ...KEY_L1], { direction: 'request', config }).map((f) => f.fieldId)).toEqual(['sid', 'sub', 'key']);
    const write = annotatePdu([0x2e, 0xf1, 0x90, ...NEW_VIN], { direction: 'request', config });
    expect(write.map((f) => f.kind)).toEqual(['sid', 'did', 'data']);
    expect(write[2]!.meaning).toContain('"VNTEST0000ABC1234"');
    expect(annotatePdu([0x6e, 0xf1, 0x90], { direction: 'response', config }).map((f) => f.kind)).toEqual(['sid', 'did']);
    expect(annotatePdu([0x51, 0x01], { direction: 'response', config })[1]!.meaning).toContain('hardReset');
  });
});
