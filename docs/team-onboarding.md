# Thành viên mới — bắt đầu với Supabase

Mỗi người làm giao diện, backend và test module mình trong một repo. Team là sinh viên năm 3; bắt đầu bằng một task nhỏ.

1. Đọc [README](../README.md), cài Node 22 (từ 22.12) và chạy `npm ci` tại gốc CNPM.
2. Làm giao diện: nhận URL/publishable key và tài khoản thử từ lead, điền `web/.env.local`, chạy `npm run dev:web`. Kết quả mong đợi: mở `/tai-khoan`, login/reload/logout được. Cách này không cần Docker.
3. Làm database/backend: mở Docker Desktop, lưu lại cấu hình server trước khi dùng local; theo [Supabase local](supabase-local.md). Chạy `npm run dev` để mở cả Supabase local và web.
4. Đọc [workflow nhóm](supabase-workflow.md), [contract](contracts.md), [kế hoạch của mình](../ke-hoach/README.md) và [lịch 3 tuần](../ke-hoach/10-ke-hoach-3-tuan.md). Chốt dữ liệu/quyền với người phụ thuộc trước khi tạo migration.
5. Tạo nhánh riêng từ dev, làm/test task rồi PR vào dev; người khác review và CI qua trước merge. Lệnh ở [hướng dẫn Git](../ke-hoach/08-github-workflow.md).

Login đúng chưa có nghĩa đã có hồ sơ/Trip/Booking/ví: các backend đó chưa triển khai. Tài khoản local không tự chuyển lên server. Nếu thiếu cấu hình hoặc Docker chưa mở, xem lỗi thường gặp trong README và hướng dẫn local.

Frontend dùng [Cloudflare Pages](cloudflare-pages.md). Push Git không tự cập nhật database Supabase; lead cập nhật server từ migrations/code đã review. Không đưa env thật, key backend hoặc giấy tờ thật vào Git.
