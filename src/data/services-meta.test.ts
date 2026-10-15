import { describe, expect, it } from 'vitest';
import { runExample } from '@/lib/sandbox';
import { DEFAULT_VEHICLE } from './defaultVehicle';
import { SERVICES_META } from './services-meta';

/** Kết quả mong đợi của từng ví dụ: 'positive' | 'suppressed' | 'noResponse' | mã NRC. */
const EXPECTED: Record<string, Record<string, string | number>> = {
  '10': {
    'Vào extended session': 'positive',
    'Vào extended session, không cần response': 'suppressed',
    'Sub-function không hỗ trợ': 0x12,
  },
  '3E': {
    'TesterPresent có response': 'positive',
    'TesterPresent không cần response': 'suppressed',
    'Functional request với sub-function sai': 'noResponse',
  },
  '19': {
    'Đếm DTC đã confirmed': 'positive',
    'Liệt kê DTC đã confirmed': 'positive',
    'Lỗi mới xuất hiện một cycle: pending nhưng chưa confirmed': 'positive',
    'Toàn bộ DTC hỗ trợ (response nhiều frame)': 'positive',
    'Snapshot của DTC': 'positive',
    'Extended data của DTC': 'positive',
    'DTC của ECU khác': 0x31,
  },
  '22': {
    'Đọc VIN (response nhiều frame)': 'positive',
    'Đọc nhiều DID trong một request': 'positive',
    'DID không tồn tại': 0x31,
    'DID cần security': 0x33,
  },
  '27': {
    'Xin seed': 'positive',
    'Gửi key đúng': 'positive',
    'Gửi key sai': 0x35,
    'sendKey khi chưa có seed': 0x24,
    'Level đã mở': 'positive',
  },
  '2E': {
    'Ghi VIN trong default session': 0x7f,
    'Ghi VIN khi chưa unlock': 0x33,
    'Ghi VIN thành công (request nhiều frame)': 'positive',
    'Điện áp ắc quy thấp': 0x93,
  },
  '11': {
    'Hard reset thành công': 'positive',
    'Xe đang chạy': 0x88,
    'Động cơ đang chạy': 0x83,
    'resetType không hỗ trợ': 0x12,
  },
};

describe('ví dụ trong nội dung học khớp với engine', () => {
  for (const [sid, content] of Object.entries(SERVICES_META)) {
    describe(`0x${sid}`, () => {
      it('mọi ví dụ đều có kết quả mong đợi được khai báo', () => {
        expect(content!.examples.map((e) => e.title).sort()).toEqual(Object.keys(EXPECTED[sid] ?? {}).sort());
      });
      for (const ex of content!.examples) {
        it(ex.title, () => {
          const { result, frames } = runExample(DEFAULT_VEHICLE, ex);
          const want = EXPECTED[sid]![ex.title];
          if (typeof want === 'number') {
            expect(result.outcome).toBe('negative');
            expect(result.nrc).toBe(want);
          } else {
            expect(result.outcome).toBe(want);
          }
          expect(frames.length).toBeGreaterThan(0);
        });
      }
      it('mọi bài tập decode đều sinh được frame', () => {
        for (const ex of content!.exercises) expect(runExample(DEFAULT_VEHICLE, ex, 7).frames.length).toBeGreaterThan(0);
      });
    });
  }

  it('ví dụ 0x19 cho đúng byte như mô tả', () => {
    const run = (title: string) => runExample(DEFAULT_VEHICLE, SERVICES_META['19']!.examples.find((e) => e.title === title)!).result.response;
    expect(run('Đếm DTC đã confirmed')).toEqual([0x59, 0x01, 0xff, 0x01, 0x00, 0x01]);
    expect(run('Liệt kê DTC đã confirmed')).toEqual([0x59, 0x02, 0xff, 0x01, 0x30, 0x13, 0xaf]);
    expect(run('Lỗi mới xuất hiện một cycle: pending nhưng chưa confirmed')).toEqual([0x59, 0x02, 0xff, 0x01, 0x30, 0x13, 0x27]);
    expect(run('Toàn bộ DTC hỗ trợ (response nhiều frame)')).toHaveLength(39);
    // record 01, 3 DID: 0100 = 00 km/h, 0101 = 03 52 (850 rpm), 0102 = 8A (13,8 V)
    expect(run('Snapshot của DTC')!.slice(6)).toEqual([0x01, 0x03, 0x01, 0x00, 0x00, 0x01, 0x01, 0x03, 0x52, 0x01, 0x02, 0x8a]);
    expect(run('Extended data của DTC')!.slice(6)).toEqual([0x01, 0x02, 0x02, 0x00]);
  });

  it('ví dụ ghi VIN thành công dùng request nhiều frame (FF + FC + CF)', () => {
    const ex = SERVICES_META['2E']!.examples.find((e) => e.title.startsWith('Ghi VIN thành công'))!;
    const kinds = runExample(DEFAULT_VEHICLE, ex).frames.map((f) => `${f.dir}:${f.kind}`);
    expect(kinds.slice(0, 3)).toEqual(['Tx:FF', 'Rx:FC', 'Tx:CF']);
  });
});
