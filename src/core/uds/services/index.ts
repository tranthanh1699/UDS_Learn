import type { ServiceDefinition } from '../types';
import { diagnosticSessionControl } from './0x10';
import { ecuReset } from './0x11';
import { readDtcInformation } from './0x19';
import { readDataByIdentifier } from './0x22';
import { securityAccess } from './0x27';
import { writeDataByIdentifier } from './0x2E';
import { testerPresent } from './0x3E';

/**
 * Danh sách service ECU hỗ trợ. Thêm service mới: tạo file trong thư mục này và thêm vào mảng.
 * SID không có ở đây → NRC 0x11 serviceNotSupported.
 */
export const DEFAULT_SERVICES: readonly ServiceDefinition[] = [
  diagnosticSessionControl,
  ecuReset,
  readDtcInformation,
  readDataByIdentifier,
  securityAccess,
  writeDataByIdentifier,
  testerPresent,
];
