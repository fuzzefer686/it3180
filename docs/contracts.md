# Contract và cách mở rộng khung

Owner file chung: người 1. Types/schema ở `shared/contracts.ts`, FE gọi wrapper `web/src/lib/callable.ts`. Chưa có handler Trip/Booking/Wallet.

Nhóm bắt đầu từ [onboarding](team-onboarding.md). Config local thống nhất `demo-vecung`, region `asia-southeast1`; cloud config chỉ lead quản lý qua [runbook deploy](firebase-deploy.md). Thay đổi config/build guard không đổi CallableContracts, Rules hoặc indexes.

## Đã chạy được

| Callable | Input | Quyền | Output |
|---|---|---|---|
| healthCheck | `{}` | Public | Kết nối DB, thông điệp fixture không nhạy cảm |
| getMyProfile | `{}` | Auth + users.status ACTIVE | Hồ sơ cơ bản của uid trong token |
| adminFoundationInfo | `{}` | Auth + ACTIVE + ADMIN | Phiên bản scaffold; chưa phải nghiệp vụ admin |

## Dữ liệu mẫu

`users/{uid}` có uid, displayName, roles, status, studentVerificationStatus. Firebase Auth quản lý email/password; không lưu password trong Firestore.

`appMeta/foundation` chứa message mẫu để chứng minh Functions đọc dữ liệu đã lưu. Seed local tạo 3 user hư cấu và appMeta; không cấp điểm ví.

## Cách thêm một chức năng

1. Owner đề xuất input/output/error trong Issue/PR. Lead cập nhật CallableContracts trong shared file; PlannedInputs mới là dự kiến.
2. Backend handler trong `functions/src/modules/<module>/`; parseInput(Zod), requireActiveUser, requireRole/eligibility rồi xử lý. Riêng bootstrap tài khoản mới dùng requireUid trước khi có users document. Export qua `functions/src/index.ts`.
3. FE trong `web/src/modules/<module>/` gọi callFunction; không thêm Firestore SDK để sửa trực tiếp dữ liệu nghiệp vụ.
4. Test trong tests/unit hoặc tests/integration. Index mới khai báo firestore.indexes.json; báo lead và các module phụ thuộc.

## Quy ước

- uid người thao tác chỉ lấy từ request.auth. DRIVER kế thừa USER; ADMIN không tự thành DRIVER.
- ACTIVE/LOCKED tách khỏi PENDING/VERIFIED/REJECTED. Khi đăng chuyến còn phải kiểm tra hồ sơ driver/xe.
- DB dùng Timestamp; API trả `…Ms` dưới dạng milliseconds. Tọa độ latitude/longitude, khoảng cách mét, điểm số nguyên.
- Input không có fare, roles hay balance do FE quyết định. List API có pagination/limit và chỉ trả trường phù hợp quyền.
- Lỗi dùng HttpsError: unauthenticated, permission-denied, invalid-argument, failed-precondition, not-found, already-exists.
- Firestore Rules chặn tất cả client; Admin SDK bỏ qua Rules, từng function phải kiểm tra quyền.

## Transaction bắt buộc khi triển khai module

- Booking: đọc Trip và khóa yêu cầu đang hoạt động theo tripId/uid; confirm ghi confirmedBookingId cùng Booking. Start/cancel đọc/ghi cùng Trip. Pickup đặt hasServedPassenger, không xóa sau dropoff.
- Ví: đọc Booking, Payment và các ví trước khi ghi; payments/{bookingId}, ledger IDs xác định và top-up requestId chống retry. Kiểm tra đủ điểm trong transaction.
- Transaction có thể retry: đọc trước khi ghi, không gọi VietMap hoặc dịch vụ bên ngoài trong callback.

Các quy tắc hàng chờ/giá đầy đủ ở [kế hoạch](../ke-hoach/00-ke-hoach-tong-the.md). Không triển khai toàn bộ nghiệp vụ trong scaffold.
