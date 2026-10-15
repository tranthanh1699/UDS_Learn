import { useMemo } from 'react';
import { create } from 'zustand';
import { DEFAULT_DTC_CONFIG, defaultCatalog } from '@/core/dtc/catalog';
import {
  clearDtcs,
  effectiveConditions,
  endOperationCycle,
  initialDtcState,
  injectFault,
  lampStates,
  removeFault,
  runTests,
  startOperationCycle,
} from '@/core/dtc/faultModel';
import type { DtcChange, DtcMemoryState, DtcModelConfig, DtcStepResult, FaultCatalogEntry } from '@/core/dtc/types';
import type { VehicleConditions } from '@/core/vehicle/types';
import { vi } from '@/i18n/vi';
import { loadJson, saveJson } from '@/lib/storage';
import { selectConditions, useVehicleConfigStore } from './vehicleConfig';

export interface FaultLogEntry {
  id: number;
  t: number;
  title: string;
  notes: string[];
  changes: DtcChange[];
}

const MAX_LOG = 200;
const f = vi.faults;

interface FaultsState {
  catalog: FaultCatalogEntry[];
  config: DtcModelConfig;
  dtc: DtcMemoryState;
  /** true khi ít nhất một DTC gắn đèn MIL có bit7 warningIndicatorRequested */
  milOn: boolean;
  /** true khi có DTC gắn đèn ABS yêu cầu bật đèn */
  absLampOn: boolean;
  log: FaultLogEntry[];
  /** Thay đổi gần nhất của từng event, để giải thích status byte. */
  lastChange: Record<string, DtcChange>;
  inject: (id: string) => void;
  remove: (id: string) => void;
  removeAll: () => void;
  startCycle: () => void;
  endCycle: () => void;
  runTests: () => void;
  clearAll: () => void;
  setConfig: (patch: Partial<DtcModelConfig>) => void;
}

const catalog = defaultCatalog();
const label = (id: string) => {
  const e = catalog.find((c) => c.id === id);
  return e ? [vi.dtc.components[e.component], vi.dtc.faultTypes[e.faultType]] : [id, ''];
};

/** Điều kiện xe ECU nhìn thấy = điều kiện cấu hình + ảnh hưởng của lỗi đang inject. */
export function getEffectiveConditions(): VehicleConditions {
  const s = useFaultsStore.getState();
  return effectiveConditions(useVehicleConfigStore.getState().config.conditions, s.dtc.injected, s.catalog);
}

export function useEffectiveConditions(): VehicleConditions {
  const base = useVehicleConfigStore(selectConditions);
  const injected = useFaultsStore((s) => s.dtc.injected);
  const cat = useFaultsStore((s) => s.catalog);
  return useMemo(() => effectiveConditions(base, injected, cat), [base, injected, cat]);
}

export const useFaultsStore = create<FaultsState>((set, get) => {
  let nextId = 1;
  const commit = (title: string, r: Pick<DtcStepResult, 'state' | 'changes' | 'notes'>) => {
    const lamps = lampStates(r.state, get().catalog);
    const lastChange = { ...get().lastChange };
    for (const c of r.changes) if (c.bitChanges.length > 0 || c.notes.length > 0) lastChange[c.eventId] = c;
    const entry: FaultLogEntry = { id: nextId++, t: Date.now(), title, notes: r.notes, changes: r.changes };
    set({ dtc: r.state, milOn: lamps.mil, absLampOn: lamps.abs, lastChange, log: [...get().log, entry].slice(-MAX_LOG) });
  };

  return {
    catalog,
    config: { ...DEFAULT_DTC_CONFIG, ...loadJson<Partial<DtcModelConfig>>('dtcConfig', {}) },
    dtc: initialDtcState(catalog),
    milOn: false,
    absLampOn: false,
    log: [],
    lastChange: {},
    inject: (id) => commit(f.injected(...(label(id) as [string, string])), { state: injectFault(get().dtc, id), changes: [], notes: [] }),
    remove: (id) => commit(f.removed(...(label(id) as [string, string])), { state: removeFault(get().dtc, id), changes: [], notes: [] }),
    removeAll: () => {
      for (const id of get().dtc.injected) get().remove(id);
    },
    startCycle: () => commit(f.startCycle, startOperationCycle(get().dtc)),
    endCycle: () => commit(f.endCycle, endOperationCycle(get().dtc, get().config)),
    runTests: () => commit(f.testRun, runTests(get().dtc, get().catalog, get().config, getEffectiveConditions())),
    clearAll: () => commit(f.clearAll, clearDtcs(get().dtc)),
    setConfig: (patch) => {
      const config = { ...get().config, ...patch };
      saveJson('dtcConfig', config);
      set({ config });
    },
  };
});
