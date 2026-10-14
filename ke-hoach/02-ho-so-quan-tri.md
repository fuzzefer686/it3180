# Người 2 — Đăng nhập, hồ sơ và quản trị

Team là sinh viên năm 3. Làm từng task nhỏ, đọc [workflow](../docs/supabase-workflow.md) để biết chạy app và giao code. Đây là kế hoạch cần triển khai; chưa có bảng/API ứng dụng.

**Mục tiêu:** user đăng ký/login/logout, gửi hồ sơ; admin duyệt để driver đăng chuyến.

## Từ cần hiểu cho phần này

- `uid`: ID của user; Supabase gọi là `user.id`.
- `bootstrap`: tạo hồ sơ lần đầu sau login, mặc định USER/ACTIVE, không tự cấp ADMIN.
- `eligibility`: điều kiện được tham gia, ví dụ đã duyệt sinh viên và tài khoản chưa bị khóa.
- PENDING/VERIFIED/REJECTED: chờ duyệt/đã duyệt/bị từ chối. ACTIVE/LOCKED: hoạt động/bị khóa.

Xem thêm [thuật ngữ chung](07-tech-stack.md) nếu gặp RLS, RPC hoặc migration.

## Việc cần làm

1. Form đăng ký email/mật khẩu, login/logout bằng Supabase Auth; hiển thị user hiện tại và bảo vệ trang.
2. Bootstrap hồ sơ user qua API server được team thiết kế: mặc định USER/ACTIVE; backend cấp role/trạng thái, không nhận quyền từ FE. Người 5 khởi tạo ví riêng, cấp điểm đúng một lần.
3. Hồ sơ họ tên, điện thoại, trường, mã sinh viên; đăng ký driver với xe máy/biển số.
4. Trang admin duyệt/từ chối hồ sơ sinh viên/driver, có lý do; khóa/mở tài khoản qua trạng thái trong users.

**Cách làm:** Dùng React cho giao diện, Supabase Auth SDK cho login/password, Supabase database/API cho hồ sơ và quyền. Team chốt bảng và luật truy cập trước, lưu SQL vào migration, test với Supabase local. Không tự quản lý password/token; SDK làm phần đó.

**Dữ liệu cần thiết kế:** user profile, xác minh sinh viên, hồ sơ driver và xe; chưa chốt tên/cấu trúc bảng. Supabase SDK user.id là ID Auth, DTO dùng uid. Contract không phải SQL schema.

**Bàn giao cho 3/4/5:** uid, roles, status, sinh viên đã VERIFIED chưa, eligibility driver và xe. Các function kiểm tra quyền/trạng thái hiện tại từ dữ liệu server; không chỉ ẩn nút FE.

## Quy tắc và kiểm tra

- Hồ sơ: PENDING, VERIFIED, REJECTED. DRIVER dùng được chức năng USER; VERIFIED là trạng thái duyệt, khác role.
- Chỉ admin duyệt/cấp DRIVER/khóa tài khoản. Không có endpoint tự cấp ADMIN; admin đầu tiên do lead cấp bằng cách tin cậy sau khi team thiết kế, seed hiện tại không cấp admin.
- User chỉ sửa hồ sơ mình; minh chứng mẫu chỉ chủ hồ sơ/admin xem. Không upload hoặc đưa giấy tờ thật vào repo.
- Số điện thoại chỉ hiện cho hai bên sau confirmed; phối hợp người 4. API public không trả trường riêng tư.
- Logout dùng Supabase SDK `signOut`; không coi thao tác này là thu hồi mọi token đã cấp. Khi khóa tài khoản, mọi function nghiệp vụ phải từ chối theo users.status.

**Demo xong:** đăng ký → login → gửi hồ sơ → admin duyệt → driver đăng chuyến → logout. Test sai mật khẩu, chưa login, tự cấp role, sai chủ hồ sơ, USER gọi admin và user bị khóa.

Thứ tự: đăng ký/hồ sơ ban đầu → duyệt/phân quyền/khóa → nối Trip và test. Reviewer: người 1. Nhóm tự chốt ngày theo tiến độ.

## Prompt gửi Agent

```text
Team tôi là sinh viên năm 3, ít kinh nghiệm.
Chỉ làm task nhỏ được giao; giải thích từ lạ, mục đích, cách làm và kết quả test để tôi hiểu.
Tôi là người 2.
Đọc README.md, docs/contracts.md, docs/supabase-workflow.md và ke-hoach/02-ho-so-quan-tri.md.
Với task tôi giao tiếp theo, làm giao diện/backend/test Auth đăng ký/login/logout, bootstrap hồ sơ, eligibility và admin.
Dùng Supabase Auth SDK quản lý password/token; uid từ phiên đã xác minh, quyền/status từ dữ liệu server, không tin user_metadata.
Chốt bảng, luật truy cập và hàm API cùng team trước khi tạo migration; không cho client tự cấp role, không tự seed ADMIN.
Bootstrap kiểm tra uid và mặc định an toàn; nghiệp vụ kiểm tra ACTIVE/eligibility.
Cung cấp eligibility cho 3/4, uid cho 5; ví do 5 khởi tạo idempotent.
Minh chứng chỉ hư cấu.
Test Supabase local Docker cho auth/RBAC/sai chủ/LOCKED; không gọi cloud/VietMap trong CI.
Giải thích ngắn để tôi hiểu, không tự sửa module khác hoặc deploy cloud.
```
