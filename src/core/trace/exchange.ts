import { annotateFrame, annotatePdu } from '../annotate';
import type { ByteAnnotation } from '../annotate/types';
import { lengthToDlc } from '../can/dlc';
import type { CanIdType } from '../can/frame';
import { planTransfer } from '../isotp/transfer';
import type { FrameKind } from '../isotp/types';
import type { UdsResult } from '../uds/types';
import type { Addressing, VehicleConfig } from '../vehicle/types';

/** Hướng frame nhìn từ phía tester: Tx = tester gửi, Rx = tester nhận. */
export type FrameDirection = 'Tx' | 'Rx';
export type FrameRole = 'request' | 'response' | 'pending' | 'flowControl';

export interface TraceFrame {
  id: string;
  exchangeId: number;
  /** Thời điểm (ms). */
  t: number;
  dir: FrameDirection;
  canId: number;
  idType: CanIdType;
  fd: boolean;
  dlc: number;
  data: number[];
  kind: FrameKind;
  role: FrameRole;
  annotations: ByteAnnotation[];
}

export interface Exchange {
  id: number;
  t: number;
  result: UdsResult;
  frames: TraceFrame[];
  /** Request do hệ thống tự gửi (ví dụ TesterPresent định kỳ). */
  auto?: boolean;
}

/** Thời gian xử lý giả lập của ECU (luôn nhỏ hơn P2). */
const ECU_PROCESSING_MS = 2;
/** Khoảng thời gian giả lập giữa NRC 0x78 và response thật. */
const PENDING_DELAY_MS = 1000;

/** Sinh CAN frame (kèm Flow Control của bên nhận) cho từng PDU, tính thời gian theo STmin. */
class FrameEmitter {
  readonly frames: TraceFrame[] = [];
  t: number;
  private seq = 0;

  constructor(
    private readonly exchangeId: number,
    t0: number,
    private readonly config: VehicleConfig,
    private readonly addressing: Addressing,
  ) {
    this.t = t0;
  }

  emit(pdu: number[], senderDir: FrameDirection, role: FrameRole): void {
    const { can } = this.config;
    const pduFields = annotatePdu(pdu, { direction: senderDir === 'Tx' ? 'request' : 'response', config: this.config });
    const testerId = this.addressing === 'functional' ? can.functionalId : can.requestId;
    for (const tf of planTransfer(pdu, { fd: can.fd, padding: can.padding }, { bs: can.bs, stMin: can.stMin })) {
      const dir: FrameDirection = tf.from === 'sender' ? senderDir : senderDir === 'Tx' ? 'Rx' : 'Tx';
      // Flow Control của tester luôn gửi physical
      const canId = dir === 'Tx' ? (tf.kind === 'FC' ? can.requestId : testerId) : can.responseId;
      if (this.seq > 0) this.t += tf.minGapUs !== undefined ? Math.max(1, tf.minGapUs / 1000) : 1;
      this.frames.push({
        id: `${this.exchangeId}-${this.seq++}`,
        exchangeId: this.exchangeId,
        t: this.t,
        dir,
        canId,
        idType: can.idType,
        fd: can.fd,
        dlc: lengthToDlc(tf.data.length, can.fd),
        data: tf.data,
        kind: tf.kind,
        role: tf.kind === 'FC' ? 'flowControl' : role,
        annotations: annotateFrame(
          { data: tf.data, kind: tf.kind, fd: can.fd, pciLength: tf.pciLength, padStart: tf.padStart, payloadOffset: tf.payloadOffset },
          tf.kind === 'FC' ? [] : pduFields,
        ),
      });
    }
  }
}

/**
 * Dựng danh sách CAN frame của một lần trao đổi request/response,
 * gồm Flow Control và NRC 0x78 (nếu có), kèm chú thích từng byte.
 */
export function buildExchange(id: number, t0: number, config: VehicleConfig, result: UdsResult, auto = false): Exchange {
  const em = new FrameEmitter(id, t0, config, result.addressing);
  if (result.request.length > 0) em.emit(result.request, 'Tx', 'request');
  em.t += ECU_PROCESSING_MS;
  for (const pending of result.pendingResponses) {
    em.emit(pending, 'Rx', 'pending');
    em.t += PENDING_DELAY_MS;
  }
  if (result.response) em.emit(result.response, 'Rx', 'response');
  return { id, t: t0, result, frames: em.frames, auto };
}

/** Xem trước các frame tester sẽ gửi cho một request (chưa gửi tới ECU). */
export function previewRequestFrames(config: VehicleConfig, pdu: number[], addressing: Addressing): TraceFrame[] {
  if (pdu.length === 0) return [];
  const em = new FrameEmitter(0, 0, config, addressing);
  em.emit(pdu, 'Tx', 'request');
  return em.frames;
}
