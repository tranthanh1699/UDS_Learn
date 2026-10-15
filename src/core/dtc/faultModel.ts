import { vi } from '../../i18n/vi';
import type { VehicleConditions } from '../vehicle/types';
import {
  STATUS_AFTER_CLEAR,
  type BitChange,
  type DtcChange,
  type DtcEventState,
  type DtcMemoryState,
  type DtcModelConfig,
  type DtcStepResult,
  type FaultCatalogEntry,
} from './types';

/**
 * Mô hình status byte của DTC (ISO 14229-1, phụ lục D; tương ứng Dem trong AUTOSAR), đã đơn giản hóa:
 * debounce dạng đếm → testFailed; số operation cycle có lỗi → confirmedDTC; healing/aging khi hết lỗi.
 * Mọi hàm đều thuần (không sửa state đầu vào) và ghi lại lý do của từng bit thay đổi.
 */

const r = vi.dtc.reasons;

const BIT = {
  testFailed: 0,
  testFailedThisOperationCycle: 1,
  pendingDTC: 2,
  confirmedDTC: 3,
  testNotCompletedSinceLastClear: 4,
  testFailedSinceLastClear: 5,
  testNotCompletedThisOperationCycle: 6,
  warningIndicatorRequested: 7,
} as const;

export const getBit = (status: number, bit: number): 0 | 1 => ((status >> bit) & 1) as 0 | 1;

function newEvent(id: string): DtcEventState {
  return { id, status: STATUS_AFTER_CLEAR, debounce: 0, failedCycles: 0, healingCounter: 0, agingCounter: 0, occurrence: 0, snapshot: null };
}

export function initialDtcState(catalog: readonly FaultCatalogEntry[]): DtcMemoryState {
  return {
    cycleActive: false,
    cycleCount: 0,
    dtcSettingOn: true,
    injected: [],
    events: Object.fromEntries(catalog.map((c) => [c.id, newEvent(c.id)])),
  };
}

/** Bộ ghi thay đổi cho một event: đặt bit kèm lý do, chỉ ghi khi giá trị thật sự đổi. */
class EventEditor {
  readonly ev: DtcEventState;
  private readonly bitChanges: BitChange[] = [];
  private readonly notes: string[] = [];
  private readonly before: number;

  constructor(ev: DtcEventState) {
    this.ev = { ...ev };
    this.before = ev.status;
  }

  set(bit: number, value: 0 | 1, reason: string): void {
    const from = getBit(this.ev.status, bit);
    if (from === value) return;
    this.ev.status = value ? this.ev.status | (1 << bit) : this.ev.status & ~(1 << bit);
    this.bitChanges.push({ bit, from, to: value, reason });
  }

  note(text: string): void {
    this.notes.push(text);
  }

  result(): DtcChange | null {
    if (this.bitChanges.length === 0 && this.notes.length === 0) return null;
    return { eventId: this.ev.id, statusBefore: this.before, statusAfter: this.ev.status, bitChanges: this.bitChanges, notes: this.notes };
  }
}

function mapEvents(state: DtcMemoryState, fn: (ev: DtcEventState, ed: EventEditor) => void): { events: DtcMemoryState['events']; changes: DtcChange[] } {
  const events: DtcMemoryState['events'] = {};
  const changes: DtcChange[] = [];
  for (const [id, ev] of Object.entries(state.events)) {
    const ed = new EventEditor(ev);
    fn(ev, ed);
    events[id] = ed.ev;
    const c = ed.result();
    if (c) changes.push(c);
  }
  return { events, changes };
}

export function injectFault(state: DtcMemoryState, id: string): DtcMemoryState {
  return state.injected.includes(id) ? state : { ...state, injected: [...state.injected, id] };
}

export function removeFault(state: DtcMemoryState, id: string): DtcMemoryState {
  return { ...state, injected: state.injected.filter((x) => x !== id) };
}

/** Bắt đầu operation cycle (key on): xóa bit1, đặt bit6, reset bộ đếm debounce. */
export function startOperationCycle(state: DtcMemoryState): DtcStepResult {
  if (state.cycleActive) return { state, changes: [], notes: [r.cycleAlreadyActive] };
  const { events, changes } = mapEvents(state, (_ev, ed) => {
    ed.set(BIT.testFailedThisOperationCycle, 0, r.cycleStartClearTfoc);
    ed.set(BIT.testNotCompletedThisOperationCycle, 1, r.cycleStartSetTnc);
    ed.ev.debounce = 0;
  });
  return { state: { ...state, cycleActive: true, events }, changes, notes: [r.cycleStarted(state.cycleCount + 1)] };
}

/** Mỗi monitor chạy test một lần: cập nhật debounce và các bit liên quan. */
export function runTests(
  state: DtcMemoryState,
  catalog: readonly FaultCatalogEntry[],
  cfg: DtcModelConfig,
  conditions: VehicleConditions,
): DtcStepResult {
  if (!state.cycleActive) return { state, changes: [], notes: [r.noCycle] };
  if (!state.dtcSettingOn) return { state, changes: [], notes: [r.settingOff] };
  const byId = new Map(catalog.map((c) => [c.id, c]));

  const { events, changes } = mapEvents(state, (ev, ed) => {
    const entry = byId.get(ev.id);
    const faulty = state.injected.includes(ev.id);
    const before = ev.debounce;
    const after = faulty ? Math.min(before + cfg.failStep, cfg.failThreshold) : Math.max(before - cfg.passStep, cfg.passThreshold);
    ed.ev.debounce = after;

    if (faulty && after >= cfg.failThreshold) {
      // Lỗi được xác nhận (qualified failed)
      ed.set(BIT.testFailed, 1, r.testFailedSet(after, cfg.failThreshold));
      if (!getBit(ev.status, BIT.testFailedThisOperationCycle)) {
        ed.ev.failedCycles = ev.failedCycles + 1;
        ed.ev.occurrence = ev.occurrence + 1;
        if (!ed.ev.snapshot) ed.ev.snapshot = { ...conditions };
      }
      ed.set(BIT.testFailedThisOperationCycle, 1, r.tfocSet);
      ed.set(BIT.pendingDTC, 1, r.pendingSet);
      ed.set(BIT.testNotCompletedSinceLastClear, 0, r.tncslcCleared);
      ed.set(BIT.testFailedSinceLastClear, 1, r.tfslcSet);
      ed.set(BIT.testNotCompletedThisOperationCycle, 0, r.tncThisCleared);
      if (ed.ev.failedCycles >= cfg.confirmationThreshold) {
        ed.set(BIT.confirmedDTC, 1, r.confirmedSet(ed.ev.failedCycles, cfg.confirmationThreshold));
      } else if (!getBit(ev.status, BIT.testFailedThisOperationCycle)) {
        ed.note(r.notConfirmedYet(ed.ev.failedCycles, cfg.confirmationThreshold));
      }
      if (getBit(ed.ev.status, BIT.confirmedDTC) && entry?.lamp) {
        ed.set(BIT.warningIndicatorRequested, 1, r.wirSet(vi.dtc.lamps[entry.lamp]));
      }
      ed.ev.healingCounter = 0;
      ed.ev.agingCounter = 0;
    } else if (!faulty && after <= cfg.passThreshold) {
      // Test được xác nhận đạt (qualified passed)
      ed.set(BIT.testFailed, 0, r.testFailedCleared(after, cfg.passThreshold));
      ed.set(BIT.testNotCompletedSinceLastClear, 0, r.tncslcCleared);
      ed.set(BIT.testNotCompletedThisOperationCycle, 0, r.tncThisCleared);
    }
    // Chỉ ghi chú debounce cho event đang có lỗi hoặc từng lỗi, để log không bị nhiễu bởi các cảm biến bình thường
    if (before !== after && (faulty || getBit(ev.status, BIT.testFailedSinceLastClear))) {
      ed.note(faulty && after < cfg.failThreshold ? r.debouncePreFailed(before, after, cfg.failThreshold) : r.debounce(before, after));
    }
  });
  return { state: { ...state, events }, changes, notes: [] };
}

/** Kết thúc operation cycle (key off): xử lý pending, healing và aging. */
export function endOperationCycle(state: DtcMemoryState, cfg: DtcModelConfig): DtcStepResult {
  if (!state.cycleActive) return { state, changes: [], notes: [r.noCycle] };
  const { events, changes } = mapEvents(state, (ev, ed) => {
    if (getBit(ev.status, BIT.testNotCompletedThisOperationCycle)) return; // test chưa chạy trong cycle: giữ nguyên
    if (getBit(ev.status, BIT.testFailedThisOperationCycle)) return; // cycle có lỗi: bộ đếm đã xử lý khi lỗi
    // Cả cycle test đều đạt
    if (getBit(ev.status, BIT.pendingDTC)) {
      ed.set(BIT.pendingDTC, 0, r.pendingCleared);
      if (!getBit(ev.status, BIT.confirmedDTC)) ed.ev.failedCycles = 0;
    }
    if (getBit(ev.status, BIT.warningIndicatorRequested)) {
      ed.ev.healingCounter = ev.healingCounter + 1;
      if (ed.ev.healingCounter >= cfg.healingCycles) {
        ed.set(BIT.warningIndicatorRequested, 0, r.wirCleared(cfg.healingCycles));
        ed.ev.healingCounter = 0;
      } else {
        ed.note(r.healingProgress(ed.ev.healingCounter, cfg.healingCycles));
      }
    }
    if (getBit(ev.status, BIT.confirmedDTC)) {
      ed.ev.agingCounter = ev.agingCounter + 1;
      if (ed.ev.agingCounter >= cfg.agingCycles) {
        ed.set(BIT.confirmedDTC, 0, r.confirmedAged(cfg.agingCycles));
        ed.ev.agingCounter = 0;
        ed.ev.failedCycles = 0;
      } else {
        ed.note(r.agingProgress(ed.ev.agingCounter, cfg.agingCycles));
      }
    }
  });
  return { state: { ...state, cycleActive: false, cycleCount: state.cycleCount + 1, events }, changes, notes: [r.cycleEnded] };
}

/** Xóa DTC (dùng cho 0x14 ClearDiagnosticInformation ở giai đoạn sau). */
export function clearDtcs(state: DtcMemoryState, filter: (id: string) => boolean = () => true): DtcStepResult {
  const { events, changes } = mapEvents(state, (ev, ed) => {
    if (!filter(ev.id)) return;
    Object.assign(ed.ev, { debounce: 0, failedCycles: 0, healingCounter: 0, agingCounter: 0, occurrence: 0, snapshot: null });
    for (let bit = 0; bit < 8; bit++) ed.set(bit, getBit(STATUS_AFTER_CLEAR, bit), r.cleared);
  });
  return { state: { ...state, events }, changes, notes: [r.clearedAll] };
}

/** Event có đáng hiển thị trong "bộ nhớ lỗi" không: đang inject hoặc có bit lỗi/cảnh báo. */
export function isRelevant(ev: DtcEventState, injected: readonly string[]): boolean {
  return injected.includes(ev.id) || (ev.status & 0b1010_1111) !== 0 || ev.debounce > 0;
}

/** Đèn cảnh báo đang bật theo bit7 của các DTC. */
export function lampStates(state: DtcMemoryState, catalog: readonly FaultCatalogEntry[]): { mil: boolean; abs: boolean } {
  const on = { mil: false, abs: false };
  for (const c of catalog) {
    const ev = state.events[c.id];
    if (c.lamp && ev && getBit(ev.status, BIT.warningIndicatorRequested)) on[c.lamp] = true;
  }
  return on;
}

/** Ảnh hưởng của lỗi đang inject lên điều kiện xe mà ECU nhìn thấy. */
export function effectiveConditions(base: VehicleConditions, injected: readonly string[], catalog: readonly FaultCatalogEntry[]): VehicleConditions {
  const c = { ...base };
  for (const id of injected) {
    const entry = catalog.find((x) => x.id === id);
    if (!entry) continue;
    if (entry.component === 'battery') c.batteryVoltage = entry.faultType === 'outOfRangeHigh' ? 16.2 : 10.5;
    if (entry.component.startsWith('wss')) c.speedValid = false;
  }
  return c;
}
