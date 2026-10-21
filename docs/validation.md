# Kiểm chứng Supabase Auth và hồ sơ

## Sửa đăng ký/xác minh email/tạo hồ sơ — 20/10/2026

- Yêu cầu theo phản hồi website test: thông báo xác minh rõ ràng sau signup, link xác nhận trả đúng website dev và tạo `public.users` ngay khi Auth tạo tài khoản, kể cả chưa có session/chưa xác minh email.
- `npm run typecheck` PASS; `npm run build` PASS; `npm test` PASS bằng **Node 22.23.3**: **57 test / 5 file**, gồm 8 contract/config/validation, 7 phiên, 22 giao diện, 20 SQL/quyền. Build còn cảnh báo JavaScript khoảng 609 kB.
- Test frontend chạy với URL `https://feat-auth.it3180.pages.dev/tai-khoan`; xác nhận signup/resend gửi đúng origin, banner không mất khi nhập tiếp hoặc SDK chuyển session trước lúc signUp trả về, lỗi rate limit không báo gửi thành công giả.
- Test SQL mới chạy cả hai migration, kiểm tra trigger tạo hồ sơ trước xác minh/session, backfill giữ LOCKED/ADMIN/DRIVER, Auth service không cần quyền đọc bảng private, không tin metadata, không trùng hồ sơ, client không tự insert và lỗi ghi hồ sơ rollback Auth insert.
- Bộ integration hiện có **11 test**. Đã thử `npm run check`; typecheck/build/57 tests PASS, nhưng integration kết thúc mã 1 do Docker chưa khả dụng. Chưa chạy 11 integration tests, chưa kiểm thử gửi/nhận email thật.
- Đã GET trang preview và asset JavaScript công khai: HTTP 200, code đang deploy dùng `emailRedirectTo` theo `window.location.origin`. Không truy cập Dashboard/Auth settings, không tạo user cloud, không push/deploy/apply SQL online; không có browser kết nối để thao tác giao diện website thật.
- Migration mới `20261020130000_auth_signup_profile.sql` thêm trigger/backfill, giữ migration cũ; không đổi shared API/DTO hoặc tạo ví. `seed:local` nay tạo hồ sơ gián tiếp qua trigger.
- Admin còn phải đối chiếu schema/trigger cũ, áp dụng migration đã review và cấu hình Site URL/Redirect URLs/Confirm Email/template. Xem [hướng dẫn cụ thể trong module Auth](auth-module.md).
- Lỗi P2 duyệt phiên bản hồ sơ cũ của lượt review trước vẫn còn; không nằm trong bản sửa signup này. Các kết quả phía dưới là lịch sử trước bản sửa signup.

## Auth/hồ sơ/admin theo thiết kế users — 20/10/2026

- **Rà soát cuối cùng cho admin:** đã chạy lại typecheck/build/45 tests bằng Node 22.23.3, kết quả PASS; integration vẫn bị chặn vì thiếu Docker. Một lượt Bugbot xác minh lỗi **P2 duyệt hồ sơ cũ**: admin xem A, user sửa thành B, RPC hiện tại có thể duyệt B mà admin chưa xem. Chưa sửa lỗi trong lượt review. Xem [biên bản trong module Auth](auth-module.md) để nhận task sửa, cách tái hiện và các bước cấu hình/gọi RPC. Chưa đủ điều kiện nghiệm thu hoặc xác nhận sẵn sàng cập nhật server.

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
