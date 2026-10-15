import { asciiBytes } from '@/core/util/hex';
import type { DidDefinition, SessionKind, VehicleConfig } from '@/core/vehicle/types';

const ALL: SessionKind[] = ['default', 'programming', 'extended'];
const EXT: SessionKind[] = ['extended'];

/** DID chỉ đọc, đọc được ở mọi session, không cần security. */
const readOnly = (d: Omit<DidDefinition, 'readSessions' | 'readSecurityLevel' | 'writable' | 'writeSessions' | 'writeSecurityLevel'>): DidDefinition => ({
  ...d,
  readSessions: ALL,
  readSecurityLevel: null,
  writable: false,
  writeSessions: [],
  writeSecurityLevel: null,
});

/**
 * Cấu hình xe mặc định. Dữ liệu là ví dụ minh họa, không thuộc hãng xe nào.
 * Viết bằng TypeScript (thay vì JSON) để giữ được hằng số hex dễ đọc; "Xuất JSON" sẽ sinh ra JSON tương ứng.
 */
export const DEFAULT_VEHICLE: VehicleConfig = {
  schemaVersion: 1,
  ecuName: 'Engine ECU',
  can: {
    requestId: 0x7e0,
    responseId: 0x7e8,
    functionalId: 0x7df,
    idType: 'standard',
    fd: false,
    padding: 0xcc,
    bs: 0,
    stMin: 0,
  },
  timing: { p2Ms: 50, p2StarMs: 5000, s3Ms: 5000 },
  security: {
    levels: [
      {
        level: 1,
        seedLength: 4,
        algorithm: 'xor',
        constant: 0x5a5a5a5a,
        expression: '(seed ^ 0x5A5A5A5A) + 0x1234',
        maxAttempts: 3,
        delayMs: 10000,
      },
      {
        level: 3,
        seedLength: 4,
        algorithm: 'add',
        constant: 0x12345678,
        expression: '((seed << 3) | (seed >> 29)) ^ 0xA5A5A5A5',
        maxAttempts: 3,
        delayMs: 10000,
      },
    ],
  },
  ecuReset: { requireStandstill: true, requireEngineOff: true },
  conditions: { speedKmh: 0, rpm: 0, engineRunning: false, batteryVoltage: 12.6, gear: 'P' },
  limits: { maxDidsPerRead: 8, maxResponseLength: 4095 },
  dids: [
    {
      did: 0xf190,
      name: 'VIN (số khung)',
      length: 17,
      format: 'ascii',
      source: 'static',
      data: asciiBytes('VNLAB2026UDS00001'),
      readSessions: ALL,
      readSecurityLevel: null,
      writable: true,
      writeSessions: EXT,
      writeSecurityLevel: 1,
      common: true,
    },
    readOnly({ did: 0xf187, name: 'Mã phụ tùng (part number)', length: 10, format: 'ascii', source: 'static', data: asciiBytes('LAB0123456'), common: true }),
    readOnly({ did: 0xf18c, name: 'Số serial ECU', length: 12, format: 'ascii', source: 'static', data: asciiBytes('SN2026000123'), common: true }),
    readOnly({ did: 0xf195, name: 'Phiên bản phần mềm', length: 9, format: 'ascii', source: 'static', data: asciiBytes('V01.02.03'), common: true }),
    readOnly({ did: 0xf18b, name: 'Ngày sản xuất ECU (YY MM DD, BCD)', length: 3, format: 'bcd', source: 'static', data: [0x26, 0x10, 0x15], common: true }),
    readOnly({ did: 0xf186, name: 'Session đang hoạt động', length: 1, format: 'hex', source: 'activeSession', data: [], common: true }),
    readOnly({ did: 0x0100, name: 'Tốc độ xe', length: 1, format: 'uint', source: 'vehicleSpeed', data: [], factor: 1, unit: 'km/h' }),
    readOnly({ did: 0x0101, name: 'Tốc độ động cơ', length: 2, format: 'uint', source: 'engineRpm', data: [], factor: 1, unit: 'rpm' }),
    readOnly({ did: 0x0102, name: 'Điện áp ắc quy', length: 1, format: 'uint', source: 'batteryVoltage', data: [], factor: 0.1, unit: 'V' }),
    {
      did: 0x0200,
      name: 'Cấu hình đèn chạy ban ngày',
      length: 1,
      format: 'hex',
      source: 'static',
      data: [0x01],
      readSessions: ALL,
      readSecurityLevel: null,
      writable: true,
      writeSessions: EXT,
      writeSecurityLevel: 1,
    },
    {
      did: 0x0201,
      name: 'Dữ liệu hiệu chỉnh (chỉ đọc trong extended session, cần security)',
      length: 4,
      format: 'hex',
      source: 'static',
      data: [0xde, 0xad, 0xbe, 0xef],
      readSessions: EXT,
      readSecurityLevel: 1,
      writable: false,
      writeSessions: [],
      writeSecurityLevel: null,
    },
  ],
};
