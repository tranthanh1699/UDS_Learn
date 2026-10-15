import type { Addressing, SessionKind, VehicleConditions, VehicleConfig } from '../vehicle/types';

/** Trạng thái chạy của ECU mô phỏng. Phải serialize được (plain object). */
export interface EcuState {
  session: SessionKind;
  /** null = đang khóa; số = security level đã mở (giá trị requestSeed lẻ: 1, 3, ...). */
  unlockedLevel: number | null;
  /** Thời điểm S3 hết hạn (ms); null khi ở default session. */
  s3Deadline: number | null;
  /** Giá trị DID static đã bị ghi (0x2E); DID chưa ghi dùng giá trị trong cấu hình. Giữ nguyên qua ECU reset (giả lập NVM). */
  didValues: Record<number, number[]>;
  security: SecurityRuntime;
  /** ECU đang khởi động lại sau 0x11 cho tới thời điểm này (ms); null = đang chạy bình thường. */
  rebootUntil: number | null;
}

/** Trạng thái nội bộ của SecurityAccess. */
export interface SecurityRuntime {
  /** Seed đã gửi cho tester và đang chờ sendKey. */
  pendingSeed: { level: number; seed: number[] } | null;
  /** Số lần gửi key sai liên tiếp theo từng level. */
  failedAttempts: Record<number, number>;
  /** Thời điểm hết thời gian khóa (ms) theo từng level. */
  delayUntil: Record<number, number>;
}

export interface RequestContext {
  addressing: Addressing;
  /** Thời điểm nhận request (ms). Truyền vào để engine chạy tất định và test được. */
  now: number;
  /** Điều kiện xe tại thời điểm request (đã áp dụng ảnh hưởng của lỗi inject). */
  conditions: VehicleConditions;
  /** Giả lập ECU xử lý lâu: gửi NRC 0x78 trước response thật. */
  simulateResponsePending?: boolean;
  /** Bộ nhớ DTC của ECU này (chỉ đọc), dùng cho 0x19. Không có = ECU chưa có DTC nào. */
  dtcs?: readonly DtcRecordView[];
}

/** Một DTC nhìn từ phía Dcm: mã 3 byte, status byte và dữ liệu phụ cho 0x19 04/06. */
export interface DtcRecordView {
  dtc: number;
  status: number;
  occurrence: number;
  agingCounter: number;
  /** Ảnh chụp điều kiện xe lúc lỗi được xác nhận lần đầu (snapshot / freeze frame). */
  snapshot: VehicleConditions | null;
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
  | { kind: 'didWritten'; did: number; data: number[]; message: string }
  | { kind: 'securityAttempt'; level: number; attempts: number; max: number; message: string }
  | { kind: 'reboot'; phase: 'start' | 'done'; message: string };

/** Hiệu ứng mà handler yêu cầu engine áp dụng; handler không tự sửa state. */
export type Effect =
  | { type: 'setSession'; to: SessionKind }
  | { type: 'lockSecurity' }
  | { type: 'writeDid'; did: number; data: number[] }
  | { type: 'storeSeed'; level: number; seed: number[] }
  | { type: 'unlock'; level: number }
  /** Key sai: engine tăng bộ đếm, xóa seed, và bắt đầu thời gian khóa khi đạt số lần tối đa. */
  | { type: 'keyFailed'; level: number }
  | { type: 'ecuReset'; resetType: number };

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
  /** Sinh n byte ngẫu nhiên (engine có thể thay bằng nguồn tất định khi test). */
  randomBytes(n: number): number[];
  /** Danh sách DTC ECU hỗ trợ cùng trạng thái hiện tại. */
  dtcs: readonly DtcRecordView[];
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
  /**
   * Danh sách sub-function; không có = service không dùng sub-function.
   * Có thể phụ thuộc cấu hình (ví dụ 0x27 sinh sub-function theo các security level đã cấu hình).
   */
  subFunctions?: readonly SubFunctionDefinition[] | ((config: VehicleConfig) => readonly SubFunctionDefinition[]);
  /** Bước 8: kiểm tra thứ tự request (ví dụ sendKey trước requestSeed). */
  checkSequence?(ctx: ServiceContext): CheckResult;
  /** Bước 9: kiểm tra riêng và thực thi. */
  handle(ctx: ServiceContext): HandlerResult;
}

/** Danh sách sub-function thực tế của service theo cấu hình hiện tại. */
export function resolveSubFunctions(def: ServiceDefinition | undefined, config: VehicleConfig): readonly SubFunctionDefinition[] {
  const subs = def?.subFunctions;
  if (subs === undefined) return [];
  return typeof subs === 'function' ? subs(config) : subs;
}
