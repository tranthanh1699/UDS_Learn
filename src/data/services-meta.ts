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
}

export interface ServiceFormSpec {
  subFunctions?: { id: number; label: string }[];
  allowSuppress?: boolean;
  didPicker?: boolean;
  defaultDids?: number[];
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

export const SERVICES_META: Partial<Record<ServiceSidKey, ServiceLearnContent>> = {
  '10': sid10,
  '22': sid22,
  '3E': sid3E,
};
