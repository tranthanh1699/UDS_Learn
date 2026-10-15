import { describe, expect, it } from 'vitest';
import { DEFAULT_VEHICLE } from '../../data/defaultVehicle';
import { UdsServer } from '../uds/engine';
import { computeKey } from '../uds/keyAlgorithm';
import { DEFAULT_DTC_CONFIG, defaultCatalog, encodeDtcCode, formatDtc } from './catalog';
import {
  clearDtcs,
  effectiveConditions,
  endOperationCycle,
  getBit,
  initialDtcState,
  injectFault,
  isRelevant,
  lampStates,
  removeFault,
  runTests,
  startOperationCycle,
} from './faultModel';
import type { DtcMemoryState } from './types';

const catalog = defaultCatalog();
const cfg = DEFAULT_DTC_CONFIG;
const cond = DEFAULT_VEHICLE.conditions;
const O2 = 'o2Sensor:openCircuit';

const status = (s: DtcMemoryState, id = O2) => s.events[id]!.status;
const test = (s: DtcMemoryState, n = 1) => {
  for (let i = 0; i < n; i++) s = runTests(s, catalog, cfg, cond).state;
  return s;
};
const start = (s: DtcMemoryState) => startOperationCycle(s).state;
const end = (s: DtcMemoryState) => endOperationCycle(s, cfg).state;

describe('mã DTC', () => {
  it('mã kiểu SAE ↔ 3 byte', () => {
    expect(encodeDtcCode('P0130')).toBe(0x0130);
    expect(encodeDtcCode('C0035')).toBe(0x4035);
    expect(encodeDtcCode('U0121')).toBe(0xc121);
    expect(formatDtc(0x013013)).toBe('P0130-13');
    expect(formatDtc(0x403564)).toBe('C0035-64');
  });

  it('danh mục mặc định: id duy nhất, DTC 3 byte', () => {
    expect(new Set(catalog.map((c) => c.id)).size).toBe(catalog.length);
    expect(catalog.find((c) => c.id === O2)!.dtc).toBe(0x013013);
  });
});

describe('status byte', () => {
  it('trạng thái ban đầu 0x50', () => {
    expect(status(initialDtcState(catalog))).toBe(0x50);
  });

  it('không có operation cycle thì test không chạy', () => {
    const s = injectFault(initialDtcState(catalog), O2);
    const r = runTests(s, catalog, cfg, cond);
    expect(r.changes).toEqual([]);
    expect(r.notes[0]).toContain('operation cycle');
  });

  it('bắt đầu cycle: bit1 = 0, bit6 = 1', () => {
    let s = start(injectFault(initialDtcState(catalog), O2));
    s = test(s, 3);
    s = end(s);
    s = start(s);
    expect(getBit(status(s), 1)).toBe(0);
    expect(getBit(status(s), 6)).toBe(1);
  });

  it('inject + N lần test → testFailed, pending; chưa confirmed ở cycle đầu', () => {
    let s = start(injectFault(initialDtcState(catalog), O2));
    s = test(s, 2);
    expect(getBit(status(s), 0)).toBe(0);
    expect(s.events[O2]!.debounce).toBe(2);
    s = test(s, 1);
    // bit0, bit1, bit2, bit5 = 1; bit4, bit6 = 0; chưa confirmed
    expect(status(s)).toBe(0b0010_0111);
    expect(s.events[O2]!.snapshot).not.toBeNull();
  });

  it('confirmed sau ngưỡng số cycle lỗi; bit7 bật đèn MIL', () => {
    let s = start(injectFault(initialDtcState(catalog), O2));
    s = end(test(s, 3));
    expect(getBit(status(s), 3)).toBe(0);
    const r = runTests(runTests(runTests(start(s), catalog, cfg, cond).state, catalog, cfg, cond).state, catalog, cfg, cond);
    s = r.state;
    expect(status(s)).toBe(0b1010_1111);
    expect(lampStates(s, catalog)).toEqual({ mil: true, abs: false });
    const change = r.changes.find((c) => c.eventId === O2)!;
    // bit0 vẫn = 1 từ cycle trước (testFailed giữ tới khi test được xác nhận đạt), nên chỉ bit 1, 6, 3, 7 đổi
    expect(change.bitChanges.map((b) => b.bit).sort()).toEqual([1, 3, 6, 7]);
    expect(change.bitChanges.every((b) => b.reason.length > 0)).toBe(true);
  });

  it('gỡ lỗi → testFailed về 0 sau đủ số lần test đạt', () => {
    let s = start(injectFault(initialDtcState(catalog), O2));
    s = test(s, 3);
    s = removeFault(s, O2);
    s = test(s, 5);
    expect(getBit(status(s), 0)).toBe(1);
    s = test(s, 1);
    expect(getBit(status(s), 0)).toBe(0);
    expect(s.events[O2]!.debounce).toBe(cfg.passThreshold);
  });

  it('healing tắt bit7 sau số cycle cấu hình, aging xóa confirmed sau đó', () => {
    let s = injectFault(initialDtcState(catalog), O2);
    s = end(test(start(s), 3));
    s = end(test(start(s), 3)); // confirmed
    s = removeFault(s, O2);
    // cycle không lỗi #1
    s = end(test(start(s), 3));
    expect(getBit(status(s), 2)).toBe(0);
    expect(getBit(status(s), 7)).toBe(1);
    // cycle không lỗi #2 → healing
    s = end(test(start(s), 3));
    expect(getBit(status(s), 7)).toBe(0);
    expect(getBit(status(s), 3)).toBe(1);
    expect(lampStates(s, catalog).mil).toBe(false);
    // cycle không lỗi #3 → aging
    s = end(test(start(s), 3));
    expect(getBit(status(s), 3)).toBe(0);
    // testFailedSinceLastClear vẫn giữ
    expect(getBit(status(s), 5)).toBe(1);
  });

  it('cycle không chạy test thì kết thúc cycle không đổi pending/aging', () => {
    let s = injectFault(initialDtcState(catalog), O2);
    s = end(test(start(s), 3));
    s = end(start(s));
    expect(getBit(status(s), 2)).toBe(1);
  });

  it('pending bị xóa và đếm cycle lỗi về 0 nếu có cycle đạt trước khi confirmed', () => {
    let s = injectFault(initialDtcState(catalog), O2);
    s = end(test(start(s), 3));
    s = removeFault(s, O2);
    s = end(test(start(s), 3));
    expect(getBit(status(s), 2)).toBe(0);
    s = injectFault(s, O2);
    s = test(start(s), 3);
    expect(getBit(status(s), 3)).toBe(0);
  });

  it('xóa DTC → 0x50', () => {
    let s = injectFault(initialDtcState(catalog), O2);
    s = end(test(start(s), 3));
    s = clearDtcs(s).state;
    expect(status(s)).toBe(0x50);
    expect(isRelevant(s.events[O2]!, [])).toBe(false);
  });

  it('DTC không có đèn thì không bật bit7', () => {
    const bat = 'battery:outOfRangeLow';
    let s = injectFault(initialDtcState(catalog), bat);
    s = end(test(start(s), 3));
    s = test(start(s), 3);
    expect(getBit(status(s, bat), 3)).toBe(1);
    expect(getBit(status(s, bat), 7)).toBe(0);
  });
});

describe('lỗi ảnh hưởng tới UDS', () => {
  it('lỗi ắc quy → điện áp 10,5 V → 0x2E trả 7F 2E 93', () => {
    const c = effectiveConditions(cond, ['battery:outOfRangeLow'], catalog);
    expect(c.batteryVoltage).toBe(10.5);
    const ecu = new UdsServer(structuredClone(DEFAULT_VEHICLE), { random: () => 0.5 });
    const send = (req: number[]) => ecu.handleRequest(req, { addressing: 'physical', now: 0, conditions: c });
    send([0x10, 0x03]);
    send([0x27, 0x01]);
    send([0x27, 0x02, ...computeKey([0x80, 0x80, 0x80, 0x80], DEFAULT_VEHICLE.security.levels[0]!).key]);
    expect(send([0x2e, 0x02, 0x00, 0x00]).response).toEqual([0x7f, 0x2e, 0x93]);
    // DID điện áp đọc được giá trị đã bị ghi đè
    expect(send([0x22, 0x01, 0x02]).response).toEqual([0x62, 0x01, 0x02, 105]);
  });

  it('lỗi ắc quy quá áp → 16,2 V', () => {
    expect(effectiveConditions(cond, ['battery:outOfRangeHigh'], catalog).batteryVoltage).toBe(16.2);
  });

  it('lỗi cảm biến tốc độ bánh → DID 0x0100 = 0xFF, 0x11 → 7F 11 22', () => {
    const c = effectiveConditions(cond, ['wssFL:signalImplausible'], catalog);
    expect(c.speedValid).toBe(false);
    const ecu = new UdsServer(structuredClone(DEFAULT_VEHICLE));
    const send = (req: number[]) => ecu.handleRequest(req, { addressing: 'physical', now: 0, conditions: c });
    expect(send([0x22, 0x01, 0x00]).response).toEqual([0x62, 0x01, 0x00, 0xff]);
    expect(send([0x11, 0x01]).response).toEqual([0x7f, 0x11, 0x22]);
  });

  it('không có lỗi thì điều kiện giữ nguyên', () => {
    expect(effectiveConditions(cond, [], catalog)).toEqual(cond);
  });
});
