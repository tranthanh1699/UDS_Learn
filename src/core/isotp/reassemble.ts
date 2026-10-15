import { maxSingleFramePayload } from './config';
import { decodePci } from './pci';
import type { IsoTpConfig, IsoTpErrorCode } from './types';

export type ReassemblyEvent =
  | { type: 'complete'; payload: number[] }
  /** Đang nhận bản tin nhiều frame. `sendFlowControl` = bên nhận phải gửi Flow Control ngay. */
  | { type: 'inProgress'; received: number; total: number; sendFlowControl: boolean }
  /** Frame Flow Control không thuộc vai trò bên nhận, bỏ qua. */
  | { type: 'ignored' }
  | { type: 'error'; code: IsoTpErrorCode };

/**
 * Bên nhận ISO-TP: ghép SF/FF/CF thành bản tin hoàn chỉnh.
 * `bs` là BS mà bên nhận quảng bá trong Flow Control (0 = không giới hạn).
 */
export class IsoTpReassembler {
  private buffer: number[] = [];
  private total = 0;
  private expectedSn = 1;
  private cfInBlock = 0;
  private active = false;

  constructor(
    private readonly cfg: IsoTpConfig,
    private readonly bs = 0,
  ) {}

  get isReceiving(): boolean {
    return this.active;
  }

  reset(): void {
    this.buffer = [];
    this.total = 0;
    this.expectedSn = 1;
    this.cfInBlock = 0;
    this.active = false;
  }

  feed(data: readonly number[]): ReassemblyEvent {
    const pci = decodePci(data, this.cfg.fd);
    switch (pci.kind) {
      case 'error':
        return { type: 'error', code: pci.code };
      case 'FC':
        return { type: 'ignored' };
      case 'SF':
        // SF mới hủy quá trình nhận nhiều frame đang dở (nếu có)
        this.reset();
        return { type: 'complete', payload: data.slice(pci.pciLength, pci.pciLength + pci.length) };
      case 'FF': {
        if (pci.length <= maxSingleFramePayload(this.cfg)) return { type: 'error', code: 'invalidFfLength' };
        this.reset();
        this.active = true;
        this.total = pci.length;
        this.buffer = data.slice(pci.pciLength);
        return { type: 'inProgress', received: this.buffer.length, total: this.total, sendFlowControl: true };
      }
      case 'CF': {
        if (!this.active) return { type: 'error', code: 'unexpectedConsecutiveFrame' };
        if (pci.sn !== this.expectedSn) {
          this.reset();
          return { type: 'error', code: 'wrongSequenceNumber' };
        }
        const remaining = this.total - this.buffer.length;
        this.buffer.push(...data.slice(1, 1 + remaining));
        this.expectedSn = (this.expectedSn + 1) & 0x0f;
        if (this.buffer.length >= this.total) {
          const payload = this.buffer;
          this.reset();
          return { type: 'complete', payload };
        }
        this.cfInBlock++;
        const blockDone = this.bs > 0 && this.cfInBlock === this.bs;
        if (blockDone) this.cfInBlock = 0;
        return { type: 'inProgress', received: this.buffer.length, total: this.total, sendFlowControl: blockDone };
      }
    }
  }
}
