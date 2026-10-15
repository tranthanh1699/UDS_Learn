import { describe, expect, it } from 'vitest';
import { DEFAULT_VEHICLE } from '../../data/defaultVehicle';
import { buildExchange } from '../trace/exchange';
import { UdsServer } from '../uds/engine';
import { asciiBytes } from '../util/hex';
import { annotateFrame, annotatePdu, annotatePduBytes } from './index';

const config = DEFAULT_VEHICLE;
const kinds = (a: { kind: string }[]) => a.map((x) => x.kind);

function exchange(request: number[], addressing: 'physical' | 'functional' = 'physical') {
  const ecu = new UdsServer(structuredClone(config));
  const result = ecu.handleRequest(request, { addressing, now: 0, conditions: config.conditions });
  return buildExchange(1, 0, config, result);
}

describe('annotatePdu', () => {
  it('request 10 83: SID + sub-function với bit suppress', () => {
    const fields = annotatePdu([0x10, 0x83], { direction: 'request', config });
    expect(kinds(fields)).toEqual(['sid', 'sub']);
    expect(fields[1]!.bits![0]).toMatchObject({ range: '7', value: '1' });
    expect(fields[1]!.meaning).toContain('extendedDiagnosticSession');
  });

  it('response 62: giải thích 0x62 = 0x22 + 0x40', () => {
    const fields = annotatePdu([0x62, 0xf1, 0x86, 0x01], { direction: 'response', config });
    expect(fields[0]!.meaning).toContain('0x62 = 0x22 + 0x40');
    expect(kinds(fields)).toEqual(['sid', 'did', 'data']);
  });

  it('response 50: P2 và P2*', () => {
    const fields = annotatePdu([0x50, 0x03, 0x00, 0x32, 0x01, 0xf4], { direction: 'response', config });
    expect(fields.map((f) => f.fieldId)).toEqual(['sid', 'sub', 'p2', 'p2star']);
    expect(fields[3]!.meaning).toContain('5000 ms');
  });

  it('negative response 7F 22 31', () => {
    const fields = annotatePdu([0x7f, 0x22, 0x31], { direction: 'response', config });
    expect(kinds(fields)).toEqual(['sid', 'sid', 'nrc']);
    expect(fields[2]!.meaning).toContain('requestOutOfRange');
  });

  it('dữ liệu VIN được giải mã ASCII', () => {
    const vin = asciiBytes('VNLAB2026UDS00001');
    const fields = annotatePdu([0x62, 0xf1, 0x90, ...vin], { direction: 'response', config });
    expect(fields[2]!.meaning).toContain('"VNLAB2026UDS00001"');
    expect(fields[2]!.byteNotes![0]).toContain("'V'");
  });

  it('byte thừa trong request 0x10', () => {
    expect(annotatePdu([0x10, 0x03, 0x00], { direction: 'request', config }).at(-1)!.fieldId).toBe('rest-2');
  });
});

describe('annotateFrame', () => {
  it('Single Frame 03 22 F1 90 + padding', () => {
    const data = [0x03, 0x22, 0xf1, 0x90, 0xcc, 0xcc, 0xcc, 0xcc];
    const a = annotateFrame({ data, kind: 'SF', fd: false, pciLength: 1, padStart: 4 }, annotatePdu([0x22, 0xf1, 0x90], { direction: 'request', config }));
    expect(kinds(a)).toEqual(['pci', 'sid', 'did', 'did', 'pad', 'pad', 'pad', 'pad']);
    expect(a[2]!.fieldId).toBe(a[3]!.fieldId);
    expect(a[0]!.bits).toHaveLength(2);
  });

  it('PDU không có PCI', () => {
    expect(kinds(annotatePduBytes([0x3e, 0x00], annotatePdu([0x3e, 0x00], { direction: 'request', config })))).toEqual(['sid', 'sub']);
  });
});

describe('buildExchange', () => {
  it('22 F1 90: SF Tx, FF Rx, FC Tx, CF Rx, CF Rx với đúng CAN ID', () => {
    const ex = exchange([0x22, 0xf1, 0x90]);
    expect(ex.frames.map((f) => `${f.dir}:${f.kind}:${f.canId.toString(16)}`)).toEqual([
      'Tx:SF:7e0',
      'Rx:FF:7e8',
      'Tx:FC:7e0',
      'Rx:CF:7e8',
      'Rx:CF:7e8',
    ]);
    // Byte payload trong Consecutive Frame vẫn được ánh xạ về trường dữ liệu DID
    expect(ex.frames[3]!.annotations[1]!.kind).toBe('data');
    expect(ex.frames[1]!.annotations.slice(0, 2).every((a) => a.kind === 'pci')).toBe(true);
    // Thời gian tăng dần
    const ts = ex.frames.map((f) => f.t);
    expect([...ts].sort((x, y) => x - y)).toEqual(ts);
  });

  it('functional request dùng CAN ID 0x7DF', () => {
    const ex = exchange([0x3e, 0x00], 'functional');
    expect(ex.frames[0]!.canId).toBe(0x7df);
    expect(ex.frames[1]!.canId).toBe(0x7e8);
  });

  it('response bị suppress: chỉ có frame request', () => {
    expect(exchange([0x3e, 0x80]).frames).toHaveLength(1);
  });

  it('negative response có màu NRC ở byte cuối', () => {
    const ex = exchange([0x22, 0x12, 0x34]);
    expect(kinds(ex.frames[1]!.annotations).slice(0, 4)).toEqual(['pci', 'sid', 'sid', 'nrc']);
  });
});
