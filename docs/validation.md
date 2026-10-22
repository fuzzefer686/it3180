# Kiểm chứng Supabase Auth và hồ sơ

## Sửa đích về domain Pages, xác định lỗi nằm ở link email — 22/10/2026

- Người dùng chốt website **`https://feat-auth.it3180.pages.dev`**, trang sau Auth **`/chuyen-di`**, và xác nhận localhost xuất hiện **khi mở link xác minh trong email**. Các URL trong email đã phát hành không tự đổi khi sửa code. Cần phân biệt đường dẫn Supabase tạo với điều hướng sau khi app đã nhận phiên.
- `AuthPage` trước đây dùng đường dẫn tương đối `/chuyen-di`, giữ origin hiện tại. Nay nếu origin khác domain đã chốt, lấy phiên bằng SDK, kiểm tra đúng uid rồi `location.replace` sang URL Pages cố định với fragment implicit. SDK đích xác minh user, lưu phiên theo origin mới và xóa fragment. Trên đúng domain vẫn chuyển nội bộ; không nhận URL đích từ query/state hoặc gửi mật khẩu trong callback.
- Signup và resend tiếp tục dùng callback tuyệt đối **`https://feat-auth.it3180.pages.dev/tai-khoan`**. Các bài test kiểm tra cả hai lời gọi; callback ở localhost đã nhận phiên cũng được đưa về domain Pages. Lỗi/thiếu phiên/khác uid không chuyển phiên.
- Typecheck **PASS**, build **PASS**, **76/76 unit test PASS**, 6 file trên Node **24.21.0**. Test mới gồm login/signup từ localhost và origin khác, callback local, lỗi SDK/uid; dùng SDK thật với HTTP giả lập để xác minh nhận user, lưu phiên ở origin Pages và xóa fragment. Sau khi bổ sung assertion URL tuyệt đối, riêng `auth.test.ts` **11/11 PASS**. Chưa chạy bằng Node 22 mà repo yêu cầu. Không thay đổi backend, không chạy lại integration đang BLOCKED do thiếu Docker.
- Đọc HTML/asset công khai của website: HTTP **200**, bundle online vẫn là **`index-DfbvxnOI.js`**, còn phụ thuộc origin hiện tại và không chứa domain callback cố định. Bản build kiểm tra mới **`index-G0NmdbZm.js`** có domain Pages, route chuyến đi và URL Supabase cloud đúng; không suy diễn rằng bản sửa đã được deploy. Đã dọn thư mục build tạm `.task-auth-domain-20261022` với **24 file** sau QA.
- Môi trường không có Supabase access token/service-role hoặc Cloudflare token; chưa đọc/sửa Site URL, allowlist hoặc template online. Phần email còn cần đúng cấu hình server: Site URL **`https://feat-auth.it3180.pages.dev`**, Redirect URLs chứa **`https://feat-auth.it3180.pages.dev/tai-khoan`**, template dùng `{{ .ConfirmationURL }}`. Cần deploy frontend mới và gửi lại email mới sau khi cập nhật; không thể sửa link đã nằm trong email cũ từ frontend.
- Không gửi email/tạo tài khoản cloud, không push/deploy, không sửa schema, shared contract, RLS/grants hoặc quyền Trip/Booking/ví. Các mục tiếp theo là lịch sử, không thay cho kết quả và giới hạn hiện tại. Hướng dẫn: [Auth/callback/database](../web/src/modules/auth/SUPABASE_SIGNUP_FIX.md); nguồn chính thức [implicit flow](https://supabase.com/docs/guides/auth/sessions/implicit-flow), [redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).

## Luồng hiện hành: đăng ký/login thành công tự mở trang chủ — 22/10/2026

- Theo yêu cầu cuối cùng, đích thành công là **`/chuyen-di`**. Các mục bên dưới ghi lịch sử thay đổi; yêu cầu bắt buộc tắt email và yêu cầu giữ trang tài khoản đã được thay thế.
- Bỏ `requireImmediateSignup` từng chặn đăng ký khi Confirm email bật. Signup gọi SDK trực tiếp; có user nhưng chưa có session là **chờ xác minh**, có hướng dẫn và nút gửi lại, không trả lỗi thiếu phiên hoặc yêu cầu liên hệ admin. Signup có phiên ngay, login hợp lệ hoặc callback nhận được phiên thì tự chuyển trang chủ, không cần bấm Tiếp tục. Người dùng vẫn có thể chủ động mở Tài khoản để quản lý hồ sơ.
- Signup/resend dùng cùng URL **`https://feat-auth.it3180.pages.dev/tai-khoan`**. Trang callback nhận phiên qua SDK rồi chuyển nội bộ tới `/chuyen-di`; callback hết hạn/lỗi báo thông báo an toàn. Resend dùng email đã đăng ký, không lấy nhầm email vừa sửa trên form. Lỗi gửi email/rate limit/email trùng/database không báo thành công giả.
- Login phải trả user/session và chờ SDK cập nhật user; không chuyển trang quá sớm khi SDK phát user trước lúc signUp trả về. Destination cố định trong app, không lấy URL bên ngoài từ query/state. Supabase Auth/RPC vẫn dùng cloud theo env; build guard localhost giữ nguyên. Không đổi shared contract, schema hay quyền của module khác.
- Trước lúc lượt làm việc bị ngắt quota: Node **24.21.0**, typecheck **PASS**, build online **PASS**, **67/67 unit test PASS**, 5 file. Gồm test signup có/không có phiên, gửi lại email, login lỗi/thiếu phiên, callback hợp lệ/hết hạn, chuyển trang tự động, phiên/hồ sơ và SQL/quyền/trigger/rollback. Sau khi tiếp tục đã rà lại code và artifact, cập nhật ghi chú cấu hình/tài liệu; không thay đổi logic đã kiểm thử hoặc chạy lặp lại các test này. Repo yêu cầu Node 22; chưa kiểm chứng lượt này bằng Node 22.
- Backend không thay đổi; không chạy lại integration. Kết quả integration trước vẫn BLOCKED do Docker. Chưa thử đăng ký/login bằng tài khoản cloud hoặc nhận email thật, chưa đọc/sửa allowlist/template/SMTP của server, chưa push/deploy. Server cần gửi email được và cho phép callback nếu bật xác minh; unit/build không xác nhận các điều kiện server này.
- Đã kiểm tra bundle có đúng Supabase online/callback/trang đích và không còn thông báo chặn signup do Confirm email; build output tạm được dọn sau kiểm tra. Hướng dẫn hiện hành: [Auth/callback/database](../web/src/modules/auth/SUPABASE_SIGNUP_FIX.md).

## Sửa hướng dẫn vị trí Confirm email trên Dashboard — 22/10/2026

- Người dùng không thấy Confirm email khi làm theo hướng dẫn mở Email provider. Đã đối chiếu mã nguồn công khai Supabase Dashboard: `BasicAuthSettingsForm.tsx` đặt Confirm email trong **User Signups** trên trang chính **Authentication → Sign In / Providers**, nút lưu là **Save changes**; `AuthProvidersFormValidation.tsx` không có Confirm email trong bảng Email.
- Sửa hướng dẫn module Auth: đóng bảng Email nếu đang mở, quay lại trang chính, tìm User Signups/Confirm email, giữ Allow new users to sign up bật. Không đổi code nghiệp vụ, Auth settings, migration hoặc quyền trên server trong lượt này.

## Đăng ký báo liên hệ admin: xác minh nguyên nhân server — 22/10/2026

- Người dùng báo vẫn lỗi gửi email và không đăng ký được. Hai lần GET `/auth/v1/settings` của project `wrvcvxirfwxgkaranlgk` trong lượt này đều trả `mailer_autoconfirm=false`, `disable_signup=false`; Email provider vẫn bật. Vì Confirm email chưa tắt, Auth không trả phiên ngay khi signup. Các sửa frontend trước chưa hoàn thành thay đổi cấu hình trên server.
- Chưa có quyền đổi cấu hình online: inventory trình duyệt không có browser kết nối; Supabase CLI trả `Access token not provided`; không có Supabase access token/service-role/database password trong environment. Không xin hoặc in credential trong chat. Chưa sửa Dashboard, gọi Management API ghi cấu hình hay áp dụng SQL trên cloud.
- Frontend nay đọc cấu hình public bằng publishable key, không cache, trước signup. Confirm email còn bật thì dừng trước lời gọi signup để tránh gửi email/tạo tài khoản chờ xác minh; thông báo chỉ rõ cần tắt Confirm email và Save trên đúng project. Login bằng mật khẩu không bị kiểm tra signup chặn. Lỗi tài khoản cũ chưa xác nhận được phân biệt với lỗi cấu hình đăng ký mới.
- User cần cập nhật Email provider trên Dashboard rồi phản hồi để kiểm tra lại; không thể dùng publishable key để thay quyền quản trị. Probe chỉ đọc `public.users` với `limit=0` trả HTTP 401/code 42501 (không được đọc trực tiếp bằng key public); kết quả này không xác minh trigger, RPC hoặc tài khoản mới đã được lưu.
- Node **24.21.0**: typecheck **PASS**, build online **PASS**, unit **64/64 PASS**, 6 file. Test mới kiểm tra settings hợp lệ, Confirm email, provider/signup bị tắt, payload thiếu/sai, HTTP/network lỗi, không gọi signup khi chưa sẵn sàng và retry kiểm tra lại cấu hình; vẫn giữ test SQL/quyền/rollback trước đó. Không gửi signup/email thật hoặc dùng tài khoản cloud để login trong lượt này.
- Dọn build output tạm sau kiểm tra. Lượt CLI ban đầu bị chặn ghi telemetry ngoài workspace; đường dẫn file tạm chính xác được kiểm tra và không tồn tại. Chưa đủ điều kiện báo đã sửa xong đăng ký trên cloud khi `mailer_autoconfirm` vẫn false.

## Đăng nhập giữ trang tài khoản, dữ liệu ở cloud — 22/10/2026

- Theo yêu cầu làm rõ: đăng nhập xong giữ `/tai-khoan` trên website, hiện “Bạn đã đăng nhập.” và tài khoản/hồ sơ. Bỏ tự điều hướng về trang riêng tư trước đó; nút Tiếp tục chỉ đổi trang khi người dùng chủ động bấm. Đăng ký cũng giữ trang tài khoản như trước.
- Giữ lời gọi `signInWithPassword` tới Supabase online và tải hồ sơ qua `get_my_profile`; không điều hướng trình duyệt tới domain Supabase. Đăng nhập không tạo lại tài khoản, không ghi mật khẩu vào public.users. Không đổi shared contract, schema, quyền hoặc endpoint của các module khác.
- Node **24.21.0**: typecheck **PASS**, build bằng cấu hình online **PASS**, **29/29 test UI/phiên PASS** (2 file). Test điều hướng thực hiện submit login, nhận phiên, kiểm tra vẫn hiện trang tài khoản/email rồi chỉ sang ví khi bấm Tiếp tục. Các kiểm tra SQL/backend không chạy lại vì lượt này chỉ đổi giao diện/điều hướng.
- Đã dọn build output tạm. Chưa push/deploy hoặc đổi cấu hình Auth server; các điều kiện tắt Confirm email và migration server của các mục trước vẫn cần được thực hiện khi cập nhật online.

## Frontend gọi Supabase online, chặn localhost khi build — 22/10/2026

- Đọc lại HTML/JavaScript công khai `https://feat-auth.it3180.pages.dev/tai-khoan`: HTTP **200**, asset `index-DfbvxnOI.js`, có lời gọi `auth.signInWithPassword`, cấu hình project `https://wrvcvxirfwxgkaranlgk.supabase.co`, không thấy origin Auth localhost:54321. Website vẫn dùng bản signup cũ (chưa có `signup_session_missing`); bản sửa trong repo chưa được phiên này triển khai.
- Đối chiếu SDK đang cài: đăng nhập email/password gửi POST `/auth/v1/token?grant_type=password` tới URL Supabase đã cấu hình. Chưa gửi request đăng nhập thật hoặc xác nhận tài khoản test thành công.
- GET `/auth/v1/settings` của đúng project, dùng publishable key từ bundle công khai: HTTP **200**, `external.email=true`, `disable_signup=false`, **`mailer_autoconfirm=false`**. Server vẫn yêu cầu xác minh email khi đăng ký mới; sửa frontend không tự tắt cấu hình này. Chưa sửa Auth settings online.
- Tạo `web/.env.local` bằng URL/publishable key của chính website đang chạy; key không in ra log, file được Git ignore. Frontend dev trên máy nay có cấu hình cùng Supabase online. Không chứa service-role/secret key.
- Thêm kiểm tra build trong `web/vite.config.ts` và kiểm tra client bản phát hành: localhost/loopback bị từ chối. Supabase Docker local vẫn dùng trong dev/test. Config dùng chung ảnh hưởng mọi module gọi Supabase; không đổi shared contract hoặc database. CI cung cấp URL `.invalid` và key mẫu chỉ để kiểm tra build, integration vẫn lấy cấu hình Docker local và không gọi cloud.
- Kiểm chứng Node **24.21.0**: typecheck **PASS**, **58/58 unit test PASS** (5 file), build thật với URL localhost **bị chặn đúng yêu cầu**, build bằng cấu hình online **PASS**. Bundle mới chứa đúng project online, không có origin Auth local. Không cần chạy lại integration cho guard frontend; integration lượt trước vẫn BLOCKED do Docker, không tính PASS. Repo yêu cầu Node 22; lượt này chưa kiểm tra Node 22.
- Build output được tạo trong thư mục tạm riêng rồi dọn sau kiểm tra. Giữ file env cấu hình sử dụng thực tế; không push/deploy hoặc sửa Dashboard trong lượt này.

## Đăng ký không cần xác minh email, có hồ sơ database — 22/10/2026

- Yêu cầu mới thay thế luồng xác minh/redirect bên dưới: signup chỉ gửi email/mật khẩu, không gửi redirect hay gửi lại email. Chỉ báo tài khoản sẵn sàng khi SDK có phiên và đã tải được hồ sơ đúng uid; thiếu phiên/RPC lỗi/email trùng không báo thành công giả.
- Giữ trigger và backfill trong `20261020130000_auth_signup_profile.sql`: tạo `public.users` cùng transaction với Auth, mặc định USER/ACTIVE/PENDING, không tin metadata, giữ quyền/trạng thái đã có. Không sửa migration cũ, schema hay shared contract. Email/password vẫn thuộc Auth; thông tin hồ sơ lưu qua `update_my_profile` vào bảng users.
- Local đã có `enable_confirmations = false`; thêm giải thích rõ đây không phải cấu hình server online. [Hướng dẫn mới](../web/src/modules/auth/SUPABASE_SIGNUP_FIX.md) yêu cầu tắt Confirm email trên đúng project dev, đối chiếu migration history rồi cập nhật trigger/RPC qua quy trình lead. Thay đổi này áp dụng mọi đăng ký email/mật khẩu cùng project; không bỏ duyệt sinh viên/driver hoặc kiểm tra quyền của module 3/4/5.
- Node đang cài **24.21.0**: `npm.cmd run typecheck` **PASS**, build frontend vào thư mục tạm **PASS**, `npm.cmd test -- --maxWorkers=1` **57/57 PASS**, 5 file. Test SQL nhúng vẫn kiểm tra trigger/backfill/grants/rollback. Repo yêu cầu Node 22; lượt này chưa xác minh bằng Node 22. Build còn cảnh báo bundle JavaScript khoảng 608 kB.
- Bổ sung integration đăng ký bằng SDK nhận phiên ngay, kiểm tra dòng users **trước RPC bootstrap**, lưu thông tin hồ sơ vào bảng, logout/login và đăng ký trùng không thêm dòng. Bộ integration hiện có **7 test**. Đã thử `npm.cmd run test:integration`: **BLOCKED**, cần cài/mở Docker Desktop; chưa chạy các test này. Lượt đầu trong sandbox còn lỗi `uv_os_get_passwd`; chạy ngoài sandbox đã tới được kiểm tra Docker và xác nhận Docker không khả dụng.
- Chưa sửa Dashboard, áp dụng migration lên server hoặc push/deploy frontend. Kết quả unit/build không được tính là đã kiểm chứng website online; tài khoản cũ chưa xác nhận cần quản trị viên kiểm tra, frontend không tự xác nhận.

Các mục ngày 21/10 và trước đó là lịch sử, không phải cấu hình signup hiện hành.

## Cố định domain trả về khi xác minh email — 21/10/2026

- Signup và gửi lại email dùng chung `AUTH_EMAIL_REDIRECT_URL = https://feat-auth.it3180.pages.dev/tai-khoan`, theo domain người dùng đã cung cấp. Không phụ thuộc địa chỉ đang mở frontend; không đổi shared contract, database hoặc cấu hình Docker local.
- Đổi môi trường UI test thành `http://localhost:5173/tai-khoan`: hai test signup/resend **FAIL trước khi sửa** vì gửi localhost, **PASS sau khi sửa** vì gửi chính xác domain đã chốt. Các test vẫn kiểm tra đúng email, thông báo, phiên và lỗi gửi lại.
- Node **22.23.3**: `npm run typecheck` **PASS**, `npm run build` **PASS**, unit test toàn bộ **57/57 PASS** (5 file, `vitest run --maxWorkers=1`). Build còn cảnh báo bundle khoảng 609 kB.
- HTTP GET trang đích `https://feat-auth.it3180.pages.dev/tai-khoan` trả **200**. Kiểm tra bundle vừa build có URL cố định và không còn `emailRedirectTo` dựa vào `window.location.origin`; HTTP 200 không chứng minh luồng email trên server đã hoạt động.
- Không chạy lại integration vì thay đổi chỉ ở URL frontend/test và tài liệu; chưa kiểm thử email thật hoặc đọc/sửa Supabase Dashboard. Kết quả integration trước đó vẫn BLOCKED do Docker, không tính là PASS.
- Admin cần thêm URL chính xác vào Redirect URLs, đặt Site URL cho project dev và giữ template xác minh đúng theo [hướng dẫn Auth](../web/src/modules/auth/SUPABASE_SIGNUP_FIX.md). Bản sửa chưa được push/deploy trong lượt này; email cũ cần thay bằng email mới/gửi lại sau khi cập nhật cấu hình.

## Sửa đăng ký/xác minh email/tạo hồ sơ — 20/10/2026

- Yêu cầu theo phản hồi website test: thông báo xác minh rõ ràng sau signup, link xác nhận trả đúng website dev và tạo `public.users` ngay khi Auth tạo tài khoản, kể cả chưa có session/chưa xác minh email.
- `npm run typecheck` PASS; `npm run build` PASS; `npm test` PASS bằng **Node 22.23.3**: **57 test / 5 file**, gồm 8 contract/config/validation, 7 phiên, 22 giao diện, 20 SQL/quyền. Build còn cảnh báo JavaScript khoảng 609 kB.
- Test frontend chạy với URL `https://feat-auth.it3180.pages.dev/tai-khoan`; xác nhận signup/resend gửi đúng origin, banner không mất khi nhập tiếp hoặc SDK chuyển session trước lúc signUp trả về, lỗi rate limit không báo gửi thành công giả.
- Test SQL mới chạy cả hai migration, kiểm tra trigger tạo hồ sơ trước xác minh/session, backfill giữ LOCKED/ADMIN/DRIVER, Auth service không cần quyền đọc bảng private, không tin metadata, không trùng hồ sơ, client không tự insert và lỗi ghi hồ sơ rollback Auth insert.
- Bộ integration hiện có **11 test**. Đã thử `npm run check`; typecheck/build/57 tests PASS, nhưng integration kết thúc mã 1 do Docker chưa khả dụng. Chưa chạy 11 integration tests, chưa kiểm thử gửi/nhận email thật.
- Đã GET trang preview và asset JavaScript công khai: HTTP 200, code đang deploy dùng `emailRedirectTo` theo `window.location.origin`. Không truy cập Dashboard/Auth settings, không tạo user cloud, không push/deploy/apply SQL online; không có browser kết nối để thao tác giao diện website thật.
- Migration mới `20261020130000_auth_signup_profile.sql` thêm trigger/backfill, giữ migration cũ; không đổi shared API/DTO hoặc tạo ví. `seed:local` nay tạo hồ sơ gián tiếp qua trigger.
- Admin còn phải đối chiếu schema/trigger cũ, áp dụng migration đã review và cấu hình Site URL/Redirect URLs/Confirm Email/template. Xem [hướng dẫn cụ thể trong module Auth](../web/src/modules/auth/SUPABASE_SIGNUP_FIX.md).
- Lỗi P2 duyệt phiên bản hồ sơ cũ của lượt review trước vẫn còn; không nằm trong bản sửa signup này. Các kết quả phía dưới là lịch sử trước bản sửa signup.

## Auth/hồ sơ/admin theo thiết kế users — 20/10/2026

- **Rà soát cuối cùng cho admin:** đã chạy lại typecheck/build/45 tests bằng Node 22.23.3, kết quả PASS; integration vẫn bị chặn vì thiếu Docker. Một lượt Bugbot xác minh lỗi **P2 duyệt hồ sơ cũ**: admin xem A, user sửa thành B, RPC hiện tại có thể duyệt B mà admin chưa xem. Chưa sửa lỗi trong lượt review. Xem [biên bản trong module Auth](../web/src/modules/auth/SUPABASE_ADMIN_REVIEW.md) để nhận task sửa, cách tái hiện và các bước cấu hình/gọi RPC. Chưa đủ điều kiện nghiệm thu hoặc xác nhận sẵn sàng cập nhật server.

- Phạm vi: đăng ký/login/logout, quản lý phiên, bảo vệ trang, bootstrap USER/ACTIVE, hồ sơ sinh viên/xe máy, admin duyệt/từ chối có lý do và khóa/mở tài khoản. Có migration local `20261020090000_auth_profiles.sql` theo ảnh bảng `users` nhóm cung cấp. Xem [yêu cầu, API, quyền và hướng dẫn chạy](auth-module.md).
- Chạy bằng **Node 22.23.3** tải vào cache tạm, không đổi Node mặc định trên máy. `npm run typecheck` PASS; `npm run build` PASS; `npm test` PASS: **45 test / 4 file**.
- Trong 45 test: **13 test SQL** chạy migration và RPC trên PostgreSQL nhúng PGlite, kiểm tra grants/private helpers, uid, chống tự cấp quyền, sai chủ, admin, eligibility, dữ liệu sai, duyệt lại, khóa/mở và phân trang; **17 test giao diện**, **7 test phiên**, **8 test contract/config/validation**. Fixture `auth.uid()` mô phỏng claim đã xác minh; đây không phải Supabase integration thật.
- Bộ Supabase integration có **10 test** (4 Auth SDK và 6 hồ sơ/admin). Đã thử chạy `npm run test:integration`, lệnh kết thúc **mã 1 do chưa có Docker Desktop/daemon khả dụng**. Không có test integration nào được thực thi trong lần này; **`npm run check` chưa PASS toàn bộ**.
- Sandbox Windows cũng chặn `tsx` gọi `os.userInfo()`; đã chạy lại ngoài sandbox để xác nhận lỗi còn lại là Docker. Typecheck/build/unit chạy được bằng Node 22.
- Build có cảnh báo bundle khoảng 607 kB, trên ngưỡng 500 kB; chưa tối ưu bundle trong phạm vi Auth.
- Không gọi Supabase cloud/VietMap, không thay database hoặc cấp ADMIN trên server. Ảnh không chứa toàn bộ defaults/constraints/RLS hiện có; lead cần đối chiếu SQL thật trước khi tích hợp migration vào server đã có bảng `users`.
- Shared ảnh hưởng module 3/4/5: `UserProfile` có thêm field hồ sơ/xe/driver/eligibility; wrapper kiểm tra input riêng từng API. Client không được truy cập trực tiếp bảng `users` chứa thông tin riêng tư. Module nghiệp vụ dùng helper kiểm tra eligibility trong transaction server; chưa triển khai Trip/Booking/ví.
- Script khởi động/test áp dụng migration **local** chưa chạy và gọi CLI qua Node để chạy trên Windows; không reset database, không fallback cloud. Redirect local bổ sung `/tai-khoan`.

## Supabase và Cloudflare Pages — 14/10/2026

- Chuẩn bị bản Supabase local trên nhánh mới từ dev hiện tại; bỏ `wrangler.jsonc` và các công cụ Firebase còn sót trên dev. Frontend dùng Cloudflare Pages qua kết nối Git trên Dashboard.
- `npm ci` và `npm run check` PASS trên Node 22.23.3: typecheck, build frontend, 4 unit tests, 3 integration tests Auth với Supabase local Docker. Build còn cảnh báo bundle trên 500 kB.
- `npm run deploy:check` vẫn kết thúc với mã 1 đúng chủ ý; đường deploy thủ công từ repo vẫn bị chặn.
- Đã kiểm tra liên kết tài liệu, output có `index.html`, không có `404.html` ở gốc gây mất hành vi SPA mặc định của Pages; không còn cấu hình Workers hoặc import Firebase trong code đang chạy. Kế hoạch 3 tuần đã merge được giữ và đồng bộ trạng thái nền.
- Không tạo schema/bảng ứng dụng, không sửa env server, không gọi Supabase cloud/VietMap trong test. Stack local do integration khởi động đã được script dừng sau test; dữ liệu local được giữ.
- Bỏ cấu hình trong Git không tự xóa Worker trên Cloudflare. Cấu hình Pages, chuyển domain và xóa dịch vụ Worker cần làm trong Dashboard theo [hướng dẫn Pages](cloudflare-pages.md). Chưa kiểm thử đăng nhập trên website Pages hoặc Supabase server trong lần này.
- Thay đổi chung ảnh hưởng mọi owner: Supabase SDK dùng `user.id`; `CallableContracts` thành `ApiContracts`, health environment thành `local/cloud`; wrapper giữ tên `callFunction` nhưng gọi RPC dự kiến. Backend hồ sơ/Trip/Booking/ví còn chưa triển khai.

## Kiểm tra lại và đơn giản hóa ngày 12/10/2026

- Docker Desktop ban đầu chưa chạy; đã mở và kiểm thử bằng Node 22.23.3 (terminal mặc định đang dùng Node 26.7.0).
- `npm run check` PASS: typecheck, build, 4 unit tests, 3 integration tests Supabase Auth local thật. Build vẫn có cảnh báo bundle >500 kB.
- `npm run dev` PASS tới Vite ready: khởi động Supabase, sinh `web/.env.local`, tự tạo tài khoản Auth demo. Chạy lại `npm run seed:local` thành công.
- `npm run test:local` PASS với 4 unit + 3 integration tests trong lúc stack dev chạy. Script giữ stack phục vụ dev.
- Hướng dẫn tối giản ở [supabase-local.md](supabase-local.md): một lệnh dev, một lệnh test; các bước kết nối frontend tới project server và quay về local. Chưa kết nối/kiểm thử server vì chưa có URL/key public của project team.
- Không thay schema/contracts/quyền. Việc gộp seed vào dev áp dụng chung cho mọi owner; chỉ tạo Auth user local, không tạo dữ liệu nghiệp vụ. Không push/deploy hoặc gọi cloud/VietMap trong test.

## Kết quả kiểm chứng trước đó (08/10/2026)

Phạm vi: SDK Supabase, phiên/login/logout và cấu hình local. Không có migration/bảng ứng dụng hoặc handler RPC; thiết kế database/API để team làm.

- `npm run check` PASS trên Node 22.23.3: typecheck, build, 4 unit tests và 3 integration tests Auth với Supabase local thật.
- Integration xác nhận login, Auth server trả đúng uid, từ chối mật khẩu sai và logout xóa phiên client. Tài khoản test tạm được dọn sau khi chạy.
- Giao diện `/tai-khoan`: mật khẩu sai có thông báo; tài khoản mẫu đăng nhập được; reload vẫn giữ phiên; logout trở lại form đăng nhập. Hồ sơ báo chưa triển khai, không có dữ liệu/quyền giả.
- Supabase local đã chạy đủ 7 thành phần; schema public chưa có bảng ứng dụng. Không gọi cloud/VietMap thật trong kiểm thử.
- Build có cảnh báo bundle lớn hơn 500 kB; chưa tối ưu bundle trong phạm vi migration Auth này.
- CI đã đổi sang kiểm thử Supabase local, chưa chạy trên GitHub cho bản sửa này. Cloud deploy tắt; chưa push/deploy hoặc di chuyển dữ liệu thật.

## Thay đổi shared/config cần team biết

Firebase SDK/config/backend cũ được bỏ; CLI local chuyển sang Supabase + Docker. Tất cả owner dùng cùng `supabase/config.toml` và client `web/src/lib/supabase.ts`. Mỗi máy có dữ liệu local riêng.

`CallableContracts` đổi tên thành `ApiContracts`; HealthResponse.environment dùng local/cloud; Auth User.uid đổi thành User.id, nhưng DTO UserProfile.uid giữ tên cũ. Wrapper callFunction giữ tên API, ánh xạ sang RPC dự kiến trong shared/api.ts. Các handler đó chưa triển khai; việc này không quyết định schema SQL cho team.

Cập nhật tài liệu 12/10/2026: kế hoạch ke-hoach/ đã đồng bộ Supabase; [workflow team](supabase-workflow.md) phân biệt frontend/server không Docker và toàn bộ local cần Docker, có quy trình migration/review/lead cập nhật server. Các quy tắc nghiệp vụ được giữ; schema do team thiết kế. Lần cập nhật tài liệu không chạy server, không thay env, không triển khai migration/backend và không kiểm thử cloud.

## Đơn giản hóa tài liệu cho team sinh viên năm 3

Hướng dẫn bắt đầu đã đổi sang bước cụ thể, có nơi chạy lệnh và kết quả mong đợi. Thuật ngữ có ví dụ Về Cùng; phần cập nhật server tách vào [supabase-lead.md](supabase-lead.md). AGENTS.md ghi nguyên tắc giải thích cho team ít kinh nghiệm để dùng cho các lần làm tiếp. Không thay code, env, database hoặc khởi động server trong lần chỉnh tài liệu này.
