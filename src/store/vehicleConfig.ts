import { create } from 'zustand';
import type { VehicleConditions, VehicleConfig } from '@/core/vehicle/types';
import { parseVehicleConfig, validateVehicleConfig } from '@/core/vehicle/validate';
import { DEFAULT_VEHICLE } from '@/data/defaultVehicle';
import { vi } from '@/i18n/vi';
import { loadJson, saveJson } from '@/lib/storage';

export type { Gear, VehicleConditions } from '@/core/vehicle/types';

const STORAGE_KEY = 'vehicleConfig';
const IDLE_RPM = 800;

function loadInitial(): VehicleConfig {
  const raw = loadJson<unknown>(STORAGE_KEY, null);
  if (raw === null) return structuredClone(DEFAULT_VEHICLE);
  const parsed = parseVehicleConfig(raw, DEFAULT_VEHICLE);
  return parsed.ok ? parsed.config : structuredClone(DEFAULT_VEHICLE);
}

interface VehicleConfigState {
  /** Cấu hình hợp lệ đang được ECU sử dụng (và được lưu vào localStorage). */
  config: VehicleConfig;
  /** Bản đang chỉnh sửa; có thể tạm thời có lỗi. */
  draft: VehicleConfig;
  errors: string[];
  /** Sửa bản nháp; nếu hợp lệ thì áp dụng ngay cho ECU và lưu lại. */
  update: (mutate: (draft: VehicleConfig) => void) => void;
  setConditions: (patch: Partial<VehicleConditions>) => void;
  reset: () => void;
  importJson: (text: string) => { ok: true } | { ok: false; errors: string[] };
}

const initial = loadInitial();

export const useVehicleConfigStore = create<VehicleConfigState>((set, get) => {
  const apply = (draft: VehicleConfig) => {
    const errors = validateVehicleConfig(draft);
    if (errors.length > 0) {
      set({ draft, errors });
      return;
    }
    saveJson(STORAGE_KEY, draft);
    set({ draft, errors: [], config: structuredClone(draft) });
  };

  return {
    config: initial,
    draft: structuredClone(initial),
    errors: [],
    update: (mutate) => {
      const draft = structuredClone(get().draft);
      mutate(draft);
      apply(draft);
    },
    setConditions: (patch) =>
      get().update((d) => {
        const c = { ...d.conditions, ...patch };
        // Động cơ tắt thì không có vòng tua; vừa nổ máy thì về mức không tải
        if (patch.engineRunning === false) c.rpm = 0;
        if (patch.engineRunning === true && c.rpm === 0) c.rpm = IDLE_RPM;
        if (patch.rpm !== undefined) c.engineRunning = patch.rpm > 0;
        d.conditions = c;
      }),
    reset: () => apply(structuredClone(DEFAULT_VEHICLE)),
    importJson: (text) => {
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        return { ok: false, errors: [vi.config.actions.invalidJson] };
      }
      const parsed = parseVehicleConfig(raw, DEFAULT_VEHICLE);
      if (!parsed.ok) return parsed;
      apply(parsed.config);
      return { ok: true };
    },
  };
});

export const selectConditions = (s: VehicleConfigState) => s.config.conditions;
