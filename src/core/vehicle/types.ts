import type { CanIdType } from '../can/frame';
import type { PaddingByte } from '../can/padding';

export type SessionKind = 'default' | 'programming' | 'extended';
export type Gear = 'P' | 'R' | 'N' | 'D';
export type Addressing = 'physical' | 'functional';

export interface VehicleConditions {
  speedKmh: number;
  rpm: number;
  engineRunning: boolean;
  batteryVoltage: number;
  gear: Gear;
}

/**
 * Nguồn dữ liệu của DID.
 * static = giá trị lưu trong ECU (ghi được bằng 0x2E); các nguồn còn lại đọc trực tiếp từ trạng thái xe/ECU.
 */
export type DidSource = 'static' | 'vehicleSpeed' | 'engineRpm' | 'batteryVoltage' | 'activeSession';

/** Cách hiển thị dữ liệu DID trên giao diện. */
export type DidFormat = 'ascii' | 'hex' | 'uint' | 'bcd';

export interface DidDefinition {
  did: number;
  name: string;
  length: number;
  format: DidFormat;
  source: DidSource;
  /** Giá trị ban đầu (chỉ dùng cho source = static). */
  data: number[];
  /** Hệ số và đơn vị khi format = uint, ví dụ 0.1 V/bit. */
  factor?: number;
  unit?: string;
  readSessions: SessionKind[];
  /** Security level cần mở để đọc; null = không cần. */
  readSecurityLevel: number | null;
  writable: boolean;
  writeSessions: SessionKind[];
  writeSecurityLevel: number | null;
  /** Đánh dấu DID phổ biến theo dải 0xF1xx của ISO 14229-1 (phụ lục C). */
  common?: boolean;
}

export interface CanConfig {
  requestId: number;
  responseId: number;
  functionalId: number;
  idType: CanIdType;
  fd: boolean;
  padding: PaddingByte;
  /** BS và STmin mà mỗi bên quảng bá trong Flow Control. */
  bs: number;
  stMin: number;
}

export interface TimingConfig {
  p2Ms: number;
  p2StarMs: number;
  s3Ms: number;
}

export interface VehicleConfig {
  schemaVersion: 1;
  ecuName: string;
  can: CanConfig;
  timing: TimingConfig;
  dids: DidDefinition[];
  conditions: VehicleConditions;
  limits: {
    /** Số DID tối đa trong một request 0x22. */
    maxDidsPerRead: number;
    /** Độ dài response tối đa ECU gửi được (byte). */
    maxResponseLength: number;
  };
}
