import type { EcuState } from '@/core/uds/types';
import type { Addressing, VehicleConditions } from '@/core/vehicle/types';
import type { ServiceSidKey } from '@/i18n/vi';

/**
 * Nội dung học cho từng service (tiếng Việt, diễn giải, không chép nguyên văn ISO).
 * Frame trong ví dụ không viết tay: chúng được sinh bằng engine từ `request` + `setup`, nên luôn đúng byte.
 */

export interface TableRow {
  byte: string;
  field: string;
  size: string;
  value: string;
  meaning: string;
}

export interface ServiceExample {
  title: string;
  description: string;
  request: number[];
  addressing?: Addressing;
  /** Các request chạy trước (không hiển thị) để đưa ECU về trạng thái cần thiết. */
  setup?: number[][];
  setupState?: Partial<EcuState>;
  conditions?: Partial<VehicleConditions>;
  /**
   * 0x27: tạo request sendKey từ seed nhận được trong bước chuẩn bị cuối cùng.
   * 'correct' = key đúng, 'wrong' = key sai (đảo byte cuối).
   */
  sendKeyFromSetup?: 'correct' | 'wrong';
  /**
   * 0x19: tạo bộ nhớ DTC bằng mô hình lỗi: inject các lỗi (id trong danh mục) rồi chạy N operation cycle,
   * mỗi cycle chạy test 3 lần (cycle cuối vẫn đang chạy).
   */
  dtcSetup?: { inject: string[]; cycles: number };
}

export interface ServiceFormSpec {
  subFunctions?: { id: number; label: string }[];
  /** Sub-function sinh từ các security level đã cấu hình, kèm ô nhập key cho sendKey (0x27). */
  securityLevels?: boolean;
  allowSuppress?: boolean;
  didPicker?: boolean;
  defaultDids?: number[];
  /** Chọn một DID ghi được và nhập dữ liệu (0x2E). */
  writeDid?: boolean;
  /** Sub-function của 0x19 kèm status mask, DTC và số record. */
  dtcRead?: boolean;
}

export interface ServiceLearnContent {
  sid: ServiceSidKey;
  isoRef: string;
  purpose: string;
  useCases: string[];
  requestTable: TableRow[];
  responseTable: TableRow[];
  subFunctions?: { value: string; name: string; meaning: string }[];
  nrcs: { nrc: number; trigger: string }[];
  examples: ServiceExample[];
  mistakes: string[];
  autosar: { intro: string; items: { name: string; desc: string }[] };
  form: ServiceFormSpec;
  /** Request dùng để sinh frame ngẫu nhiên cho bài tập decode. */
  exercises: ServiceExample[];
}

const sid10: ServiceLearnContent = {
  sid: '10',
  isoRef: 'ISO 14229-1, mục 10.2',
  purpose:
    'DiagnosticSessionControl chuyển ECU giữa các session chẩn đoán. Mỗi session mở ra một nhóm service khác nhau: default session chỉ cho các thao tác an toàn như đọc dữ liệu, extended session mở thêm các service ghi dữ liệu và điều khiển, còn programming session dùng khi nạp phần mềm.',
  useCases: [
    'Trước khi ghi DID (0x2E) hoặc chạy routine: chuyển sang extended session.',
    'Trước khi flash phần mềm: chuyển sang programming session (trên xe thật thường phải đi qua extended session trước).',
    'Kết thúc phiên chẩn đoán: quay về default session để ECU hoạt động bình thường trở lại.',
    'Đọc P2 và P2* trong response để tester biết phải chờ ECU trả lời trong bao lâu.',
  ],
  requestTable: [
    { byte: '0', field: 'SID', size: '1 byte', value: '0x10', meaning: 'DiagnosticSessionControl' },
    {
      byte: '1',
      field: 'Sub-function',
      size: '1 byte',
      value: '0x01 / 0x02 / 0x03',
      meaning: 'Loại session cần chuyển tới. Bit 7 là suppressPosRspMsgIndicationBit, ví dụ 0x83 = extended session + không cần positive response.',
    },
  ],
  responseTable: [
    { byte: '0', field: 'Response SID', size: '1 byte', value: '0x50', meaning: '0x10 + 0x40' },
    { byte: '1', field: 'Sub-function', size: '1 byte', value: '0x01 / 0x02 / 0x03', meaning: 'ECU lặp lại loại session vừa vào (bit 7 luôn bằng 0).' },
    { byte: '2–3', field: 'P2 server max', size: '2 byte', value: '0x0032', meaning: 'Thời gian tối đa để ECU bắt đầu trả lời, đơn vị 1 ms: 0x0032 = 50 ms.' },
    {
      byte: '4–5',
      field: 'P2* server max',
      size: '2 byte',
      value: '0x01F4',
      meaning: 'Thời gian chờ tối đa sau khi ECU gửi NRC 0x78, đơn vị 10 ms: 0x01F4 = 500 × 10 ms = 5000 ms.',
    },
  ],
  subFunctions: [
    { value: '0x01', name: 'defaultSession', meaning: 'Session khi ECU vừa khởi động; chỉ cho phép các service cơ bản. Timer S3 không chạy.' },
    {
      value: '0x02',
      name: 'programmingSession',
      meaning: 'Dùng để nạp phần mềm. Xe thật thường yêu cầu đi qua extended session và mở security trước; simulator này cho vào trực tiếp.',
    },
    {
      value: '0x03',
      name: 'extendedDiagnosticSession',
      meaning: 'Mở thêm service ghi dữ liệu, điều khiển I/O, routine. Phải giữ bằng TesterPresent để không bị S3 timeout.',
    },
  ],
  nrcs: [
    { nrc: 0x12, trigger: 'Sub-function khác 0x01–0x03, ví dụ 10 04 (simulator chỉ hỗ trợ 3 session).' },
    { nrc: 0x13, trigger: 'Request không đúng 2 byte, ví dụ chỉ có 10, hoặc 10 03 00.' },
  ],
  examples: [
    {
      title: 'Vào extended session',
      description: 'ECU chấp nhận và trả 50 03 kèm P2 = 50 ms, P2* = 5000 ms. Từ lúc này timer S3 bắt đầu đếm.',
      request: [0x10, 0x03],
    },
    {
      title: 'Vào extended session, không cần response',
      description:
        'Sub-function 0x83 = 0x03 với bit 7 bật. ECU vẫn chuyển session nhưng không gửi positive response; tester có thể kiểm tra lại bằng cách đọc DID 0xF186.',
      request: [0x10, 0x83],
    },
    {
      title: 'Sub-function không hỗ trợ',
      description: 'Simulator không có session 0x04 nên ECU trả NRC 0x12 subFunctionNotSupported.',
      request: [0x10, 0x04],
    },
  ],
  mistakes: [
    'Quên rằng đổi session làm security bị khóa lại: phải unlock lại bằng 0x27 sau mỗi lần đổi session.',
    'Không gửi TesterPresent nên sau 5 s (S3) ECU tự quay về default session, các request sau đó bị NRC 0x7F.',
    'Đọc sai P2*: giá trị trong response có đơn vị 10 ms, 0x01F4 = 500 nghĩa là 5000 ms chứ không phải 500 ms.',
    'Đặt suppress bit rồi tưởng ECU không nhận request: suppress chỉ tắt positive response, negative response vẫn được gửi.',
  ],
  autosar: {
    intro: 'Trong AUTOSAR Classic, module Dcm xử lý 0x10 gần như hoàn toàn dựa trên cấu hình.',
    items: [
      { name: 'DcmDsdService', desc: 'Khai báo service 0x10 trong bảng service (DcmDsdServiceTable), kèm danh sách sub-function được hỗ trợ.' },
      {
        name: 'DcmDspSessionRow',
        desc: 'Mỗi session là một dòng: DcmDspSessionLevel (giá trị sub-function), DcmDspSessionP2ServerMax và DcmDspSessionP2StarServerMax (giá trị đưa vào response).',
      },
      { name: 'DcmDsdServiceSessionLevelRef', desc: 'Tham chiếu tới các session mà một service được phép chạy; sai session → Dcm tự trả NRC 0x7F.' },
      { name: 'DcmDspSessionForBoot', desc: 'Đánh dấu session cần nhảy sang bootloader (thường là programming session).' },
    ],
  },
  form: {
    subFunctions: [
      { id: 0x01, label: '01 defaultSession' },
      { id: 0x02, label: '02 programmingSession' },
      { id: 0x03, label: '03 extendedDiagnosticSession' },
    ],
    allowSuppress: true,
  },
  exercises: [
    { title: '', description: '', request: [0x10, 0x01] },
    { title: '', description: '', request: [0x10, 0x03] },
    { title: '', description: '', request: [0x10, 0x02] },
    { title: '', description: '', request: [0x10, 0x83] },
    { title: '', description: '', request: [0x10, 0x05] },
    { title: '', description: '', request: [0x10, 0x03, 0x00] },
  ],
};

const sid3E: ServiceLearnContent = {
  sid: '3E',
  isoRef: 'ISO 14229-1, mục 10.7',
  purpose:
    'TesterPresent báo cho ECU biết tester vẫn đang kết nối. Nhờ đó ECU không tự thoát khỏi session không mặc định khi hết thời gian S3.',
  useCases: [
    'Giữ extended/programming session trong lúc kỹ thuật viên thao tác chậm.',
    'Gửi định kỳ (thường mỗi 2 s) dạng functional 3E 80 để giữ session cho mọi ECU cùng lúc mà không sinh response làm bận bus.',
    'Kiểm tra nhanh ECU còn phản hồi hay không bằng 3E 00.',
  ],
  requestTable: [
    { byte: '0', field: 'SID', size: '1 byte', value: '0x3E', meaning: 'TesterPresent' },
    {
      byte: '1',
      field: 'Sub-function',
      size: '1 byte',
      value: '0x00 / 0x80',
      meaning: 'Chỉ có giá trị 0x00 (zeroSubFunction). 0x80 = 0x00 với suppressPosRspMsgIndicationBit.',
    },
  ],
  responseTable: [
    { byte: '0', field: 'Response SID', size: '1 byte', value: '0x7E', meaning: '0x3E + 0x40' },
    { byte: '1', field: 'Sub-function', size: '1 byte', value: '0x00', meaning: 'ECU lặp lại zeroSubFunction.' },
  ],
  subFunctions: [{ value: '0x00', name: 'zeroSubFunction', meaning: 'Giá trị duy nhất; chỉ báo tester còn hiện diện.' }],
  nrcs: [
    { nrc: 0x12, trigger: 'Sub-function khác 0x00, ví dụ 3E 01 gửi physical. Nếu gửi functional thì ECU im lặng thay vì trả NRC này.' },
    { nrc: 0x13, trigger: 'Request không đúng 2 byte, ví dụ 3E 00 00.' },
  ],
  examples: [
    { title: 'TesterPresent có response', description: 'ECU trả 7E 00 và khởi động lại S3 (nếu đang ở session khác default).', request: [0x3e, 0x00] },
    {
      title: 'TesterPresent không cần response',
      description: 'Cách dùng phổ biến nhất: 3E 80 giữ session mà ECU không phải trả lời.',
      request: [0x3e, 0x80],
      setup: [[0x10, 0x03]],
    },
    {
      title: 'Functional request với sub-function sai',
      description: 'Với functional addressing, ECU không gửi NRC 0x12 để tránh nhiều ECU cùng báo lỗi, nên tester không nhận được gì.',
      request: [0x3e, 0x05],
      addressing: 'functional',
    },
  ],
  mistakes: [
    'Gửi 3E 00 physical tới từng ECU mỗi 2 s: tốn băng thông vì ECU nào cũng phải trả lời; nên dùng functional 3E 80.',
    'Gửi TesterPresent thưa hơn S3 (5 s) nên session vẫn bị rơi về default.',
    'Nghĩ rằng cần TesterPresent ở default session: ở default session S3 không chạy nên không cần.',
  ],
  autosar: {
    intro: 'Dcm tự xử lý 0x3E và tự quản lý timer S3; ứng dụng gần như không phải viết code.',
    items: [
      { name: 'DcmDsdService', desc: 'Khai báo service 0x3E với sub-function 0x00 trong bảng service.' },
      { name: 'S3 timer trong Dcm', desc: 'Dcm khởi động lại S3 sau mỗi request; hết hạn thì Dcm tự chuyển về default session.' },
      {
        name: 'DcmDslProtocolRxAddrType',
        desc: 'Mỗi kênh nhận được khai báo là physical hay functional (DCM_FUNCTIONAL_TYPE); Dcm dựa vào đó để chặn các NRC không được gửi với functional request.',
      },
    ],
  },
  form: { subFunctions: [{ id: 0x00, label: '00 zeroSubFunction' }], allowSuppress: true },
  exercises: [
    { title: '', description: '', request: [0x3e, 0x00] },
    { title: '', description: '', request: [0x3e, 0x01] },
    { title: '', description: '', request: [0x3e, 0x00, 0x00] },
  ],
};

const sid22: ServiceLearnContent = {
  sid: '22',
  isoRef: 'ISO 14229-1, mục 11.2',
  purpose:
    'ReadDataByIdentifier đọc một hoặc nhiều mục dữ liệu của ECU. Mỗi mục được định danh bằng một DID 2 byte: số VIN, phiên bản phần mềm, giá trị cảm biến, ...',
  useCases: [
    'Nhận diện ECU: đọc VIN (0xF190), part number (0xF187), phiên bản phần mềm (0xF195).',
    'Đọc giá trị sống khi chẩn đoán: tốc độ, RPM, điện áp ắc quy.',
    'Kiểm tra lại giá trị vừa ghi bằng 0x2E.',
    'Đọc session hiện tại qua DID 0xF186.',
  ],
  requestTable: [
    { byte: '0', field: 'SID', size: '1 byte', value: '0x22', meaning: 'ReadDataByIdentifier' },
    { byte: '1–2', field: 'DID #1', size: '2 byte', value: 'ví dụ 0xF190', meaning: 'DID cần đọc, byte cao trước.' },
    { byte: '3–…', field: 'DID #2…', size: '2 byte mỗi DID', value: '(tùy chọn)', meaning: 'Có thể đọc nhiều DID trong một request; simulator cho tối đa 8 DID.' },
  ],
  responseTable: [
    { byte: '0', field: 'Response SID', size: '1 byte', value: '0x62', meaning: '0x22 + 0x40' },
    { byte: '1–2', field: 'DID #1', size: '2 byte', value: 'ví dụ 0xF190', meaning: 'ECU lặp lại DID trước khối dữ liệu của nó.' },
    { byte: '3–…', field: 'Dữ liệu DID #1', size: 'theo bảng DID', value: '…', meaning: 'Độ dài cố định theo định nghĩa DID (VIN = 17 byte).' },
    { byte: '…', field: 'DID #2 + dữ liệu', size: '…', value: '…', meaning: 'Lặp lại cho từng DID được hỗ trợ, theo thứ tự trong request.' },
  ],
  nrcs: [
    { nrc: 0x13, trigger: 'Request ngắn hơn 3 byte (ví dụ 22 F1), số byte DID lẻ, hoặc nhiều hơn 8 DID.' },
    { nrc: 0x31, trigger: 'Không DID nào được hỗ trợ trong session hiện tại, ví dụ 22 12 34, hoặc 22 02 01 khi đang ở default session.' },
    { nrc: 0x33, trigger: 'DID yêu cầu security nhưng ECU đang khóa, ví dụ 22 02 01 trong extended session khi chưa unlock.' },
    { nrc: 0x14, trigger: 'Response dài hơn giới hạn của ECU (mặc định 4095 byte).' },
  ],
  examples: [
    {
      title: 'Đọc VIN (response nhiều frame)',
      description:
        'Response dài 20 byte (62 F1 90 + 17 ký tự) nên ECU gửi First Frame, tester trả Flow Control, rồi ECU gửi hai Consecutive Frame.',
      request: [0x22, 0xf1, 0x90],
    },
    {
      title: 'Đọc nhiều DID trong một request',
      description: 'Đọc session hiện tại (0xF186) và điện áp ắc quy (0x0102, 0.1 V mỗi bit). Response lặp lại từng DID trước dữ liệu của nó.',
      request: [0x22, 0xf1, 0x86, 0x01, 0x02],
    },
    {
      title: 'DID không tồn tại',
      description: 'ECU không có DID 0x1234 nên trả NRC 0x31 requestOutOfRange.',
      request: [0x22, 0x12, 0x34],
    },
    {
      title: 'DID cần security',
      description:
        'DID 0x0201 chỉ đọc được trong extended session và cần security level 1. Đã vào extended session nhưng chưa unlock nên ECU trả NRC 0x33.',
      request: [0x22, 0x02, 0x01],
      setup: [[0x10, 0x03]],
    },
  ],
  mistakes: [
    'Quên rằng response dài hơn 7 byte được chia thành nhiều frame: tester phải gửi Flow Control sau First Frame, nếu không ECU sẽ chờ rồi hủy.',
    'Tính sai độ dài khi đọc nhiều DID: response chứa cả DID lặp lại trước mỗi khối dữ liệu.',
    'Hiểu NRC 0x31 là "gõ sai DID": DID có thể đúng nhưng chỉ đọc được trong session khác.',
    'Đưa byte padding 0xCC vào giá trị DID: padding không thuộc PDU UDS.',
  ],
  autosar: {
    intro: 'Dcm xử lý 0x22 dựa trên cấu hình DID; dữ liệu được lấy từ SWC qua port hoặc callout.',
    items: [
      { name: 'DcmDspDid', desc: 'Mỗi DID một container: DcmDspDidIdentifier (giá trị DID) và các tín hiệu dữ liệu tạo nên nó.' },
      { name: 'DcmDspDidRead', desc: 'Điều kiện đọc: DcmDspDidReadSessionRef (session cho phép) và DcmDspDidReadSecurityLevelRef (security level cần mở).' },
      { name: 'DcmDspData', desc: 'Mô tả dữ liệu (độ dài, kiểu) và cách lấy giá trị: gọi hàm đọc hoặc port của SWC.' },
      { name: 'DcmDspMaxDidToRead', desc: 'Giới hạn số DID trong một request 0x22; vượt quá → NRC 0x13.' },
    ],
  },
  form: { didPicker: true, defaultDids: [0xf190] },
  exercises: [
    { title: '', description: '', request: [0x22, 0xf1, 0x90] },
    { title: '', description: '', request: [0x22, 0xf1, 0x87] },
    { title: '', description: '', request: [0x22, 0xf1, 0x95] },
    { title: '', description: '', request: [0x22, 0x01, 0x02] },
    { title: '', description: '', request: [0x22, 0xf1, 0x86, 0x01, 0x00] },
    { title: '', description: '', request: [0x22, 0x12, 0x34] },
    { title: '', description: '', request: [0x22, 0xf1] },
  ],
};

const VIN_NEW = [...'VNTEST0000ABC1234'].map((c) => c.charCodeAt(0));

const sid27: ServiceLearnContent = {
  sid: '27',
  isoRef: 'ISO 14229-1, mục 10.4',
  purpose:
    'SecurityAccess bảo vệ các thao tác nhạy cảm như ghi dữ liệu, điều khiển chấp hành hay nạp phần mềm. ECU gửi một seed ngẫu nhiên; tester tính key bằng thuật toán bí mật mà chỉ tester và ECU biết rồi gửi lại. Key đúng thì ECU mở security level đó cho tới khi đổi session, S3 hết hạn hoặc ECU reset.',
  useCases: [
    'Trước khi ghi các DID được bảo vệ (VIN, cấu hình) bằng 0x2E.',
    'Trước khi nạp phần mềm trong programming session (thường dùng một level riêng).',
    'Mở các routine hoặc điều khiển I/O chỉ dành cho xưởng dịch vụ.',
  ],
  requestTable: [
    { byte: '0', field: 'SID', size: '1 byte', value: '0x27', meaning: 'SecurityAccess' },
    {
      byte: '1',
      field: 'Sub-function',
      size: '1 byte',
      value: '0x01 / 0x02 …',
      meaning: 'Số lẻ = requestSeed của một level; số chẵn = sendKey của level đó (= requestSeed + 1). Bit 7 là suppressPosRspMsgIndicationBit.',
    },
    { byte: '2–…', field: 'Key', size: 'bằng độ dài seed', value: '…', meaning: 'Chỉ có trong sendKey: key tester tính từ seed vừa nhận.' },
  ],
  responseTable: [
    { byte: '0', field: 'Response SID', size: '1 byte', value: '0x67', meaning: '0x27 + 0x40' },
    { byte: '1', field: 'Sub-function', size: '1 byte', value: '0x01 / 0x02 …', meaning: 'ECU lặp lại sub-function của request.' },
    {
      byte: '2–…',
      field: 'Seed',
      size: '1–4 byte (cấu hình)',
      value: '…',
      meaning: 'Chỉ có trong response của requestSeed. Seed toàn 0 nghĩa là level này đã mở, không cần gửi key.',
    },
  ],
  subFunctions: [
    { value: '0x01', name: 'requestSeed (level 1)', meaning: 'Xin seed cho level 1.' },
    { value: '0x02', name: 'sendKey (level 1)', meaning: 'Gửi key cho seed level 1 vừa nhận.' },
    { value: '0x03', name: 'requestSeed (level 3)', meaning: 'Xin seed cho level 3 (thường là level cao hơn, ví dụ cho nạp phần mềm).' },
    { value: '0x04', name: 'sendKey (level 3)', meaning: 'Gửi key cho seed level 3.' },
    { value: '…', name: '', meaning: 'Các level khác tùy hãng. Simulator sinh danh sách sub-function theo trang Cấu hình xe › Security.' },
  ],
  nrcs: [
    { nrc: 0x7f, trigger: 'Gửi 0x27 trong default session; simulator chỉ cho phép trong extended/programming session.' },
    { nrc: 0x12, trigger: 'Sub-function của level chưa cấu hình, ví dụ 27 05.' },
    { nrc: 0x13, trigger: 'requestSeed không đúng 2 byte, hoặc key không đúng độ dài seed.' },
    { nrc: 0x24, trigger: 'sendKey khi chưa có seed nào đang chờ (chưa requestSeed, seed đã bị hủy sau key sai, hoặc seed của level khác).' },
    { nrc: 0x35, trigger: 'Key không khớp với key ECU tính từ seed.' },
    { nrc: 0x36, trigger: 'Key sai đến lần thứ "số lần thử tối đa" (mặc định 3); ECU bắt đầu thời gian khóa.' },
    { nrc: 0x37, trigger: 'requestSeed trong thời gian khóa (mặc định 10 s sau NRC 0x36).' },
  ],
  examples: [
    { title: 'Xin seed', description: 'Ở extended session, ECU trả 67 01 kèm seed 4 byte ngẫu nhiên và ghi nhớ seed này.', request: [0x27, 0x01], setup: [[0x10, 0x03]] },
    {
      title: 'Gửi key đúng',
      description: 'Tester tính key từ seed vừa nhận theo thuật toán của level 1 (mặc định: seed XOR 0x5A5A5A5A). ECU so sánh và trả 67 02: level 1 đã mở.',
      request: [],
      setup: [
        [0x10, 0x03],
        [0x27, 0x01],
      ],
      sendKeyFromSetup: 'correct',
    },
    {
      title: 'Gửi key sai',
      description: 'Key không khớp nên ECU trả NRC 0x35, tăng bộ đếm số lần sai và hủy seed. Muốn thử lại phải requestSeed lần nữa.',
      request: [],
      setup: [
        [0x10, 0x03],
        [0x27, 0x01],
      ],
      sendKeyFromSetup: 'wrong',
    },
    {
      title: 'sendKey khi chưa có seed',
      description: 'Chưa gửi requestSeed nên ECU không có seed nào để so sánh: NRC 0x24 requestSequenceError.',
      request: [0x27, 0x02, 0x00, 0x00, 0x00, 0x00],
      setup: [[0x10, 0x03]],
    },
    {
      title: 'Level đã mở',
      description: 'Khi level 1 đã mở, requestSeed nhận seed toàn 0: tester hiểu là không cần gửi key nữa.',
      request: [0x27, 0x01],
      setup: [[0x10, 0x03]],
      setupState: { unlockedLevel: 1 },
    },
  ],
  mistakes: [
    'Gửi lại key cũ sau NRC 0x35: seed đã bị hủy, phải requestSeed lại (nếu không sẽ nhận NRC 0x24).',
    'Thử key liên tục: sau số lần cho phép ECU khóa level (0x36), mọi requestSeed trong thời gian chờ đều nhận 0x37.',
    'Quên rằng đổi session, S3 hết hạn hay ECU reset đều làm mất trạng thái đã mở khóa.',
    'Dùng thuật toán của level này để tính key cho level khác.',
    'Gửi 0x27 trong default session: hầu hết ECU chỉ cho phép trong extended/programming session (NRC 0x7F).',
  ],
  autosar: {
    intro: 'Dcm quản lý trạng thái security; phần tính seed và so sánh key do ứng dụng (SWC hoặc CDD) cung cấp qua callout.',
    items: [
      {
        name: 'DcmDspSecurityRow',
        desc: 'Mỗi security level một dòng: DcmDspSecurityLevel, DcmDspSecuritySeedSize, DcmDspSecurityKeySize, DcmDspSecurityNumAttDelay (số lần sai trước khi khóa), DcmDspSecurityDelayTime.',
      },
      { name: 'GetSeed / CompareKey', desc: 'Dcm gọi GetSeed để lấy seed và CompareKey để kiểm tra key; thuật toán bí mật nằm ở đây, không nằm trong Dcm.' },
      { name: 'DcmDsdServiceSecurityLevelRef', desc: 'Khai báo service/sub-function cần level nào; chưa mở → Dcm tự trả NRC 0x33.' },
      { name: 'DcmDspSecurityDelayTimeOnBoot', desc: 'Thời gian khóa ngay sau khi ECU khởi động, chống dò key bằng cách reset liên tục.' },
    ],
  },
  form: { securityLevels: true, allowSuppress: true },
  exercises: [
    { title: '', description: '', request: [0x27, 0x01], setup: [[0x10, 0x03]] },
    { title: '', description: '', request: [0x27, 0x03], setup: [[0x10, 0x03]] },
    { title: '', description: '', request: [], setup: [[0x10, 0x03], [0x27, 0x01]], sendKeyFromSetup: 'correct' },
    { title: '', description: '', request: [], setup: [[0x10, 0x03], [0x27, 0x01]], sendKeyFromSetup: 'wrong' },
    { title: '', description: '', request: [0x27, 0x02, 0x11, 0x22, 0x33, 0x44], setup: [[0x10, 0x03]] },
    { title: '', description: '', request: [0x27, 0x01] },
  ],
};

const sid2E: ServiceLearnContent = {
  sid: '2E',
  isoRef: 'ISO 14229-1, mục 11.7',
  purpose:
    'WriteDataByIdentifier ghi giá trị mới cho một DID: VIN khi thay ECU, cấu hình tính năng (coding), giá trị hiệu chỉnh... Vì làm thay đổi dữ liệu lâu dài trong ECU, service này thường chỉ được phép trong extended session và cần security access.',
  useCases: [
    'Ghi VIN vào ECU mới thay thế (DID 0xF190).',
    'Bật/tắt tính năng bằng coding, ví dụ đèn chạy ban ngày (DID 0x0200 trong simulator).',
    'Ghi ngày lập trình hoặc mã xưởng sau khi sửa chữa.',
  ],
  requestTable: [
    { byte: '0', field: 'SID', size: '1 byte', value: '0x2E', meaning: 'WriteDataByIdentifier' },
    { byte: '1–2', field: 'DID', size: '2 byte', value: 'ví dụ 0xF190', meaning: 'DID cần ghi; mỗi request chỉ ghi một DID.' },
    { byte: '3–…', field: 'Dữ liệu ghi', size: 'đúng độ dài DID', value: '…', meaning: 'Giá trị mới, không thừa không thiếu byte nào.' },
  ],
  responseTable: [
    { byte: '0', field: 'Response SID', size: '1 byte', value: '0x6E', meaning: '0x2E + 0x40' },
    { byte: '1–2', field: 'DID', size: '2 byte', value: 'ví dụ 0xF190', meaning: 'ECU lặp lại DID vừa ghi (không gửi lại dữ liệu).' },
  ],
  nrcs: [
    { nrc: 0x7f, trigger: 'Gửi trong default session; simulator chỉ cho ghi ở extended/programming session.' },
    { nrc: 0x13, trigger: 'Request ngắn hơn 4 byte, hoặc dữ liệu không đúng độ dài DID (VIN phải đúng 17 byte).' },
    { nrc: 0x31, trigger: 'DID không tồn tại, DID chỉ đọc (ví dụ 0xF187), hoặc DID không được ghi trong session hiện tại.' },
    { nrc: 0x33, trigger: 'DID yêu cầu security level (VIN và 0x0200 cần level 1) nhưng ECU đang khóa.' },
    { nrc: 0x93, trigger: 'Điện áp ắc quy dưới 11,0 V (kéo slider ở Cấu hình xe › Điều kiện xe, hoặc inject lỗi ắc quy).' },
    { nrc: 0x92, trigger: 'Điện áp ắc quy trên 15,5 V.' },
  ],
  examples: [
    { title: 'Ghi VIN trong default session', description: 'Service bị chặn ngay ở bước 2 của quy trình: NRC 0x7F.', request: [0x2e, 0xf1, 0x90, ...VIN_NEW] },
    {
      title: 'Ghi VIN khi chưa unlock',
      description: 'Đã vào extended session nhưng chưa mở security level 1 mà VIN yêu cầu: NRC 0x33.',
      request: [0x2e, 0xf1, 0x90, ...VIN_NEW],
      setup: [[0x10, 0x03]],
    },
    {
      title: 'Ghi VIN thành công (request nhiều frame)',
      description:
        'Request dài 20 byte nên tester gửi First Frame, ECU trả Flow Control, rồi tester gửi Consecutive Frame. ECU ghi xong trả 6E F1 90; đọc lại bằng 22 F1 90 sẽ thấy VIN mới.',
      request: [0x2e, 0xf1, 0x90, ...VIN_NEW],
      setup: [[0x10, 0x03]],
      setupState: { unlockedLevel: 1 },
    },
    {
      title: 'Điện áp ắc quy thấp',
      description: 'Mọi điều kiện khác đều đạt nhưng điện áp chỉ 10,5 V: ECU từ chối ghi bộ nhớ với NRC 0x93.',
      request: [0x2e, 0x02, 0x00, 0x00],
      setup: [[0x10, 0x03]],
      setupState: { unlockedLevel: 1 },
      conditions: { batteryVoltage: 10.5 },
    },
  ],
  mistakes: [
    'Ghi xong mà không đọc lại bằng 0x22 để kiểm tra.',
    'Sai độ dài dữ liệu: phải đúng độ dài DID (NRC 0x13).',
    'Quên mở security trước khi ghi (NRC 0x33).',
    'Ghi khi ắc quy yếu (NRC 0x93): xưởng dịch vụ luôn gắn bộ cấp nguồn ổn định khi lập trình.',
    'Hiểu NRC 0x31 là lỗi định dạng: DID chỉ đọc hoặc không ghi được trong session hiện tại cũng trả 0x31.',
  ],
  autosar: {
    intro: 'Dcm kiểm tra session/security theo cấu hình DID rồi chuyển dữ liệu cho SWC ghi vào bộ nhớ (thường qua NvM).',
    items: [
      { name: 'DcmDspDidWrite', desc: 'Điều kiện ghi của DID: DcmDspDidWriteSessionRef và DcmDspDidWriteSecurityLevelRef.' },
      { name: 'DcmDspData (WriteData)', desc: 'Dcm gọi hàm/port WriteData của SWC; SWC có thể trả NRC (ví dụ 0x22, 0x93) qua tham số ErrorCode.' },
      { name: 'NvM', desc: 'SWC lưu giá trị vào NvM block để giữ qua lần khởi động sau; ghi thất bại có thể dẫn tới NRC 0x72.' },
    ],
  },
  form: { writeDid: true },
  exercises: [
    { title: '', description: '', request: [0x2e, 0x02, 0x00, 0x00], setup: [[0x10, 0x03]], setupState: { unlockedLevel: 1 } },
    { title: '', description: '', request: [0x2e, 0x02, 0x00, 0x01] },
    { title: '', description: '', request: [0x2e, 0x02, 0x00, 0x01], setup: [[0x10, 0x03]] },
    { title: '', description: '', request: [0x2e, 0xf1, 0x87, 0x41], setup: [[0x10, 0x03]] },
    { title: '', description: '', request: [0x2e, 0xf1, 0x90, ...VIN_NEW], setup: [[0x10, 0x03]], setupState: { unlockedLevel: 1 } },
    { title: '', description: '', request: [0x2e, 0x02, 0x00, 0x00], setup: [[0x10, 0x03]], setupState: { unlockedLevel: 1 }, conditions: { batteryVoltage: 10.5 } },
  ],
};

const sid11: ServiceLearnContent = {
  sid: '11',
  isoRef: 'ISO 14229-1, mục 10.3',
  purpose:
    'ECUReset yêu cầu ECU khởi động lại. Thường dùng sau khi nạp phần mềm hoặc ghi cấu hình để ECU áp dụng giá trị mới, hoặc để đưa ECU về trạng thái ban đầu khi chẩn đoán.',
  useCases: [
    'Sau khi flash xong: hardReset để chạy phần mềm mới.',
    'Sau khi coding bằng 0x2E: reset để ECU đọc lại cấu hình.',
    'Đưa nhanh ECU về default session và trạng thái security bị khóa.',
  ],
  requestTable: [
    { byte: '0', field: 'SID', size: '1 byte', value: '0x11', meaning: 'ECUReset' },
    { byte: '1', field: 'Sub-function', size: '1 byte', value: '0x01 / 0x02 / 0x03', meaning: 'resetType; bit 7 là suppressPosRspMsgIndicationBit (0x81 = hardReset, không cần response).' },
  ],
  responseTable: [
    { byte: '0', field: 'Response SID', size: '1 byte', value: '0x51', meaning: '0x11 + 0x40' },
    { byte: '1', field: 'Sub-function', size: '1 byte', value: '0x01 / 0x02 / 0x03', meaning: 'ECU lặp lại resetType. Riêng sub-function 0x04 có thêm byte powerDownTime (simulator không hỗ trợ).' },
  ],
  subFunctions: [
    { value: '0x01', name: 'hardReset', meaning: 'Giả lập ngắt rồi cấp lại nguồn: khởi động lại toàn bộ ECU.' },
    { value: '0x02', name: 'keyOffOnReset', meaning: 'Giả lập tắt rồi bật lại khóa điện.' },
    { value: '0x03', name: 'softReset', meaning: 'Chỉ khởi động lại phần mềm.' },
    { value: '0x04 / 0x05', name: 'enable/disableRapidPowerShutDown', meaning: 'Simulator không hỗ trợ nên trả NRC 0x12.' },
  ],
  nrcs: [
    { nrc: 0x12, trigger: 'Sub-function khác 0x01–0x03, ví dụ 11 04.' },
    { nrc: 0x13, trigger: 'Request không đúng 2 byte.' },
    { nrc: 0x88, trigger: 'Xe đang chạy (tốc độ > 0) khi điều kiện "xe phải đứng yên" đang bật.' },
    { nrc: 0x83, trigger: 'Động cơ đang chạy khi điều kiện "động cơ phải tắt" đang bật.' },
  ],
  examples: [
    { title: 'Hard reset thành công', description: 'ECU gửi 51 01 trước, sau đó khởi động lại khoảng 1,5 s, về default session và khóa security.', request: [0x11, 0x01], setup: [[0x10, 0x03]] },
    { title: 'Xe đang chạy', description: 'Tốc độ 30 km/h nên ECU từ chối reset vì lý do an toàn: NRC 0x88.', request: [0x11, 0x01], conditions: { speedKmh: 30 } },
    { title: 'Động cơ đang chạy', description: 'Xe đứng yên nhưng động cơ đang nổ máy: NRC 0x83.', request: [0x11, 0x01], conditions: { engineRunning: true, rpm: 800 } },
    { title: 'resetType không hỗ trợ', description: 'Simulator không hỗ trợ enableRapidPowerShutDown: NRC 0x12.', request: [0x11, 0x04] },
  ],
  mistakes: [
    'Gửi request ngay sau 0x11: ECU đang khởi động lại nên không trả lời, tester phải chờ.',
    'Quên rằng sau reset ECU về default session và security bị khóa: phải vào session và unlock lại.',
    'Reset khi xe đang chạy: hầu hết ECU từ chối (NRC 0x88) vì lý do an toàn.',
    'Dùng 0x81 (có suppress bit) rồi không chắc ECU đã reset: có thể đọc DID 0xF186 sau khi ECU khởi động xong.',
  ],
  autosar: {
    intro: 'Dcm không tự reset vi điều khiển; nó báo cho BswM qua mode switch và BswM thực hiện reset.',
    items: [
      { name: 'DcmDsdService 0x11', desc: 'Khai báo service và các resetType được hỗ trợ.' },
      { name: 'Mode DcmEcuReset', desc: 'Dcm chuyển mode HARD / KEYONOFF / SOFT theo resetType, rồi EXECUTE sau khi positive response đã gửi xong.' },
      { name: 'BswM', desc: 'Nhận mode EXECUTE và gọi hàm reset của MCU (ví dụ Mcu_PerformReset).' },
    ],
  },
  form: {
    subFunctions: [
      { id: 0x01, label: '01 hardReset' },
      { id: 0x02, label: '02 keyOffOnReset' },
      { id: 0x03, label: '03 softReset' },
    ],
    allowSuppress: true,
  },
  exercises: [
    { title: '', description: '', request: [0x11, 0x01] },
    { title: '', description: '', request: [0x11, 0x03] },
    { title: '', description: '', request: [0x11, 0x01], conditions: { speedKmh: 40 } },
    { title: '', description: '', request: [0x11, 0x02], conditions: { engineRunning: true, rpm: 900 } },
    { title: '', description: '', request: [0x11, 0x05] },
  ],
};

/** Lỗi O2 hở mạch qua 2 operation cycle → DTC P0130-13 confirmed; động cơ đang chạy khi lỗi xảy ra. */
const O2_CONFIRMED = { inject: ['o2Sensor:openCircuit'], cycles: 2 };
const O2_PENDING = { inject: ['o2Sensor:openCircuit'], cycles: 1 };
const RUNNING = { engineRunning: true, rpm: 850, batteryVoltage: 13.8 };

const sid19: ServiceLearnContent = {
  sid: '19',
  isoRef: 'ISO 14229-1, mục 12.3',
  purpose:
    'ReadDTCInformation đọc bộ nhớ lỗi của ECU: có bao nhiêu DTC, DTC nào đang ở trạng thái nào (status byte), điều kiện xe lúc lỗi xảy ra (snapshot / freeze frame) và dữ liệu phụ như số lần lỗi xảy ra. Đây là service được dùng nhiều nhất khi chẩn đoán lỗi trong xưởng.',
  useCases: [
    'Bắt đầu chẩn đoán: 19 02 với mask 0x08 để xem các DTC đã confirmed (lỗi thật, đã được xác nhận).',
    'Đếm nhanh số DTC trước khi đọc chi tiết: 19 01.',
    'Xem điều kiện xe lúc lỗi xảy ra (tốc độ, RPM, điện áp) để tái hiện lỗi: 19 04.',
    'Biết lỗi đã xảy ra bao nhiêu lần, đã "lành" được bao nhiêu cycle: 19 06.',
    'Liệt kê toàn bộ DTC mà ECU có thể báo: 19 0A.',
  ],
  requestTable: [
    { byte: '0', field: 'SID', size: '1 byte', value: '0x19', meaning: 'ReadDTCInformation' },
    { byte: '1', field: 'Sub-function', size: '1 byte', value: '0x01 / 0x02 / 0x04 / 0x06 / 0x0A', meaning: 'reportType: loại thông tin cần đọc.' },
    { byte: '2', field: 'DTC status mask', size: '1 byte', value: 'ví dụ 0x08', meaning: 'Chỉ có ở 01/02: ECU chọn các DTC có (status & mask) ≠ 0.' },
    { byte: '2–4', field: 'DTC', size: '3 byte', value: 'ví dụ 01 30 13', meaning: 'Chỉ có ở 04/06: DTC cần đọc chi tiết.' },
    { byte: '5', field: 'Số record', size: '1 byte', value: '0x01 / 0xFF', meaning: 'Chỉ có ở 04/06: snapshot record hoặc extended data record cần đọc; 0xFF = tất cả.' },
  ],
  responseTable: [
    { byte: '0', field: 'Response SID', size: '1 byte', value: '0x59', meaning: '0x19 + 0x40' },
    { byte: '1', field: 'Sub-function', size: '1 byte', value: 'như request', meaning: 'ECU lặp lại reportType.' },
    { byte: '2', field: 'DTCStatusAvailabilityMask', size: '1 byte', value: '0xFF', meaning: '01/02/0A: các bit status ECU hỗ trợ.' },
    { byte: '3–5', field: '01: format + số DTC', size: '1 + 2 byte', value: '01 00 01', meaning: 'DTCFormatIdentifier rồi số DTC khớp mask.' },
    { byte: '3–…', field: '02/0A: danh sách', size: '4 byte mỗi DTC', value: '01 30 13 AF …', meaning: 'Mỗi DTC 3 byte rồi status byte của nó.' },
    {
      byte: '2–…',
      field: '04/06: chi tiết',
      size: '…',
      value: '01 30 13 AF 01 …',
      meaning: 'DTC + status, rồi các record: snapshot (số record, số DID, DID + dữ liệu) hoặc extended data (số record + dữ liệu).',
    },
  ],
  subFunctions: [
    { value: '0x01', name: 'reportNumberOfDTCByStatusMask', meaning: 'Đếm số DTC khớp status mask.' },
    { value: '0x02', name: 'reportDTCByStatusMask', meaning: 'Liệt kê các DTC khớp status mask kèm status byte.' },
    { value: '0x04', name: 'reportDTCSnapshotRecordByDTCNumber', meaning: 'Snapshot (freeze frame) của một DTC. Simulator có record 0x01 gồm DID 0x0100 tốc độ, 0x0101 RPM, 0x0102 điện áp.' },
    { value: '0x06', name: 'reportDTCExtDataRecordByDTCNumber', meaning: 'Extended data của một DTC. Simulator có record 0x01 = số lần xảy ra, 0x02 = bộ đếm aging.' },
    { value: '0x0A', name: 'reportSupportedDTC', meaning: 'Mọi DTC mà ECU hỗ trợ, kể cả DTC chưa từng lỗi.' },
    { value: 'khác', name: '', meaning: 'ISO 14229-1 còn nhiều reportType khác; simulator trả NRC 0x12.' },
  ],
  nrcs: [
    { nrc: 0x12, trigger: 'reportType chưa hỗ trợ, ví dụ 19 03.' },
    { nrc: 0x13, trigger: 'Sai độ dài: 01/02 cần 3 byte, 04/06 cần 6 byte, 0A cần 2 byte.' },
    { nrc: 0x31, trigger: 'DTC không thuộc ECU này (ví dụ DTC của ABS ECU), hoặc số record không có (khác 01/02/FF).' },
    { nrc: 0x14, trigger: 'Danh sách DTC dài hơn giới hạn response của ECU.' },
  ],
  examples: [
    {
      title: 'Đếm DTC đã confirmed',
      description: 'Lỗi O2 hở mạch đã xảy ra trong 2 operation cycle nên P0130-13 confirmed. Mask 0x08 chọn DTC có bit 3 confirmedDTC: có 1 DTC.',
      request: [0x19, 0x01, 0x08],
      dtcSetup: O2_CONFIRMED,
      conditions: RUNNING,
    },
    {
      title: 'Liệt kê DTC đã confirmed',
      description: 'Response gồm DTC 01 30 13 (P0130-13) và status 0xAF: testFailed, testFailedThisOperationCycle, pendingDTC, confirmedDTC, testFailedSinceLastClear, warningIndicatorRequested.',
      request: [0x19, 0x02, 0x08],
      dtcSetup: O2_CONFIRMED,
      conditions: RUNNING,
    },
    {
      title: 'Lỗi mới xuất hiện một cycle: pending nhưng chưa confirmed',
      description: 'Sau 1 cycle, mask 0x08 không thấy gì nhưng mask 0x04 (pendingDTC) thấy P0130-13 với status 0x27.',
      request: [0x19, 0x02, 0x04],
      dtcSetup: O2_PENDING,
      conditions: RUNNING,
    },
    {
      title: 'Toàn bộ DTC hỗ trợ (response nhiều frame)',
      description: 'Engine ECU hỗ trợ 9 DTC; response dài 39 byte nên được chia thành First Frame + Consecutive Frame.',
      request: [0x19, 0x0a],
      dtcSetup: O2_CONFIRMED,
      conditions: RUNNING,
    },
    {
      title: 'Snapshot của DTC',
      description: 'Record 0x01 chụp lúc lỗi được xác nhận lần đầu: tốc độ 0 km/h, RPM 850 (03 52), điện áp 13,8 V (0x8A).',
      request: [0x19, 0x04, 0x01, 0x30, 0x13, 0x01],
      dtcSetup: O2_CONFIRMED,
      conditions: RUNNING,
    },
    {
      title: 'Extended data của DTC',
      description: 'Record 0x01 = lỗi đã xảy ra 2 lần (2 cycle), record 0x02 = bộ đếm aging 0 (chưa có cycle nào không lỗi).',
      request: [0x19, 0x06, 0x01, 0x30, 0x13, 0xff],
      dtcSetup: O2_CONFIRMED,
      conditions: RUNNING,
    },
    {
      title: 'DTC của ECU khác',
      description: 'C0035-13 (cảm biến tốc độ bánh) nằm trong ABS ECU, không phải Engine ECU đang được hỏi: NRC 0x31.',
      request: [0x19, 0x04, 0x40, 0x35, 0x13, 0x01],
      dtcSetup: O2_CONFIRMED,
    },
  ],
  mistakes: [
    'Dùng mask 0xFF rồi thấy "rất nhiều lỗi": DTC chưa từng chạy test có status 0x50 (bit 4 và 6) cũng khớp. Muốn xem lỗi thật hãy dùng 0x08 (confirmed) hoặc 0x0D.',
    'Nhầm pendingDTC với confirmedDTC: pending chỉ là lỗi mới xuất hiện, chưa đủ số cycle để xác nhận.',
    'Đọc DTC sai ECU: mỗi ECU giữ DTC của riêng nó; DTC cảm biến tốc độ bánh phải hỏi ABS ECU.',
    'Quên rằng response 02/0A có thể rất dài và được chia nhiều frame: tester phải gửi Flow Control.',
    'Tưởng snapshot là giá trị hiện tại: snapshot là điều kiện lúc lỗi xảy ra, không đổi theo thời gian.',
  ],
  autosar: {
    intro: 'Dcm xử lý giao thức 0x19, còn dữ liệu DTC do Dem cung cấp qua các API lọc DTC.',
    items: [
      { name: 'Dem_SetDTCFilter / Dem_GetNumberOfFilteredDTC / Dem_GetNextFilteredDTC', desc: 'Dcm đặt bộ lọc theo status mask rồi đếm (19 01) hoặc lấy lần lượt từng DTC (19 02).' },
      { name: 'DemDtcStatusAvailabilityMask', desc: 'Các bit status mà ECU hỗ trợ; giá trị này đi vào byte thứ 3 của response.' },
      { name: 'DemFreezeFrameClass', desc: 'Danh sách DID được chụp khi lỗi xảy ra (snapshot) cho 19 04.' },
      { name: 'DemExtendedDataClass', desc: 'Các extended data record (occurrence counter, aging counter...) cho 19 06.' },
    ],
  },
  form: { dtcRead: true },
  exercises: [
    { title: '', description: '', request: [0x19, 0x01, 0x08], dtcSetup: O2_CONFIRMED, conditions: RUNNING },
    { title: '', description: '', request: [0x19, 0x02, 0x08], dtcSetup: O2_CONFIRMED, conditions: RUNNING },
    { title: '', description: '', request: [0x19, 0x02, 0x04], dtcSetup: O2_PENDING, conditions: RUNNING },
    { title: '', description: '', request: [0x19, 0x04, 0x01, 0x30, 0x13, 0x01], dtcSetup: O2_CONFIRMED, conditions: RUNNING },
    { title: '', description: '', request: [0x19, 0x06, 0x01, 0x30, 0x13, 0xff], dtcSetup: O2_CONFIRMED, conditions: RUNNING },
    { title: '', description: '', request: [0x19, 0x04, 0x40, 0x35, 0x13, 0x01], dtcSetup: O2_CONFIRMED },
    { title: '', description: '', request: [0x19, 0x03] },
  ],
};

export const SERVICES_META: Partial<Record<ServiceSidKey, ServiceLearnContent>> = {
  '10': sid10,
  '11': sid11,
  '19': sid19,
  '22': sid22,
  '27': sid27,
  '2E': sid2E,
  '3E': sid3E,
};
