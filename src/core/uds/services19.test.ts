import { describe, expect, it } from 'vitest';
import { DEFAULT_VEHICLE } from '../../data/defaultVehicle';
import { annotatePdu } from '../annotate';
import { DEFAULT_DTC_CONFIG, defaultCatalog } from '../dtc/catalog';
import { dtcViewsForEcu, endOperationCycle, initialDtcState, injectFault, runTests, startOperationCycle } from '../dtc/faultModel';
import type { DtcMemoryState } from '../dtc/types';
import type { VehicleConditions } from '../vehicle/types';
import { UdsServer } from './engine';
import type { UdsResult } from './types';

const catalog = defaultCatalog();
const cfg = DEFAULT_DTC_CONFIG;
const engineDtcs = catalog.filter((c) => c.ecu === 'engine');
const O2 = 'o2Sensor:openCircuit'; // P0130-13 = 01 30 13
const FAULT_COND: VehicleConditions = { speedKmh: 0, rpm: 850, engineRunning: true, batteryVoltage: 13.8, gear: 'P' };

/** Hai operation cycle có lỗi O2 → DTC confirmed (status 0xAF), snapshot chụp lúc lỗi đầu tiên. */
function confirmedO2(): DtcMemoryState {
  let s = injectFault(initialDtcState(catalog), O2);
  for (let cycle = 0; cycle < 2; cycle++) {
    s = startOperationCycle(s).state;
    for (let i = 0; i < 3; i++) s = runTests(s, catalog, cfg, FAULT_COND).state;
    if (cycle === 0) s = endOperationCycle(s, cfg).state;
  }
  return s;
}

function send(req: number[], dtcState: DtcMemoryState): UdsResult {
  const ecu = new UdsServer(structuredClone(DEFAULT_VEHICLE));
  return ecu.handleRequest(req, {
    addressing: 'physical',
    now: 0,
    conditions: DEFAULT_VEHICLE.conditions,
    dtcs: dtcViewsForEcu(dtcState, catalog, 'engine'),
  });
}

describe('0x19 ReadDTCInformation', () => {
  const state = confirmedO2();

  it('trạng thái mô phỏng: O2 confirmed 0xAF, DTC khác đã test đạt 0x00', () => {
    const views = dtcViewsForEcu(state, catalog, 'engine');
    expect(views).toHaveLength(engineDtcs.length);
    expect(views.find((v) => v.dtc === 0x013013)!.status).toBe(0xaf);
    expect(views.filter((v) => v.dtc !== 0x013013).every((v) => v.status === 0x00)).toBe(true);
  });

  it('19 01 08 → 59 01 FF 01 00 01 (1 DTC confirmed)', () => {
    expect(send([0x19, 0x01, 0x08], state).response).toEqual([0x59, 0x01, 0xff, 0x01, 0x00, 0x01]);
  });

  it('19 01 FF khi chưa test lần nào: mọi DTC có status 0x50 đều khớp', () => {
    expect(send([0x19, 0x01, 0xff], initialDtcState(catalog)).response).toEqual([0x59, 0x01, 0xff, 0x01, 0x00, engineDtcs.length]);
  });

  it('19 02 08 → 59 02 FF 01 30 13 AF', () => {
    expect(send([0x19, 0x02, 0x08], state).response).toEqual([0x59, 0x02, 0xff, 0x01, 0x30, 0x13, 0xaf]);
  });

  it('19 02 với mask không khớp → danh sách rỗng', () => {
    expect(send([0x19, 0x02, 0x10], state).response).toEqual([0x59, 0x02, 0xff]);
  });

  it('19 0A → toàn bộ DTC hỗ trợ kèm status', () => {
    const r = send([0x19, 0x0a], state).response!;
    expect(r.slice(0, 3)).toEqual([0x59, 0x0a, 0xff]);
    expect(r.length).toBe(3 + 4 * engineDtcs.length);
    expect(r.slice(3, 7)).toEqual([0x01, 0x30, 0x13, 0xaf]);
  });

  it('19 04 01 30 13 01 → snapshot 3 DID: tốc độ, RPM, điện áp lúc lỗi', () => {
    expect(send([0x19, 0x04, 0x01, 0x30, 0x13, 0x01], state).response).toEqual([
      0x59, 0x04, 0x01, 0x30, 0x13, 0xaf, 0x01, 0x03, 0x01, 0x00, 0x00, 0x01, 0x01, 0x03, 0x52, 0x01, 0x02, 138,
    ]);
  });

  it('19 04 với DTC chưa từng lỗi → chỉ DTC + status', () => {
    expect(send([0x19, 0x04, 0x01, 0x15, 0x16, 0xff], state).response).toEqual([0x59, 0x04, 0x01, 0x15, 0x16, 0x00]);
  });

  it('19 06 … FF → occurrence counter và aging counter', () => {
    expect(send([0x19, 0x06, 0x01, 0x30, 0x13, 0xff], state).response).toEqual([0x59, 0x06, 0x01, 0x30, 0x13, 0xaf, 0x01, 0x02, 0x02, 0x00]);
    expect(send([0x19, 0x06, 0x01, 0x30, 0x13, 0x02], state).response).toEqual([0x59, 0x06, 0x01, 0x30, 0x13, 0xaf, 0x02, 0x00]);
  });

  it('DTC không thuộc ECU (DTC của ABS ECU) hoặc record sai → 7F 19 31', () => {
    expect(send([0x19, 0x04, 0x40, 0x35, 0x13, 0x01], state).response).toEqual([0x7f, 0x19, 0x31]);
    expect(send([0x19, 0x04, 0x01, 0x30, 0x13, 0x05], state).response).toEqual([0x7f, 0x19, 0x31]);
    expect(send([0x19, 0x06, 0x01, 0x30, 0x13, 0x10], state).response).toEqual([0x7f, 0x19, 0x31]);
  });

  it('sai độ dài → 13; sub-function chưa hỗ trợ → 12', () => {
    expect(send([0x19, 0x02], state).response).toEqual([0x7f, 0x19, 0x13]);
    expect(send([0x19, 0x0a, 0x00], state).response).toEqual([0x7f, 0x19, 0x13]);
    expect(send([0x19, 0x03], state).response).toEqual([0x7f, 0x19, 0x12]);
  });

  it('chú thích byte: mask, DTC, status, snapshot', () => {
    const config = DEFAULT_VEHICLE;
    expect(annotatePdu([0x19, 0x02, 0x08], { direction: 'request', config }).map((f) => f.fieldId)).toEqual(['sid', 'sub', 'mask']);
    const rsp = annotatePdu([0x59, 0x02, 0xff, 0x01, 0x30, 0x13, 0xaf], { direction: 'response', config });
    expect(rsp.map((f) => f.kind)).toEqual(['sid', 'sub', 'data', 'did', 'data']);
    expect(rsp[3]!.meaning).toContain('P0130-13');
    expect(rsp[4]!.bits).toHaveLength(8);
    const snap = annotatePdu(send([0x19, 0x04, 0x01, 0x30, 0x13, 0x01], state).response!, { direction: 'response', config });
    expect(snap.find((f) => f.fieldId.startsWith('sdata'))!.meaning).toContain('0');
    expect(snap.at(-1)!.meaning).toContain('13.8 V');
  });
});
