import { FD_DLC_LENGTHS } from '../can/dlc';
import type { IsoTpConfig } from './types';

/** Kích thước bản tin tối đa ISO-TP hỗ trợ (FF_DL 32-bit). */
export const MAX_MESSAGE_LENGTH = 0xffffffff;
/** FF_DL 12-bit tối đa; lớn hơn phải dùng First Frame dạng escape 4 byte. */
export const MAX_FF_DL_12BIT = 0xfff;

export function resolveTxDl(cfg: IsoTpConfig): number {
  if (!cfg.fd) return 8;
  const txDl = cfg.txDl ?? 64;
  if (txDl < 8 || !FD_DLC_LENGTHS.includes(txDl)) throw new RangeError(`TX_DL ${txDl} không hợp lệ cho CAN FD`);
  return txDl;
}

/** Số byte payload tối đa của một Single Frame. */
export function maxSingleFramePayload(cfg: IsoTpConfig): number {
  const txDl = resolveTxDl(cfg);
  return txDl === 8 ? 7 : txDl - 2;
}
