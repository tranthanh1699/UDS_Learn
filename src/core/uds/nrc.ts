/**
 * Bảng NRC dùng trong simulator (ISO 14229-1, phụ lục A).
 * Chỉ dùng các mã có trong bảng này; ý nghĩa tiếng Việt nằm ở vi.nrc.
 */
export const NRC = {
  generalReject: 0x10,
  serviceNotSupported: 0x11,
  subFunctionNotSupported: 0x12,
  incorrectMessageLengthOrInvalidFormat: 0x13,
  responseTooLong: 0x14,
  busyRepeatRequest: 0x21,
  conditionsNotCorrect: 0x22,
  requestSequenceError: 0x24,
  failurePreventsExecutionOfRequestedAction: 0x26,
  requestOutOfRange: 0x31,
  securityAccessDenied: 0x33,
  invalidKey: 0x35,
  exceededNumberOfAttempts: 0x36,
  requiredTimeDelayNotExpired: 0x37,
  generalProgrammingFailure: 0x72,
  requestCorrectlyReceivedResponsePending: 0x78,
  subFunctionNotSupportedInActiveSession: 0x7e,
  serviceNotSupportedInActiveSession: 0x7f,
  rpmTooHigh: 0x81,
  engineIsRunning: 0x83,
  vehicleSpeedTooHigh: 0x88,
  transmissionRangeNotInGear: 0x8d,
  shifterLeverNotInPark: 0x90,
  voltageTooHigh: 0x92,
  voltageTooLow: 0x93,
} as const;

export type NrcCode = (typeof NRC)[keyof typeof NRC];

/** Tên ISO của từng NRC (giữ nguyên tiếng Anh). */
export const NRC_NAMES: Record<NrcCode, string> = {
  0x10: 'generalReject',
  0x11: 'serviceNotSupported',
  0x12: 'subFunctionNotSupported',
  0x13: 'incorrectMessageLengthOrInvalidFormat',
  0x14: 'responseTooLong',
  0x21: 'busyRepeatRequest',
  0x22: 'conditionsNotCorrect',
  0x24: 'requestSequenceError',
  0x26: 'failurePreventsExecutionOfRequestedAction',
  0x31: 'requestOutOfRange',
  0x33: 'securityAccessDenied',
  0x35: 'invalidKey',
  0x36: 'exceededNumberOfAttempts',
  0x37: 'requiredTimeDelayNotExpired',
  0x72: 'generalProgrammingFailure',
  0x78: 'requestCorrectlyReceived-ResponsePending',
  0x7e: 'subFunctionNotSupportedInActiveSession',
  0x7f: 'serviceNotSupportedInActiveSession',
  0x81: 'rpmTooHigh',
  0x83: 'engineIsRunning',
  0x88: 'vehicleSpeedTooHigh',
  0x8d: 'transmissionRangeNotInGear',
  0x90: 'shifterLeverNotInPark',
  0x92: 'voltageTooHigh',
  0x93: 'voltageTooLow',
};

export const ALL_NRC_CODES = Object.keys(NRC_NAMES).map(Number) as NrcCode[];

export function nrcName(code: number): string {
  return NRC_NAMES[code as NrcCode] ?? 'unknown';
}

/** SID của negative response. */
export const NEGATIVE_RESPONSE_SID = 0x7f;

/** Các NRC ECU không được gửi khi request dùng functional addressing (ISO 14229-1, mục 7.5). */
export const NRC_SUPPRESSED_ON_FUNCTIONAL: readonly number[] = [
  NRC.serviceNotSupported,
  NRC.subFunctionNotSupported,
  NRC.requestOutOfRange,
  NRC.subFunctionNotSupportedInActiveSession,
  NRC.serviceNotSupportedInActiveSession,
];
