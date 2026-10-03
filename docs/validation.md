# Kiểm chứng scaffold — 04/10/2026

- Runtime kiểm tra: Node 22.14.0, Java 21; phiên bản dependency đã cố định trong package-lock.json.
- `npm run check`: PASS (typecheck, build frontend/backend, 3 unit tests + 8 integration tests).
- Emulator thật xác nhận health đọc Firestore, token uid, input giả quyền, USER bị chặn admin, ADMIN được phép, khóa user theo trạng thái DB, thiếu profile và Rules chặn client.
- Giao diện đã làm lại thành 4 trang; bỏ các khối kiểm tra Firebase/tài khoản mẫu/phân công khỏi UI. Login bằng form email/mật khẩu vẫn đọc được hồ sơ từ server. Chi tiết kiểm tra giao diện ở [ui-redesign.md](ui-redesign.md).
- Seed local chạy xong; chỉ tạo fixture trong localhost demo project. `npm run deploy:check` chặn cấu hình cloud thiếu như thiết kế.
- Chưa chạy CI trên GitHub, deploy cloud, VietMap thật hoặc nghiệm thu nghiệp vụ Trip/Booking/ví; các phần đó chưa triển khai.

## Dependency audit

Đã chốt override @grpc/grpc-js 1.14.5 để sửa dependency gRPC cũ của Firebase client SDK; chạy lại toàn bộ check thành công.

`npm audit --omit=dev` còn 2 cảnh báo moderate trong chuỗi gaxios/uuid. Audit đầy đủ còn cảnh báo ở dependency gián tiếp của Firebase CLI, trong đó có high. Không chạy audit fix --force vì npm đề xuất downgrade Firebase/CLI và có thể phá API. Lead kiểm tra bản cập nhật upstream trước khi phát hành cloud; đây không phải chứng nhận ứng dụng đã được kiểm toán bảo mật.
