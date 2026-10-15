import { create } from 'zustand';
import type { VehicleConditions, VehicleConfig } from '@/core/vehicle/types';
import { DEFAULT_VEHICLE } from '@/data/defaultVehicle';

export type { Gear, VehicleConditions } from '@/core/vehicle/types';

/** Cấu hình xe đang dùng. Giai đoạn 5 sẽ bổ sung chỉnh sửa đầy đủ, persistence và nhập/xuất JSON. */
interface VehicleConfigState {
  config: VehicleConfig;
  setConditions: (patch: Partial<VehicleConditions>) => void;
}

export const useVehicleConfigStore = create<VehicleConfigState>((set) => ({
  config: structuredClone(DEFAULT_VEHICLE),
  setConditions: (patch) =>
    set((s) => ({ config: { ...s.config, conditions: { ...s.config.conditions, ...patch } } })),
}));

export const selectConditions = (s: VehicleConfigState) => s.config.conditions;
