# Kế hoạch tối giản — nhóm 5 người

Cập nhật 03/10/2026. Mục tiêu demo V1: 10/10/2026. Thành viên 1 là Lead; repository công khai.

Bản này thay thế kế hoạch dài trước đó. V1 chỉ nhận một khách mỗi chuyến; khách có thể đi một phần tuyến. Ghép nhiều khách nối tiếp để sau.

| Tài liệu | Ai đọc |
|---|---|
| [Kế hoạch chung và hàng chờ](00-ke-hoach-tong-the.md) | Cả nhóm |
| [1 — Lead](01-lead.md) | Thành viên 1 |
| [2 — Đăng nhập, hồ sơ và quản trị](02-ho-so-quan-tri.md) | Thành viên 2 |
| [3 — Chuyến và VietMap](03-chuyen-vietmap.md) | Thành viên 3 |
| [4 — Đặt chuyến](04-dat-cho.md) | Thành viên 4 |
| [5 — Thanh toán](05-thanh-toan.md) | Thành viên 5 |
| [Hosting tối giản](06-hosting-cicd.md) | Lead; cả nhóm đọc khi cần |
| [Tech stack và giải thích từng công cụ](07-tech-stack.md) | Cả nhóm |
| [GitHub: branch, push, PR và việc của lead](08-github-workflow.md) | Cả nhóm |

Mỗi bản riêng có việc cần làm, điều kiện hoàn thành và prompt sẵn ở cuối. Mỗi người làm cả giao diện, API và kiểm thử phần mình.

Mặc định demo: 5.000 điểm/km, phí mô phỏng 10%. Mỗi tài khoản được cấp 1.000.000 điểm ảo và có nút thêm điểm thử. Điểm không mua bằng tiền, không rút hoặc quy đổi ra tiền. V1 dùng ví điểm demo; tạm bỏ tiền mặt, PayOS và công nợ. Đây là cấu hình mô phỏng, không phải biểu giá Grab/Be.

Stack đã đổi sang **React + Vite + TypeScript + Tailwind CSS; Firebase Authentication + Cloud Firestore + Cloud Functions + Firebase Hosting**. Cả nhóm dùng chung stack, một repo. VietMap giữ nguyên.

Người 2 phụ trách đăng ký/login/logout, hồ sơ, duyệt sinh viên và phân quyền. Lead phụ trách scaffold, contract chung, Emulator, CI/deploy và tích hợp.

**Điều kiện hosting:** triển khai Cloud Functions cần Firebase Blaze và liên kết tài khoản billing. Có hạn mức miễn phí nhưng không bảo đảm tổng chi phí bằng 0. Chưa có billing thì phát triển/demo local bằng Firebase Emulator Suite; không tự bật billing hoặc triển khai cloud. Xem [hosting và CI/CD](06-hosting-cicd.md).
