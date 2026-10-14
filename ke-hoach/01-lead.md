# Người 1 — Lead: giúp team chạy được và ghép code

Team đều là sinh viên năm 3. Lead cũng cần hiểu từng bước; không cần dựng hệ thống phức tạp ngay. Phần đăng nhập/hồ sơ nghiệp vụ do người 2 phụ trách.

## Việc đầu tiên

1. Gửi [README](../README.md) cho team, cùng thử mỗi người mở được web bằng `npm run dev:web` với server dev. Cách này không cần Docker.
2. Cung cấp URL/publishable key và tài khoản test riêng trên server. Giải thích key public khác key quản trị; không chia sẻ password quản trị.
3. Người bắt đầu làm database/backend thì hướng dẫn thêm [Supabase local](../docs/supabase-local.md), không yêu cầu mọi người học deploy ngay.
4. Cùng từng owner chốt một task nhỏ, dữ liệu gửi/nhận và test cần có. Owner là người phụ trách module, làm code và test phần mình.

## Khi ghép code

Owner gửi PR (yêu cầu ghép code) vào dev. Lead hoặc reviewer đọc thay đổi, hỏi owner giải thích được cách làm và test. Review khác tác giả; PR lead do 2 review nền tảng, 5 review phần kiểm tra/phát hành.

Giữ code dùng chung ở shared/client/config; đổi dữ liệu dùng chung phải báo người phụ thuộc. Migration là file SQL thay đổi database: owner viết, lead kiểm tra thứ tự và ảnh hưởng rồi mới cập nhật server khi được giao. Hướng dẫn lệnh ở [phần riêng cho lead](../docs/supabase-lead.md).

Không cần viết hộ hết module. Nếu owner kẹt, giúp xác định thiếu dữ liệu gì, phụ thuộc ai và chia task nhỏ hơn.

## Những điều phải kiểm tra

- Login không đồng nghĩa đã có hồ sơ/ví; backend ứng dụng hiện chưa có.
- User thường không tự sửa role/giá/số dư; server kiểm tra quyền. Admin đầu tiên phải có cách cấp tin cậy riêng, seed hiện không cấp admin.
- Booking chỉ nhận một khách; ví phải chống trả trùng và thay đổi dở dang. Xem ví dụ transaction/idempotency trong [giải thích công cụ](07-tech-stack.md).
- GitHub tự test trước merge; Pages tự build/deploy frontend từ các nhánh đã bật trên Dashboard. Database/backend Supabase cập nhật riêng sau review. Dev ổn mới PR dev → main, không force push nhánh chung.

Xem [checklist lead](09-checklist-lead.md) khi cần theo dõi việc cần làm.

## Prompt gửi Agent

```text
Tôi là người 1/Lead trong nhóm CNPM gồm sinh viên năm 3, ít kinh nghiệm.
Đọc README, contracts, workflow Supabase và kế hoạch này.
Chỉ làm từng task nhỏ được giao; giải thích mục đích, lệnh ở đâu, kết quả và cách test bằng từ đơn giản.
Giữ stack hiện có; tôi phụ trách config/code chung/CI/tích hợp, Auth nghiệp vụ thuộc người 2.
Team phải chốt schema và quyền trước khi tạo bảng/migration.
Không tự sửa module khác, push/deploy, tạo project hoặc bật billing.
```
