# Người 3 — Chuyến đi và VietMap

Team là sinh viên năm 3. Làm từng task nhỏ, đọc [workflow](../docs/supabase-workflow.md) để biết chạy app và giao code. Đây là kế hoạch cần triển khai; chưa có bảng/API ứng dụng.

**Mục tiêu:** driver đăng chuyến xe máy, app vẽ đường và cho khách chọn các điểm dừng.

## Từ cần hiểu cho phần này

- Trip: một chuyến; `tripId` là ID chuyến.
- Stops: các điểm dừng có thứ tự. Route snapshot: tuyến đã lưu để dùng lại, không đổi giá vì tuyến tính lại khác.
- `confirmedBookingId`: ID yêu cầu đã được nhận. `hasServedPassenger`: đánh dấu chuyến đã đón khách, không được xóa để nhận khách tiếp.
- Lifecycle: vòng đời chuyến, tức các bước mở → đang đi → hoàn thành hoặc hủy.

Xem thêm [thuật ngữ chung](07-tech-stack.md) nếu gặp RLS, RPC hoặc migration.

## Việc cần làm

1. Dùng VietMap hiển thị bản đồ, tìm địa điểm và tính đường xe máy.
2. Form chuyến: điểm đầu/cuối, các điểm dừng, giờ đi, giờ đến dự kiến, ghi chú.
3. Lưu đường đi, thứ tự điểm dừng và khoảng cách từng đoạn.
4. Trang danh sách/chi tiết chuyến, lọc đơn giản theo điểm/ngày.
5. Driver bắt đầu, kết thúc hoặc hủy chuyến; nối với Booking của 4.

**Dữ liệu:** Trip, RouteStop, RouteSnapshot; khoảng cách giữa các stops. Không cần bộ máy tối ưu tuyến.

**Cách làm:** Dùng React/VietMap cho bản đồ và Supabase để lưu chuyến, kiểm tra thao tác. Team chốt bảng/quyền và migration trước. VietMap REST key giữ ở backend; nếu cần Edge Function (code chạy trên Supabase), cùng lead bổ sung vì repo chưa có. Không để frontend tự sửa trạng thái chuyến.

**Bàn giao cho 4:** tripId, điểm dừng có thứ tự, khoảng cách từng đoạn và giờ đi. Giá khách đi A→C dựa trên khoảng cách AB+BC của tuyến đã lưu.

## Quy tắc và kiểm tra

- [VietMap Route v4](https://maps.vietmap.vn/docs/vi/map-api/route-version/route-v4/) dùng vehicle=motorcycle. Kiểm tra đúng đơn vị và thứ tự tọa độ.
- REST key ở backend; dùng đúng key client dành cho bản đồ web.
- V1 chỉ có một khách được nhận cho cả chuyến; khách được xuống giữa đường. Không ghép khách nối tiếp.
- Đã có Booking confirmed thì không sửa tuyến/giờ.
- Chỉ chủ chuyến được start/cancel/complete. Không kết thúc khi khách chưa được xử lý.
- Kiểm tra uid, roles/status/VERIFIED từ người 2. Lưu `confirmedBookingId` và `hasServedPassenger` ở Trip để người 4 chống nhận trùng; không tự xóa cờ đã phục vụ khi khách xuống xe.
- Start/cancel/complete dùng transaction database cùng người 4 để không chạy đua với confirm/pickup. Hủy/expire yêu cầu dựa trên Trip là nguồn quyết định; không cần cập nhật mọi WAITING trong một transaction lớn.
- API map lỗi thì báo rõ, không lưu khoảng cách giả. Fixture phải có nhãn nếu chưa kiểm tra API thật.

**Demo xong:** đăng A→B→C→D, vẽ được đường, 4 chọn A→C và tính đúng khoảng cách. Khách xuống C nhưng driver vẫn có thể đi đến D.

## Mốc của bạn

Thứ tự: bản đồ/điểm dừng → đăng/tìm/bắt đầu/kết thúc chuyến → nối Booking và test. Nhờ 2 hỗ trợ hồ sơ/tài khoản mẫu nếu cần; nhóm tự chốt ngày theo tiến độ.

Reviewer: 4. Test bằng Vitest + Supabase local Docker, mock VietMap và thử một tuyến thật có xe máy. Viết ngắn schema/contract và test lỗi; giải thích được tọa độ và khoảng cách.

## Prompt gửi Agent

```text
Team tôi là sinh viên năm 3, ít kinh nghiệm.
Chỉ làm task nhỏ được giao; giải thích từ lạ, mục đích, cách làm và kết quả test để tôi hiểu.
Tôi là người 3.
Đọc README.md, docs/contracts.md, docs/supabase-workflow.md và ke-hoach/03-chuyen-vietmap.md.
Với task tôi giao tiếp theo, làm giao diện/backend/test Trip/VietMap bằng React và Supabase; bảng, luật truy cập và hàm API phải thống nhất với team rồi đưa vào migration.
Client không ghi lifecycle/giá trực tiếp; uid/eligibility lấy từ Auth đã xác minh và dữ liệu server của 2.
REST key ở backend; nếu dùng Edge Function thì cùng lead bổ sung runtime/config/test vì hiện chưa có.
Đối chiếu tài liệu VietMap chính thức cho motorcycle/đơn vị/tọa độ.
Bàn giao route/stops/distance cho 4; cùng thiết kế transaction chống start/cancel/confirm chạy đua.
Một khách/Trip, có thể xuống sớm, không nhận khách kế tiếp.
Mock VietMap trong test/CI, không gọi ngoài trong transaction.
Giải thích ngắn để tôi học; không sửa Booking/ví hoặc deploy cloud.
```
