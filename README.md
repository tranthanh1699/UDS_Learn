# UDS Lab

Ứng dụng web giúp kỹ sư Việt Nam học **UDS (ISO 14229-1)**, **ISO-TP (ISO 15765-2)** và **CAN / CAN FD**: cấu hình một chiếc xe mô phỏng, inject lỗi, gửi request UDS và soi từng byte của mỗi CAN frame.

Toàn bộ chạy trong trình duyệt: không cần backend, không cần database, không cần Docker, không cần biến môi trường. Bản build chạy được offline.

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
Cấu hình lưu trong `localStorage` của trình duyệt. Chế độ ẩn danh hoặc chính sách chặn lưu trữ sẽ làm mất cấu hình khi đóng tab. Dùng "Xuất JSON" để sao lưu.

## Cấu trúc dự án

```
src/
  core/              Lõi TypeScript thuần (không React), có unit test
    can/             CanFrame, ánh xạ DLC (Classic + FD), padding
    isotp/           Mã hóa/giải mã SF/FF/CF/FC, chia và ghép bản tin, BS/STmin
    uds/
      engine.ts      UdsServer: request PDU → pipeline NRC → handler → response
      pipeline.ts    Các bước kiểm tra NRC theo thứ tự
      services/      Mỗi service một file (handler + metadata)
      session.ts     session, timer S3, P2/P2*
      security.ts    seed/key, đếm số lần thử, thời gian chờ
      nrc.ts         Bảng NRC
    dtc/             Mô hình fault injection → status byte của DTC
    annotate/        frame + ngữ cảnh → chú thích từng byte
  i18n/vi.ts         Từ điển tiếng Việt duy nhất (mọi chuỗi giao diện)
  data/              Nội dung bài học, cấu hình xe mặc định, menu
  store/             Zustand store: cấu hình xe, trạng thái ECU, lỗi, trace, giao diện
  assets/svg/        Hình minh họa SVG gốc (React component)
  components/        Thành phần giao diện (layout, ui, ...)
  pages/             Các trang
  hooks/             React hook dùng chung
  lib/               Tiện ích (localStorage an toàn, định dạng số, ...)
```

Lưu ý: dự án được xây theo từng giai đoạn. Một số thư mục ở trên (ví dụ `core/uds/`, `core/dtc/`, `assets/svg/`) sẽ được tạo ở các giai đoạn sau.

## Thêm một service mới

Ví dụ thêm service `0x19 ReadDTCInformation`:

1. **Handler**: tạo `src/core/uds/services/0x19.ts` export một `ServiceDefinition` (xem `src/core/uds/types.ts`): SID, tên ISO, độ dài tối thiểu, session/security cho phép, danh sách sub-function, và hàm `handle(ctx)`. Trong `handle`, dùng `ctx.pass(...)` / `ctx.fail(title, nrc, lý do)` để ghi từng kiểm tra riêng (bước 9 của pipeline), rồi trả về positive response cùng các `effects` (đổi session, ghi DID, ...). Handler không tự sửa trạng thái ECU.
2. **Đăng ký**: thêm service vào mảng `DEFAULT_SERVICES` trong `src/core/uds/services/index.ts`. Pipeline NRC tự chạy các bước chung 1–8 (SID, session, security, độ dài, sub-function, thứ tự) dựa trên metadata.
3. **Chuỗi giao diện**: thêm mục `'19'` vào `vi.services` trong `src/i18n/vi.ts` và nội dung bài học vào `src/data/services-meta.ts`.
4. **Menu**: thêm `'19'` vào `MVP_SERVICES` trong `src/data/navigation.ts`. Trang `/service/19` sẽ tự xuất hiện.
5. **Test**: viết test byte-exact (request → response) cạnh file handler và chạy `npm test`.

Chỉ dùng mã NRC có trong bảng NRC. Mã nào chưa chắc chắn phải ghi chú `// TODO: verify against ISO 14229-1`.

## Bản quyền nội dung

Nội dung giải thích được diễn giải bằng tiếng Việt, không chép nguyên văn tiêu chuẩn ISO. Các mã DTC mẫu chỉ là ví dụ minh họa.
