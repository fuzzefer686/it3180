# Auth, hồ sơ và quản trị — triển khai ngày 20/10/2026

Tài liệu này gom hướng dẫn Auth, cấu hình đăng ký và các việc còn cần lead xử lý. Kết quả kiểm thử theo từng thời điểm nằm trong [validation](validation.md).

Yêu cầu hiện hành ngày 22/10/2026: [đăng ký/đăng nhập và tự trở về trang chủ](../web/src/modules/auth/SUPABASE_SIGNUP_FIX.md). Hỗ trợ cả server có hoặc không yêu cầu xác minh email; trigger tạo hồ sơ ngay khi Auth insert, `get_my_profile` giữ bootstrap dự phòng, idempotent.

## Cập nhật 27/10/2026 — role USER + DRIVER mặc định

Migration `supabase/migrations/20261027000100_auth_default_driver_role.sql`
thay thế quy tắc role của bản 26/10 bên dưới. **Người dùng đã chạy migration trên
server; kiểm tra chỉ đọc ngày 28/10/2026 xác nhận 6/6 tài khoản có USER + DRIVER,
VERIFIED cả hai.** Default roles, trigger signup, CHECK và `update_my_profile`
trên server khớp migration trong repo.

- Tài khoản mới và hồ sơ được bootstrap có `USER` + `DRIVER`, xác minh sinh viên
  và tài xế là `VERIFIED`. Hồ sơ cũ cũng được bổ sung `DRIVER`, giữ `ADMIN`,
  trạng thái `LOCKED` và thông tin cá nhân/xe. Bù hồ sơ Auth còn thiếu nếu có.
- CHECK `users_driver_eligible` chỉ yêu cầu hai trạng thái VERIFIED khi có DRIVER;
  không bắt có xe để mang role. Việc đăng chuyến/nhận khách vẫn cần đủ thông tin
  xe, tài khoản ACTIVE và xác minh, do RPC Auth/Trip/Booking kiểm tra.
- Xóa thông tin xe không xóa role DRIVER, nhưng `eligibility.canDrive` trở thành
  false. Admin vẫn có thể thu hồi quyền bằng thao tác từ chối xác minh; sửa hồ sơ
  không tự khôi phục role khi đã bị admin từ chối.
- Không đổi shared contract, RLS hoặc quyền ghi bảng của client. Module 3/4 phải
  dùng `eligibility.canDrive` và kiểm tra backend, không chỉ kiểm tra role DRIVER.
  Trước khi cập nhật server, chạy integration Supabase local bằng Docker theo
  quy trình repo; không chạy lại các migration cũ đã áp dụng.

## Cập nhật 26/10/2026 — mặc định xác minh sinh viên và tài xế

Bản demo bỏ bước admin duyệt hồ sơ. Migration mới `supabase/migrations/20261026000100_auth_default_verified.sql`:

- Trigger `auth.users` tạo hồ sơ với `student_verification_status` và `driver_verification_status` = `VERIFIED`; default hai cột cũng đổi theo nên bootstrap trong `get_my_profile` không tạo hồ sơ `PENDING` nữa.
- Hồ sơ đã có được đặt lại `VERIFIED` cho cả hai; giữ `status` (`LOCKED` vẫn bị khóa), giữ role `ADMIN`, xóa ghi chú duyệt cũ.
- Role `DRIVER` **không** cấp lúc đăng ký vì ràng buộc `users_driver_eligible` yêu cầu có loại xe và biển số. `update_my_profile` tự cấp `DRIVER` khi hồ sơ có đủ hai thông tin xe và tự thu hồi khi xóa trống, nên `canDrive` bật ngay sau khi người dùng nhập xe mà không cần admin.
- Sửa hồ sơ không còn đưa trạng thái về `PENDING` hoặc thu hồi `DRIVER`; `canBook` đúng với mọi tài khoản `ACTIVE`.
- Admin vẫn dùng được `admin_review_user`/`admin_set_user_status` (từ chối, khóa) khi cần, nhưng đó không còn là bước bắt buộc.

Ảnh hưởng: module 3/4 gọi `private.require_eligible_user(true)` vẫn phải có thông tin xe như trước; không đổi contract `UserProfile`, không đổi RLS/quyền bảng.

Ngày 27/10/2026, theo yêu cầu người dùng, đã áp dụng riêng SQL của migration
`20261026000100_auth_default_verified.sql` lên Supabase dev
`wrvcvxirfwxgkaranlgk`. Kiểm tra sau cập nhật: 6/6 hồ sơ đã VERIFIED cả sinh viên
và tài xế, không còn hồ sơ chờ xác minh; default hai cột và trigger signup đều
dùng VERIFIED. `update_my_profile` không đưa hồ sơ về PENDING khi sửa thông tin.
Giữ trạng thái khóa/quyền ADMIN; DRIVER vẫn phụ thuộc thông tin xe.

Lần áp dụng riêng SQL này không ghi version vào migration history; server vẫn
chỉ ghi nhận baseline. Lead cần đối chiếu lịch sử với schema thực tế trước khi
dùng `db push`, không chạy lại cả chuỗi migration. Test Supabase local qua Docker
vẫn thực hiện bằng `npm run test:integration` khi Docker sẵn sàng.

## Yêu cầu và phần đã làm

Theo `ke-hoach/02-ho-so-quan-tri.md` và ảnh thiết kế database nhóm cung cấp:

1. **Tài khoản:** đăng ký email/mật khẩu, đăng nhập, đăng xuất bằng Supabase Auth SDK; nhập lại mật khẩu; thông báo lỗi tiếng Việt. Signup có user nhưng chưa có phiên là chờ xác minh email, không phải lỗi đăng ký. Có nút gửi lại email; lỗi SMTP/rate limit không báo thành công giả. Không tự lưu mật khẩu/token.
2. **Phiên và trang riêng tư:** khôi phục phiên từ SDK, tránh nhận hồ sơ của phiên cũ khi đổi tài khoản; làm mới token không tải lại hồ sơ thừa. `/dat-chuyen`, `/vi-diem` yêu cầu hồ sơ ACTIVE; `/quan-tri` còn yêu cầu ADMIN. Đăng ký/login hoặc callback thành công tự mở `https://feat-auth.it3180.pages.dev/chuyen-di` khi SDK có user, kể cả từ localhost; khi đổi origin, SDK đích nhận và lưu phiên qua fragment implicit. Người đã đăng nhập vẫn chủ động mở `/tai-khoan` để sửa hồ sơ.
3. **Bootstrap và hồ sơ:** trigger trên `auth.users` tạo hồ sơ USER/ACTIVE/VERIFIED ngay khi tài khoản được tạo, kể cả chưa xác minh email (xem cập nhật 26/10 ở trên); migration bù hồ sơ thiếu của tài khoản cũ. `get_my_profile` giữ bootstrap dự phòng theo `auth.uid()`. Gọi lại không đặt lại quyền/trạng thái. User sửa họ tên, điện thoại, trường, mã sinh viên và minh chứng hư cấu; tùy chọn xe máy/biển số để đăng ký driver.
4. **Quản trị:** danh sách 20 hồ sơ/trang; admin duyệt/từ chối sinh viên và driver; từ chối phải có lý do; chỉ duyệt driver khi sinh viên đã VERIFIED và có xe. Duyệt driver thêm DRIVER, giữ USER. Khóa/mở tài khoản qua `users.status`; không cho admin tự khóa mình; không có API tự cấp ADMIN.
5. **Điều kiện tham gia:** server trả `eligibility.canBook` khi ACTIVE + sinh viên VERIFIED; `canDrive` còn cần DRIVER + driver VERIFIED + xe. Từ 26/10, hồ sơ mặc định VERIFIED và `DRIVER` được cấp tự động khi có xe; sửa hồ sơ không còn hạ trạng thái về PENDING.

## Database theo ảnh thiết kế

Từ bản sửa 22/10, bảng `public.users` lấy từ baseline server `20261016000000_initial_schema.sql`. Migration `20261022000100_auth_existing_schema.sql` chỉ bổ sung RPC Auth và default tên hồ sơ, không tạo lại bảng. `users.id` tham chiếu `auth.users.id` với ON DELETE RESTRICT: không tự xóa hồ sơ và dữ liệu nghiệp vụ khi xóa Auth user.

Migration Auth không tạo Trip/Booking/ví/thanh toán; không cấp điểm hoặc seed ADMIN. Baseline nhóm chứa đủ 7 bảng. Bảng ứng dụng không chứa password. Frontend dùng tên camelCase trong contract, database dùng snake_case.

Schema đã được đối chiếu catalog server ngày 22/10. Các migration Auth cũ đã chuyển sang `supabase/legacy-migrations/` để tránh CREATE TABLE trùng. Xem [thứ tự áp dụng và các khác biệt server](trips.md); không chạy lại baseline trên server đã ghi nhận version đó.

## Quyền truy cập

- Giữ RLS của nhóm: `authenticated` chỉ đọc trực tiếp hồ sơ của chính mình, `anon` không đọc được. Client không ghi trực tiếp hoặc xem hồ sơ người khác. Admin xem qua RPC có kiểm tra ADMIN/ACTIVE. Không thu hồi SELECT users vì policy Trip/Booking/ví đang phụ thuộc việc đọc hồ sơ của người gọi.
- RPC là hàm database được gọi qua Supabase. Mỗi hàm lấy uid từ `auth.uid()`, không nhận uid cho thao tác hồ sơ cá nhân và không tin `user_metadata`. Dữ liệu lạ như `roles`, `status` trong input sửa hồ sơ bị từ chối ở cả frontend và SQL.
- Hàm `security definer` chạy bằng quyền chủ sở hữu, nên tất cả đều đặt `search_path = ''`, dùng tên bảng đầy đủ và kiểm tra quyền rõ ràng. Helper nằm trong schema `private`, client không gọi được.
- Các thao tác thay đổi hồ sơ/duyệt/khóa khóa dòng trong transaction. Admin bị khóa mất quyền ngay khi gọi lại API bằng phiên cũ. User bị khóa vẫn xem được hồ sơ mình và đăng xuất; không sửa hồ sơ hay thực hiện nghiệp vụ.
- Module nghiệp vụ phải kiểm tra quyền **bên trong hàm server**, rồi xử lý trong cùng transaction. Auth cung cấp `private.require_eligible_user(true)` (driver) và `private.require_eligible_user(false)` (hành khách). Trip đã có helper `private.require_trip_user` tương thích hồ sơ mới; xem [Trip/VietMap](trips.md). Không dùng boolean frontend làm kiểm tra quyền.
- Sau khi khóa tài khoản, phiên UI khác có thể còn dữ liệu đã tải cho tới khi tải lại; server vẫn từ chối thao tác tiếp theo. `signOut` không được coi là thu hồi tức thì mọi access token.

## API và ảnh hưởng tới module khác

- `getMyProfile` → `get_my_profile`, input `{}`, trả `UserProfile`; kèm bootstrap an toàn.
- `updateMyProfile` → `update_my_profile`, input họ tên/điện thoại/trường/mã/minh chứng/xe, trả hồ sơ của phiên hiện tại.
- `adminListUsers` → `admin_list_users`, input `{page}`, trả `{users, total}`; mỗi trang 20 hồ sơ.
- `adminReviewUser` → `admin_review_user`, input `{uid, kind, decision, reason}`; kind STUDENT/DRIVER, decision VERIFIED/REJECTED.
- `adminSetUserStatus` → `admin_set_user_status`, input `{uid, status}`; status ACTIVE/LOCKED.

**Shared thay đổi:** `UserProfile` giữ các field cũ và thêm field riêng tư, trạng thái driver, xe và eligibility. Fixture của các module 3/4/5 cần bổ sung các field mới. Không đưa toàn bộ UserProfile vào kết quả tìm chuyến công khai; cần DTO công khai riêng khi triển khai Trip. Wrapper `callFunction` kiểm tra input theo từng API thay vì chỉ nhận `{}`. `healthCheck` và `adminFoundationInfo` vẫn chưa triển khai.

**Config/công cụ:** local đặt `enable_confirmations = false`; server dev có thể bật xác minh nếu gửi được email. Signup/resend dùng callback website Pages trong `auth-redirect.ts`; lead cần cho phép URL đó trong Supabase và dùng template xác minh đúng. Không đổi duyệt sinh viên/driver hoặc quyền của module 3/4/5. Script local/test gọi CLI qua Node để tương thích Windows. `supabase:start` và bộ test integration áp dụng migration **local** chưa chạy; không reset dữ liệu local và không chuyển sang cloud. Các thư viện PGlite/jsdom/Testing Library chỉ dùng để test, không nằm trong bundle frontend.

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

1. Mở `/tai-khoan`, đăng ký email test, thử mật khẩu không khớp; có phiên thì tự tới `/chuyen-di`, chưa có phiên thì xác minh qua email rồi trở về website và tự tới trang chủ. Kiểm tra dòng `public.users` cùng ID Auth. Reload, đăng xuất và đăng nhập lại; login đúng tự tới trang chủ, sai giữ form. Nếu thiếu hồ sơ, kiểm tra migration/RPC/trigger.
2. Lưu hồ sơ với minh chứng hư cấu và xe demo. Tài khoản đang ACTIVE/PENDING chưa đủ điều kiện đặt/đăng chuyến.
3. Với tài khoản ADMIN test do lead cấp bằng thao tác tin cậy, vào `/quan-tri`, duyệt sinh viên rồi tài xế; trở lại tài khoản user bấm Tải lại hồ sơ. DRIVER vẫn có USER, canDrive thành true.
4. Sửa biển số: DRIVER bị thu hồi và cần duyệt lại. Khóa user từ admin: user không lưu được hồ sơ bằng phiên cũ. Mở khóa cho phép dùng lại theo trạng thái duyệt hiện tại.

Nếu báo “chưa được triển khai”, server đang thiếu RPC/migration; không phải đã lưu thành công. Nếu `users already exists` khi áp dụng SQL, dừng và đối chiếu schema với lead; không xóa bảng.

## Chỉ dành cho lead

### Cấu hình đăng ký và xác nhận email

1. Đối chiếu schema server trước khi áp dụng migration Auth. Migration `20261022000200_auth_signup_existing_schema.sql` tạo/thay thế trigger `auth_create_app_profile` trên `auth.users` và bù hồ sơ thiếu. Hồ sơ mới có USER/ACTIVE/PENDING; tài khoản cũ giữ nguyên quyền/trạng thái nhờ `on conflict do nothing`. Trigger không tạo ví. Lỗi trigger có thể khiến cả thao tác đăng ký bị rollback.
2. Trong Supabase Dashboard → Authentication → URL Configuration, đặt Site URL là địa chỉ frontend đang dùng. Thêm URL `/tai-khoan` vào Redirect URLs cho từng môi trường, ví dụ `http://127.0.0.1:5173/tai-khoan`, `http://localhost:5173/tai-khoan`; nếu dùng preview Auth thì thêm `https://feat-auth.it3180.pages.dev/tai-khoan`.
3. Frontend gửi `emailRedirectTo` bằng `window.location.origin + '/tai-khoan'`. Nếu bật Confirm Email, template email cần dùng `{{ .ConfirmationURL }}` để xác nhận token rồi chuyển về web. Chỉ dùng Site URL/Redirect URL sẽ không thực hiện bước xác nhận token. Sau khi sửa cấu hình, gửi email xác nhận mới vì link trong email cũ không tự đổi.
4. Thử đăng ký bằng email test, xác nhận email rồi đăng nhập. User object trả về khi signup chưa chứng minh đã có phiên; UI chỉ coi là đăng nhập khi SDK trả session. Luồng email thật trên cloud vẫn cần lead kiểm tra.

Kiểm tra số tài khoản chưa có hồ sơ sau khi áp dụng migration:

```sql
select count(*)
from auth.users a
left join public.users u on u.id = a.id
where u.id is null;
```

Mong đợi kết quả bằng 0. `get_my_profile` vẫn giữ bước tạo hồ sơ dự phòng, gọi lại không đặt lại quyền. Kiểm tra RLS/grants: client chỉ đọc hồ sơ mình và không sửa trực tiếp `users`; schema `private` không được expose. RPC admin phải kiểm tra ADMIN/ACTIVE ở server. Quyền ADMIN trong ứng dụng khác quyền quản trị project trên Supabase Dashboard.

### Lỗi P2 còn mở: duyệt hồ sơ đã thay đổi

Auth hiện có lỗi được ghi nhận trong lần review ngày 20/10/2026: admin có thể duyệt phiên bản hồ sơ chưa từng xem. Việc gom tài liệu không sửa lỗi này; owner Auth/lead cần xử lý trước khi nghiệm thu luồng duyệt.

Cách tái hiện:

1. Admin mở hồ sơ có minh chứng A.
2. User đổi minh chứng thành B; backend đưa trạng thái về PENDING.
3. Admin vẫn nhìn A nhưng bấm duyệt. `AdminPage.tsx` chỉ gửi `{uid, kind, decision, reason}`.
4. `admin_review_user` khóa và duyệt dòng hiện tại chứa B, dù admin chưa xem B. Đổi xe trước khi duyệt DRIVER cũng gặp vấn đề tương tự.

Khóa dòng trong transaction chưa ràng buộc quyết định với dữ liệu admin đã xem. Hướng sửa: gửi snapshot hoặc phiên bản hồ sơ trong yêu cầu duyệt, đối chiếu sau khi khóa dòng; nếu đã đổi thì trả PT409 và yêu cầu admin tải lại. Chỉ tải lại ở UI chưa đủ để chặn thay đổi xen giữa lúc xem và lúc duyệt.

Owner Auth cần cập nhật đồng bộ schema input, payload UI, RPC và test hồi quy cho STUDENT/DRIVER, cả duyệt lẫn từ chối. Nếu thêm cột phiên bản, tạo migration mới sau khi nhóm thống nhất; không sửa migration đã áp dụng. Các test đang PASS không phủ nhận lỗi này. Test Supabase integration vẫn cần Docker; test PGlite không thay thế kiểm thử token/email/PostgREST thật.

### Cấp ADMIN đầu tiên

ADMIN đầu tiên không được tạo qua form hoặc lấy từ metadata. Sau khi đã review schema và chọn đúng Auth ID của tài khoản tin cậy, lead có thể cấp bằng SQL trong môi trường được giao quản trị:

```sql
-- Thay UUID_DEMO bằng đúng Auth user ID; user cần đăng nhập mở hồ sơ trước.
update public.users
set roles = array['USER', 'ADMIN']::text[]
where id = 'UUID_DEMO'::uuid;
```

Không chạy đoạn này với uid do user tùy ý gửi; không đưa service_role key vào frontend. Lần triển khai code này không thực hiện thao tác trên server hoặc cấp ADMIN thật.

Nguồn đối chiếu: [Supabase signUp](https://supabase.com/docs/reference/javascript/auth-signup), [sự kiện phiên Auth](https://supabase.com/docs/reference/javascript/auth-onauthstatechange), [PGlite](https://pglite.dev/docs/).
