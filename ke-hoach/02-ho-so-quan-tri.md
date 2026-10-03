# Người 2 — Đăng nhập, hồ sơ và quản trị

**Mục tiêu:** user đăng ký/login/logout, gửi hồ sơ; admin duyệt để driver đăng chuyến.

## Việc cần làm

1. Form đăng ký email/mật khẩu, login/logout bằng Firebase Authentication; hiển thị user hiện tại và bảo vệ trang.
2. Bootstrap `users/{uid}` qua callable: mặc định USER/ACTIVE; backend cấp role/trạng thái, không nhận quyền từ FE. Người 5 khởi tạo ví riêng, cấp điểm đúng một lần.
3. Hồ sơ họ tên, điện thoại, trường, mã sinh viên; đăng ký driver với xe máy/biển số.
4. Trang admin duyệt/từ chối hồ sơ sinh viên/driver, có lý do; khóa/mở tài khoản qua trạng thái trong users.

**Stack:** React và Firebase Auth SDK ở FE; callable Functions + Admin SDK + Firestore ở BE; Zod + Vitest/Emulator. Không tự lưu mật khẩu, ký JWT hoặc viết refresh token. Xem [tech stack](07-tech-stack.md).

**Collections:** users, studentVerifications, driverProfiles, vehicles. Firebase Auth uid là khóa user chung.

**Bàn giao cho 3/4/5:** uid, roles, status, sinh viên đã VERIFIED chưa, eligibility driver và xe. Các function kiểm tra quyền/trạng thái hiện tại từ Firestore; không chỉ ẩn nút FE.

## Quy tắc và kiểm tra

- Hồ sơ: PENDING, VERIFIED, REJECTED. DRIVER dùng được chức năng USER; VERIFIED là trạng thái duyệt, khác role.
- Chỉ admin duyệt/cấp DRIVER/khóa tài khoản. Không có endpoint tự cấp ADMIN; admin đầu tiên do lead seed tin cậy.
- User chỉ sửa hồ sơ mình; minh chứng mẫu chỉ chủ hồ sơ/admin xem. Không upload hoặc đưa giấy tờ thật vào repo.
- Số điện thoại chỉ hiện cho hai bên sau confirmed; phối hợp người 4. API public không trả trường riêng tư.
- Logout dùng Firebase `signOut`; không coi thao tác này là thu hồi mọi token đã cấp. Khi khóa tài khoản, mọi function nghiệp vụ phải từ chối theo users.status.

**Demo xong:** đăng ký → login → gửi hồ sơ → admin duyệt → driver đăng chuyến → logout. Test sai mật khẩu, chưa login, tự cấp role, sai chủ hồ sơ, USER gọi admin và user bị khóa.

04–05/10: auth/bootstrap/hồ sơ. 06–07/10: duyệt/RBAC/khóa và nối Trip. 08–10/10: test/sửa lỗi. Reviewer: người 1.

## Prompt gửi Agent

```text
Tôi là người 2. Đọc ke-hoach/00-ke-hoach-tong-the.md, ke-hoach/02-ho-so-quan-tri.md và ke-hoach/07-tech-stack.md. Làm FE/BE/test cho Firebase Auth đăng ký email/mật khẩu, login/logout, users bootstrap, hồ sơ sinh viên/xe và admin duyệt/từ chối/khóa. Dùng Firebase SDK, callable Cloud Functions TypeScript và Admin SDK/Firestore; không tự ký JWT hoặc lưu password. uid lấy từ request.auth, quyền/status đọc từ users do backend quản lý. FE không ghi trực tiếp Firestore. Cung cấp eligibility cho 3/4 và uid cho 5; ví do 5 khởi tạo idempotent. V1 chỉ minh chứng hư cấu, không upload/report đầy đủ. Giải thích ngắn trước mỗi task để tôi học. Test auth/RBAC/sai chủ hồ sơ/khóa bằng Vitest và Emulator; không tự sửa module khác hoặc triển khai cloud.
```
