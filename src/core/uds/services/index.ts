import type { ServiceDefinition } from '../types';
import { diagnosticSessionControl } from './0x10';
import { readDataByIdentifier } from './0x22';
import { testerPresent } from './0x3E';

/**
 * Danh sách service ECU hỗ trợ. Thêm service mới: tạo file trong thư mục này và thêm vào mảng.
 * SID không có ở đây → NRC 0x11 serviceNotSupported.
 */
export const DEFAULT_SERVICES: readonly ServiceDefinition[] = [
  diagnosticSessionControl,
  readDataByIdentifier,
  testerPresent,
];
