# Người 3 — Chuyến đi và VietMap

**Mục tiêu:** driver đăng chuyến xe máy, app vẽ đường và cho khách chọn các điểm dừng.

## Việc cần làm

1. Dùng VietMap hiển thị bản đồ, tìm địa điểm và tính đường xe máy.
2. Form chuyến: điểm đầu/cuối, các điểm dừng, giờ đi, giờ đến dự kiến, ghi chú.
3. Lưu đường đi, thứ tự điểm dừng và khoảng cách từng đoạn.
4. Trang danh sách/chi tiết chuyến, lọc đơn giản theo điểm/ngày.
5. Driver bắt đầu, kết thúc hoặc hủy chuyến; nối với Booking của 4.

**Dữ liệu:** Trip, RouteStop, RouteSnapshot; khoảng cách giữa các stops. Không cần bộ máy tối ưu tuyến.

**Stack:** React + VietMap GL JS ở FE; callable Cloud Functions TypeScript + Admin SDK/Firestore ở BE. Lưu `trips/{tripId}` với stops/route snapshot có giới hạn; API nghiệp vụ đi qua Functions, không cho FE ghi trực tiếp. Xem [tech stack](07-tech-stack.md).

**Bàn giao cho 4:** tripId, điểm dừng có thứ tự, khoảng cách từng đoạn và giờ đi. Giá khách đi A→C dựa trên khoảng cách AB+BC của tuyến đã lưu.

## Quy tắc và kiểm tra

- [VietMap Route v4](https://maps.vietmap.vn/docs/vi/map-api/route-version/route-v4/) dùng vehicle=motorcycle. Kiểm tra đúng đơn vị và thứ tự tọa độ.
- REST key ở backend; dùng đúng key client dành cho bản đồ web.
- V1 chỉ có một khách được nhận cho cả chuyến; khách được xuống giữa đường. Không ghép khách nối tiếp.
- Đã có Booking confirmed thì không sửa tuyến/giờ.
- Chỉ chủ chuyến được start/cancel/complete. Không kết thúc khi khách chưa được xử lý.
- Kiểm tra uid, roles/status/VERIFIED từ người 2. Lưu `confirmedBookingId` và `hasServedPassenger` ở Trip để người 4 chống nhận trùng; không tự xóa cờ đã phục vụ khi khách xuống xe.
- Start/cancel/complete dùng Firestore transaction cùng người 4 để không chạy đua với confirm/pickup. Hủy/expire yêu cầu dựa trên Trip là nguồn quyết định; không cần cập nhật mọi WAITING trong một transaction lớn.
- API map lỗi thì báo rõ, không lưu khoảng cách giả. Fixture phải có nhãn nếu chưa kiểm tra API thật.

**Demo xong:** đăng A→B→C→D, vẽ được đường,4 chọn A→C và tính đúng khoảng cách. Khách xuống C nhưng driver vẫn có thể đi đến D.

## Mốc của bạn

04–05/10: VietMap và contract điểm dừng. 06–07/10: đăng/tìm/lifecycle Trip. 08–10/10: tích hợp/test; nhờ2 hỗ trợ form/seed nếu cần.

Reviewer: 4. Test bằng Vitest + Emulator, mock VietMap và thử một tuyến thật có xe máy. Viết ngắn collection/contract và test lỗi; giải thích được tọa độ và khoảng cách.

## Prompt gửi Agent

```text
Tôi là người 3, phụ trách Trip/VietMap. Đọc ke-hoach/00-ke-hoach-tong-the.md, ke-hoach/03-chuyen-vietmap.md và ke-hoach/07-tech-stack.md. Dùng React + VietMap GL JS, callable Cloud Functions TypeScript, Admin SDK/Firestore; không cho client ghi trips trực tiếp. uid/eligibility lấy từ người 2. Làm map, đăng/tìm, stops và lifecycle; dùng tài liệu VietMap chính thức, Route v4 motorcycle, không đoán API. Lưu tuyến/khoảng cách cho người 4; cùng chốt confirmedBookingId/hasServedPassenger và transaction chống start/cancel chạy đua confirm. Không gọi VietMap trong transaction. V1 một khách mỗi chuyến, có thể xuống dọc đường; không tối ưu tuyến/GPS/ghép nối tiếp. Giải thích ngắn trước từng task, test Vitest/Emulator và mock map, giúp tôi hiểu tọa độ/đơn vị. Không tự sửa Booking/ví hoặc deploy cloud.
```
