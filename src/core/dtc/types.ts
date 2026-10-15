import type { VehicleConditions } from '../vehicle/types';

/** Linh kiện có thể inject lỗi. */
export type ComponentId = 'wssFL' | 'wssFR' | 'wssRL' | 'wssRR' | 'o2Sensor' | 'coolantTemp' | 'battery' | 'absPump' | 'canAbs';

export type FaultType =
  | 'openCircuit'
  | 'shortToGround'
  | 'shortToBattery'
  | 'outOfRangeHigh'
  | 'outOfRangeLow'
  | 'signalImplausible'
  | 'canTimeout';

/** ECU lưu DTC (để giai đoạn sau 0x19/0x14 đọc/xóa theo từng ECU). */
export type EcuId = 'engine' | 'abs' | 'body' | 'gateway';

export type WarningLamp = 'mil' | 'abs';

/** Một mục trong danh mục lỗi = một "event" trong ECU, gắn với một DTC 3 byte. */
export interface FaultCatalogEntry {
  /** Khóa duy nhất, ví dụ "wssFL:openCircuit". */
  id: string;
  component: ComponentId;
  faultType: FaultType;
  /** DTC 3 byte: 2 byte mã lỗi (kiểu SAE) + 1 byte FTB. */
  dtc: number;
  ecu: EcuId;
  /** Đèn cảnh báo bật khi DTC confirmed; null = không yêu cầu đèn. */
  lamp: WarningLamp | null;
}

/** Tham số mô hình DTC (tương ứng cấu hình Dem trong AUTOSAR). */
export interface DtcModelConfig {
  /** Debounce dạng đếm: mỗi lần test lỗi cộng failStep, mỗi lần test đạt trừ passStep. */
  failStep: number;
  passStep: number;
  /** Bộ đếm ≥ failThreshold → lỗi được xác nhận (testFailed = 1). */
  failThreshold: number;
  /** Bộ đếm ≤ passThreshold → test được xác nhận đạt (testFailed = 0). */
  passThreshold: number;
  /** Số operation cycle có lỗi trước khi DTC confirmed. */
  confirmationThreshold: number;
  /** Số operation cycle liên tiếp không lỗi trước khi tắt đèn cảnh báo (healing). */
  healingCycles: number;
  /** Số operation cycle liên tiếp không lỗi trước khi xóa confirmedDTC (aging). */
  agingCycles: number;
}

export interface DtcEventState {
  id: string;
  status: number;
  debounce: number;
  /** Số operation cycle (liên tiếp, chưa confirmed) có lỗi. */
  failedCycles: number;
  healingCounter: number;
  agingCounter: number;
  occurrence: number;
  /** Ảnh chụp điều kiện xe lúc lỗi được xác nhận lần đầu (dùng cho 0x19 04 sau này). */
  snapshot: VehicleConditions | null;
}

export interface DtcMemoryState {
  /** Operation cycle (key on) đang diễn ra? */
  cycleActive: boolean;
  cycleCount: number;
  /** false = cập nhật status byte bị tắt (giai đoạn sau: 0x85 ControlDTCSetting). */
  dtcSettingOn: boolean;
  injected: string[];
  events: Record<string, DtcEventState>;
}

export interface BitChange {
  bit: number;
  from: 0 | 1;
  to: 0 | 1;
  reason: string;
}

export interface DtcChange {
  eventId: string;
  statusBefore: number;
  statusAfter: number;
  bitChanges: BitChange[];
  notes: string[];
}

export interface DtcStepResult {
  state: DtcMemoryState;
  changes: DtcChange[];
  /** Ghi chú chung (ví dụ chưa bắt đầu operation cycle). */
  notes: string[];
}

/** Tên ISO của 8 bit trong status byte (bit 0 → bit 7). */
export const STATUS_BIT_NAMES = [
  'testFailed',
  'testFailedThisOperationCycle',
  'pendingDTC',
  'confirmedDTC',
  'testNotCompletedSinceLastClear',
  'testFailedSinceLastClear',
  'testNotCompletedThisOperationCycle',
  'warningIndicatorRequested',
] as const;

/** Status byte sau khi xóa DTC: chỉ bit 4 và bit 6 (test chưa hoàn thành) bằng 1. */
export const STATUS_AFTER_CLEAR = 0x50;
