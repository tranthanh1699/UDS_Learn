import { vi } from '../../i18n/vi';
import { isValidCanId } from '../can/frame';
import { PADDING_OPTIONS } from '../can/padding';
import { parseKeyExpression } from '../uds/keyAlgorithm';
import { hex } from '../util/hex';
import type { CanConfig, DidDefinition, DidSource, SecurityLevelConfig, VehicleConfig } from './types';

const err = vi.config.errors;

/** Độ dài dữ liệu cố định của các DID dữ liệu sống. */
export const LIVE_SOURCE_LENGTH: Record<Exclude<DidSource, 'static'>, number> = {
  vehicleSpeed: 1,
  engineRpm: 2,
  batteryVoltage: 1,
  activeSession: 1,
};

/** VIN: 17 ký tự chữ hoa/số, không dùng I, O, Q (để tránh nhầm với 1 và 0). */
export function validateVin(vin: string): string[] {
  const errors: string[] = [];
  if (vin.length !== 17) errors.push(err.vinLength(vin.length));
  if (!/^[A-Z0-9]*$/.test(vin)) errors.push(err.vinChars);
  else if (/[IOQ]/.test(vin)) errors.push(err.vinIoq);
  return errors;
}

export function validateCan(can: CanConfig): string[] {
  const errors: string[] = [];
  const bits = can.idType === 'standard' ? '11-bit' : '29-bit';
  for (const [key, label] of [
    ['requestId', vi.config.can.requestId],
    ['responseId', vi.config.can.responseId],
    ['functionalId', vi.config.can.functionalId],
  ] as const) {
    if (!isValidCanId(can[key], can.idType)) errors.push(err.canId(label, bits));
  }
  if (can.requestId === can.responseId) errors.push(err.sameIds);
  if (!Number.isInteger(can.bs) || can.bs < 0 || can.bs > 0xff) errors.push(err.bs);
  if (!Number.isInteger(can.stMin) || can.stMin < 0 || can.stMin > 0xff) errors.push(err.stMin);
  if (!PADDING_OPTIONS.includes(can.padding)) errors.push(err.padding);
  return errors;
}

export function validateDid(def: DidDefinition, all: readonly DidDefinition[]): string[] {
  const errors: string[] = [];
  const id = hex(def.did, 4);
  if (!Number.isInteger(def.did) || def.did < 0 || def.did > 0xffff) errors.push(err.didRange);
  if (all.filter((d) => d.did === def.did).length > 1) errors.push(err.didDuplicate(id));
  if (!Number.isInteger(def.length) || def.length < 1 || def.length > 255) errors.push(err.didLength(id));
  if (def.source === 'static' && def.data.length !== def.length) errors.push(err.didDataLength(id, def.data.length, def.length));
  if (def.source !== 'static' && def.length !== LIVE_SOURCE_LENGTH[def.source]) errors.push(err.didLiveLength(id, LIVE_SOURCE_LENGTH[def.source]));
  if (def.writable && def.source !== 'static') errors.push(err.didLiveWritable(id));
  if (def.readSessions.length === 0) errors.push(err.didNoReadSession(id));
  if (def.writable && def.writeSessions.length === 0) errors.push(err.didNoWriteSession(id));
  return errors;
}

export function validateSecurityLevel(s: SecurityLevelConfig): string[] {
  const errors: string[] = [];
  if (!Number.isInteger(s.level) || s.level < 1 || s.level > 0x41 || s.level % 2 === 0) errors.push(err.secLevel);
  if (!Number.isInteger(s.seedLength) || s.seedLength < 1 || s.seedLength > 4) errors.push(err.secSeedLength);
  if (!Number.isInteger(s.maxAttempts) || s.maxAttempts < 1 || s.maxAttempts > 20) errors.push(err.secAttempts);
  if (!Number.isFinite(s.delayMs) || s.delayMs < 0 || s.delayMs > 600_000) errors.push(err.secDelay);
  if (s.algorithm === 'expression') {
    const parsed = parseKeyExpression(s.expression);
    if (!parsed.ok) errors.push(err.secExpression(parsed.error));
  }
  return errors;
}

/** Kiểm tra toàn bộ cấu hình; trả về danh sách lỗi tiếng Việt (rỗng = hợp lệ). */
export function validateVehicleConfig(cfg: VehicleConfig): string[] {
  const errors = [...validateCan(cfg.can)];
  const t = cfg.timing;
  if (!(t.p2Ms > 0 && t.p2Ms <= 0xffff)) errors.push(err.p2);
  if (!(t.p2StarMs > 0 && t.p2StarMs <= 0xffff * 10)) errors.push(err.p2Star);
  if (!(t.s3Ms >= 1000 && t.s3Ms <= 60_000)) errors.push(err.s3);
  for (const d of cfg.dids) errors.push(...validateDid(d, cfg.dids));
  const levels = cfg.security.levels.map((l) => l.level);
  if (new Set(levels).size !== levels.length) errors.push(err.secDuplicate);
  for (const s of cfg.security.levels) errors.push(...validateSecurityLevel(s));
  const vin = cfg.dids.find((d) => d.did === 0xf190);
  if (vin) errors.push(...validateVin(String.fromCharCode(...vin.data)));
  return errors;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Đọc cấu hình từ JSON (nhập file hoặc localStorage): bổ sung trường thiếu từ mặc định rồi kiểm tra.
 * Không chấp nhận cấu hình có lỗi để simulator luôn chạy với dữ liệu hợp lệ.
 */
export function parseVehicleConfig(raw: unknown, defaults: VehicleConfig): { ok: true; config: VehicleConfig } | { ok: false; errors: string[] } {
  if (!isObj(raw)) return { ok: false, errors: [err.notObject] };
  if (raw.schemaVersion !== 1) return { ok: false, errors: [err.schemaVersion(String(raw.schemaVersion))] };
  const section = <T extends object>(key: string, def: T): T => (isObj(raw[key]) ? { ...def, ...(raw[key] as Partial<T>) } : def);
  const config: VehicleConfig = {
    schemaVersion: 1,
    ecuName: typeof raw.ecuName === 'string' ? raw.ecuName : defaults.ecuName,
    can: section('can', defaults.can),
    timing: section('timing', defaults.timing),
    conditions: section('conditions', defaults.conditions),
    limits: section('limits', defaults.limits),
    security: isObj(raw.security) && Array.isArray(raw.security.levels) ? { levels: raw.security.levels as SecurityLevelConfig[] } : defaults.security,
    dids: Array.isArray(raw.dids) ? (raw.dids as DidDefinition[]) : defaults.dids,
  };
  // Kiểm tra kiểu cơ bản của từng DID trước khi kiểm tra ngữ nghĩa
  for (const d of config.dids) {
    if (!isObj(d) || typeof d.did !== 'number' || !Array.isArray(d.data) || !Array.isArray(d.readSessions) || !Array.isArray(d.writeSessions)) {
      return { ok: false, errors: [err.didShape] };
    }
  }
  const errors = validateVehicleConfig(config);
  return errors.length > 0 ? { ok: false, errors } : { ok: true, config };
}
