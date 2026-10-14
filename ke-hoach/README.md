# Kế hoạch tối giản — nhóm 5 người

Team đều là sinh viên năm 3, chưa có nhiều kinh nghiệm. Mỗi người chỉ cần đọc README → workflow → kế hoạch của mình; làm từng task nhỏ. Không cần đọc hết tài liệu vận hành server ngay.

Cập nhật nền Supabase/Pages ngày 14/10/2026. Thành viên 1 là Lead; repository công khai. Lịch hiện tại là [15/10–04/11 theo kế hoạch 3 tuần](10-ke-hoach-3-tuan.md); mốc demo 10/10 là lịch sử.

**Cả nhóm đọc trước:** [README chạy app](../README.md) và [quy trình Supabase](../docs/supabase-workflow.md). Làm UI với server dev không cần Docker; làm database/backend và integration local cần Docker.

Bản này thay thế kế hoạch dài trước đó. V1 chỉ nhận một khách mỗi chuyến; khách có thể đi một phần tuyến. Ghép nhiều khách nối tiếp để sau.

| Tài liệu | Ai đọc |
|---|---|
| [Lịch 3 tuần và checklist bàn giao](10-ke-hoach-3-tuan.md) | Cả nhóm — đọc trước |
| [Kế hoạch chung và hàng chờ](00-ke-hoach-tong-the.md) | Cả nhóm |
| [1 — Lead](01-lead.md) | Thành viên 1 |
| [2 — Đăng nhập, hồ sơ và quản trị](02-ho-so-quan-tri.md) | Thành viên 2 |
| [3 — Chuyến và VietMap](03-chuyen-vietmap.md) | Thành viên 3 |
| [4 — Đặt chuyến](04-dat-cho.md) | Thành viên 4 |
| [5 — Thanh toán](05-thanh-toan.md) | Thành viên 5 |
| [Hosting tối giản](06-hosting-cicd.md) | Lead; cả nhóm đọc khi cần |
| [Tech stack và giải thích từng công cụ](07-tech-stack.md) | Cả nhóm |
| [GitHub: branch, push, PR và việc của lead](08-github-workflow.md) | Cả nhóm |
| [Checklist lead sau scaffold](09-checklist-lead.md) | Người 1 |

Mỗi bản riêng có việc cần làm, điều kiện hoàn thành và prompt sẵn ở cuối. Mỗi người làm cả giao diện, API và kiểm thử phần mình.

Mặc định demo: 5.000 điểm/km, phí mô phỏng 10%. Mỗi tài khoản được cấp 1.000.000 điểm ảo và có nút thêm điểm thử. Điểm không mua bằng tiền, không rút hoặc quy đổi ra tiền. V1 dùng ví điểm demo; tạm bỏ tiền mặt, PayOS và công nợ. Đây là cấu hình mô phỏng, không phải biểu giá Grab/Be.

Stack hiện tại: **React/Vite/TypeScript/Tailwind; Supabase Auth/Postgres; Cloudflare Pages frontend; VietMap**. Một repo, một client/config chung. Chưa có bảng hoặc backend nghiệp vụ; các kế hoạch module mô tả việc phải làm, không phải schema đã chốt.

Người 2 phụ trách Auth/hồ sơ/admin; lead phụ trách nền tảng/config/shared/CI và tích hợp. Mỗi người viết code/test và file thay đổi database (migration) nếu cần. Gửi yêu cầu ghép code (PR) vào dev, một người khác đọc lại và bộ test tự động (CI) phải qua. Lead ghép code, cập nhật server và team thử chung. Bản ổn mới đưa từ dev vào main; Pages tự build/deploy frontend theo cấu hình Dashboard; database/backend Supabase cập nhật riêng.

Không sửa schema trực tiếp trên server để thử; thực hành bằng migrations local rồi review. Không tạo thêm project, bật billing hoặc deploy khi chưa được giao. Xem [hosting/CI](06-hosting-cicd.md) và [GitHub workflow](08-github-workflow.md).
