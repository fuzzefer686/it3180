# Người 2 — Hồ sơ và quản trị

**Mục tiêu:** sinh viên gửi hồ sơ, admin duyệt, driver đủ điều kiện mới đăng chuyến.

## Việc cần làm

1. Trang hồ sơ: họ tên, điện thoại, trường, mã sinh viên.
2. Đăng ký driver: tên xe máy và biển số.
3. Trang admin duyệt/từ chối hồ sơ sinh viên và driver, có lý do.
4. Dùng minh chứng mẫu hư cấu cho demo. Chưa làm upload tài liệu thật hoặc báo cáo vi phạm.

**Dữ liệu:** StudentVerification, DriverProfile, Vehicle. Tài khoản/login do 1 làm.

**Bàn giao cho 3/4:** user đã xác thực chưa, có quyền DRIVER chưa và thông tin xe. Không chỉ ẩn nút ở giao diện; backend cũng phải kiểm tra.

## Quy tắc và kiểm tra

- Trạng thái hồ sơ: PENDING, VERIFIED, REJECTED.
- User không tự duyệt hoặc tự cấp quyền driver.
- User chỉ sửa hồ sơ mình; minh chứng chỉ chủ hồ sơ/admin xem.
- Số điện thoại chỉ hiện cho hai bên sau khi Booking được xác nhận; phối hợp4.
- Dùng dữ liệu hư cấu, không đưa giấy tờ thật vào repo.

**Demo xong:** user gửi hồ sơ → admin duyệt → driver đăng được chuyến của 3. Có test user gọi API admin bị chặn.

## Mốc của bạn

04–05/10: hồ sơ và dữ liệu mẫu. 06–07/10: duyệt và nối với auth/Trip. 08–10/10: test, sửa lỗi; hỗ trợ form/seed cho 3/4 nếu rảnh.

Reviewer: 1. Viết ngắn luồng duyệt, các trường dữ liệu và test đã chạy. Cần giải thích được quyền USER/DRIVER khác trạng thái VERIFIED thế nào.

## Prompt gửi Agent

```text
Tôi là người 2, phụ trách hồ sơ và quản trị. Đọc ke-hoach/00-ke-hoach-tong-the.md và ke-hoach/02-ho-so-quan-tri.md. Làm giao diện/API hồ sơ sinh viên, xe máy và admin duyệt/từ chối. Dùng auth của người 1, cung cấp eligibility cho 3/4. V1 dùng minh chứng mẫu hư cấu, không làm upload thật hoặc reports. Làm từng task nhỏ, giải thích ngắn trước khi code, kiểm tra quyền ở backend và viết test truy cập sai quyền. Không tự thay schema/module khác. Giúp tôi hiểu và tự giải thích được luồng duyệt.
```
