import { create } from 'zustand';
import type { Exchange } from '@/core/trace/exchange';

/** Sự kiện của ECU không gắn với request nào (ví dụ S3 hết hạn). */
export interface EcuEvent {
  id: number;
  t: number;
  messages: string[];
}

export type TraceEntry = { type: 'exchange'; exchange: Exchange } | { type: 'event'; event: EcuEvent };

const MAX_ENTRIES = 500;

interface TraceState {
  /** Mốc thời gian bắt đầu (ms) để hiển thị timestamp tương đối kiểu CANoe. */
  startTime: number;
  entries: TraceEntry[];
  nextId: number;
  takeId: () => number;
  addExchange: (exchange: Exchange) => void;
  addEvent: (t: number, messages: string[]) => void;
  clear: () => void;
}

export const useTraceStore = create<TraceState>((set, get) => ({
  startTime: Date.now(),
  entries: [],
  nextId: 1,
  takeId: () => {
    const id = get().nextId;
    set({ nextId: id + 1 });
    return id;
  },
  addExchange: (exchange) => set((s) => ({ entries: [...s.entries, { type: 'exchange' as const, exchange }].slice(-MAX_ENTRIES) })),
  addEvent: (t, messages) => {
    const id = get().takeId();
    set((s) => ({ entries: [...s.entries, { type: 'event' as const, event: { id, t, messages } }].slice(-MAX_ENTRIES) }));
  },
  clear: () => set({ entries: [], startTime: Date.now() }),
}));
