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

  /** Ý nghĩa NRC (ISO 14229-1, phụ lục A), diễn giải bằng tiếng Việt. */
  nrc: {
    0x10: {
      meaning: 'ECU từ chối request nhưng không có NRC nào cụ thể hơn để mô tả lý do.',
      cause: 'Lỗi nội bộ của ECU, hoặc tình huống không khớp với NRC nào khác.',
      fix: 'Thử gửi lại; nếu vẫn lỗi, tra tài liệu chẩn đoán của ECU.',
    },
    0x11: {
      meaning: 'ECU không hỗ trợ service (SID) này ở bất kỳ session nào.',
      cause: 'Gõ sai SID, hoặc ECU không cài đặt service này.',
      fix: 'Kiểm tra lại byte SID và danh sách service của ECU.',
    },
    0x12: {
      meaning: 'Service có hỗ trợ nhưng sub-function được yêu cầu thì không.',
      cause: 'Giá trị sub-function (bit 0–6) không có trong danh sách của ECU.',
      fix: 'Kiểm tra giá trị sub-function; nhớ rằng bit 7 là suppressPosRspMsgIndicationBit chứ không thuộc giá trị sub-function.',
    },
    0x13: {
      meaning: 'Độ dài request sai hoặc định dạng tham số không hợp lệ.',
      cause: 'Thiếu/thừa byte, DID bị cắt nửa, dữ liệu ghi không đúng độ dài của DID.',
      fix: 'Đếm lại số byte của PDU (không tính PCI và padding) theo cấu trúc request của service.',
    },
    0x14: {
      meaning: 'Response quá dài so với khả năng gửi của ECU hoặc của lớp transport.',
      cause: 'Đọc quá nhiều DID dài trong một request.',
      fix: 'Chia thành nhiều request, mỗi request đọc ít DID hơn.',
    },
    0x21: {
      meaning: 'ECU đang bận, tạm thời không xử lý được request.',
      cause: 'ECU đang làm việc khác có độ ưu tiên cao hơn.',
      fix: 'Chờ một chút rồi gửi lại request.',
    },
    0x22: {
      meaning: 'Điều kiện hiện tại của xe/ECU không cho phép thực hiện request.',
      cause: 'Ví dụ động cơ đang chạy, xe đang chạy, hoặc một điều kiện nội bộ chưa thỏa.',
      fix: 'Đưa xe về trạng thái ECU yêu cầu (tắt máy, dừng xe, ...) rồi gửi lại.',
    },
    0x24: {
      meaning: 'Request đến sai thứ tự so với quy trình ECU mong đợi.',
      cause: 'Ví dụ gửi sendKey (0x27 02) khi chưa gửi requestSeed (0x27 01).',
      fix: 'Gửi các request theo đúng trình tự của service.',
    },
    0x26: {
      meaning: 'Một lỗi đang tồn tại trong ECU ngăn không cho thực hiện request.',
      cause: 'Ví dụ cảm biến hoặc mạch chấp hành liên quan đang hỏng.',
      fix: 'Xử lý lỗi gốc (xem DTC) trước khi thực hiện lại.',
    },
    0x31: {
      meaning: 'Tham số trong request nằm ngoài phạm vi ECU chấp nhận.',
      cause: 'DID không tồn tại hoặc không hỗ trợ trong session hiện tại, giá trị ngoài giới hạn, DID chỉ đọc mà lại ghi.',
      fix: 'Kiểm tra DID/tham số và session hiện tại theo tài liệu của ECU.',
    },
    0x33: {
      meaning: 'Request cần security access nhưng ECU đang khóa (hoặc mở sai level).',
      cause: 'Chưa thực hiện 0x27 requestSeed/sendKey, hoặc security đã bị khóa lại do đổi session/ECU reset.',
      fix: 'Mở khóa bằng 0x27 với đúng security level rồi gửi lại.',
    },
    0x35: {
      meaning: 'Key gửi lên không khớp với key ECU tính từ seed.',
      cause: 'Thuật toán tính key sai, dùng seed cũ, hoặc sai level.',
      fix: 'Tính lại key từ seed mới nhất; chú ý số lần thử còn lại.',
    },
    0x36: {
      meaning: 'Đã gửi sai key quá số lần cho phép.',
      cause: 'Gửi key sai liên tiếp nhiều lần.',
      fix: 'Chờ hết thời gian khóa (delay) rồi requestSeed lại.',
    },
    0x37: {
      meaning: 'Thời gian chờ bắt buộc chưa kết thúc nên ECU chưa nhận request security access.',
      cause: 'Request đến khi ECU đang trong thời gian khóa sau khi bị sai key quá nhiều, hoặc ngay sau khi khởi động.',
      fix: 'Chờ hết thời gian delay rồi thử lại.',
    },
    0x72: {
      meaning: 'ECU gặp lỗi khi xóa hoặc ghi bộ nhớ.',
      cause: 'Lỗi bộ nhớ flash/EEPROM, điện áp không ổn định khi ghi.',
      fix: 'Kiểm tra nguồn điện, thực hiện lại quy trình ghi; nếu vẫn lỗi có thể ECU hỏng bộ nhớ.',
    },
    0x78: {
      meaning: 'ECU đã nhận đúng request nhưng cần thêm thời gian; response thật sẽ được gửi sau.',
      cause: 'Thao tác tốn thời gian (ghi bộ nhớ, tính toán, ...).',
      fix: 'Không gửi lại request; chờ response thật trong thời gian P2* (có thể nhận nhiều NRC 0x78 liên tiếp).',
    },
    0x7e: {
      meaning: 'Sub-function có hỗ trợ nhưng không được phép trong session hiện tại.',
      cause: 'Gửi sub-function chỉ dành cho extended/programming session khi đang ở default session.',
      fix: 'Chuyển sang session phù hợp bằng 0x10 rồi gửi lại.',
    },
    0x7f: {
      meaning: 'Service có hỗ trợ nhưng không được phép trong session hiện tại.',
      cause: 'Ví dụ gửi 0x2E WriteDataByIdentifier khi đang ở default session.',
      fix: 'Chuyển sang session phù hợp bằng 0x10 rồi gửi lại.',
    },
    0x81: {
      meaning: 'Tốc độ động cơ (RPM) quá cao để thực hiện request.',
      cause: 'Động cơ đang quay nhanh hơn ngưỡng ECU cho phép.',
      fix: 'Giảm RPM (về không tải hoặc tắt máy) rồi gửi lại.',
    },
    0x83: {
      meaning: 'Request yêu cầu động cơ tắt nhưng động cơ đang chạy.',
      cause: 'Ví dụ ECU reset hoặc ghi dữ liệu khi động cơ đang chạy.',
      fix: 'Tắt động cơ (vẫn bật khóa điện) rồi gửi lại.',
    },
    0x88: {
      meaning: 'Tốc độ xe quá cao để thực hiện request.',
      cause: 'Xe đang chạy trong khi request yêu cầu xe đứng yên.',
      fix: 'Dừng xe (tốc độ = 0) rồi gửi lại.',
    },
    0x8d: {
      meaning: 'Request yêu cầu hộp số đang vào số nhưng hiện tại thì không.',
      cause: 'Cần số tiến hoặc lùi đang ở vị trí trung gian/đỗ.',
      fix: 'Đưa cần số về vị trí ECU yêu cầu rồi gửi lại.',
    },
    0x90: {
      meaning: 'Request yêu cầu cần số ở vị trí P nhưng hiện tại thì không.',
      cause: 'Cần số đang ở R, N hoặc D.',
      fix: 'Đưa cần số về P rồi gửi lại.',
    },
    0x92: {
      meaning: 'Điện áp nguồn của ECU cao hơn ngưỡng cho phép.',
      cause: 'Bộ sạc/máy phát cấp điện áp quá cao.',
      fix: 'Đưa điện áp về khoảng bình thường rồi gửi lại.',
    },
    0x93: {
      meaning: 'Điện áp nguồn của ECU thấp hơn ngưỡng cho phép.',
      cause: 'Ắc quy yếu hoặc lỗi mạch nguồn; ECU không dám ghi bộ nhớ khi điện áp thấp.',
      fix: 'Sạc ắc quy hoặc gắn bộ cấp nguồn ổn định rồi gửi lại.',
    },
  } as Record<number, { meaning: string; cause: string; fix: string }>,

  uds: {
    pipelineTitle: 'Quy trình ECU xử lý request',
    pipelineNote: 'Thứ tự đã đơn giản hóa từ quy tắc xử lý NRC chung của ISO 14229-1',
    stepTitles: {
      sidSupported: 'SID có được hỗ trợ?',
      sidSession: 'SID có được phép trong session hiện tại?',
      sidSecurity: 'SID có yêu cầu security?',
      minLength: 'Độ dài tối thiểu',
      subFunctionSupported: 'Sub-function có được hỗ trợ?',
      subFunctionSession: 'Sub-function có được phép trong session hiện tại?',
      subFunctionSecurity: 'Sub-function có yêu cầu security?',
      sequence: 'Thứ tự request',
      serviceSpecific: 'Kiểm tra riêng của service',
    },
    reasons: {
      skipped: 'Không kiểm tra vì một bước trước đó đã thất bại.',
      sidSupportedPass: (sid: string, name: string) => `ECU hỗ trợ service 0x${sid} (${name}).`,
      sidSupportedFail: (sid: string) => `ECU không hỗ trợ SID 0x${sid} nên trả NRC 0x11 (serviceNotSupported).`,
      sidSessionPass: (sid: string, session: string) => `Service 0x${sid} được phép trong ${session}.`,
      sidSessionFail: (sid: string, session: string, allowed: string) =>
        `Service 0x${sid} không được phép trong ${session} (chỉ được phép trong: ${allowed}).`,
      securityNotRequired: 'Không yêu cầu security access.',
      securityPass: (level: number) => `Yêu cầu security level ${level} và level này đang được mở.`,
      securityFail: (level: number) => `Yêu cầu security level ${level} nhưng ECU đang khóa level này.`,
      minLengthPass: (len: number, min: number) => `Request dài ${len} byte, đủ tối thiểu ${min} byte.`,
      minLengthFail: (len: number, min: number) => `Request chỉ dài ${len} byte, ít hơn tối thiểu ${min} byte của service này.`,
      noSubFunction: (name: string) => `${name} không có sub-function nên bỏ qua bước này.`,
      subFunctionPass: (sub: string, name: string) => `Sub-function 0x${sub} (${name}) được hỗ trợ.`,
      subFunctionFail: (sub: string) => `Sub-function 0x${sub} không có trong danh sách sub-function của service này.`,
      subFunctionSessionPass: (sub: string, session: string) => `Sub-function 0x${sub} được phép trong ${session}.`,
      subFunctionSessionFail: (sub: string, session: string, allowed: string) =>
        `Sub-function 0x${sub} không được phép trong ${session} (chỉ được phép trong: ${allowed}).`,
      sequenceNotRequired: 'Service này không yêu cầu thứ tự request đặc biệt.',
    },
    outcome: {
      positive: (rsid: string, sid: string, name: string) =>
        `ECU trả về positive response: SID 0x${rsid} = 0x${sid} + 0x40 (${name}).`,
      negative: (nrc: string, nrcName: string, reason: string) =>
        `ECU trả về negative response với NRC 0x${nrc} (${nrcName}): ${reason}`,
      suppressed:
        'Kết quả là positive nhưng request đặt suppressPosRspMsgIndicationBit (bit 7 của sub-function = 1), nên ECU không gửi response (response bị suppress).',
      functionalNrcSuppressed: (nrc: string, nrcName: string) =>
        `Request dùng functional addressing nên ECU không gửi NRC 0x${nrc} (${nrcName}). Với functional request, ECU im lặng với các NRC 0x11, 0x12, 0x31, 0x7E, 0x7F để các ECU không hỗ trợ không làm nhiễu bus bằng negative response.`,
      emptyRequest: 'Request rỗng (không có SID) nên ECU bỏ qua.',
      responsePending: (p2Star: number) =>
        `ECU giả lập xử lý lâu: gửi trước NRC 0x78 (requestCorrectlyReceived-ResponsePending); tester chuyển sang chờ theo P2* = ${p2Star} ms.`,
      pendingOverridesSuppress:
        'Vì ECU đã gửi NRC 0x78, response cuối vẫn được gửi dù request đặt suppressPosRspMsgIndicationBit.',
    },
    stateChange: {
      session: (from: string, to: string) => `Session chuyển từ ${from} sang ${to}.`,
      securityLocked: 'Security bị khóa lại vì session thay đổi.',
      didWritten: (did: string, data: string) => `DID 0x${did} được ghi giá trị mới: ${data}.`,
      s3Timeout: (s3: number) =>
        `S3 hết hạn (${s3} ms không có request nào), ECU tự quay về default session và khóa security.`,
    },
    service10: {
      lengthTitle: 'Độ dài request đúng 2 byte',
      lengthPass: 'Request có đúng 2 byte (SID + sub-function).',
      lengthFail: (len: number) => `0x10 phải có đúng 2 byte nhưng request có ${len} byte.`,
      executeTitle: 'Chuyển session',
      executePass: (to: string, p2: number, p2Star: number) =>
        `ECU chuyển sang ${to} và báo P2 = ${p2} ms, P2* = ${p2Star} ms trong response.`,
    },
    service3E: {
      lengthTitle: 'Độ dài request đúng 2 byte',
      lengthPass: 'Request có đúng 2 byte (SID + sub-function).',
      lengthFail: (len: number) => `0x3E phải có đúng 2 byte nhưng request có ${len} byte.`,
      executeTitle: 'Giữ session',
      executePass: 'ECU nhận TesterPresent và khởi động lại timer S3.',
    },
    service22: {
      formatTitle: 'Độ dài và định dạng',
      formatPass: (n: number) => `Request chứa ${n} DID (mỗi DID 2 byte).`,
      formatOdd: (n: number) => `Sau SID phải là các cặp 2 byte DID, nhưng có ${n} byte (số lẻ).`,
      formatTooMany: (n: number, max: number) => `Request chứa ${n} DID, vượt giới hạn ${max} DID mỗi request của ECU này.`,
      supportTitle: 'DID có được hỗ trợ trong session hiện tại?',
      supportPass: (list: string) => `Các DID đều được hỗ trợ: ${list}.`,
      supportPartial: (ok: string, skipped: string) =>
        `DID ${skipped} không được hỗ trợ trong session hiện tại nên bị bỏ qua; ECU vẫn trả dữ liệu cho ${ok}.`,
      supportFail: (list: string, session: string) =>
        `Không DID nào trong ${list} được hỗ trợ trong ${session} (DID không tồn tại hoặc chỉ đọc được ở session khác).`,
      securityTitle: 'Security của từng DID',
      securityNone: 'Không DID nào yêu cầu security.',
      securityPass: 'Các security level mà DID yêu cầu đều đang được mở.',
      securityFail: (did: string, level: number) => `DID 0x${did} yêu cầu security level ${level} nhưng ECU đang khóa level này.`,
      lengthTitle: 'Độ dài response',
      lengthPass: (n: number) => `Response dài ${n} byte, nằm trong giới hạn của ECU.`,
      lengthFail: (n: number, max: number) => `Response sẽ dài ${n} byte, vượt giới hạn ${max} byte của ECU.`,
    },
  },

  isotp: {
    frameKind: {
      SF: 'Single Frame',
      FF: 'First Frame',
      CF: 'Consecutive Frame',
      FC: 'Flow Control',
    },
    flowStatus: {
      0: 'ContinueToSend (CTS): bên nhận sẵn sàng, bên gửi tiếp tục gửi Consecutive Frame',
      1: 'Wait: bên nhận chưa sẵn sàng, bên gửi phải chờ Flow Control kế tiếp',
      2: 'Overflow: bản tin quá lớn so với bộ đệm của bên nhận, hủy truyền',
    },
    errors: {
      emptyFrame: 'Frame không có byte dữ liệu nào nên không đọc được PCI.',
      unknownPciType: 'Nibble cao của byte PCI không thuộc 0–3 nên đây không phải frame ISO-TP hợp lệ.',
      invalidSfLength: 'Độ dài trong PCI của Single Frame không hợp lệ (bằng 0, lớn hơn số byte thực có, hoặc sai dạng so với độ dài frame).',
      invalidFfLength: 'Độ dài trong First Frame quá nhỏ: bản tin này lẽ ra phải gửi bằng một Single Frame.',
      invalidFlowStatus: 'Flow status trong Flow Control lớn hơn 2 (chỉ có CTS, Wait, Overflow).',
      frameTooShort: 'Frame ngắn hơn số byte tối thiểu của loại PCI này.',
      unexpectedConsecutiveFrame: 'Nhận Consecutive Frame trong khi không có First Frame nào đang chờ ghép, nên frame bị bỏ qua.',
      wrongSequenceNumber: 'SN của Consecutive Frame không đúng thứ tự mong đợi, bên nhận hủy bản tin đang ghép.',
    },
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
