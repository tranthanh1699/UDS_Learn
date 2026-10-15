/**
 * Tên ISO của các service UDS phổ biến, dùng để chú thích byte SID kể cả khi simulator chưa hỗ trợ.
 * Mục tham chiếu theo ISO 14229-1:2020.
 * TODO: verify against ISO 14229-1 (số mục của các service chưa có trong MVP).
 */
export const SERVICE_NAMES: Record<number, string> = {
  0x10: 'DiagnosticSessionControl',
  0x11: 'ECUReset',
  0x14: 'ClearDiagnosticInformation',
  0x19: 'ReadDTCInformation',
  0x22: 'ReadDataByIdentifier',
  0x23: 'ReadMemoryByAddress',
  0x27: 'SecurityAccess',
  0x28: 'CommunicationControl',
  0x2e: 'WriteDataByIdentifier',
  0x2f: 'InputOutputControlByIdentifier',
  0x31: 'RoutineControl',
  0x34: 'RequestDownload',
  0x36: 'TransferData',
  0x37: 'RequestTransferExit',
  0x3e: 'TesterPresent',
  0x85: 'ControlDTCSetting',
};

/** Mục tham chiếu ISO 14229-1:2020 của các service trong MVP. */
export const SERVICE_ISO_REFS: Record<number, string> = {
  0x10: 'ISO 14229-1, mục 10.2',
  0x11: 'ISO 14229-1, mục 10.3',
  0x27: 'ISO 14229-1, mục 10.4',
  0x3e: 'ISO 14229-1, mục 10.7',
  0x22: 'ISO 14229-1, mục 11.2',
  0x2e: 'ISO 14229-1, mục 11.7',
};

export const NRC_ISO_REF = 'ISO 14229-1, phụ lục A';
export const ISOTP_ISO_REF = 'ISO 15765-2, mục 9.6';

export function serviceName(sid: number): string | undefined {
  return SERVICE_NAMES[sid];
}
