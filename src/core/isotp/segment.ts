import { padFrameData } from '../can/padding';
import { maxSingleFramePayload, resolveTxDl } from './config';
import { consecutiveFramePci, firstFramePci, singleFramePci } from './pci';
import type { IsoTpConfig, IsoTpSegment } from './types';

/**
 * Chia bản tin thành các frame ISO-TP: một Single Frame, hoặc First Frame + các Consecutive Frame.
 * SN của Consecutive Frame bắt đầu từ 1 và quay vòng F → 0.
 */
export function segment(payload: readonly number[], cfg: IsoTpConfig): IsoTpSegment[] {
  if (payload.length === 0) throw new RangeError('Bản tin rỗng');
  const txDl = resolveTxDl(cfg);

  if (payload.length <= maxSingleFramePayload(cfg)) {
    const pci = singleFramePci(payload.length, cfg);
    const { data, padStart } = padFrameData([...pci, ...payload], cfg.fd, cfg.padding);
    return [{ kind: 'SF', data, pciLength: pci.length, payloadOffset: 0, payloadLength: payload.length, padStart }];
  }

  // First Frame luôn đầy đủ TX_DL byte nên không cần padding
  const ffPci = firstFramePci(payload.length);
  const ffChunk = txDl - ffPci.length;
  const segments: IsoTpSegment[] = [
    {
      kind: 'FF',
      data: [...ffPci, ...payload.slice(0, ffChunk)],
      pciLength: ffPci.length,
      payloadOffset: 0,
      payloadLength: ffChunk,
      padStart: txDl,
    },
  ];

  const cfChunk = txDl - 1;
  let offset = ffChunk;
  let sn = 1;
  while (offset < payload.length) {
    const chunk = payload.slice(offset, offset + cfChunk);
    const { data, padStart } = padFrameData([...consecutiveFramePci(sn), ...chunk], cfg.fd, cfg.padding);
    segments.push({ kind: 'CF', data, pciLength: 1, payloadOffset: offset, payloadLength: chunk.length, padStart, sn });
    offset += chunk.length;
    sn = (sn + 1) & 0x0f;
  }
  return segments;
}
