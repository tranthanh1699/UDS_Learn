import { hex } from '../util/hex';
import type { ComponentId, DtcModelConfig, EcuId, FaultCatalogEntry, FaultType, WarningLamp } from './types';

/**
 * FTB (Failure Type Byte) theo kiểu SAE J2012 cho từng loại lỗi.
 * Mã DTC trong danh mục mặc định là ví dụ minh họa.
 * TODO: verify against SAE J2012 / ISO 15031-6 (giá trị FTB).
 */
export const FTB: Record<FaultType, number> = {
  shortToGround: 0x11,
  shortToBattery: 0x12,
  openCircuit: 0x13,
  outOfRangeLow: 0x16,
  outOfRangeHigh: 0x17,
  signalImplausible: 0x64,
  canTimeout: 0x00,
};

/** "C0035" → 0x4035 (2 bit cao: P=00, C=01, B=10, U=11). */
export function encodeDtcCode(code: string): number {
  const letter = 'PCBU'.indexOf(code[0]!.toUpperCase());
  const digits = parseInt(code.slice(1), 16);
  return ((letter << 14) | digits) & 0xffff;
}

/** DTC 3 byte → "C0035-13". */
export function formatDtc(dtc: number): string {
  const code = (dtc >> 8) & 0xffff;
  const letter = 'PCBU'[code >> 14]!;
  return `${letter}${hex(code & 0x3fff, 4)}-${hex(dtc & 0xff)}`;
}

/** DTC 3 byte → "40 35 13". */
export const dtcBytes = (dtc: number): string => [dtc >> 16, (dtc >> 8) & 0xff, dtc & 0xff].map((b) => hex(b)).join(' ');

interface ComponentSpec {
  code: string;
  ecu: EcuId;
  lamp: WarningLamp | null;
  faults: FaultType[];
}

/** Danh mục linh kiện mặc định (dữ liệu mẫu, ví dụ minh họa). */
export const COMPONENTS: Record<ComponentId, ComponentSpec> = {
  wssFL: { code: 'C0035', ecu: 'abs', lamp: 'abs', faults: ['openCircuit', 'shortToGround', 'signalImplausible'] },
  wssFR: { code: 'C0040', ecu: 'abs', lamp: 'abs', faults: ['openCircuit', 'shortToGround', 'signalImplausible'] },
  wssRL: { code: 'C0045', ecu: 'abs', lamp: 'abs', faults: ['openCircuit', 'shortToGround', 'signalImplausible'] },
  wssRR: { code: 'C0050', ecu: 'abs', lamp: 'abs', faults: ['openCircuit', 'shortToGround', 'signalImplausible'] },
  o2Sensor: { code: 'P0130', ecu: 'engine', lamp: 'mil', faults: ['openCircuit', 'shortToBattery', 'signalImplausible'] },
  coolantTemp: { code: 'P0115', ecu: 'engine', lamp: 'mil', faults: ['outOfRangeLow', 'outOfRangeHigh', 'openCircuit'] },
  battery: { code: 'P0560', ecu: 'engine', lamp: null, faults: ['outOfRangeLow', 'outOfRangeHigh'] },
  absPump: { code: 'C0110', ecu: 'abs', lamp: 'abs', faults: ['openCircuit', 'shortToGround'] },
  canAbs: { code: 'U0121', ecu: 'engine', lamp: 'abs', faults: ['canTimeout'] },
};

export const COMPONENT_IDS = Object.keys(COMPONENTS) as ComponentId[];

export function defaultCatalog(): FaultCatalogEntry[] {
  return COMPONENT_IDS.flatMap((component) => {
    const spec = COMPONENTS[component];
    return spec.faults.map((faultType) => ({
      id: `${component}:${faultType}`,
      component,
      faultType,
      dtc: (encodeDtcCode(spec.code) << 8) | FTB[faultType],
      ecu: spec.ecu,
      lamp: spec.lamp,
    }));
  });
}

export const DEFAULT_DTC_CONFIG: DtcModelConfig = {
  failStep: 1,
  passStep: 1,
  failThreshold: 3,
  passThreshold: -3,
  confirmationThreshold: 2,
  healingCycles: 2,
  agingCycles: 3,
};
