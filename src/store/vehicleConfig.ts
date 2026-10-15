import { create } from 'zustand';

export type Gear = 'P' | 'R' | 'N' | 'D';

/** Điều kiện xe đang mô phỏng. Giai đoạn 5 sẽ bổ sung cấu hình CAN, DID, security và persistence. */
export interface VehicleConditions {
  speedKmh: number;
  rpm: number;
  engineRunning: boolean;
  batteryVoltage: number;
  gear: Gear;
}

export const DEFAULT_CONDITIONS: VehicleConditions = {
  speedKmh: 0,
  rpm: 0,
  engineRunning: false,
  batteryVoltage: 12.6,
  gear: 'P',
};

interface VehicleConfigState {
  conditions: VehicleConditions;
  setConditions: (patch: Partial<VehicleConditions>) => void;
}

export const useVehicleConfigStore = create<VehicleConfigState>((set) => ({
  conditions: DEFAULT_CONDITIONS,
  setConditions: (patch) => set((s) => ({ conditions: { ...s.conditions, ...patch } })),
}));
