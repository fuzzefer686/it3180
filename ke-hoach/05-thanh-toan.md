# Người 5 — Ví điểm demo và giao dịch

Team là sinh viên năm 3. Làm từng task nhỏ, đọc [workflow](../docs/supabase-workflow.md) để biết chạy app và giao code. Đây là kế hoạch cần triển khai; chưa có bảng/API ứng dụng.

**Mục tiêu:** làm đầy đủ luồng trả chuyến, thu nhập và lịch sử bằng điểm ảo; không đụng đến tiền thật.

## Từ cần hiểu cho phần này

- Wallet: ví điểm. Payment: một lần trả điểm. LedgerEntry: một dòng lịch sử tăng/giảm điểm.
- `farePoints`/`feePoints`/`driverPoints`: tổng điểm trả/phí demo/điểm driver nhận, lấy từ giá server đã chốt của 4.
- Transaction: trừ khách, cộng driver và ghi lịch sử phải cùng xong hoặc cùng hủy.
- Idempotency/retry: gửi lại cùng yêu cầu không trả/cấp điểm thêm lần nữa. `requestId` giúp nhận diện yêu cầu đó.

Xem thêm [thuật ngữ chung](07-tech-stack.md) nếu gặp RLS, RPC hoặc migration.

## Việc cần làm

1. Tạo ví cho mỗi user, cấp 1.000.000 điểm demo đúng một lần, có lịch sử.
2. Trang ví: số dư, lịch sử, nút “Thêm 100.000 điểm thử” cho ví của chính user.
3. Sau khi khách xuống xe, khách bấm “Thanh toán bằng điểm”.
4. Trừ điểm khách, cộng điểm tài xế sau phí, ghi phí mô phỏng của app và kết quả thanh toán.

**Dữ liệu:** Wallet, Payment, LedgerEntry. Nhận bookingId, passengerId, driverId, farePoints, feePoints, driverPoints và Booking COMPLETED từ người 4. Một ví/user, DRIVER vẫn dùng ví đó khi làm hành khách.

**Cách làm:** Dùng React cho trang ví, Supabase database/API cho thay đổi điểm. Team chốt bảng/quyền, cách chống trùng và transaction rồi viết migration/test local. Frontend chỉ yêu cầu thao tác, không tự ghi số dư. Cùng 4 xác nhận giá và trạng thái Booking.

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
- Dùng transaction database: kiểm tra quyền/COMPLETED/đủ điểm và khóa dữ liệu cần thiết, rồi trừ/cộng điểm, ghi payment/ledger nguyên tử. Team thiết kế khóa idempotency/unique constraints để một Booking chỉ trả thành công một lần và retry không ghi trùng. Không gọi dịch vụ bên ngoài trong transaction.
- Bootstrap ví dùng uid và ledger cấp ban đầu cố định để chỉ cấp một lần. Top-up có requestId: cùng requestId chỉ cấp một lần, lần bấm mới được thêm 100.000 điểm; không tin số cấp từ FE.
- Giữ balance nhất quán với ledger bằng transaction và constraints phù hợp do team thiết kế; không tách thành các calls SDK độc lập. Lịch sử không sửa/xóa tùy ý.

V1 bỏ cash, PayOS, công nợ, số dư âm và rút tiền. Có thể thêm provider thật sau này nhưng không quy đổi điểm test thành tiền thật.

## Kiểm tra và bàn giao

Test đủ điểm, thiếu điểm, bấm hai lần, hai giao dịch đồng thời, sai người trả và cấp điểm ban đầu bị gọi lại. Nếu lỗi giữa chừng, không ví nào bị thay đổi một phần. Driver chỉ xem ví mình; admin xem phí demo nếu còn thời gian.

Thứ tự: ví/cấp điểm mẫu → trả điểm theo Booking → lịch sử và test. Reviewer: người 1; người 4 kiểm tra giá/trạng thái. Nhóm tự chốt ngày theo tiến độ.

Viết ngắn sơ đồ chuyển điểm và test đã chạy. Cần giải thích được số dư, transaction và chống trả hai lần.

## Prompt gửi Agent

```text
Team tôi là sinh viên năm 3, ít kinh nghiệm.
Chỉ làm task nhỏ được giao; giải thích từ lạ, mục đích, cách làm và kết quả test để tôi hiểu.
Tôi là người 5.
Đọc README.md, docs/contracts.md, docs/supabase-workflow.md và ke-hoach/05-thanh-toan.md.
Với task tôi giao tiếp theo, làm giao diện/backend/test ví điểm demo bằng Supabase Postgres/RPC.
Thống nhất bảng và quyền truy cập và ranh giới transaction/constraints/idempotency rồi viết migration, không để client ghi balance/ledger.
Cấp 1.000.000 điểm/user đúng một lần; thêm 100.000 điểm theo requestId, cùng request chỉ cấp một lần.
Chỉ khách đã xác minh của Booking COMPLETED được trả; quyền/status từ 2, giá/phí server từ 4.
Transaction kiểm tra đủ điểm và trừ/cộng/ghi phí/payment/ledger nguyên tử; concurrent/retry không âm ví hoặc thanh toán trùng.
Không tiền thật/PayOS/rút điểm.
Test thiếu điểm, sai quyền, retry, concurrent và rollback trên Supabase local Docker; không cloud thật trong CI.
Giải thích ngắn để tôi học, không tự sửa module khác hoặc deploy cloud.
```
