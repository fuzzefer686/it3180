# BÁO CÁO & HƯỚNG DẪN NGƯỜI 5 — VÍ ĐIỂM DEMO & THANH TOÁN (SUPABASE)
**Dự án:** Về Cùng — Hệ thống ghép xe sinh viên HUST (IT3180)  
**Vai trò:** Người 5 (Phụ trách Ví điểm demo, Lịch sử biến động Ledger và Thanh toán chuyến đi)  
**Công nghệ:** React + Vite + TypeScript, Supabase PostgreSQL, Supabase Auth & RPC Stored Procedures

---

## 1. Cập nhật mới nhất về kiến trúc (Chuyển sang Supabase)

Nhóm trưởng (Lead) đã chính thức cập nhật toàn bộ dự án từ **Firebase sang Supabase**:
- **Backend:** Không còn dùng Cloud Functions, chuyển sang dùng **PostgreSQL Database** trên Supabase với các hàm Stored Procedures (**RPC Functions**).
- **Cấu hình môi trường:** Đã tạo sẵn tại `web/.env.local`:
  ```env
  VITE_SUPABASE_URL=https://wrvcvxirfwxgkaranlgk.supabase.co
  VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_vpMNYXFK5sVsBqXztRhnEA_jVJBL_N6
  ```
- **Lệnh chạy giao diện kết nối server Supabase:**
  ```bash
  npm run dev:web
  ```

---

## 2. Toàn bộ phần việc của Người 5 đã hoàn thành

### A. Cơ sở dữ liệu & SQL Migration (`supabase/migrations/20261015000000_create_wallets_and_payments.sql`)
1. **Bảng `wallets`:**
   - `uid` (text, PK): ID người dùng.
   - `balance_points` (bigint): Số dư điểm (ràng buộc `check balance_points >= 0`).
2. **Bảng `payments`:**
   - `booking_id` (text, PK): Mã chuyến đặt.
   - `passenger_id`, `driver_id`, `fare_points`, `fee_points`, `driver_points`, `status`.
3. **Bảng `ledger_entries`:**
   - `id` (text, PK): Khóa chính xác định chống trùng (`initial_uid`, `topup_uid_reqId`, `ride_pay_bookingId`...).
   - `wallet_id`, `delta_points`, `kind`, `reference_id`, `created_at_ms`.
4. **Bảo mật Row Level Security (RLS):**
   - Người dùng chỉ được phép xem ví và lịch sử của chính mình (`auth.uid() = uid`).
   - Cấm client tự ý sửa/cập nhật số dư trực tiếp. Mọi biến động số dư bắt buộc phải thông qua các hàm RPC nguyên tử.
5. **Các hàm xử lý Stored Procedures (RPC Functions):**
   - **`get_my_wallet()`**: Lấy ví và lịch sử. Tự động cấp 1.000.000 điểm demo đúng 1 lần cho tài khoản mới (`INITIAL_GRANT`).
   - **`top_up_demo(input jsonb)`**: Thêm cố định 100.000 điểm thử theo `requestId` độc nhất. Nếu gọi lại cùng `requestId`, trả về kết quả cũ mà không cộng thêm điểm lần 2 (Idempotency).
   - **`pay_booking(input jsonb)`**: Thanh toán chuyến đi `COMPLETED`. Kiểm tra số dư bằng `SELECT ... FOR UPDATE` (khóa bản ghi tránh xung đột đồng thời). Trừ khách 100%, tài xế nhận 90%, ví sàn hệ thống (`system-fees`) nhận 10% phí app. Ghi nhận payment và 3 dòng ledger entries cùng lúc trong một Transaction nguyên tử (ACID).
   - **`get_booking_payment(input jsonb)`**: Tra cứu thông tin thanh toán chuyến đi.

### B. Frontend React (`web/src/modules/wallets/WalletsPage.tsx`)
- Thẻ hiển thị số dư điểm demo, định dạng chuẩn tiếng Việt.
- Nút **"Thêm 100.000 điểm thử"** có loading state và tự động sinh `requestId` độc nhất.
- Form **"Thanh toán chuyến đi bằng điểm"**: Cho phép khách nhập mã đặt chuyến (`bookingId`) để thanh toán ngay khi hoàn thành cuốc xe.
- Danh sách lịch sử biến động điểm (**Ledger**) hiển thị chi tiết: ngày giờ, loại giao dịch, mã tham chiếu, số điểm tăng `+` (xanh lá) / giảm `-` (đỏ).

### C. Contracts & Boundary Type-safe (`shared/contracts.ts` & `shared/api.ts`)
- Khai báo đầy đủ interfaces trong `ApiContracts`.
- Khai báo Zod schemas và ánh xạ RPC name trong `shared/api.ts`.
- Wrapper `callFunction` trong `web/src/lib/callable.ts` tự động validate input và gọi RPC Supabase.

### D. Kiểm thử (`tests/unit/wallets.test.ts`)
- Chạy `npm test`: **10/10 tests passed**.
- Kiểm tra tính toán phân chia 10% phí sàn, tính xác định của ID, kiểm tra ràng buộc không âm và Zod validation.

---

## 3. Cách nạp Migration lên Supabase Dashboard

Nhóm trưởng đã cung cấp project Supabase cloud. Để các hàm và bảng của module Ví hoạt động trên server:

1. Đăng nhập vào trang quản trị Supabase Dashboard của project nhóm (`https://wrvcvxirfwxgkaranlgk.supabase.co`).
2. Vào mục **SQL Editor** ở thanh menu bên trái.
3. Mở file [20261015000000_create_wallets_and_payments.sql](file:///D:/Downsload+/5.payment-project/supabase/migrations/20261015000000_create_wallets_and_payments.sql), copy toàn bộ nội dung SQL và paste vào ô soạn thảo.
4. Bấm nút **Run** (Chạy). Toàn bộ các bảng, chỉ mục, chính sách RLS và 4 hàm RPC sẽ được tạo lập hoàn chỉnh!

---

## 4. Cách chạy thử giao diện trên máy

Chạy lệnh theo đúng hướng dẫn của nhóm trưởng:
```bash
cd "D:\Downsload+\5.payment-project"
npm run dev:web
```
- Truy cập vào: `http://localhost:5173/vi-diem`
- Đăng nhập tài khoản mẫu hoặc tài khoản đăng ký mới để xem ví điểm tự động khởi tạo 1.000.000 điểm và thử nghiệm nút nạp 100.000 điểm!
