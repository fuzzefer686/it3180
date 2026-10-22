# Cloudflare Pages — cấu hình và bỏ Worker cũ

Về Cùng dùng Pages để phục vụ frontend React/Vite; Supabase lo Auth và database. Cấu hình Workers trong `wrangler.jsonc` đã được bỏ. Không cần cài Wrangler hoặc chạy lệnh deploy trên máy để Pages nhận code qua Git.

## 1. Cấu hình Pages một lần trên Dashboard

Mở Cloudflare → **Workers & Pages** → chọn dự án loại **Pages** của Về Cùng. Vào **Settings → Builds & deployments** và đặt:

| Mục | Giá trị |
|---|---|
| Repository | `fuzzefer686/it3180` |
| Production branch | `main`; bật tự deploy |
| Preview branches | All non-Production branches; bao gồm dev và feature branches |
| Root directory | Để trống, dùng gốc repo |
| Build command | `npm run build` |
| Build output directory | `web/dist` |

Pages tự cài dependencies theo lockfile. `npm run build` chỉ đóng gói frontend, không cần Docker. Không dùng `npm run dev`, `supabase start`, `npm run check` hoặc lệnh `wrangler deploy` làm build command Pages.

Ở **Settings → Environment variables**, điền cho **Production** và **Preview**:

```dotenv
NODE_VERSION=22.23.3
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
```

Thay URL/key bằng thông tin từ project Supabase cần kết nối. Chỉ dùng publishable key hoặc anon key, không dùng secret/service-role key. Nếu bản đồ cần client key, thêm `VITE_VIETMAP_MAP_KEY`; VietMap REST key ở backend.

Các giá trị được đưa vào frontend lúc build. Sửa env cần build/deploy lại; `.env.local` trên máy không tự được gửi lên Cloudflare. Có thể cấu hình URL/key khác giữa Production và Preview khi team đã có các server riêng. Nếu cùng trỏ một project, cả hai dùng chung dữ liệu; mỗi nhánh Git không có database riêng.

Build hiện kiểm tra URL/key ngay trong `web/vite.config.ts`: thiếu cấu hình, dùng key quyền cao hoặc trỏ localhost/loopback sẽ bị chặn trước khi đóng gói. Client bản build cũng từ chối URL local. Tất cả module dùng chung Supabase client (Auth, hồ sơ, Trip/Booking/ví khi triển khai) chịu cùng cấu hình; không đổi shared contract hay schema.

Chạy `npm run dev:web` trên máy vẫn kết nối Supabase online theo `web/.env.local`; không cần Docker. Backend/test Docker vẫn dùng local theo hướng dẫn riêng. Nếu đang dùng env local để làm backend, `npm run build`/bước build của `npm run check` cần được cung cấp URL/key online qua biến môi trường; không dùng bản build trỏ local để phát hành. CI dùng URL `.invalid` và publishable key mẫu chỉ để kiểm tra đóng gói, còn integration luôn lấy URL/key từ Supabase local, không gọi cloud thật.

Kết quả mong đợi: merge main cập nhật website chính; push dev/feature tạo bản Preview. Không cần thêm job deploy Pages trong GitHub Actions. CI GitHub và build Pages chạy riêng; Pages không tự đợi CI xanh hoặc approval.

Tài liệu chính thức: [build và environment variables](https://developers.cloudflare.com/pages/configuration/build-configuration/), [chọn nhánh deploy](https://developers.cloudflare.com/pages/configuration/branch-build-controls/), [Preview deployments](https://developers.cloudflare.com/pages/configuration/preview-deployments/).

## 2. Kiểm tra trước khi xóa Worker

Sau khi PR nền Supabase/Pages được review và merge vào dev, mở bản Preview của dev. Sau khi thử ổn và PR dev→main được merge bằng merge commit, mở bản Production Pages.

1. Trong Deployments, kiểm tra nhánh, mã commit và trạng thái thành công của đúng bản cần thử.
2. Mở `/tai-khoan` trực tiếp, tải lại trang; các trang `/chuyen-di`, `/dat-chuyen`, `/vi-diem` cũng phải mở được.
3. Dùng tài khoản thử có trên Supabase server để login. Tài khoản local không tự chuyển lên server.
4. Nếu cần xác nhận địa chỉ server: Windows nhấn `F12` → Network → đăng nhập → tìm request `auth/v1/token?grant_type=password`. Địa chỉ phải là project Supabase đã chọn, phản hồi 200; UI hiện email đã đăng nhập. Tải lại rồi logout để thử phiên.

Nếu hồ sơ báo chưa triển khai thì Auth vẫn có thể đã thành công; server đang thiếu migration/RPC hồ sơ có trong repo. Trip, Booking hoặc ví vẫn thiếu backend. Deployment thành công chỉ xác nhận build/hosting, chưa chứng minh nghiệp vụ đúng.

Pages phục vụ app React cho URL sâu nếu không có file `404.html` ở gốc output. Repo không có file này, nên dùng hành vi mặc định của Pages; không cần Worker để sửa routing. Xem [SPA trên Pages](https://developers.cloudflare.com/pages/configuration/serving-pages/).

## 3. Chuyển domain rồi xóa Worker trên Cloudflare

Làm trong **Dashboard Cloudflare**, không trong terminal repo:

1. Nếu đang dùng domain riêng gắn với Worker, ghi lại domain, gỡ khỏi Worker trong **Settings → Domains & Routes**, rồi thêm cùng domain trong **Pages → Custom domains**. Làm theo hướng dẫn DNS và chờ domain báo Active. Việc chuyển có thể có khoảng gián đoạn; URL Pages mặc định vẫn dùng để thử.
2. Mở domain đã chuyển và thử login/reload như phần 2. Nếu chưa có domain riêng, dùng URL Pages mặc định mà Dashboard cung cấp.
3. Vào **Workers & Pages**, chọn dịch vụ loại **Worker** tên `it3180`; kiểm tra đúng loại dịch vụ, vì Pages có thể trùng tên. Trong **Settings**, tìm **Delete**, nhập tên Worker và xác nhận theo Dashboard.
4. Kết quả mong đợi: Worker không còn trong danh sách; website Pages và Supabase vẫn hoạt động. Xóa Worker không xóa dự án Pages hoặc database Supabase.

Không xóa dự án Pages. Bỏ file Workers trong Git không tự xóa Worker đã deploy; bước Dashboard là việc riêng. Nếu nút Delete bị khóa, kiểm tra quyền tài khoản Cloudflare hoặc nhờ owner tài khoản thực hiện.

## 4. Lỗi thường gặp

| Hiện tượng | Kiểm tra |
|---|---|
| Pages báo thiếu cấu hình Supabase | URL/key đã đặt đúng Production hoặc Preview chưa; build lại sau khi đổi |
| Build báo không được trỏ localhost | Đặt URL Supabase online cho đúng Production/Preview rồi build lại; không bỏ kiểm tra |
| Chỉ Production login được | Preview cũng cần URL/key và tài khoản của đúng server |
| Sai mật khẩu hoặc email chưa xác nhận | Kiểm tra Auth user trên server, không dùng tài khoản seed local; nếu cần xác minh thì mở email mới nhất hoặc dùng nút gửi lại trên form |
| URL sâu lỗi | Output có đúng `web/dist`, có `index.html` và không có `404.html` ở gốc không |
| Còn thấy hai build trên PR | Worker vẫn còn Git integration hoặc chưa bị xóa trên Dashboard |
| Link xác minh quay sai website | Cho phép `https://feat-auth.it3180.pages.dev/tai-khoan`, đặt Site URL `https://feat-auth.it3180.pages.dev` và kiểm tra template ConfirmationURL; gửi email mới sau khi sửa |
| Login vẫn ở localhost hoặc bản online chưa tự mở trang chủ | Deploy đúng bản có `auth-redirect.ts`; đích thành công cố định `https://feat-auth.it3180.pages.dev/chuyen-di`, phiên đổi origin được SDK nhận qua fragment |

Push/merge Git chỉ cập nhật frontend theo cấu hình Pages. Migrations, quyền truy cập và API Supabase vẫn qua review/test local rồi lead cập nhật server; không reset database online hoặc bỏ guard deploy để chạy nhanh.
