import type { DidDefinition, VehicleConditions } from '../vehicle/types';
import { SESSION_IDS } from './session';
import type { EcuState } from './types';

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Đọc dữ liệu hiện tại của một DID (độ dài luôn bằng def.length). */
export function readDidData(def: DidDefinition, state: Readonly<EcuState>, conditions: VehicleConditions): number[] {
  switch (def.source) {
    case 'vehicleSpeed':
      // Tín hiệu không tin cậy (lỗi cảm biến tốc độ bánh) → giá trị thay thế 0xFF
      return [conditions.speedValid === false ? 0xff : clamp(Math.round(conditions.speedKmh), 0, 0xfe)];
    case 'engineRpm': {
      const rpm = clamp(Math.round(conditions.rpm), 0, 0xffff);
      return [rpm >> 8, rpm & 0xff];
    }
    case 'batteryVoltage':
      // 0.1 V mỗi bit
      return [clamp(Math.round(conditions.batteryVoltage * 10), 0, 0xff)];
    case 'activeSession':
      return [SESSION_IDS[state.session]];
    case 'static': {
      const data = state.didValues[def.did] ?? def.data;
      return Array.from({ length: def.length }, (_, i) => data[i] ?? 0);
    }
  }
}

export function findDid(dids: readonly DidDefinition[], did: number): DidDefinition | undefined {
  return dids.find((d) => d.did === did);
}
