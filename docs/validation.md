# Kiểm chứng phần Supabase Auth — 08/10/2026

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
