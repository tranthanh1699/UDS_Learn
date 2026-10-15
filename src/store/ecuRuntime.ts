import { create } from 'zustand';
import { buildExchange, type Exchange } from '@/core/trace/exchange';
import { initialEcuState, UdsServer } from '@/core/uds/engine';
import type { Addressing, SessionKind } from '@/core/vehicle/types';
import { dtcViewsForEcu } from '@/core/dtc/faultModel';
import { getEffectiveConditions, useFaultsStore } from './faults';
import { useTraceStore } from './trace';
import { useVehicleConfigStore } from './vehicleConfig';

export type { SessionKind };

/** ECU mô phỏng duy nhất của ứng dụng; store chỉ phản chiếu trạng thái của nó cho React. */
const server = new UdsServer(useVehicleConfigStore.getState().config);
useVehicleConfigStore.subscribe((s) => server.setConfig(s.config));

interface EcuRuntimeState {
  session: SessionKind;
  /** null = đang khóa; số = security level đã mở */
  unlockedLevel: number | null;
  /** Thời điểm (ms, Date.now) S3 hết hạn; null khi ở default session */
  s3ExpiresAt: number | null;
  rebooting: boolean;
  autoTesterPresent: boolean;
  simulateResponsePending: boolean;
  /** Exchange gần nhất (dùng cho hiệu ứng gói tin trên hình xe). */
  lastExchange: Exchange | null;
  /** Seed tester nhận được gần nhất (lấy từ response 67 <lẻ> ...), dùng để tính key. */
  lastSeed: { level: number; seed: number[] } | null;
  send: (request: number[], addressing: Addressing, opts?: { auto?: boolean }) => Exchange;
  tick: () => void;
  setAutoTesterPresent: (on: boolean) => void;
  setSimulateResponsePending: (on: boolean) => void;
  /** Đưa ECU về trạng thái lúc mới cấp nguồn lần đầu (xóa cả bộ đếm sai key và giá trị DID đã ghi). */
  resetEcu: () => void;
}

const snapshot = () => {
  const s = server.getState();
  return { session: s.session, unlockedLevel: s.unlockedLevel, s3ExpiresAt: s.s3Deadline, rebooting: s.rebootUntil !== null };
};

export const useEcuRuntimeStore = create<EcuRuntimeState>((set, get) => ({
  ...snapshot(),
  autoTesterPresent: false,
  simulateResponsePending: false,
  lastExchange: null,
  lastSeed: null,

  send: (request, addressing, opts = {}) => {
    const now = Date.now();
    const config = useVehicleConfigStore.getState().config;
    const result = server.handleRequest(request, {
      addressing,
      now,
      conditions: getEffectiveConditions(),
      // ECU mô phỏng là Engine ECU: chỉ báo các DTC thuộc chính nó
      dtcs: dtcViewsForEcu(useFaultsStore.getState().dtc, useFaultsStore.getState().catalog, 'engine'),
      simulateResponsePending: get().simulateResponsePending && !opts.auto,
    });
    const trace = useTraceStore.getState();
    const exchange = buildExchange(trace.takeId(), now, config, result, opts.auto);
    trace.addExchange(exchange);
    const rsp = result.response;
    const seedReceived = rsp && rsp[0] === 0x67 && rsp.length > 2 && rsp[1]! % 2 === 1;
    set({
      ...snapshot(),
      ...(opts.auto ? {} : { lastExchange: exchange }),
      ...(seedReceived ? { lastSeed: { level: rsp[1]!, seed: rsp.slice(2) } } : {}),
    });
    return exchange;
  },

  tick: () => {
    const now = Date.now();
    const changes = server.tick(now);
    if (changes.length > 0) {
      useTraceStore.getState().addEvent(now, changes.map((c) => c.message));
      set(snapshot());
    }
  },

  setAutoTesterPresent: (autoTesterPresent) => set({ autoTesterPresent }),
  setSimulateResponsePending: (simulateResponsePending) => set({ simulateResponsePending }),
  resetEcu: () => {
    server.patchState(initialEcuState());
    set({ ...snapshot(), lastSeed: null, lastExchange: null, autoTesterPresent: false, simulateResponsePending: false });
  },
}));

/** Truy cập engine chỉ để đọc (ví dụ tra metadata service). */
export const ecuServer: Pick<UdsServer, 'getService' | 'getState'> = server;
