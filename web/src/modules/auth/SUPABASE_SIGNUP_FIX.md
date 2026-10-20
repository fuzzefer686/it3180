# Sửa luồng đăng ký, xác minh email và tạo hồ sơ — 20/10/2026

## 1. Yêu cầu từ phản hồi kiểm thử

Ba việc cần đạt trên `https://feat-auth.it3180.pages.dev/`:

1. Đăng ký xong thấy thông báo rõ ràng yêu cầu mở email xác minh, nếu server bật Confirm Email.
2. Link xác nhận quay về `https://feat-auth.it3180.pages.dev/tai-khoan`, không quay về localhost khi đăng ký từ website này.
3. Tài khoản mới có dòng tương ứng trong `public.users` ngay khi Auth tạo tài khoản, để các module khác có uid/hồ sơ; không chờ user xác minh hoặc đăng nhập rồi mới tạo.

## 2. Code đã sửa

- [AuthPage.tsx](./AuthPage.tsx): thông báo đăng ký đặt ở đầu trang, bên ngoài form login và nhánh hiển thị tài khoản. Thông báo còn hiển thị khi nhập tiếp vào form hoặc SDK phát sự kiện đăng nhập trước khi `signUp` trả về.
- Khi chưa có session: hiển thị “Kiểm tra email để xác minh tài khoản”, địa chỉ đã nhập và nhắc kiểm tra thư rác. Câu chữ không tiết lộ email đã tồn tại hoặc khẳng định email chắc chắn được gửi khi Supabase trả kết quả ẩn thông tin tài khoản.
- Có nút gửi lại email bằng `supabase.auth.resend`; gửi lại dùng email đã đăng ký, không lấy nhầm địa chỉ mới nhập trong form login. Lỗi/rate limit được hiển thị, không báo thành công giả.
- Khi server cho phép session ngay: báo tài khoản đã sẵn sàng, không giả vờ đang chờ xác minh. Khi phiên của đúng email được xác nhận, thông báo chuyển sang “Email đã được xác nhận”.
- Cả đăng ký và gửi lại đều dùng `emailRedirectTo: window.location.origin + '/tai-khoan'`. Không cố định localhost trong frontend, cũng không cố định domain preview cho mọi môi trường.
- [Migration mới](../../../../supabase/migrations/20261020130000_auth_signup_profile.sql) tạo trigger `auth_create_app_profile` trên `auth.users`. Trigger dùng ID do Auth server tạo, cấp USER/ACTIVE/PENDING; không đọc role/status từ metadata hoặc nhận uid do frontend tự khai.
- Migration bù dòng `public.users` còn thiếu cho tài khoản đã tồn tại. `ON CONFLICT DO NOTHING` giữ nguyên hồ sơ và quyền/trạng thái hiện có, gồm LOCKED/ADMIN/DRIVER. Không tạo ví hoặc cấp điểm demo.
- Trigger chạy trong cùng transaction với Auth insert. Nếu ghi hồ sơ lỗi, Auth insert phải rollback, không trả thành công nửa chừng. `get_my_profile` vẫn giữ bootstrap idempotent để tương thích tài khoản cũ hoặc trường hợp hồ sơ bị thiếu.

**Ảnh hưởng module khác:** không đổi API/DTO trong `shared`, không mở quyền client trực tiếp với bảng users. Chỉ bổ sung helper private/trigger và các dòng hồ sơ mặc định. User chờ xác minh email vẫn PENDING, chưa đủ eligibility; Trip/Booking vẫn cần kiểm tra ACTIVE và VERIFIED tại server. Owner 5 vẫn phụ trách khởi tạo ví riêng.

## 3. Admin cần cập nhật Supabase để hết redirect localhost

### Bước 1 — URL Configuration, khoảng 5 phút

**Cần làm:** mở Dashboard đúng project Supabase đang được website preview dùng, vào **Authentication → URL Configuration**.

- Site URL: dùng URL chính mà nhóm đã chốt, không để localhost cho server dev online. Nếu project này dành riêng cho website test trên, đặt `https://feat-auth.it3180.pages.dev`.
- Thêm chính xác Redirect URL: `https://feat-auth.it3180.pages.dev/tai-khoan`.
- Giữ các URL frontend khác mà nhóm thực sự dùng. Nếu cần phát triển local, thêm riêng `http://127.0.0.1:5173/tai-khoan` và `http://localhost:5173/tai-khoan`; không lấy chúng làm URL mặc định của website online.

**Kết quả mong đợi:** Supabase chấp nhận `emailRedirectTo` mà frontend gửi. Nếu URL không nằm trong danh sách cho phép, link có thể dùng Site URL mặc định và tiếp tục quay về localhost.

**Lưu ý:** `supabase/config.toml` của repo phục vụ local và hiện vẫn để Site URL local đúng mục đích. Sửa file local hoặc push code không tự đổi Auth settings trong Dashboard server.

### Bước 2 — email provider và template, khoảng 5–10 phút

**Cần làm:** bật Email/password và Confirm Email theo yêu cầu test; kiểm tra email xác minh gửi được. Nếu template đã sửa, link xác nhận cho React/Vite hiện tại dùng mẫu mặc định có token:

```html
<h2>Xác nhận đăng ký Về Cùng</h2>
<p>Nhấn liên kết dưới đây để xác minh email của bạn.</p>
<p><a href="{{ .ConfirmationURL }}">Xác minh email</a></p>
```

**Kết quả mong đợi:** link đi qua Supabase Auth để xác minh token, rồi trả về URL đã được cho phép ở bước 1. Không dùng link trực tiếp `{{ .SiteURL }}` hoặc `{{ .RedirectTo }}` thay cho bước xác minh. Không dùng template yêu cầu route `/auth/confirm` nếu app chưa có handler đó.

**Lỗi thường gặp:** link email đã gửi trước khi đổi settings vẫn mang địa chỉ cũ. Sau khi frontend mới và settings được cập nhật, dùng “Gửi lại email xác minh” hoặc đăng ký tài khoản test mới để kiểm tra link mới. Kiểm tra thư rác, log gửi email và lỗi giới hạn tần suất nếu chưa nhận được.

### Bước 3 — áp dụng trigger/backfill, khoảng 10–15 phút sau review

**Cần làm:** đối chiếu bảng `public.users` hiện có với schema Auth của repo rồi review/apply migration **`20261020130000_auth_signup_profile.sql`**. Xem [quy trình dành cho lead](../../../../docs/supabase-lead.md).

- Migration mới chỉ thêm trigger/helper và bù dữ liệu; không tạo lại bảng users.
- Migration nền `20261020090000_auth_profiles.sql` có CREATE TABLE. Server đã có bảng phải giải quyết baseline/history trước; không chạy lại CREATE TABLE, không reset remote hoặc dùng repair để bỏ qua phần SQL chưa áp dụng.
- Đối chiếu trigger cũ trên `auth.users` để tránh một trigger cũ khác lấy role từ metadata hoặc làm signup thất bại. Không tự xóa trigger của module khác khi chưa review.
- Với môi trường local có Docker, chạy tại **gốc repo**: `npm.cmd run test:integration`. Script áp dụng các migration local còn thiếu. Không thử migration bằng cách sửa tay trên server chung trước khi review.

**Kết quả mong đợi:** trigger tạo dòng mặc định đúng UUID ngay sau Auth insert; không phụ thuộc session frontend, email đã xác nhận hay RPC `get_my_profile` đã được gọi.

**Kiểm tra metadata ở SQL Editor** — chỉ đọc:

```sql
select t.tgname, pg_get_triggerdef(t.oid) as definition
from pg_trigger t
where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal;

select count(*) as missing_profile_count
from auth.users a left join public.users u on u.id = a.id
where u.id is null;
```

Sau migration, cần thấy `auth_create_app_profile` và `missing_profile_count = 0` ở thời điểm kiểm tra. Account có Auth user nhưng thiếu hồ sơ trước đó được backfill; hồ sơ đã có không bị sửa. Nếu signup báo “Database error saving new user”, kiểm tra constraint/cột/trigger và log SQL trước, không nuốt lỗi rồi trả thành công.

## 4. Test và kiểm tra trên website

### Kiểm tra code trước — khoảng 1–2 phút, tại gốc repo

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd test
npm.cmd run test:integration
```

Unit test mới kiểm tra banner/session/redirect URL trên domain preview, gửi lại email và rate limit; test SQL kiểm tra trigger, backfill, giữ quyền/status, quyền của Auth service, chống tự cấp quyền và rollback khi lỗi. Integration bổ sung kiểm tra hồ sơ tồn tại **trước** RPC bootstrap và trường hợp Auth user chưa xác minh email.

PostgreSQL nhúng không thay cho Auth/PostgREST/email thật. Nếu thiếu Docker, integration phải ghi BLOCKED, không ghi PASS.

### Kiểm thử dev — khoảng 10–15 phút, sau khi code và settings đã được cập nhật

1. Mở `https://feat-auth.it3180.pages.dev/tai-khoan`, đăng ký bằng email test do người kiểm thử kiểm soát. Khi Confirm Email bật, phải thấy banner xác minh và nút gửi lại; nhập tiếp vào form không làm mất banner.
2. Chưa nhấp email, admin kiểm tra tài khoản test đã có trong **Auth Users** và `public.users`, cùng UUID, roles USER, status ACTIVE, xác minh sinh viên/driver PENDING. Chưa có ví tự tạo.
3. Mở link email mới. Kiểm tra quay về domain `feat-auth.it3180.pages.dev`, đường dẫn `/tai-khoan`; SDK xử lý phiên và tải được hồ sơ, không tạo dòng trùng.
4. Thử gửi lại email một lần khi cần; nếu server rate limit thì phải thấy lỗi, không thông báo đã gửi thành công. Sau khi phiên xác nhận được đồng bộ, không tiếp tục yêu cầu gửi lại.
5. Kiểm tra một hồ sơ LOCKED/ADMIN/DRIVER có sẵn giữ nguyên sau backfill và sau khi gọi lại bootstrap. Không cấp ADMIN thật hoặc dùng giấy tờ thật để test.

## 5. Giới hạn và phần vẫn còn

- Đã đọc được HTML website test và JavaScript công khai qua HTTP GET. Bản đang chạy có `emailRedirectTo` dùng `window.location.origin`; chưa kết luận Dashboard/email template hiện đang cấu hình cụ thể ra sao.
- Môi trường này không có trình duyệt kết nối để thao tác website; không tạo tài khoản hoặc gửi email thật trên cloud. Test frontend/SQL chạy local; kết quả cuối cùng ghi tại [validation](../../../../docs/validation.md).
- Code/migration mới chưa được phiên làm việc này push, deploy hoặc áp dụng lên Supabase server. Lead cần thực hiện theo các bước trên; sửa frontend một mình không đổi Site URL/allowlist của Supabase.
- Lỗi P2 về admin duyệt phiên bản hồ sơ cũ trong [biên bản review](./SUPABASE_ADMIN_REVIEW.md) vẫn là task riêng; bản sửa signup này không sửa contract duyệt.

Nguồn đối chiếu: [Supabase User Management/trigger](https://supabase.com/docs/guides/auth/managing-user-data), [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [lỗi redirect sai URL](https://supabase.com/docs/guides/troubleshooting/why-am-i-being-redirected-to-the-wrong-url-when-using-auth-redirectto-option-_vqIeO), [gửi lại email](https://supabase.com/docs/reference/javascript/auth-resend).
