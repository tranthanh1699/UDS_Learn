# UDS Lab

Ứng dụng web giúp kỹ sư Việt Nam học **UDS (ISO 14229-1)**, **ISO-TP (ISO 15765-2)** và **CAN / CAN FD**: cấu hình một chiếc xe mô phỏng, inject lỗi, gửi request UDS và soi từng byte của mỗi CAN frame.

Toàn bộ chạy trong trình duyệt: không cần backend, không cần database, không cần Docker, không cần biến môi trường. Bản build chạy được offline.

## Tính năng

- **7 service UDS**: 0x10 DiagnosticSessionControl, 0x11 ECUReset, 0x19 ReadDTCInformation (01, 02, 04, 06, 0A), 0x22 ReadDataByIdentifier, 0x27 SecurityAccess, 0x2E WriteDataByIdentifier, 0x3E TesterPresent. Mỗi service có 3 tab: **Học** (cấu trúc byte, sub-function, NRC, ma trận session × security, sơ đồ trao đổi, ví dụ với CAN frame thật, góc nhìn AUTOSAR), **Thực hành** (tạo request bằng biểu mẫu hoặc hex thô, xem quy trình ECU kiểm tra NRC từng bước) và **Bài tập decode**.
- **Soi từng byte**: mỗi byte của CAN frame có màu theo loại trường (PCI, SID, sub-function, DID, dữ liệu, NRC, padding); bấm vào để xem giải thích tiếng Việt, phân tích bit và mục tham chiếu ISO.
- **ISO-TP đầy đủ**: Single/First/Consecutive Frame, Flow Control, BS/STmin, Classic CAN và CAN FD, padding tùy chọn.
- **Cấu hình xe**: CAN ID 11/29-bit, bảng DID, security level và thuật toán key, điều kiện xe (tốc độ, RPM, điện áp, số), lưu tự động và nhập/xuất JSON.
- **Mô phỏng lỗi / DTC**: inject lỗi vào linh kiện trên hình xe, theo dõi status byte 8 bit thay đổi qua debounce, operation cycle, confirmation, healing và aging; lỗi ảnh hưởng ngược lại UDS (ví dụ lỗi ắc quy → 0x2E bị NRC 0x93) và đèn MIL/ABS.
- **Trace** kiểu CANoe với bộ lọc và xuất CSV, **Tra cứu NRC**, và **5 kịch bản hướng dẫn** từng bước.

Phím tắt: **Enter** gửi request ở tab Thực hành, **Ctrl+K** mở bảng lệnh để nhảy nhanh tới trang, service, NRC hoặc kịch bản.

## Yêu cầu

- **Node.js 20 LTS** (đã kèm npm). Tải tại <https://nodejs.org> hoặc dùng `nvm install 20 && nvm use 20` (dự án có sẵn file `.nvmrc`).
- Trình duyệt hiện đại: Chrome, Edge hoặc Firefox bản mới.

## Chạy trong 3 bước

1. Cài Node.js 20 LTS.
2. Mở terminal tại thư mục dự án.
3. Chạy:

   ```bash
   npm install && npm run dev
   ```

   Trình duyệt tự mở tại <http://localhost:5173>.

Hoặc chạy bằng script (script tự kiểm tra phiên bản Node và tự `npm install` ở lần đầu):

- Windows: nhấp đúp `start.bat`
- Linux/macOS: `./start.sh`

### Các lệnh khác

| Lệnh | Tác dụng |
| --- | --- |
| `npm run build` | Kiểm tra kiểu TypeScript và build bản production vào `dist/` |
| `npm run preview` | Chạy thử bản build tại <http://localhost:4173> |
| `npm test` | Chạy toàn bộ unit test (Vitest) |
| `npm run typecheck` | Chỉ kiểm tra kiểu TypeScript |

Thư mục `dist/` là web tĩnh, chạy offline (font đóng gói qua @fontsource, hình là inline SVG, không gọi CDN). Có thể chép `dist/` lên bất kỳ web server tĩnh nào.

## Lỗi thường gặp

**Cổng 5173 đã bị chiếm** (`Port 5173 is in use`)
Vite tự chuyển sang cổng kế tiếp (5174, 5175, ...) và in địa chỉ mới ra terminal. Muốn giải phóng cổng 5173:

- Windows: `netstat -ano | findstr :5173` rồi `taskkill /PID <số PID> /F`
- Linux/macOS: `lsof -i :5173` rồi `kill <PID>`

**Sai phiên bản Node.js** (lỗi cú pháp lạ, `Unsupported engine`, hoặc `start.bat`/`start.sh` báo Node quá cũ)
Kiểm tra bằng `node -v`. Cần `v20.x`. Với nvm: `nvm install 20 && nvm use 20`, rồi xóa thư mục `node_modules` và chạy lại `npm install`.

**`'node' is not recognized` / `command not found: node`**
Chưa cài Node.js, hoặc cần mở lại terminal sau khi cài để PATH được cập nhật.

**`npm install` lỗi mạng**
Kiểm tra kết nối Internet hoặc proxy công ty (`npm config set proxy ...`). Chỉ cần mạng lúc cài đặt; sau đó ứng dụng chạy offline.

**Cấu hình không được lưu**
Cấu hình xe và tham số DTC lưu trong `localStorage` của trình duyệt. Chế độ ẩn danh hoặc chính sách chặn lưu trữ sẽ làm mất cấu hình khi đóng tab. Dùng "Xuất JSON" để sao lưu. Trạng thái chạy của ECU (session, security, lỗi đang inject, trace) không được lưu: tải lại trang là ECU khởi động lại từ đầu.

**Kịch bản hướng dẫn báo "Khác mong đợi"**
Trạng thái ECU trước đó (session, số lần sai key, lỗi đang inject) khác với giả định của kịch bản. Bấm "Bắt đầu lại từ đầu" trong trang Kịch bản hướng dẫn.

## Cấu trúc dự án

```
src/
  core/                Lõi TypeScript thuần (không React), có unit test
    can/               CanFrame, ánh xạ DLC (Classic + FD), padding
    isotp/             Mã hóa/giải mã SF/FF/CF/FC, chia và ghép bản tin, BS/STmin
    uds/
      engine.ts        UdsServer: request PDU → pipeline NRC → handler → response
      pipeline.ts      Các bước kiểm tra NRC theo thứ tự
      services/        Mỗi service một file (handler + metadata)
      session.ts       session, timer S3, P2/P2*
      security.ts      kiểm tra security level
      keyAlgorithm.ts  tính key từ seed, parser biểu thức (không dùng eval)
      nrc.ts           Bảng NRC
    dtc/               Danh mục lỗi, mô hình status byte (debounce, cycle, healing, aging)
    annotate/          frame + ngữ cảnh → chú thích từng byte
    trace/             dựng frame cho mỗi lần trao đổi, tóm tắt và xuất CSV
    vehicle/           kiểu cấu hình xe và kiểm tra hợp lệ
  i18n/vi.ts           Từ điển tiếng Việt duy nhất (mọi chuỗi giao diện)
  data/                Cấu hình xe mặc định, nội dung bài học, kịch bản hướng dẫn, menu
  store/               Zustand store: cấu hình xe, trạng thái ECU, lỗi/DTC, trace, giao diện
  assets/svg/          Hình minh họa SVG gốc: mạng xe, bảng đồng hồ, hình lỗi, sơ đồ 3 lớp
  components/          Thành phần giao diện (layout, ui, frames, learn, practice, faults, config...)
  pages/               Các trang
  hooks/               React hook dùng chung
  lib/                 Tiện ích (localStorage an toàn, ECU tạm cho ví dụ, ...)
```

0x19 đọc DTC trực tiếp từ mô hình lỗi (`core/dtc/faultModel.ts` → `dtcViewsForEcu`); ECU mô phỏng là Engine ECU nên chỉ báo DTC của chính nó. Mô hình DTC đã sẵn sàng cho các service tiếp theo: `clearDtcs` (cho 0x14) và cờ `dtcSettingOn` (cho 0x85).

## Thêm một service mới

Ví dụ thêm service `0x14 ClearDiagnosticInformation`:

1. **Handler**: tạo `src/core/uds/services/0x14.ts` export một `ServiceDefinition` (xem `src/core/uds/types.ts`): SID, tên ISO, độ dài tối thiểu, session/security cho phép, danh sách sub-function, và hàm `handle(ctx)`. Trong `handle`, dùng `ctx.pass(...)` / `ctx.fail(title, nrc, lý do)` để ghi từng kiểm tra riêng (bước 9 của pipeline), rồi trả về positive response cùng các `effects` (đổi session, ghi DID, ...). Handler không tự sửa trạng thái ECU.
2. **Đăng ký**: thêm service vào mảng `DEFAULT_SERVICES` trong `src/core/uds/services/index.ts`. Pipeline NRC tự chạy các bước chung 1–8 (SID, session, security, độ dài, sub-function, thứ tự) dựa trên metadata.
3. **Chuỗi giao diện**: thêm mục `'14'` vào `vi.services` trong `src/i18n/vi.ts` và nội dung bài học vào `src/data/services-meta.ts`.
4. **Menu**: thêm `'14'` vào `MVP_SERVICES` trong `src/data/navigation.ts`. Trang `/service/14` sẽ tự xuất hiện.
5. **Chú thích byte**: nếu service có trường riêng (ví dụ DTC + status byte), bổ sung nhánh tương ứng trong `src/core/annotate/pdu.ts`.
6. **Test**: viết test byte-exact (request → response) cạnh file handler và chạy `npm test`. Test `src/data/services-meta.test.ts` sẽ kiểm tra các ví dụ trong nội dung học có ra đúng kết quả mô tả.

Chỉ dùng mã NRC có trong bảng NRC. Mã nào chưa chắc chắn phải ghi chú `// TODO: verify against ISO 14229-1`.

## Bản quyền nội dung

Nội dung giải thích được diễn giải bằng tiếng Việt, không chép nguyên văn tiêu chuẩn ISO. Các mã DTC mẫu chỉ là ví dụ minh họa.
