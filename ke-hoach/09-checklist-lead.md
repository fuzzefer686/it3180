# Checklist lead sau khi có scaffold

Cập nhật 04/10/2026. Khung React/Firebase đã được merge vào dev/main; nghiệp vụ các module chưa triển khai. Chưa deploy cloud.

## Làm ngay hôm nay

1. Chạy theo README: npm ci → npm run dev; terminal thứ hai npm run seed:local. Kiểm tra Firebase và đọc hồ sơ mẫu.
2. Đọc shared/contracts.ts và docs/contracts.md; hiểu uid, role/status, callable, Firestore Rules và transaction. Hỏi Agent giải thích phần chưa hiểu trước khi giao nhóm.
3. Scaffold đã merge; mỗi task mới lấy origin/dev mới nhất và tạo feature branch riêng, review diff rồi mở PR vào dev. Không dùng lại nhánh đã merge, không force push hoặc ghi đè remote.
4. Mời 4 người vào repo. Bảo vệ dev/main: PR, một approval, resolve conversation, checks qua, không force push/xóa; áp dụng cho cả lead.
5. Gửi link README/kế hoạch; yêu cầu cả 5 người xác nhận chạy được local. Dừng Emulator dev trước khi chạy npm run check.

## Giao task đầu tiên

| Người | Task đầu | Hoàn thành khi |
|---|---|---|
| 1 — Lead | Baseline, CI checks, contract chung | Cả nhóm chạy local và PR có CI xanh |
| 2 | Auth email/password và bootstrap users | Register/login/logout; USER không gọi admin |
| 3 | VietMap motorcycle và form tuyến | Một tuyến thật với stops/distance lưu được |
| 4 | Request/confirm Booking với fixture | Hai confirm đồng thời chỉ một người thành công |
| 5 | Bootstrap ví và ledger cấp điểm | Một ví/user, cấp 1.000.000 điểm đúng một lần |

Mỗi Issue có owner, reviewer, input/output, điều kiện hoàn thành và phần chưa làm. Một task chính/người; dùng fixture có nhãn nếu đang chờ module khác.

## Trong tuần

- 10 phút mỗi ngày: đã chạy được gì, tiếp theo làm gì, cần ai hỗ trợ.
- Review code/quyền/contracts/test; yêu cầu owner giải thích được code AI. PR lead cũng có reviewer.
- Merge từng task nhỏ vào dev, thử luồng tích hợp và giao lỗi lại đúng owner.
- Demo chung 05/10 và 07/10. Sau 08/10 dừng thêm chức năng; 09/10 nghiệm thu, 10/10 demo.
- Giữ scope: xe máy, một khách mỗi chuyến, trả điểm demo. Không thêm GPS, tiền thật hoặc nhiều khách nối tiếp.

## Hosting khi sẵn sàng

Cloud chưa cấu hình. Nếu dùng web cloud hoàn chỉnh, chủ tài khoản cần quyết định bật Blaze/billing. Lead quản lý 2 Firebase projects riêng cho dev/production-demo, GitHub Environments/Variables/WIF và budget; không chia sẻ password hoặc đưa private key vào repo. Chưa có billing vẫn phát triển/demo local bằng Emulator.

Pipeline deploy tắt cho đến khi bật ENABLE_FIREBASE_DEPLOY sau khi cấu hình đủ. Test chung trên dev, PR dev → main bằng merge commit, kiểm tra sau release. Chưa cần mua domain.

## Bạn không cần làm thay cả nhóm

Bạn giữ khung/config/contract, gỡ vướng, review và ghép code. Owner tự làm FE/BE/test và sửa lỗi module mình. Khi kẹt, giải quyết dependency và scope trước khi viết hộ.
