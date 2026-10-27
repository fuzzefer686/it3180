# Đăng ký, đăng nhập và tự trở về trang chủ Về Cùng

Yêu cầu hiện hành ngày 27/10/2026: đăng ký/đăng nhập thành công tự mở **`/chuyen-di` trên chính website đang dùng**. Ví dụ mở form ở `https://feat-4-booking.it3180.pages.dev` thì tiếp tục dùng nhánh Booking; mở từ localhost thì ở lại localhost. Thay thế yêu cầu cũ ép chuyển mọi phiên về một domain Pages cố định.

## 1. Luồng hiện tại

1. Frontend gọi Supabase Auth SDK bằng email/mật khẩu, không kiểm tra rồi chặn signup vì Confirm email đang bật.
2. Signup có user nhưng chưa có session là bước **chờ xác minh email**, không phải đăng ký thất bại. Web nhắc mở email và có nút gửi lại.
3. Nếu server trả session ngay, hoặc sau khi xác minh SDK nhận được user, web tự chuyển tới `/chuyen-di`.
4. Login thành công phải trả cả user/session; web chờ SDK cập nhật phiên rồi tự mở `/chuyen-di`, không cần nút Tiếp tục. Việc SDK phát user trước khi signUp trả kết quả không làm chuyển trang quá sớm.
5. Người đã đăng nhập vẫn có thể chủ động mở `/tai-khoan` để xem/sửa hồ sơ; chỉ có hành động Auth thành công hoặc callback mới tự chuyển trang.
6. Link hết hạn/lỗi xác minh hiển thị thông báo an toàn, không lộ token hoặc mô tả lỗi thô. Login tài khoản chưa xác minh cho gửi lại email.

Callback email do `authEmailRedirectUrl()` tạo từ `window.location.origin` và đường dẫn `/tai-khoan`. Signup và resend dùng cùng cách này; không lấy domain từ query, router state hoặc form nhập liệu.

Sau Auth thành công, web chuyển nội bộ tới `/chuyen-di`. Phiên vẫn do SDK quản lý ở website hiện tại; ứng dụng không ghép access token/refresh token vào URL để chuyển sang website khác. Callback email vẫn do SDK nhận phiên và xóa token khỏi URL.

Auth SDK quản lý token/mật khẩu. Bảng `public.users` lưu hồ sơ và quyền/trạng thái, cùng ID với `auth.users`; không chứa mật khẩu. Trigger và RPC trong hai migration Auth giữ nguyên. Đăng nhập không tạo lại tài khoản mỗi lần.

## 2. Code đã sửa

- Xóa `requireImmediateSignup` và các test chỉ kiểm tra việc chặn signup khi Confirm email bật.
- `AuthPage.tsx` gọi `signUp` trực tiếp với `emailRedirectTo`, phân biệt có phiên/chờ xác minh và giữ thông báo/lỗi thực tế.
- `auth-redirect.ts` lấy origin hiện tại cho callback email, giữ đường dẫn thành công nội bộ, nhận biết callback và lọc mã lỗi.
- `signInWithPassword` thành công nhưng thiếu session/user không được coi là đăng nhập hoàn tất.
- Resend giữ email đã đăng ký, không lấy nhầm email vừa sửa trong form. Rate limit/lỗi gửi email được hiển thị, không báo gửi thành công giả.
- Lỗi `email_address_not_authorized` nhắc cấu hình dịch vụ gửi email; không đổ lỗi cho người dùng hoặc giả tạo tài khoản thành công.
- Supabase client vẫn dùng cloud theo env; guard build localhost giữ nguyên. Không đổi shared contract, schema, quyền, transaction hoặc logic Trip/Booking/ví.

## 3. Cấu hình server cần khớp

Đây là các điều kiện server, không tự thay đổi khi sửa React hoặc push Git.

### Bước 1 — Email/password và signup, khoảng 1–2 phút

Đúng project Supabase mà frontend dùng phải bật Email provider và cho phép tài khoản mới đăng ký. **Confirm email có thể bật hoặc tắt** theo chính sách nhóm; frontend hỗ trợ cả hai, không bắt buộc tắt để gửi yêu cầu signup.

Nếu bật xác minh, Supabase cần gửi email được tới người kiểm thử. Dịch vụ email mặc định có giới hạn người nhận và tần suất; muốn dùng địa chỉ ngoài nhóm có thể cần cấu hình custom SMTP. Lỗi SMTP/quota không thể sửa bằng cách đổi giao diện hoặc bỏ kiểm tra phản hồi.

### Bước 2 — callback về đúng website, khoảng 2 phút

Vào **Authentication → URL Configuration**:

- Site URL: URL mặc định của project do lead chốt; không cần đổi theo từng nhánh.
- Redirect URLs: thêm callback của từng website được nhóm dùng, ví dụ `https://feat-4-booking.it3180.pages.dev/tai-khoan`, `https://it3180.pages.dev/tai-khoan`, `http://127.0.0.1:5173/tai-khoan` và `http://localhost:5173/tai-khoan`.
- Không xóa các URL khác mà nhóm còn dùng.
- Template Confirm signup dùng liên kết `{{ .ConfirmationURL }}` để Supabase xác minh rồi chuyển về callback; không thay bằng liên kết trang web thuần khiến bước xác minh bị bỏ qua.

Nếu callback không được allowlist chấp nhận, Supabase có thể dùng Site URL mặc định. Frontend không có quyền ghi đè cấu hình đó. Tạo email mới/gửi lại sau khi sửa cấu hình; email cũ giữ đường dẫn đã tạo trước đó.

### Bước 3 — dữ liệu hồ sơ, chỉ dành cho lead

Giữ quy trình [cập nhật Supabase server](../../../../docs/supabase-lead.md). Đối chiếu schema/history rồi áp dụng migration đã review; không reset remote hoặc chạy CREATE TABLE chồng lên bảng đã tồn tại.

- `20261022000100_auth_existing_schema.sql`: RPC hồ sơ và quyền trên bảng users của baseline.
- `20261022000200_auth_signup_existing_schema.sql`: trigger tạo hồ sơ cùng transaction với Auth, backfill giữ quyền/trạng thái đã có.
- `get_my_profile` giữ bootstrap dự phòng, idempotent. Phải đọc bảng trước RPC khi kiểm tra trigger để tránh bootstrap che lỗi.
- Lỗi ghi hồ sơ phải rollback Auth insert. Không mở quyền client tự insert/upsert hoặc tự cấp role.

## 4. Chạy và thử

Tại gốc repo, chạy `npm.cmd run dev:web` rồi mở `/tai-khoan`. Dùng tài khoản test của đúng Supabase cloud; địa chỉ giao diện local không phải địa chỉ backend Auth.

1. **2 phút:** Đăng ký email test mới. Có session thì tự tới `/chuyen-di` trên website đang mở; chưa có session thì hiện hướng dẫn xác minh và nút gửi lại, không báo lỗi thiếu phiên.
2. **2–5 phút:** Mở link xác minh mới. Trình duyệt về callback trên website đã gửi đăng ký, SDK nhận phiên, sau đó tự mở `/chuyen-di`. Reload vẫn giữ phiên.
3. **2 phút:** Đăng xuất rồi đăng nhập đúng/sai mật khẩu; đúng phải tự chuyển trang chủ trên cùng domain và reload vẫn có phiên, sai phải giữ form và hiện lỗi. Tài khoản chưa xác minh có nút gửi lại.
4. **2 phút:** Chủ động mở lại Tài khoản, lưu thông tin mẫu rồi đối chiếu `public.users`. Không đưa giấy tờ thật vào repo/test.

Kiểm tra code bằng Node 22 từ 22.12:

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd test -- --maxWorkers=1
```

Unit test mô phỏng SDK để kiểm tra luồng giao diện và callback, kèm test SQL nhúng về quyền/trigger/rollback. Test `auth-redirect.test.ts` dùng SDK thật với HTTP giả lập để kiểm tra xác minh user, lưu phiên ở origin preview và xóa fragment; không gọi cloud. Supabase integration thật cần Docker: `npm.cmd run test:integration`; test này chỉ gọi local, không dùng cloud hay VietMap. Chưa chạy được thì ghi BLOCKED, không ghi PASS.

## 5. Giới hạn kiểm chứng

Không coi unit/build PASS là đăng ký email thật hoặc đăng nhập cloud đã được xác minh. Không có phiên quản trị server trong môi trường sửa code nên chưa sửa Auth settings, template, allowlist hoặc áp dụng migration online. Bản sửa chưa được push/deploy trong lượt này.

Nguồn: [Supabase signUp](https://supabase.com/docs/reference/javascript/auth-signup), [implicit flow](https://supabase.com/docs/guides/auth/sessions/implicit-flow), [redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [email templates](https://supabase.com/docs/guides/auth/auth-email-templates), [SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
