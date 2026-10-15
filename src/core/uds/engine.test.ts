import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_VEHICLE } from '../../data/defaultVehicle';
import { planTransfer } from '../isotp';
import { asciiBytes } from '../util/hex';
import type { Addressing, VehicleConditions } from '../vehicle/types';
import { UdsServer } from './engine';
import type { UdsResult } from './types';

const VIN = asciiBytes('VNLAB2026UDS00001');
const COND: VehicleConditions = DEFAULT_VEHICLE.conditions;

let ecu: UdsServer;
let now: number;

beforeEach(() => {
  ecu = new UdsServer(structuredClone(DEFAULT_VEHICLE));
  now = 1_000;
});

function send(request: number[], opts: { addressing?: Addressing; at?: number; pending?: boolean; conditions?: Partial<VehicleConditions> } = {}): UdsResult {
  if (opts.at !== undefined) now = opts.at;
  return ecu.handleRequest(request, {
    addressing: opts.addressing ?? 'physical',
    now,
    conditions: { ...COND, ...opts.conditions },
    simulateResponsePending: opts.pending,
  });
}

describe('0x10 DiagnosticSessionControl', () => {
  it('10 03 → 50 03 00 32 01 F4', () => {
    const r = send([0x10, 0x03]);
    expect(r.outcome).toBe('positive');
    expect(r.response).toEqual([0x50, 0x03, 0x00, 0x32, 0x01, 0xf4]);
    expect(ecu.getState().session).toBe('extended');
  });

  it('10 83 → không có response nhưng vẫn chuyển session', () => {
    const r = send([0x10, 0x83]);
    expect(r.outcome).toBe('suppressed');
    expect(r.response).toBeNull();
    expect(r.suppressPosRsp).toBe(true);
    expect(r.subFunction).toBe(0x03);
    expect(ecu.getState().session).toBe('extended');
  });

  it('10 01 → 50 01 ..., 10 02 → programming session', () => {
    expect(send([0x10, 0x01]).response).toEqual([0x50, 0x01, 0x00, 0x32, 0x01, 0xf4]);
    send([0x10, 0x02]);
    expect(ecu.getState().session).toBe('programming');
  });

  it('sub-function không hỗ trợ → 7F 10 12', () => {
    const r = send([0x10, 0x04]);
    expect(r.response).toEqual([0x7f, 0x10, 0x12]);
    expect(r.steps.find((s) => s.status === 'failed')?.id).toBe('subFunctionSupported');
  });

  it('thiếu hoặc thừa byte → 7F 10 13', () => {
    expect(send([0x10]).response).toEqual([0x7f, 0x10, 0x13]);
    const r = send([0x10, 0x03, 0x00]);
    expect(r.response).toEqual([0x7f, 0x10, 0x13]);
    expect(r.steps.find((s) => s.status === 'failed')?.id).toBe('serviceSpecific');
    expect(ecu.getState().session).toBe('default');
  });

  it('đổi session khóa lại security', () => {
    send([0x10, 0x03]);
    ecu.patchState({ unlockedLevel: 1 });
    const r = send([0x10, 0x01]);
    expect(ecu.getState().unlockedLevel).toBeNull();
    expect(r.stateChanges.map((c) => c.kind)).toEqual(['session', 'security']);
  });

  it('P2/P2* trong response lấy từ cấu hình', () => {
    ecu.setConfig({ ...DEFAULT_VEHICLE, timing: { p2Ms: 25, p2StarMs: 2000, s3Ms: 5000 } });
    expect(send([0x10, 0x03]).response).toEqual([0x50, 0x03, 0x00, 0x19, 0x00, 0xc8]);
  });
});

describe('0x3E TesterPresent', () => {
  it('3E 00 → 7E 00', () => {
    expect(send([0x3e, 0x00]).response).toEqual([0x7e, 0x00]);
  });

  it('3E 80 → không có response', () => {
    const r = send([0x3e, 0x80]);
    expect(r.outcome).toBe('suppressed');
    expect(r.response).toBeNull();
  });

  it('physical 3E 05 → 7F 3E 12', () => {
    expect(send([0x3e, 0x05]).response).toEqual([0x7f, 0x3e, 0x12]);
  });

  it('functional 3E 05 → không gửi NRC', () => {
    const r = send([0x3e, 0x05], { addressing: 'functional' });
    expect(r.outcome).toBe('noResponse');
    expect(r.response).toBeNull();
    expect(r.nrc).toBe(0x12);
  });

  it('3E 00 00 → 7F 3E 13 (NRC 0x13 vẫn được gửi khi functional)', () => {
    expect(send([0x3e, 0x00, 0x00], { addressing: 'functional' }).response).toEqual([0x7f, 0x3e, 0x13]);
  });
});

describe('S3 timer', () => {
  it('hết S3 → quay về default session và khóa security', () => {
    send([0x10, 0x03], { at: 0 });
    ecu.patchState({ unlockedLevel: 1 });
    expect(ecu.getState().s3Deadline).toBe(5000);
    expect(ecu.tick(4999)).toEqual([]);
    const changes = ecu.tick(5000);
    expect(changes.map((c) => c.kind)).toEqual(['session', 'security']);
    expect(ecu.getState()).toMatchObject({ session: 'default', unlockedLevel: null, s3Deadline: null });
  });

  it('TesterPresent khởi động lại S3', () => {
    send([0x10, 0x03], { at: 0 });
    send([0x3e, 0x80], { at: 4000 });
    expect(ecu.tick(8999)).toEqual([]);
    expect(ecu.getState().session).toBe('extended');
    ecu.tick(9000);
    expect(ecu.getState().session).toBe('default');
  });

  it('request đến sau khi S3 hết hạn được xử lý trong default session', () => {
    send([0x10, 0x03], { at: 0 });
    const r = send([0x22, 0xf1, 0x86], { at: 6000 });
    expect(r.stateChanges[0]).toMatchObject({ kind: 'session', from: 'extended', to: 'default' });
    expect(r.response).toEqual([0x62, 0xf1, 0x86, 0x01]);
  });

  it('S3 không chạy trong default session', () => {
    send([0x3e, 0x00]);
    expect(ecu.getState().s3Deadline).toBeNull();
  });
});

describe('0x22 ReadDataByIdentifier', () => {
  it('22 F1 90 → 62 F1 90 + VIN, chia thành FF/FC/CF/CF', () => {
    const r = send([0x22, 0xf1, 0x90]);
    expect(r.response).toEqual([0x62, 0xf1, 0x90, ...VIN]);
    const { padding, bs, stMin } = DEFAULT_VEHICLE.can;
    const frames = planTransfer(r.response!, { fd: false, padding }, { bs, stMin });
    expect(frames.map((f) => [f.from, f.data])).toEqual([
      ['sender', [0x10, 0x14, 0x62, 0xf1, 0x90, ...VIN.slice(0, 3)]],
      ['receiver', [0x30, 0x00, 0x00, 0xcc, 0xcc, 0xcc, 0xcc, 0xcc]],
      ['sender', [0x21, ...VIN.slice(3, 10)]],
      ['sender', [0x22, ...VIN.slice(10, 17)]],
    ]);
  });

  it('DID không tồn tại → 7F 22 31', () => {
    expect(send([0x22, 0x12, 0x34]).response).toEqual([0x7f, 0x22, 0x31]);
  });

  it('22 F1 → 7F 22 13 (thiếu độ dài tối thiểu)', () => {
    const r = send([0x22, 0xf1]);
    expect(r.response).toEqual([0x7f, 0x22, 0x13]);
    expect(r.steps.find((s) => s.status === 'failed')?.id).toBe('minLength');
  });

  it('số byte DID lẻ → 7F 22 13', () => {
    expect(send([0x22, 0xf1, 0x90, 0xf1]).response).toEqual([0x7f, 0x22, 0x13]);
  });

  it('quá số DID tối đa → 7F 22 13', () => {
    const req = [0x22, ...Array.from({ length: 9 }, () => [0xf1, 0x86]).flat()];
    expect(send(req).response).toEqual([0x7f, 0x22, 0x13]);
  });

  it('đọc nhiều DID trong một request', () => {
    expect(send([0x22, 0xf1, 0x86, 0x01, 0x02]).response).toEqual([0x62, 0xf1, 0x86, 0x01, 0x01, 0x02, 126]);
  });

  it('bỏ qua DID không hỗ trợ khi vẫn còn DID hợp lệ', () => {
    const r = send([0x22, 0x12, 0x34, 0xf1, 0x86]);
    expect(r.response).toEqual([0x62, 0xf1, 0x86, 0x01]);
  });

  it('DID dữ liệu sống: tốc độ, RPM, điện áp, session', () => {
    const cond = { speedKmh: 88, rpm: 2500, batteryVoltage: 13.8 };
    expect(send([0x22, 0x01, 0x00], { conditions: cond }).response).toEqual([0x62, 0x01, 0x00, 88]);
    expect(send([0x22, 0x01, 0x01], { conditions: cond }).response).toEqual([0x62, 0x01, 0x01, 0x09, 0xc4]);
    expect(send([0x22, 0x01, 0x02], { conditions: cond }).response).toEqual([0x62, 0x01, 0x02, 138]);
    send([0x10, 0x03]);
    expect(send([0x22, 0xf1, 0x86]).response).toEqual([0x62, 0xf1, 0x86, 0x03]);
  });

  it('DID chỉ đọc trong extended session → 0x31 ở default, 0x33 khi khóa, OK khi mở', () => {
    expect(send([0x22, 0x02, 0x01]).response).toEqual([0x7f, 0x22, 0x31]);
    send([0x10, 0x03]);
    expect(send([0x22, 0x02, 0x01]).response).toEqual([0x7f, 0x22, 0x33]);
    ecu.patchState({ unlockedLevel: 1 });
    expect(send([0x22, 0x02, 0x01]).response).toEqual([0x62, 0x02, 0x01, 0xde, 0xad, 0xbe, 0xef]);
  });

  it('giá trị đã ghi được đọc lại', () => {
    ecu.patchState({ didValues: { 0x0200: [0x00] } });
    expect(send([0x22, 0x02, 0x00]).response).toEqual([0x62, 0x02, 0x00, 0x00]);
  });

  it('response vượt giới hạn → 7F 22 14', () => {
    ecu.setConfig({ ...DEFAULT_VEHICLE, limits: { maxDidsPerRead: 8, maxResponseLength: 10 } });
    expect(send([0x22, 0xf1, 0x90]).response).toEqual([0x7f, 0x22, 0x14]);
  });

  it('functional: DID không tồn tại → không gửi NRC 0x31', () => {
    expect(send([0x22, 0x12, 0x34], { addressing: 'functional' }).outcome).toBe('noResponse');
  });
});

describe('quy tắc chung', () => {
  it('SID không hỗ trợ → 7F xx 11, các bước sau bị skip', () => {
    const r = send([0x99, 0x00]);
    expect(r.response).toEqual([0x7f, 0x99, 0x11]);
    expect(r.steps[0]).toMatchObject({ id: 'sidSupported', status: 'failed', nrc: 0x11 });
    expect(r.steps.slice(1).every((s) => s.status === 'skipped')).toBe(true);
    expect(r.steps).toHaveLength(9);
  });

  it('functional: SID không hỗ trợ → im lặng', () => {
    expect(send([0x99], { addressing: 'functional' }).outcome).toBe('noResponse');
  });

  it('pipeline đủ 9 bước khi positive, service không có sub-function được đánh dấu notApplicable', () => {
    const r = send([0x22, 0xf1, 0x86]);
    const generic = r.steps.filter((s) => s.order < 9);
    expect(generic.map((s) => s.status)).toEqual([
      'passed', 'passed', 'passed', 'passed', 'notApplicable', 'notApplicable', 'notApplicable', 'notApplicable',
    ]);
    expect(r.steps.filter((s) => s.order === 9).every((s) => s.status === 'passed')).toBe(true);
  });

  it('request rỗng → không response', () => {
    expect(send([]).outcome).toBe('noResponse');
  });

  it('giả lập 0x78: gửi 7F 10 78 trước, response cuối vẫn gửi dù có suppress bit', () => {
    const r = send([0x10, 0x83], { pending: true });
    expect(r.pendingResponses).toEqual([[0x7f, 0x10, 0x78]]);
    expect(r.outcome).toBe('positive');
    expect(r.response).toEqual([0x50, 0x03, 0x00, 0x32, 0x01, 0xf4]);
  });

  it('giải thích negative response bằng tiếng Việt', () => {
    const r = send([0x22, 0x12, 0x34]);
    expect(r.explanation).toContain('NRC 0x31 (requestOutOfRange)');
  });
});
