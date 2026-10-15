import { computeKey } from '@/core/uds/keyAlgorithm';
import type { UdsOutcome } from '@/core/uds/types';
import type { Addressing, VehicleConfig } from '@/core/vehicle/types';

/**
 * Kịch bản hướng dẫn từng bước. Request được tạo lúc chạy (ví dụ key tính từ seed vừa nhận),
 * kết quả thực tế được so với kết quả mong đợi.
 */

export interface StepContext {
  lastSeed: { level: number; seed: number[] } | null;
  config: VehicleConfig;
}

export interface Expectation {
  outcome: UdsOutcome;
  nrc?: number;
  /** Các byte đầu của response phải khớp. */
  responsePrefix?: number[];
}

export type ScenarioAction = 'autoTpOn' | 'autoTpOff' | 'injectBattery' | 'removeBattery' | 'waitS3' | 'waitSecurityDelay';

export type ScenarioStep =
  | { kind: 'request'; title: string; explain: string; build: (ctx: StepContext) => number[] | null; addressing?: Addressing; expect: Expectation }
  | { kind: 'action'; title: string; explain: string; action: ScenarioAction };

export interface Scenario {
  id: string;
  title: string;
  summary: string;
  steps: ScenarioStep[];
}

/** Key cho seed level 1 vừa nhận; wrong = đảo byte cuối để chắc chắn sai. */
function key(ctx: StepContext, wrong = false): number[] | null {
  if (!ctx.lastSeed) return null;
  const cfg = ctx.config.security.levels.find((l) => l.level === ctx.lastSeed!.level);
  if (!cfg) return null;
  const k = computeKey(ctx.lastSeed.seed, cfg).key;
  if (wrong) k[k.length - 1] = k[k.length - 1]! ^ 0xff;
  return [0x27, ctx.lastSeed.level + 1, ...k];
}

const fixed = (bytes: number[]) => () => bytes;

const AUTO_TP_ON: ScenarioStep = {
  kind: 'action',
  title: 'Bật TesterPresent tự động',
  explain: 'Kịch bản dùng extended session. Bật functional 3E 80 mỗi 2 s để session không bị S3 timeout trong lúc bạn đọc giải thích.',
  action: 'autoTpOn',
};
const EXTENDED: ScenarioStep = {
  kind: 'request',
  title: 'Vào extended session',
  explain: 'SecurityAccess và WriteDataByIdentifier không được phép ở default session.',
  build: fixed([0x10, 0x03]),
  expect: { outcome: 'positive', responsePrefix: [0x50, 0x03] },
};
const REQUEST_SEED: ScenarioStep = {
  kind: 'request',
  title: 'Xin seed (27 01)',
  explain: 'ECU trả 67 01 kèm seed ngẫu nhiên 4 byte.',
  build: fixed([0x27, 0x01]),
  expect: { outcome: 'positive', responsePrefix: [0x67, 0x01] },
};
const SEND_KEY: ScenarioStep = {
  kind: 'request',
  title: 'Gửi key đúng (27 02)',
  explain: 'Key được tính tự động từ seed vừa nhận theo thuật toán level 1 (xem Key calculator ở trang 0x27).',
  build: (ctx) => key(ctx),
  expect: { outcome: 'positive', responsePrefix: [0x67, 0x02] },
};

export const SCENARIOS: Scenario[] = [
  {
    id: 'a',
    title: 'Đọc VIN',
    summary: 'Đọc DID 0xF190 và quan sát response được chia thành nhiều frame ISO-TP.',
    steps: [
      {
        kind: 'request',
        title: 'Đọc VIN (22 F1 90)',
        explain:
          'Response dài 20 byte (62 F1 90 + 17 ký tự) không vừa một CAN frame 8 byte. ECU gửi First Frame (10 14 …), tester trả Flow Control (30 00 00), rồi ECU gửi hai Consecutive Frame (21 …, 22 …). Bấm vào từng byte trong frame để xem giải thích.',
        build: fixed([0x22, 0xf1, 0x90]),
        expect: { outcome: 'positive', responsePrefix: [0x62, 0xf1, 0x90] },
      },
      {
        kind: 'request',
        title: 'Đọc VIN cùng phiên bản phần mềm',
        explain: 'Một request 0x22 có thể đọc nhiều DID; response lặp lại từng DID trước dữ liệu của nó.',
        build: fixed([0x22, 0xf1, 0x90, 0xf1, 0x95]),
        expect: { outcome: 'positive', responsePrefix: [0x62, 0xf1, 0x90] },
      },
    ],
  },
  {
    id: 'b',
    title: 'Unlock security: sai key → 0x35 → 0x36 → 0x37, rồi unlock đúng',
    summary: 'Thấy cơ chế chống dò key: đếm số lần sai, khóa level và thời gian chờ.',
    steps: [
      AUTO_TP_ON,
      EXTENDED,
      REQUEST_SEED,
      {
        kind: 'request',
        title: 'Gửi key sai lần 1',
        explain: 'Key sai: ECU trả NRC 0x35 invalidKey, tăng bộ đếm (1/3) và hủy seed.',
        build: (ctx) => key(ctx, true),
        expect: { outcome: 'negative', nrc: 0x35 },
      },
      { ...REQUEST_SEED, explain: 'Seed cũ đã bị hủy nên phải xin seed mới.' },
      {
        kind: 'request',
        title: 'Gửi key sai lần 2',
        explain: 'Vẫn NRC 0x35; bộ đếm là 2/3.',
        build: (ctx) => key(ctx, true),
        expect: { outcome: 'negative', nrc: 0x35 },
      },
      REQUEST_SEED,
      {
        kind: 'request',
        title: 'Gửi key sai lần 3',
        explain: 'Đạt số lần tối đa: ECU trả NRC 0x36 exceededNumberOfAttempts và khóa level 1 trong 10 s.',
        build: (ctx) => key(ctx, true),
        expect: { outcome: 'negative', nrc: 0x36 },
      },
      {
        kind: 'request',
        title: 'Xin seed trong thời gian khóa',
        explain: 'ECU từ chối với NRC 0x37 requiredTimeDelayNotExpired.',
        build: fixed([0x27, 0x01]),
        expect: { outcome: 'negative', nrc: 0x37 },
      },
      { kind: 'action', title: 'Chờ hết thời gian khóa', explain: 'Chờ thời gian khóa của level 1 (mặc định 10 s) trôi qua.', action: 'waitSecurityDelay' },
      { ...REQUEST_SEED, explain: 'Hết thời gian khóa: ECU lại cấp seed.' },
      { ...SEND_KEY, explain: 'Lần này gửi key đúng: ECU trả 67 02, level 1 đã mở (xem status bar).' },
    ],
  },
  {
    id: 'c',
    title: 'Extended session → unlock → ghi DID → đọc lại',
    summary: 'Quy trình ghi dữ liệu chuẩn: đổi session, mở security, ghi, kiểm tra lại.',
    steps: [
      AUTO_TP_ON,
      EXTENDED,
      REQUEST_SEED,
      SEND_KEY,
      {
        kind: 'request',
        title: 'Ghi DID 0x0200 = 00 (2E 02 00 00)',
        explain: 'Tắt đèn chạy ban ngày. DID này cần extended session và security level 1, cả hai đã có.',
        build: fixed([0x2e, 0x02, 0x00, 0x00]),
        expect: { outcome: 'positive', responsePrefix: [0x6e, 0x02, 0x00] },
      },
      {
        kind: 'request',
        title: 'Đọc lại DID 0x0200',
        explain: 'Giá trị mới (00) được đọc lại ngay bằng 0x22.',
        build: fixed([0x22, 0x02, 0x00]),
        expect: { outcome: 'positive', responsePrefix: [0x62, 0x02, 0x00, 0x00] },
      },
    ],
  },
  {
    id: 'd',
    title: 'Inject lỗi ắc quy → ghi DID bị 0x93',
    summary: 'Lỗi phần cứng làm thay đổi điều kiện xe, và ECU từ chối ghi bộ nhớ khi điện áp thấp.',
    steps: [
      AUTO_TP_ON,
      EXTENDED,
      REQUEST_SEED,
      SEND_KEY,
      {
        kind: 'action',
        title: 'Inject lỗi ắc quy (điện áp thấp)',
        explain: 'ECU đo được điện áp 10,5 V (xem status bar và bảng đồng hồ: đèn ắc quy sáng).',
        action: 'injectBattery',
      },
      {
        kind: 'request',
        title: 'Ghi DID 0x0200',
        explain: 'Mọi điều kiện khác đều đạt nhưng điện áp dưới 11,0 V: NRC 0x93 voltageTooLow.',
        build: fixed([0x2e, 0x02, 0x00, 0x00]),
        expect: { outcome: 'negative', nrc: 0x93 },
      },
      { kind: 'action', title: 'Gỡ lỗi ắc quy', explain: 'Điện áp trở về giá trị bình thường.', action: 'removeBattery' },
      {
        kind: 'request',
        title: 'Ghi lại DID 0x0200',
        explain: 'Lần này ghi thành công: 6E 02 00.',
        build: fixed([0x2e, 0x02, 0x00, 0x00]),
        expect: { outcome: 'positive', responsePrefix: [0x6e, 0x02, 0x00] },
      },
    ],
  },
  {
    id: 'e',
    title: 'Để S3 hết hạn → quay về default session',
    summary: 'Không gửi gì trong 5 s: ECU tự thoát extended session.',
    steps: [
      { kind: 'action', title: 'Tắt TesterPresent tự động', explain: 'Nếu TesterPresent còn chạy, S3 sẽ không bao giờ hết hạn.', action: 'autoTpOff' },
      EXTENDED,
      {
        kind: 'request',
        title: 'Đọc session hiện tại (22 F1 86)',
        explain: 'DID 0xF186 trả 03 = extended session.',
        build: fixed([0x22, 0xf1, 0x86]),
        expect: { outcome: 'positive', responsePrefix: [0x62, 0xf1, 0x86, 0x03] },
      },
      { kind: 'action', title: 'Chờ S3 hết hạn', explain: 'Quan sát đồng hồ S3 ở status bar đếm ngược về 0.', action: 'waitS3' },
      {
        kind: 'request',
        title: 'Đọc lại session',
        explain: 'ECU đã tự quay về default session: DID 0xF186 trả 01.',
        build: fixed([0x22, 0xf1, 0x86]),
        expect: { outcome: 'positive', responsePrefix: [0x62, 0xf1, 0x86, 0x01] },
      },
      {
        kind: 'request',
        title: 'Thử ghi DID',
        explain: 'Ở default session, 0x2E bị từ chối với NRC 0x7F serviceNotSupportedInActiveSession.',
        build: fixed([0x2e, 0x02, 0x00, 0x00]),
        expect: { outcome: 'negative', nrc: 0x7f },
      },
    ],
  },
];

export function matchesExpectation(expect: Expectation, outcome: UdsOutcome, nrc: number | null, response: number[] | null): boolean {
  if (outcome !== expect.outcome) return false;
  if (expect.nrc !== undefined && nrc !== expect.nrc) return false;
  if (expect.responsePrefix && !expect.responsePrefix.every((b, i) => response?.[i] === b)) return false;
  return true;
}
