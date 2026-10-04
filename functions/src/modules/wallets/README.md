# Module wallets & payments — Người 5

Phụ trách toàn bộ nghiệp vụ Ví điểm mô phỏng, Giao dịch (Ledger) và Thanh toán chuyến đi (Payment).

## 1. Kiến trúc dữ liệu

1. **`wallets/{uid}`**:
   - `uid`: string (ID tài khoản)
   - `balancePoints`: number (số dư điểm)
   - *Ví hệ thống thu phí:* `wallets/system-fees`
2. **`payments/{bookingId}`**:
   - `bookingId`: string (Khóa chính trùng ID đặt chuyến)
   - `passengerId`: string (Hành khách trả điểm)
   - `driverId`: string (Tài xế nhận điểm)
   - `farePoints`: number (Giá chuyến đi)
   - `feePoints`: number (Phí nền tảng 10%)
   - `driverPoints`: number (Thu nhập tài xế = fare - fee)
   - `status`: `'SUCCEEDED' | 'FAILED' | 'PENDING'`
3. **`ledgerEntries/{entryId}`**:
   - `id`: string (ID cố định theo nghiệp vụ)
   - `walletId`: string (ID ví hưởng/bị trừ)
   - `deltaPoints`: number (Số điểm biến động âm/dương)
   - `kind`: `'INITIAL_GRANT' | 'DEMO_TOP_UP' | 'RIDE_PAYMENT' | 'DRIVER_INCOME' | 'APP_FEE'`
   - `referenceId`: string
   - `createdAtMs`: number

## 2. Các hàm Callable API

- **`getMyWallet`**: Lấy số dư và lịch sử giao dịch. Tự động khởi tạo 1.000.000 điểm và ghi nhận `initial_${uid}` đúng một lần nếu tài khoản mới.
- **`topUpDemo`**: Thêm cố định 100.000 điểm thử nghiệm. Chống gọi lặp (idempotency) thông qua `requestId`.
- **`payBooking`**: Thanh toán chuyến đi bằng điểm khi `booking.status === 'COMPLETED'`. Sử dụng Firestore Transaction đọc toàn bộ Booking, Payment, các Ví trước khi ghi nguyên tử.
- **`getBookingPayment`**: Tra cứu trạng thái thanh toán của chuyến đi.

## 3. Quy tắc Idempotency & Firestore Transaction

- **Chống trừ tiền trùng**: `payments/{bookingId}` có ID là `bookingId`. Nếu đã có trạng thái `SUCCEEDED`, transaction trả về kết quả thành công ngay lập tức mà không thực hiện ghi mới hay trừ thêm điểm.
- **Nguyên tử & Chống âm ví**: Kiểm tra `passengerBalance >= farePoints` nằm bên trong callback của `db.runTransaction`. Quy tắc đọc trước ghi sau được tuân thủ nghiêm ngặt. Khi thiếu điểm hoặc có lỗi, transaction tự động hủy bỏ (rollback) toàn bộ, không có ví nào bị thay đổi một phần.
- **Xử lý đồng thời (Concurrency)**: Khi có 2 giao dịch đồng thời yêu cầu điểm lớn hơn số dư hiện tại, Firestore Transaction sẽ phát hiện xung đột và đảm bảo chỉ 1 giao dịch thành công, số dư không bao giờ bị âm.
