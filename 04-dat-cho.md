# Người 4 — Đặt chuyến và hàng chờ

**Mục tiêu:** khách gửi yêu cầu, driver nhận một người, theo dõi đón/trả. V1 không cần thuật toán xếp hàng hoặc giữ chỗ theo nhiều đoạn.

## Việc cần làm

1. Khách chọn điểm đón/trả trong tuyến, xem giá bằng điểm; chỉ có phương thức ví điểm demo.
2. Khách gửi/rút yêu cầu; driver xem hàng chờ, nhận/từ chối.
3. Khách confirmed được hủy trước khi đón, có lý do.
4. Driver đánh dấu đã đón và đã trả khách.

**Dữ liệu:** Booking và giá chốt. Dùng tuyến/stops của 3; giao bookingId, người trả/nhận, giá/phí bằng điểm, trạng thái cho 5; paymentMethod cố định DEMO_WALLET.

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

- Hai lần confirm đồng thời chỉ một khách được nhận: dùng DB constraint/mutation nguyên tử, không chỉ kiểm tra FE.
- Khách hủy thì có thể chọn người dự phòng; không thể nhận sau khi đã phục vụ khách đầu.
- Điểm trả phải sau điểm đón, đúng tuyến.
- T−30/giờ đi được kiểm tra ở backend, không cần cron V1.
- Chỉ driver chủ Trip đón/trả khách; contact chỉ hiện sau confirmed.

04–05/10: contract/giá. 06–07/10: queue/confirm/đón/trả. 08–10/10: test cùng 3/5. Reviewer:3. Viết ngắn state Booking và test nhận trùng.

## Prompt gửi Agent

```text
Tôi là người 4, phụ trách Booking/hàng chờ/giá. Đọc ke-hoach/00-ke-hoach-tong-the.md và ke-hoach/04-dat-cho.md. Làm đúng queue đã chốt: WAITING không giữ chỗ, driver chọn thủ công, một khách mỗi chuyến, khách có thể đi một đoạn. Không làm FIFO tự động, ghép nối tiếp hoặc segment reservation nhiều khách. Dùng stops/distance của 3, chuyển giá/phí bằng điểm đã chốt và Booking completed cho người 5. Chỉ dùng DEMO_WALLET, không cash/PayOS hoặc kiểm tra công nợ. Giải thích ngắn state và cách chống hai confirm đồng thời trước code. Làm FE/BE/test cho cancel, cutoff và concurrent confirm, giúp tôi hiểu từng phần.
```
