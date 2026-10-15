/**
 * Từ điển tiếng Việt duy nhất của UDS Lab.
 * Quy tắc: câu tiếng Việt + thuật ngữ kỹ thuật giữ nguyên tiếng Anh
 * (service, SID, DID, NRC, session, security access, frame, ...).
 * Không chép nguyên văn ISO; chỉ diễn giải và dẫn mục (vd "ISO 14229-1, mục 10.2").
 */

export const vi = {
  app: {
    name: 'UDS Lab',
    tagline: 'Phòng thí nghiệm UDS cho kỹ sư Việt Nam',
  },

  nav: {
    groupOverview: 'Tổng quan',
    groupServices: 'Service UDS',
    groupTools: 'Công cụ',
    home: 'Trang chủ',
    config: 'Cấu hình xe',
    faults: 'Mô phỏng lỗi / DTC',
    trace: 'Trace',
    nrc: 'Tra cứu NRC',
    scenarios: 'Kịch bản hướng dẫn',
    openMenu: 'Mở menu',
    closeMenu: 'Đóng menu',
    collapse: 'Thu gọn thanh bên',
    expand: 'Mở rộng thanh bên',
  },

  theme: {
    toLight: 'Chuyển sang giao diện sáng',
    toDark: 'Chuyển sang giao diện tối',
  },

  services: {
    '10': { name: 'DiagnosticSessionControl', short: 'Đổi session' },
    '11': { name: 'ECUReset', short: 'ECU reset' },
    '22': { name: 'ReadDataByIdentifier', short: 'Đọc DID' },
    '27': { name: 'SecurityAccess', short: 'Mở khóa security' },
    '2E': { name: 'WriteDataByIdentifier', short: 'Ghi DID' },
    '3E': { name: 'TesterPresent', short: 'Giữ session' },
  },

  session: {
    default: 'default session',
    programming: 'programming session',
    extended: 'extended session',
  },

  statusBar: {
    session: 'Session',
    security: 'Security',
    locked: 'Đang khóa',
    unlocked: (level: number) => `Đã mở (level ${level})`,
    s3: 'S3',
    s3Inactive: 'không chạy',
    s3InactiveHint: 'S3 chỉ đếm khi ECU ở session khác default session.',
    s3Hint: 'Thời gian còn lại trước khi ECU tự quay về default session nếu tester không gửi request nào.',
    speed: 'Tốc độ',
    rpm: 'RPM',
    voltage: 'Điện áp',
    gear: 'Số',
    engineOn: 'Động cơ chạy',
    engineOff: 'Động cơ tắt',
    faults: 'Lỗi đang inject',
    mil: 'Đèn MIL',
    milOn: 'BẬT',
    milOff: 'tắt',
    milHint: 'Đèn MIL bật khi có DTC đặt bit7 warningIndicatorRequested trong status byte.',
  },

  units: {
    kmh: 'km/h',
    rpm: 'v/ph',
    volt: 'V',
    ms: 'ms',
    s: 's',
  },

  common: {
    comingSoon: 'Đang xây dựng',
    plannedPhase: (phase: number) => `Nội dung này sẽ có ở giai đoạn ${phase} của lộ trình phát triển.`,
    phaseLabel: (phase: number) => `Giai đoạn ${phase}`,
    notFoundTitle: 'Không tìm thấy trang',
    notFoundBody: 'Đường dẫn bạn mở không tồn tại trong UDS Lab.',
    backHome: 'Về trang chủ',
    serviceUnknown: (sid: string) => `Service 0x${sid} chưa có trong phiên bản MVP này.`,
  },

  pages: {
    home: {
      title: 'Chào mừng đến UDS Lab',
      subtitle:
        'Cấu hình một chiếc xe mô phỏng, inject lỗi, gửi request UDS và soi từng byte của mỗi CAN frame.',
      whatIsTitle: 'UDS là gì?',
      whatIsBody:
        'UDS (Unified Diagnostic Services, ISO 14229-1) là "ngôn ngữ" chung để tester nói chuyện với ECU trên xe. Tester gửi một request gồm SID và tham số; ECU trả về positive response (SID + 0x40) hoặc negative response (7F SID NRC). Dưới UDS, ISO-TP (ISO 15765-2) cắt bản tin dài thành nhiều CAN frame và ghép lại ở phía nhận.',
      layersTitle: 'Ba lớp bạn sẽ học',
      layers: [
        { name: 'UDS', desc: 'Ý nghĩa của request/response: service, sub-function, DID, NRC.' },
        { name: 'ISO-TP', desc: 'Đóng gói: PCI, Single Frame, First Frame, Consecutive Frame, Flow Control.' },
        { name: 'CAN / CAN FD', desc: 'Vận chuyển: CAN ID, DLC, padding, tối đa 8 hoặc 64 byte mỗi frame.' },
      ],
      quickStartTitle: 'Bắt đầu nhanh',
      quickStart: [
        'Mở "Cấu hình xe" để xem CAN ID, bảng DID và điều kiện xe.',
        'Chọn một service ở thanh bên (ví dụ 0x22 ReadDataByIdentifier) và mở tab "Thực hành".',
        'Gửi request, bấm vào từng byte để xem giải thích, rồi thử inject lỗi ở "Mô phỏng lỗi / DTC".',
      ],
      roadmapTitle: 'Tiến độ xây dựng',
      roadmapBody:
        'Giai đoạn 1 đã xong khung ứng dụng: bố cục, thanh bên, status bar, giao diện sáng/tối. Các giai đoạn tiếp theo sẽ thêm lõi CAN/ISO-TP, engine UDS, hình minh họa xe và bài tập.',
    },
    config: {
      title: 'Cấu hình xe',
      subtitle: 'Mạng CAN, thông tin ECU, bảng DID, security và điều kiện xe.',
    },
    service: {
      subtitle: (sid: string) => `Học, thực hành và làm bài tập decode cho service 0x${sid}.`,
    },
    faults: {
      title: 'Mô phỏng lỗi / DTC',
      subtitle: 'Inject lỗi vào linh kiện và theo dõi status byte của DTC thay đổi theo từng bước.',
    },
    trace: {
      title: 'Trace',
      subtitle: 'Bảng frame kiểu CANoe với bộ lọc theo ID, service, NRC và xuất CSV.',
    },
    nrc: {
      title: 'Tra cứu NRC',
      subtitle: 'Ý nghĩa, nguyên nhân thường gặp và cách tester xử lý từng NRC.',
    },
    scenarios: {
      title: 'Kịch bản hướng dẫn',
      subtitle: 'Làm theo từng bước: request được điền sẵn, kèm giải thích response mong đợi.',
    },
  },
} as const;

export type Vi = typeof vi;
export type ServiceSidKey = keyof typeof vi.services;
