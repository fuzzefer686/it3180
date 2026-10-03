# Người 5 — Ví điểm demo và giao dịch

**Mục tiêu:** làm đầy đủ luồng trả chuyến, thu nhập và lịch sử bằng điểm ảo; không đụng đến tiền thật.

## Việc cần làm

1. Tạo ví cho mỗi user, cấp 1.000.000 điểm demo đúng một lần, có lịch sử.
2. Trang ví: số dư, lịch sử, nút “Thêm 100.000 điểm thử” cho ví của chính user.
3. Sau khi khách xuống xe, khách bấm “Thanh toán bằng điểm”.
4. Trừ điểm khách, cộng điểm tài xế sau phí, ghi phí mô phỏng của app và kết quả thanh toán.

**Dữ liệu:** Wallet, Payment, LedgerEntry. Nhận bookingId, passengerId, driverId, farePoints, feePoints, driverPoints và Booking COMPLETED từ người 4. Một ví/user, DRIVER vẫn dùng ví đó khi làm hành khách.

**Stack:** React; callable Cloud Functions TypeScript + Admin SDK/Firestore; Zod + Vitest/Emulator. Collections `wallets/{uid}`, `payments/{bookingId}`, `ledgerEntries`; dùng ví phí hệ thống tách biệt. FE không đọc/ghi ví trực tiếp, gọi function lấy ví mình. Xem [tech stack](07-tech-stack.md).

## Quy tắc đơn giản

| Chuyến 100.000 điểm, phí 10% | Thay đổi |
|---|---:|
| Ví khách | −100.000 điểm |
| Ví tài xế | +90.000 điểm |
| Tài khoản phí demo của app | +10.000 điểm |

- Điểm không mua bằng tiền, không rút/đổi ra tiền; UI luôn ghi rõ là điểm demo.
- Chỉ khách của Booking được thanh toán; backend lấy giá đã chốt, không tin giá/ID người trả từ FE.
- Chỉ trả sau Booking COMPLETED, không đợi Trip kết thúc.
- Thiếu điểm: báo lỗi, không thay đổi ví; thêm điểm thử rồi trả lại.
- Một Booking chỉ trả thành công một lần, dù bấm lặp hoặc retry.
- Trừ/cộng/ghi phí, Payment và ledger phải nguyên tử. Kiểm tra đủ điểm cũng nằm trong thao tác nguyên tử để hai giao dịch không làm âm ví.
- Cấp ban đầu/thêm điểm thử có loại giao dịch riêng; backend cố định mức cấp, kiểm tra người đăng nhập và chống retry ghi trùng.
- Dùng Firestore transaction: đọc Booking/Payment/các ví trước, kiểm tra quyền/COMPLETED/đủ điểm rồi ghi tất cả. Payment document có ID bookingId; ledger ID xác định theo loại và bookingId để retry không ghi trùng. Không gọi dịch vụ bên ngoài trong transaction.
- Bootstrap ví dùng uid và ledger cấp ban đầu cố định để chỉ cấp một lần. Top-up có requestId: cùng requestId chỉ cấp một lần, lần bấm mới được thêm 100.000 điểm; không tin số cấp từ FE.
- Giữ Wallet.balance nhất quán với ledger bằng transaction, không dùng constraint SQL. Lịch sử không sửa/xóa tùy ý.

V1 bỏ cash, PayOS, công nợ, số dư âm và rút tiền. Có thể thêm provider thật sau này nhưng không quy đổi điểm test thành tiền thật.

## Kiểm tra và bàn giao

Test đủ điểm, thiếu điểm, bấm hai lần, hai giao dịch đồng thời, sai người trả và cấp điểm ban đầu bị gọi lại. Nếu lỗi giữa chừng, không ví nào bị thay đổi một phần. Driver chỉ xem ví mình; admin xem phí demo nếu còn thời gian.

04–05/10: ví/cấp điểm và fixture. 06–07/10: trả chuyến và nối Booking. 08–10/10: lịch sử, test và sửa lỗi. Reviewer: người 1; người 4 kiểm tra giá và trạng thái Booking.

Viết ngắn sơ đồ chuyển điểm và test đã chạy. Cần giải thích được số dư, transaction và chống trả hai lần.

## Prompt gửi Agent

```text
Tôi là người 5, phụ trách ví điểm demo. Đọc ke-hoach/00-ke-hoach-tong-the.md, ke-hoach/05-thanh-toan.md và ke-hoach/07-tech-stack.md. Dùng React, callable Cloud Functions TypeScript, Admin SDK/Firestore, Zod và Vitest/Emulator; không cho client ghi ví/ledger trực tiếp. Làm wallets/payments/ledgerEntries: cấp 1.000.000 điểm/uid đúng một lần, thêm cố định 100.000 điểm theo requestId idempotent, trả Booking COMPLETED, cộng driver sau phí và ghi phí hệ thống. Firestore transaction đọc Booking/Payment/các ví trước khi ghi, kiểm tra đủ điểm trong transaction; payments ID=bookingId, ledger ID cố định cho retry. uid lấy request.auth, quyền/status từ người 2, giá/phí từ người 4. Chỉ DEMO_WALLET, không tiền thật/nợ/rút. Giải thích trước từng task để tôi học; test thiếu điểm, concurrent payments, gọi lại bootstrap/top-up, sai quyền, lỗi giữa transaction. Không tự sửa module khác hoặc deploy cloud.
```
