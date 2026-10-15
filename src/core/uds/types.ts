import type { Addressing, SessionKind, VehicleConditions, VehicleConfig } from '../vehicle/types';

/** Trạng thái chạy của ECU mô phỏng. Phải serialize được (plain object). */
export interface EcuState {
  session: SessionKind;
  /** null = đang khóa; số = security level đã mở (giá trị requestSeed lẻ: 1, 3, ...). */
  unlockedLevel: number | null;
  /** Thời điểm S3 hết hạn (ms); null khi ở default session. */
  s3Deadline: number | null;
  /** Giá trị DID static đã bị ghi (0x2E); DID chưa ghi dùng giá trị trong cấu hình. */
  didValues: Record<number, number[]>;
}

export interface RequestContext {
  addressing: Addressing;
  /** Thời điểm nhận request (ms). Truyền vào để engine chạy tất định và test được. */
  now: number;
  /** Điều kiện xe tại thời điểm request (đã áp dụng ảnh hưởng của lỗi inject). */
  conditions: VehicleConditions;
  /** Giả lập ECU xử lý lâu: gửi NRC 0x78 trước response thật. */
  simulateResponsePending?: boolean;
}

export type StepId =
  | 'sidSupported'
  | 'sidSession'
  | 'sidSecurity'
  | 'minLength'
  | 'subFunctionSupported'
  | 'subFunctionSession'
  | 'subFunctionSecurity'
  | 'sequence'
  | 'serviceSpecific';

export type StepStatus = 'passed' | 'failed' | 'skipped' | 'notApplicable';

export interface PipelineStep {
  id: StepId;
  /** Thứ tự bước 1–9 trong quy trình (các kiểm tra riêng của service cùng là bước 9). */
  order: number;
  title: string;
  status: StepStatus;
  reason: string;
  nrc?: number;
}

/** Thay đổi trạng thái do một request (hoặc do S3 hết hạn) gây ra, kèm giải thích. */
export type StateChange =
  | { kind: 'session'; from: SessionKind; to: SessionKind; message: string }
  | { kind: 'security'; from: number | null; to: number | null; message: string }
  | { kind: 'didWritten'; did: number; data: number[]; message: string };

/** Hiệu ứng mà handler yêu cầu engine áp dụng; handler không tự sửa state. */
export type Effect =
  | { type: 'setSession'; to: SessionKind }
  | { type: 'lockSecurity' }
  | { type: 'writeDid'; did: number; data: number[] };

export type UdsOutcome =
  /** Gửi positive response. */
  | 'positive'
  /** Gửi negative response. */
  | 'negative'
  /** Positive nhưng không gửi vì suppressPosRspMsgIndicationBit. */
  | 'suppressed'
  /** Không gửi gì (NRC bị chặn khi functional addressing, hoặc request rỗng). */
  | 'noResponse';

export interface UdsResult {
  request: number[];
  addressing: Addressing;
  sid: number | null;
  serviceName: string | null;
  subFunction: number | null;
  suppressPosRsp: boolean;
  steps: PipelineStep[];
  outcome: UdsOutcome;
  /** Response cuối cùng được gửi (null nếu không gửi). */
  response: number[] | null;
  /** Các NRC 0x78 gửi trước response cuối. */
  pendingResponses: number[][];
  /** NRC của kết quả (kể cả khi bị chặn do functional addressing). */
  nrc: number | null;
  stateChanges: StateChange[];
  /** Câu tóm tắt tiếng Việt cho người học. */
  explanation: string;
  notes: string[];
}

export interface SubFunctionDefinition {
  id: number;
  /** Tên ISO (tiếng Anh). */
  name: string;
  sessions: readonly SessionKind[];
  securityLevel: number | null;
}

/** Ngữ cảnh truyền cho handler của service. */
export interface ServiceContext {
  request: readonly number[];
  subFunction: number | null;
  suppressPosRsp: boolean;
  addressing: Addressing;
  now: number;
  conditions: VehicleConditions;
  config: VehicleConfig;
  state: Readonly<EcuState>;
  /** Ghi nhận một kiểm tra riêng của service đã đạt. */
  pass(title: string, reason: string): void;
  /** Ghi nhận một kiểm tra riêng thất bại và trả về kết quả negative tương ứng. */
  fail(title: string, nrc: number, reason: string, effects?: Effect[]): HandlerResult;
}

/** Kết quả một bước kiểm tra trong pipeline. */
export interface CheckResult {
  passed: boolean;
  nrc?: number;
  reason: string;
}

export type HandlerResult =
  | { kind: 'positive'; response: number[]; effects?: Effect[] }
  | { kind: 'negative'; nrc: number; reason: string; effects?: Effect[] };

export interface ServiceDefinition {
  sid: number;
  /** Tên ISO (tiếng Anh). */
  name: string;
  /** Độ dài tối thiểu của request, tính cả SID. */
  minLength: number;
  sessions: readonly SessionKind[];
  /** Security level cần cho cả service; null = không cần. */
  securityLevel: number | null;
  /** Danh sách sub-function; không có = service không dùng sub-function. */
  subFunctions?: readonly SubFunctionDefinition[];
  /** Bước 8: kiểm tra thứ tự request (ví dụ sendKey trước requestSeed). */
  checkSequence?(ctx: ServiceContext): CheckResult;
  /** Bước 9: kiểm tra riêng và thực thi. */
  handle(ctx: ServiceContext): HandlerResult;
}
