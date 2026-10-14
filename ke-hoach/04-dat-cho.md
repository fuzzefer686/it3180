# Người 4 — Đặt chuyến và hàng chờ

Team là sinh viên năm 3. Làm từng task nhỏ, đọc [workflow](../docs/supabase-workflow.md) để biết chạy app và giao code. Đây là kế hoạch cần triển khai; chưa có bảng/API ứng dụng.

**Mục tiêu:** khách gửi yêu cầu, driver nhận một người, theo dõi đón/trả. V1 không cần thuật toán xếp hàng hoặc giữ chỗ theo nhiều đoạn.

## Từ cần hiểu cho phần này

- Booking: một yêu cầu đi cùng; queue là danh sách yêu cầu đang chờ tài xế chọn.
- WAITING/CONFIRMED/ONBOARD/COMPLETED: đang chờ/đã nhận/đã lên xe/đã trả khách.
- REJECTED/CANCELLED/EXPIRED: bị từ chối/đã hủy/hết hạn.
- Cutoff hoặc T−30: mốc khóa yêu cầu mới, trước giờ đi 30 phút; server kiểm tra giờ.
- Concurrent: hai thao tác xảy ra đồng thời. Transaction/khóa bảo vệ để driver không nhận hai khách cùng lúc.

Xem thêm [thuật ngữ chung](07-tech-stack.md) nếu gặp RLS, RPC hoặc migration.

## Việc cần làm

1. Khách chọn điểm đón/trả trong tuyến, xem giá bằng điểm; chỉ có phương thức ví điểm demo.
2. Khách gửi/rút yêu cầu; driver xem hàng chờ, nhận/từ chối.
3. Khách confirmed được hủy trước khi đón, có lý do.
4. Driver đánh dấu đã đón và đã trả khách.

**Dữ liệu:** Booking và giá chốt. Dùng tuyến/stops của 3; giao bookingId, người trả/nhận, giá/phí bằng điểm, trạng thái cho 5; paymentMethod cố định DEMO_WALLET.

**Cách làm:** Dùng React cho giao diện, Supabase database/API để nhận khách và tính giá. Cùng 3/5 chốt bảng/quyền trước. Backend dùng transaction và ràng buộc dữ liệu để chống nhận trùng; lưu thay đổi bằng migration và test Supabase local. Xem ví dụ transaction trong tài liệu công cụ.

## Hàng chờ đã chốt

- WAITING chưa giữ chỗ; xếp hiển thị theo lúc gửi, driver chọn thủ công.
- Mỗi khách một yêu cầu hoạt động/Trip; không đặt Trip của mình.
- Chỉ một khách confirmed/onboard cho cả chuyến. Những người còn lại là dự phòng.
- Có khách confirmed thì không nhận request mới. Nếu khách hủy, driver tự chọn người dự phòng trước giờ xuất phát và trước start.
- T−30 khóa request mới, vẫn xử lý queue có sẵn trước giờ xuất phát.
- Đến giờ đi hoặc Trip start, WAITING hết hạn. Sau khi đã đón một khách, không nhận người khác.
- Hủy/rút miễn phí trong V1. Không tự động chọn hoặc xác nhận người thay thế.

## Giá và trạng thái

Giá demo=5.000 điểm/km của đoạn khách đi, làm tròn tới một điểm nguyên; phí mô phỏng 10%, làm tròn xuống. Backend tính và lưu farePoints, feePoints, driverPoints khi confirmed. Không tin giá FE gửi. Điểm không mua/rút/đổi ra tiền.

WAITING → CONFIRMED → ONBOARD → COMPLETED; có REJECTED/CANCELLED/EXPIRED. Trả khách giữa tuyến thì Booking COMPLETED, không tự kết thúc Trip.

## Kiểm tra để hoàn thành

- Hai lần confirm đồng thời chỉ một khách được nhận: transaction database đọc Trip/Booking, kiểm tra confirmedBookingId trống rồi ghi cả hai. Transaction cùng đọc trạng thái/giờ đi để start/cancel không chạy đua với confirm.
- Gửi request/rút/hủy cũng dùng transaction với khóa hoạt động theo tripId/uid. Pickup đặt hasServedPassenger=true trên Trip; sau dropoff không xóa cờ này để nhận khách khác. Retry không tạo request trùng.
- Khách hủy thì có thể chọn người dự phòng; không thể nhận sau khi đã phục vụ khách đầu.
- Điểm trả phải sau điểm đón, đúng tuyến.
- T−30/giờ đi được kiểm tra ở backend, không cần cron V1.
- Chỉ driver chủ Trip đón/trả khách; contact chỉ hiện sau confirmed.

Thứ tự: thống nhất dữ liệu/giá → hàng chờ/nhận khách/đón/trả → test cùng 3/5. Reviewer: 3. Viết lại bằng lời các trạng thái Booking và kết quả test nhận trùng.

## Prompt gửi Agent

```text
Team tôi là sinh viên năm 3, ít kinh nghiệm.
Chỉ làm task nhỏ được giao; giải thích từ lạ, mục đích, cách làm và kết quả test để tôi hiểu.
Tôi là người 4.
Đọc README.md, docs/contracts.md, docs/supabase-workflow.md và ke-hoach/04-dat-cho.md.
Với task tôi giao tiếp theo, làm giao diện/backend/test Booking/queue/giá trên Supabase Postgres/RPC; chốt bảng và quyền truy cập, transaction/khóa/constraints với 3/5 rồi viết migration.
uid từ phiên đã xác minh, eligibility từ dữ liệu server của 2; client không sửa Booking/giá trực tiếp.
WAITING chưa giữ chỗ, driver chọn thủ công, một khách/Trip.
Transaction bảo vệ confirm/start/cancel đồng thời, request hoạt động tripId/uid và retry; pickup đánh dấu đã phục vụ, không xóa khi dropoff.
Server quyết định cutoff/giá.
Nhận route của 3, bàn giao COMPLETED/giá/phí cho 5, chỉ DEMO_WALLET.
Test quyền/cutoff/cancel/concurrent trên Supabase local Docker, không cloud thật trong CI.
Giải thích ngắn để tôi hiểu, không sửa module khác hoặc deploy cloud.
```
