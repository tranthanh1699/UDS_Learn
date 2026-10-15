import { create } from 'zustand';
import type { VehicleConditions } from '@/core/vehicle/types';
import { DEFAULT_VEHICLE } from '@/data/defaultVehicle';

export type { Gear, VehicleConditions } from '@/core/vehicle/types';

/** Điều kiện xe đang mô phỏng. Giai đoạn 5 sẽ bổ sung toàn bộ VehicleConfig và persistence. */
export const DEFAULT_CONDITIONS: VehicleConditions = DEFAULT_VEHICLE.conditions;

interface VehicleConfigState {
  conditions: VehicleConditions;
  setConditions: (patch: Partial<VehicleConditions>) => void;
}

export const useVehicleConfigStore = create<VehicleConfigState>((set) => ({
  conditions: DEFAULT_CONDITIONS,
  setConditions: (patch) => set((s) => ({ conditions: { ...s.conditions, ...patch } })),
}));
