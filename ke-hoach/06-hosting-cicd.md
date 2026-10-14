# Hosting và kiểm tra tự động — phần dành cho lead

Hosting là nơi đưa frontend lên cho người khác mở bằng URL. CI là bộ kiểm tra code tự động. Deploy là đưa thay đổi lên nơi đang chạy. Thành viên làm task hằng ngày chỉ cần [workflow](../docs/supabase-workflow.md); đọc file này khi cần hiểu việc phát hành.

## 1. Ba nơi chạy app

| Nơi chạy | Dùng để làm gì? |
|---|---|
| Supabase local trong Docker | Mỗi bạn thử database/backend với dữ liệu riêng |
| Server Supabase dev chung | Ghép các phần đã review và thử luồng cả team |
| Bản demo ổn định khi được cấu hình | Dùng code main và dữ liệu/config riêng để trình bày |

Frontend vẫn viết React trên máy; hosting dùng **Cloudflare Pages**, không dùng Worker để phục vụ frontend. Cách cấu hình, thử Pages và xóa Worker cũ ở [hướng dẫn Pages](../docs/cloudflare-pages.md). Git dev/main là nhánh code, không tự tạo server Supabase. Nhóm không cần mỗi module một project.

## 2. Repo tự kiểm tra gì?

GitHub Actions trong `.github/workflows/ci.yml` chạy trên PR/push dev/main: cài thư viện → typecheck → build → unit test → test Auth với Supabase local Docker → dừng Supabase. Không dùng server chung hoặc VietMap thật cho test tự động.

CI qua và một người khác review thì mới merge. PR của lead cũng cần review. GitHub Actions không có job deploy; Cloudflare Pages tự build/deploy frontend qua kết nối Git trên Dashboard. `npm run deploy:check` vẫn chặn đường deploy thủ công từ repo; không sửa guard để né cấu hình. Việc cập nhật database/backend Supabase là bước riêng sau review.

## 3. Khi cần đưa bản đã duyệt lên server

1. Nếu có thay đổi database, lead làm theo [Supabase dành cho lead](../docs/supabase-lead.md). Đọc trước và xem thay đổi sẽ chạy trên đúng project dev.
2. Nếu có thay đổi frontend, build với URL/publishable key của project cần kết nối rồi đưa lên Cloudflare khi được giao. Đổi env phải build lại; thử cả URL sâu như `/tai-khoan`.
3. Tạo user test/cấu hình Auth của server riêng khi cần. Migration không tự mang tài khoản local lên server.
4. Nhờ owner thử chức năng, ghi lại bản code và migration đang chạy. Bản dev ổn mới PR dev → main bằng merge commit (giữ lịch sử hai nhánh); cập nhật bản demo là bước sau khi được yêu cầu.

Edge Function là code backend chạy trên Supabase; repo hiện chưa có, local runtime tắt. Nếu sau này chọn dùng cho VietMap REST thì phải bổ sung cách test, secrets và deploy riêng.

## 4. Giữ dữ liệu và quyền đúng

Không reset database online để phát hành; reset local mới là bước thực hành tái tạo trên máy. Sửa server bằng migration tiếp theo đã review. Quay lại code trước không tự khôi phục dữ liệu trước.

Frontend chỉ dùng key public. Database password, token quản trị, service-role và VietMap REST key phải ở nơi riêng, không trong Git/frontend. Owner gửi thay đổi bảng/quyền qua PR; lead quản lý việc cập nhật server.

Supabase/Cloudflare/VietMap có gói và hạn mức riêng. Không tự tạo project, nâng cấp gói, bật billing hoặc deploy khi chưa được giao. Không áp dụng hướng dẫn Firebase Blaze cũ. Ví chỉ là điểm demo ở mọi môi trường.
