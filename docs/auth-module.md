# Auth, hồ sơ và quản trị — triển khai ngày 20/10/2026

Admin review/tích hợp Supabase đọc [biên bản rà soát, việc cần làm và ví dụ gọi endpoint](../web/src/modules/auth/SUPABASE_ADMIN_REVIEW.md) đặt ngay trong module Auth.

Phản hồi test đăng ký mới: xem [bản sửa thông báo xác minh, redirect và trigger tạo users](../web/src/modules/auth/SUPABASE_SIGNUP_FIX.md). Trigger mới tạo hồ sơ ngay khi Auth insert; `get_my_profile` vẫn giữ bootstrap dự phòng, idempotent.

## Yêu cầu và phần đã làm

Theo `ke-hoach/02-ho-so-quan-tri.md` và ảnh thiết kế database nhóm cung cấp:

1. **Tài khoản:** đăng ký email/mật khẩu, đăng nhập, đăng xuất bằng Supabase Auth SDK; nhập lại mật khẩu; thông báo lỗi tiếng Việt; hỗ trợ server có hoặc không yêu cầu xác nhận email. Không tự lưu mật khẩu/token.
2. **Phiên và trang riêng tư:** khôi phục phiên từ SDK, tránh nhận hồ sơ của phiên cũ khi đổi tài khoản; làm mới token không tải lại hồ sơ thừa. `/dat-chuyen`, `/vi-diem` yêu cầu hồ sơ ACTIVE; `/quan-tri` còn yêu cầu ADMIN. Sau đăng nhập quay về trang đã chọn.
3. **Bootstrap và hồ sơ:** trigger trên `auth.users` tạo hồ sơ USER/ACTIVE/PENDING ngay khi tài khoản được tạo, kể cả chưa xác minh email; migration bù hồ sơ thiếu của tài khoản cũ. `get_my_profile` giữ bootstrap dự phòng theo `auth.uid()`. Gọi lại không đặt lại quyền/trạng thái. User sửa họ tên, điện thoại, trường, mã sinh viên và minh chứng hư cấu; tùy chọn xe máy/biển số để đăng ký driver.
4. **Quản trị:** danh sách 20 hồ sơ/trang; admin duyệt/từ chối sinh viên và driver; từ chối phải có lý do; chỉ duyệt driver khi sinh viên đã VERIFIED và có xe. Duyệt driver thêm DRIVER, giữ USER. Khóa/mở tài khoản qua `users.status`; không cho admin tự khóa mình; không có API tự cấp ADMIN.
5. **Điều kiện tham gia:** server trả `eligibility.canBook` khi ACTIVE + sinh viên VERIFIED; `canDrive` còn cần DRIVER + driver VERIFIED + xe. Thay trường/mã/minh chứng đưa sinh viên và driver về PENDING, thu hồi DRIVER; thay xe chỉ đưa driver về PENDING và thu hồi DRIVER. Thay họ tên/điện thoại giữ trạng thái duyệt.

## Database theo ảnh thiết kế

Migration `supabase/migrations/20261020090000_auth_profiles.sql` chỉ tạo bảng `public.users` và hàm Auth. Giữ các cột trong ảnh: `id`, `display_name`, `phone`, `school`, `student_code`, `student_evidence_demo`, `roles`, `status`, hai trạng thái xác minh và ghi chú duyệt, `vehicle_model`, `vehicle_plate`, `created_at`. `id` là khóa ngoại tới `auth.users.id`; xóa Auth user sẽ xóa hồ sơ tương ứng.

Không tạo Trip/Booking/ví/thanh toán; không cấp điểm hoặc seed ADMIN. Bảng ứng dụng không chứa password. Frontend dùng tên camelCase trong contract, database dùng snake_case.

**Ảnh chỉ thể hiện cột và quan hệ, không cho biết toàn bộ defaults, constraints, RLS/grants hay SQL đang chạy.** Migration là bản triển khai local dựa trên ảnh và quy tắc repo, cần lead đối chiếu trước khi cập nhật server. Nếu server đã có `users`, không chạy nguyên migration CREATE TABLE lên server đó; lead cần đưa schema hiện tại vào lịch sử migration và tách phần thay đổi sau khi review. Không sửa/xóa bảng server hoặc reset remote để né xung đột.

## Quyền truy cập

- Bật RLS (kiểm soát từng dòng) và thu hồi quyền truy cập trực tiếp bảng `users` của `anon`/`authenticated`. Dữ liệu điện thoại/minh chứng chỉ trả qua RPC cho chính user hoặc ADMIN đang ACTIVE; không có API hồ sơ công khai.
- RPC là hàm database được gọi qua Supabase. Mỗi hàm lấy uid từ `auth.uid()`, không nhận uid cho thao tác hồ sơ cá nhân và không tin `user_metadata`. Dữ liệu lạ như `roles`, `status` trong input sửa hồ sơ bị từ chối ở cả frontend và SQL.
- Hàm `security definer` chạy bằng quyền chủ sở hữu, nên tất cả đều đặt `search_path = ''`, dùng tên bảng đầy đủ và kiểm tra quyền rõ ràng. Helper nằm trong schema `private`, client không gọi được.
- Các thao tác thay đổi hồ sơ/duyệt/khóa khóa dòng trong transaction. Admin bị khóa mất quyền ngay khi gọi lại API bằng phiên cũ. User bị khóa vẫn xem được hồ sơ mình và đăng xuất; không sửa hồ sơ hay thực hiện nghiệp vụ.
- Module 3/4 cần gọi `private.require_eligible_user(true)` (driver) hoặc `private.require_eligible_user(false)` (hành khách) **bên trong hàm server**, rồi xử lý nghiệp vụ trong cùng transaction. Không dùng boolean frontend làm kiểm tra quyền. Trip/Booking hiện chưa có handler; Auth không tự bảo vệ một handler tương lai nếu handler đó không gọi kiểm tra này.
- Sau khi khóa tài khoản, phiên UI khác có thể còn dữ liệu đã tải cho tới khi tải lại; server vẫn từ chối thao tác tiếp theo. `signOut` không được coi là thu hồi tức thì mọi access token.

## API và ảnh hưởng tới module khác

- `getMyProfile` → `get_my_profile`, input `{}`, trả `UserProfile`; kèm bootstrap an toàn.
- `updateMyProfile` → `update_my_profile`, input họ tên/điện thoại/trường/mã/minh chứng/xe, trả hồ sơ của phiên hiện tại.
- `adminListUsers` → `admin_list_users`, input `{page}`, trả `{users, total}`; mỗi trang 20 hồ sơ.
- `adminReviewUser` → `admin_review_user`, input `{uid, kind, decision, reason}`; kind STUDENT/DRIVER, decision VERIFIED/REJECTED.
- `adminSetUserStatus` → `admin_set_user_status`, input `{uid, status}`; status ACTIVE/LOCKED.

**Shared thay đổi:** `UserProfile` giữ các field cũ và thêm field riêng tư, trạng thái driver, xe và eligibility. Fixture của các module 3/4/5 cần bổ sung các field mới. Không đưa toàn bộ UserProfile vào kết quả tìm chuyến công khai; cần DTO công khai riêng khi triển khai Trip. Wrapper `callFunction` kiểm tra input theo từng API thay vì chỉ nhận `{}`. `healthCheck` và `adminFoundationInfo` vẫn chưa triển khai.

**Config/công cụ:** thêm URL `/tai-khoan` vào redirect local; server dev cần lead cấu hình URL frontend thực tế trong Auth URL Configuration nếu bật xác nhận email. Script local/test gọi CLI qua Node để tương thích Windows. `supabase:start` và bộ test integration áp dụng migration **local** chưa chạy; không reset dữ liệu local và không chuyển sang cloud. Các thư viện PGlite/jsdom/Testing Library chỉ dùng để test, không nằm trong bundle frontend.

## Chạy thử bắt buộc

### Bước 1 — kiểm tra code, khoảng 1–2 phút

Tại thư mục gốc repo, dùng Node 22 (từ 22.12):

```bash
npm ci
npm run typecheck
npm run build
npm test
```

Mong đợi TypeScript/build không lỗi, tests đều passed. Trên Windows PowerShell nếu `npm.ps1` bị chặn, dùng `npm.cmd` thay cho `npm`, không cần đổi chính sách PowerShell.

`npm test` có test React bằng DOM mô phỏng và test migration/RPC/grants trên PostgreSQL nhúng PGlite. Phần `auth.uid()` được dựng trong fixture để mô phỏng claim đã xác minh; bộ này **không chứng minh Supabase Auth/PostgREST và Docker hoạt động đúng**.

### Bước 2 — test Supabase local, khoảng 5–15 phút lần đầu

Cài/mở Docker Desktop rồi chạy tại gốc repo:

```bash
npm run test:integration
```

Script mở Supabase local, áp dụng migration chưa chạy bằng `migration up --local`, rồi kiểm tra Auth SDK thật, signup/login/logout, bootstrap, dữ liệu riêng tư, quyền admin, đổi xe, từ chối có lý do và LOCKED với token đã cấp. Chỉ lấy URL/key qua CLI local, không đọc key cloud. Tài khoản test tạm được dọn sau test. Nếu thiếu Docker, lệnh phải thất bại rõ ràng; không skip và không báo PASS.

### Bước 3 — thử giao diện, khoảng 10–15 phút

Chạy `npm run dev` cho toàn bộ local (cần Docker), hoặc `npm run dev:web` với server dev đã được lead cập nhật API. Đổi cấu hình cloud sang local theo `docs/supabase-local.md`; script không ghi đè env cloud.

1. Mở `/tai-khoan`, đăng ký email test, thử mật khẩu không khớp; đăng nhập, reload và đăng xuất. Nếu server bật xác nhận email, xác nhận trước khi login; local hiện tắt xác nhận email.
2. Lưu hồ sơ với minh chứng hư cấu và xe demo. Tài khoản đang ACTIVE/PENDING chưa đủ điều kiện đặt/đăng chuyến.
3. Với tài khoản ADMIN test do lead cấp bằng thao tác tin cậy, vào `/quan-tri`, duyệt sinh viên rồi tài xế; trở lại tài khoản user bấm Tải lại hồ sơ. DRIVER vẫn có USER, canDrive thành true.
4. Sửa biển số: DRIVER bị thu hồi và cần duyệt lại. Khóa user từ admin: user không lưu được hồ sơ bằng phiên cũ. Mở khóa cho phép dùng lại theo trạng thái duyệt hiện tại.

Nếu báo “chưa được triển khai”, server đang thiếu RPC/migration; không phải đã lưu thành công. Nếu `users already exists` khi áp dụng SQL, dừng và đối chiếu schema với lead; không xóa bảng.

## Chỉ dành cho lead

ADMIN đầu tiên không được tạo qua form hoặc lấy từ metadata. Sau khi đã review schema và chọn đúng Auth ID của tài khoản tin cậy, lead có thể cấp bằng SQL trong môi trường được giao quản trị:

```sql
-- Thay UUID_DEMO bằng đúng Auth user ID; user cần đăng nhập mở hồ sơ trước.
update public.users
set roles = array['USER', 'ADMIN']::text[]
where id = 'UUID_DEMO'::uuid;
```

Không chạy đoạn này với uid do user tùy ý gửi; không đưa service_role key vào frontend. Lần triển khai code này không thực hiện thao tác trên server hoặc cấp ADMIN thật.

Nguồn đối chiếu: [Supabase signUp](https://supabase.com/docs/reference/javascript/auth-signup), [sự kiện phiên Auth](https://supabase.com/docs/reference/javascript/auth-onauthstatechange), [PGlite](https://pglite.dev/docs/).
