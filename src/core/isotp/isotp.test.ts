import { describe, expect, it } from 'vitest';
import {
  decodePci,
  decodeStMin,
  encodeFlowControl,
  FlowStatus,
  IsoTpReassembler,
  type IsoTpConfig,
  planTransfer,
  segment,
} from './index';

const CLASSIC: IsoTpConfig = { fd: false, padding: 0xcc };
const FD: IsoTpConfig = { fd: true, padding: 0xcc };
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
const seq = (n: number) => Array.from({ length: n }, (_, i) => (i * 7 + 3) & 0xff);

describe('Single Frame', () => {
  it('Classic: 22 F1 90 → 03 22 F1 90 CC CC CC CC', () => {
    const [sf] = segment([0x22, 0xf1, 0x90], CLASSIC);
    expect(sf!.kind).toBe('SF');
    expect(sf!.data).toEqual([0x03, 0x22, 0xf1, 0x90, 0xcc, 0xcc, 0xcc, 0xcc]);
    expect(sf!.padStart).toBe(4);
  });
  it('Classic không padding: 02 10 03', () => {
    expect(segment([0x10, 0x03], { fd: false, padding: null })[0]!.data).toEqual([0x02, 0x10, 0x03]);
  });
  it('Classic: 7 byte là tối đa của Single Frame', () => {
    const s = segment(seq(7), CLASSIC);
    expect(s).toHaveLength(1);
    expect(s[0]!.data[0]).toBe(0x07);
  });
  it('CAN FD: payload ≤ 7 vẫn dùng PCI 0x0N trong frame 8 byte', () => {
    const [sf] = segment([0x3e, 0x00], FD);
    expect(sf!.data).toEqual([0x02, 0x3e, 0x00, 0xcc, 0xcc, 0xcc, 0xcc, 0xcc]);
  });
  it('CAN FD: payload > 7 dùng escape 0x00 LL, frame làm tròn lên 24 byte', () => {
    const payload = seq(20);
    const [sf] = segment(payload, FD);
    expect(sf!.kind).toBe('SF');
    expect(sf!.data.slice(0, 2)).toEqual([0x00, 0x14]);
    expect(sf!.data).toHaveLength(24);
    expect(sf!.data.slice(22)).toEqual([0xcc, 0xcc]);
  });
  it('CAN FD: 62 byte là tối đa của Single Frame', () => {
    expect(segment(seq(62), FD)).toHaveLength(1);
    expect(segment(seq(63), FD)[0]!.kind).toBe('FF');
  });
});

describe('First Frame / Consecutive Frame', () => {
  it('response 0x22 F190 với VIN 17 ký tự (Classic)', () => {
    const vin = ascii('WVWZZZ1JZXW000001');
    const payload = [0x62, 0xf1, 0x90, ...vin];
    const frames = segment(payload, CLASSIC);
    expect(frames.map((f) => f.data)).toEqual([
      [0x10, 0x14, 0x62, 0xf1, 0x90, ...vin.slice(0, 3)],
      [0x21, ...vin.slice(3, 10)],
      [0x22, ...vin.slice(10, 17)],
    ]);
  });
  it('Consecutive Frame cuối được padding', () => {
    const frames = segment(seq(10), CLASSIC); // FF chứa 6, CF chứa 4
    expect(frames[1]!.data).toEqual([0x21, ...seq(10).slice(6), 0xcc, 0xcc, 0xcc]);
    expect(frames[1]!.padStart).toBe(5);
  });
  it('SN quay vòng 1 → F → 0 → 1', () => {
    const frames = segment(seq(6 + 7 * 17), CLASSIC);
    const sns = frames.slice(1).map((f) => f.data[0]);
    expect(sns.slice(0, 17)).toEqual([
      0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2a, 0x2b, 0x2c, 0x2d, 0x2e, 0x2f, 0x20, 0x21,
    ]);
  });
  it('4095 byte: FF dạng 12-bit 1F FF', () => {
    expect(segment(seq(4095), CLASSIC)[0]!.data.slice(0, 2)).toEqual([0x1f, 0xff]);
  });
  it('4096 byte: FF dạng escape 10 00 00 00 10 00', () => {
    const ff = segment(seq(4096), CLASSIC)[0]!;
    expect(ff.data.slice(0, 6)).toEqual([0x10, 0x00, 0x00, 0x00, 0x10, 0x00]);
    expect(ff.pciLength).toBe(6);
    expect(ff.data).toHaveLength(8);
  });
  it('CAN FD: FF và CF dài 64 byte', () => {
    const frames = segment(seq(200), FD);
    expect(frames[0]!.data).toHaveLength(64);
    expect(frames[0]!.data.slice(0, 2)).toEqual([0x10, 0xc8]);
    expect(frames[1]!.data).toHaveLength(64);
    // 200 = 62 + 63 + 63 + 12 → CF cuối 13 byte, làm tròn lên 16
    expect(frames).toHaveLength(4);
    expect(frames[3]!.data).toHaveLength(16);
  });
});

describe('Flow Control', () => {
  it('CTS, BS = 0, STmin = 0: 30 00 00 CC CC CC CC CC', () => {
    expect(encodeFlowControl({ status: FlowStatus.CTS, bs: 0, stMin: 0 }, CLASSIC).data).toEqual([
      0x30, 0x00, 0x00, 0xcc, 0xcc, 0xcc, 0xcc, 0xcc,
    ]);
  });
  it('Wait và Overflow', () => {
    expect(encodeFlowControl({ status: FlowStatus.WAIT, bs: 0, stMin: 0 }, CLASSIC).data[0]).toBe(0x31);
    expect(encodeFlowControl({ status: FlowStatus.OVERFLOW, bs: 0, stMin: 0 }, CLASSIC).data[0]).toBe(0x32);
  });
  it('giải mã Flow Control', () => {
    expect(decodePci([0x30, 0x08, 0x14], false)).toEqual({ kind: 'FC', status: 0, bs: 8, stMin: 0x14, pciLength: 3 });
    expect(decodePci([0x33, 0x00, 0x00], false)).toEqual({ kind: 'error', code: 'invalidFlowStatus' });
  });
});

describe('STmin', () => {
  it.each([
    [0x00, 0, false],
    [0x14, 20_000, false],
    [0x7f, 127_000, false],
    [0xf1, 100, false],
    [0xf9, 900, false],
    [0x80, 127_000, true],
    [0xf0, 127_000, true],
    [0xfa, 127_000, true],
  ])('0x%s', (v, us, reserved) => {
    expect(decodeStMin(v)).toEqual({ microseconds: us, reserved });
  });
});

describe('decodePci', () => {
  it('nhận diện SF, FF, CF', () => {
    expect(decodePci([0x03, 0x22, 0xf1, 0x90, 0xcc, 0xcc, 0xcc, 0xcc], false)).toMatchObject({ kind: 'SF', length: 3, pciLength: 1 });
    expect(decodePci([0x10, 0x14, 0, 0, 0, 0, 0, 0], false)).toMatchObject({ kind: 'FF', length: 20, pciLength: 2 });
    expect(decodePci([0x2a, 0, 0, 0, 0, 0, 0, 0], false)).toMatchObject({ kind: 'CF', sn: 0xa });
  });
  it('báo lỗi PCI không hợp lệ', () => {
    expect(decodePci([], false)).toEqual({ kind: 'error', code: 'emptyFrame' });
    expect(decodePci([0x40, 0x00], false)).toEqual({ kind: 'error', code: 'unknownPciType' });
    expect(decodePci([0x00, 0x00], false)).toEqual({ kind: 'error', code: 'invalidSfLength' });
    expect(decodePci([0x08, 1, 2, 3, 4, 5, 6, 7], false)).toEqual({ kind: 'error', code: 'invalidSfLength' });
    expect(decodePci([0x05, 0x22, 0xf1], false)).toEqual({ kind: 'error', code: 'invalidSfLength' });
    expect(decodePci([0x10, 0x00, 0x00, 0x00, 0x00, 0x10, 0, 0], false)).toEqual({ kind: 'error', code: 'invalidFfLength' });
  });
  it('CAN FD: frame > 8 byte bắt buộc dùng escape SF', () => {
    expect(decodePci([0x03, ...new Array(11).fill(0)], true)).toEqual({ kind: 'error', code: 'invalidSfLength' });
  });
});

describe('IsoTpReassembler', () => {
  it('báo cần Flow Control sau First Frame và sau mỗi BS frame', () => {
    const payload = seq(6 + 7 * 5);
    const frames = segment(payload, CLASSIC);
    const rx = new IsoTpReassembler(CLASSIC, 2);
    const events = frames.map((f) => rx.feed(f.data));
    expect(events.map((e) => (e.type === 'inProgress' ? e.sendFlowControl : e.type))).toEqual([
      true, // FF
      false,
      true, // hết block 2 CF
      false,
      true,
      'complete',
    ]);
    expect(events.at(-1)).toEqual({ type: 'complete', payload });
  });
  it('SN sai → hủy bản tin', () => {
    const frames = segment(seq(20), CLASSIC);
    const rx = new IsoTpReassembler(CLASSIC);
    rx.feed(frames[0]!.data);
    expect(rx.feed(frames[2]!.data)).toEqual({ type: 'error', code: 'wrongSequenceNumber' });
    expect(rx.isReceiving).toBe(false);
  });
  it('Consecutive Frame không có First Frame trước đó', () => {
    expect(new IsoTpReassembler(CLASSIC).feed([0x21, 1, 2, 3, 4, 5, 6, 7])).toEqual({
      type: 'error',
      code: 'unexpectedConsecutiveFrame',
    });
  });
  it('First Frame mang độ dài vừa Single Frame bị từ chối', () => {
    expect(new IsoTpReassembler(CLASSIC).feed([0x10, 0x05, 1, 2, 3, 4, 5, 0xcc])).toEqual({
      type: 'error',
      code: 'invalidFfLength',
    });
  });
  it('bỏ qua Flow Control', () => {
    expect(new IsoTpReassembler(CLASSIC).feed([0x30, 0, 0])).toEqual({ type: 'ignored' });
  });
});

describe('planTransfer', () => {
  it('chèn Flow Control sau FF và sau mỗi block BS', () => {
    const plan = planTransfer(seq(6 + 7 * 5), CLASSIC, { bs: 2, stMin: 0x0a });
    expect(plan.map((f) => `${f.from === 'sender' ? 'S' : 'R'}:${f.kind}`)).toEqual([
      'S:FF', 'R:FC', 'S:CF', 'S:CF', 'R:FC', 'S:CF', 'S:CF', 'R:FC', 'S:CF',
    ]);
    expect(plan[1]!.data.slice(0, 3)).toEqual([0x30, 0x02, 0x0a]);
    expect(plan[2]!.minGapUs).toBe(10_000);
  });
  it('BS = 0: chỉ một Flow Control', () => {
    const plan = planTransfer(seq(100), CLASSIC, { bs: 0, stMin: 0 });
    expect(plan.filter((f) => f.kind === 'FC')).toHaveLength(1);
  });
  it('Single Frame: không có Flow Control', () => {
    expect(planTransfer([0x3e, 0x00], CLASSIC, { bs: 0, stMin: 0 }).map((f) => f.kind)).toEqual(['SF']);
  });
});

describe('ISO-TP round-trip', () => {
  const configs: [string, IsoTpConfig][] = [
    ['Classic, padding 0xCC', CLASSIC],
    ['Classic, không padding', { fd: false, padding: null }],
    ['CAN FD, padding 0xCC', FD],
    ['CAN FD, không padding', { fd: true, padding: null }],
    ['CAN FD, TX_DL 16', { fd: true, padding: 0xaa, txDl: 16 }],
  ];
  for (const [name, cfg] of configs) {
    describe(name, () => {
      it.each([1, 7, 8, 62, 4095, 4096])('%i byte', (len) => {
        const payload = seq(len);
        const rx = new IsoTpReassembler(cfg, 3);
        let result: number[] | undefined;
        for (const frame of segment(payload, cfg)) {
          const ev = rx.feed(frame.data);
          expect(ev.type).not.toBe('error');
          if (ev.type === 'complete') result = ev.payload;
        }
        expect(result).toEqual(payload);
      });
    });
  }
});
