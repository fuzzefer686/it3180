# Người 3 — Chuyến đi và VietMap

**Mục tiêu:** driver đăng chuyến xe máy, app vẽ đường và cho khách chọn các điểm dừng.

## Việc cần làm

1. Dùng VietMap hiển thị bản đồ, tìm địa điểm và tính đường xe máy.
2. Form chuyến: điểm đầu/cuối, các điểm dừng, giờ đi, giờ đến dự kiến, ghi chú.
3. Lưu đường đi, thứ tự điểm dừng và khoảng cách từng đoạn.
4. Trang danh sách/chi tiết chuyến, lọc đơn giản theo điểm/ngày.
5. Driver bắt đầu, kết thúc hoặc hủy chuyến; nối với Booking của 4.

**Dữ liệu:** Trip, RouteStop, RouteSnapshot; khoảng cách giữa các stops. Không cần bộ máy tối ưu tuyến.

**Bàn giao cho 4:** tripId, điểm dừng có thứ tự, khoảng cách từng đoạn và giờ đi. Giá khách đi A→C dựa trên khoảng cách AB+BC của tuyến đã lưu.

## Quy tắc và kiểm tra

- [VietMap Route v4](https://maps.vietmap.vn/docs/vi/map-api/route-version/route-v4/) dùng vehicle=motorcycle. Kiểm tra đúng đơn vị và thứ tự tọa độ.
- REST key ở backend; dùng đúng key client dành cho bản đồ web.
- V1 chỉ có một khách được nhận cho cả chuyến; khách được xuống giữa đường. Không ghép khách nối tiếp.
- Đã có Booking confirmed thì không sửa tuyến/giờ.
- Chỉ chủ chuyến được start/cancel/complete. Không kết thúc khi khách chưa được xử lý.
- API map lỗi thì báo rõ, không lưu khoảng cách giả. Fixture phải có nhãn nếu chưa kiểm tra API thật.

**Demo xong:** đăng A→B→C→D, vẽ được đường,4 chọn A→C và tính đúng khoảng cách. Khách xuống C nhưng driver vẫn có thể đi đến D.

## Mốc của bạn

04–05/10: VietMap và contract điểm dừng. 06–07/10: đăng/tìm/lifecycle Trip. 08–10/10: tích hợp/test; nhờ2 hỗ trợ form/seed nếu cần.

Reviewer: 4. Viết ngắn dữ liệu tuyến/API và test lỗi. Cần giải thích được đường đi, điểm dừng và khoảng cách khách sử dụng.

## Prompt gửi Agent

```text
Tôi là người 3, phụ trách Trip/VietMap. Đọc ke-hoach/00-ke-hoach-tong-the.md và ke-hoach/03-chuyen-vietmap.md. Làm map, đăng/tìm chuyến, stops và lifecycle Trip bằng stack chung. Dùng tài liệu VietMap chính thức, Route v4 motorcycle; không đoán trường API. Lưu tuyến/khoảng cách để4 tính giá; V1 chỉ một khách mỗi chuyến, có thể xuống dọc đường. Không làm tối ưu tuyến, GPS hoặc nhiều khách nối tiếp. Giải thích ngắn trước từng task, làm FE/BE/test và giúp tôi hiểu tọa độ/đơn vị. Không sửa Booking hoặc ví điểm của người khác.
```
