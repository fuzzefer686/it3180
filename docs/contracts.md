# Contract — frontend gửi gì, backend trả gì?

Contract là quy ước giữa người viết giao diện và người viết backend. Ví dụ khi hỏi “hồ sơ của tôi”, frontend gửi gì, backend trả những trường nào? Chốt trước giúp các bạn không đoán tên field của nhau.

**Contract không phải cấu trúc bảng database.** Auth/hồ sơ/admin đã có migration và RPC local theo thiết kế `users` nhóm cung cấp; chưa áp dụng lên server. Xem [đầu vào/đầu ra, quyền và ảnh hưởng shared](auth-module.md#api-và-ảnh-hưởng-tới-module-khác). `healthCheck`/`adminFoundationInfo` vẫn chưa có backend.

Nhánh này đã tích hợp Trip/VietMap: [API, điều kiện driver và khác biệt schema server](trips.md).
callFunction gọi RPC cho Auth và đọc/đổi trạng thái Trip; gọi Edge trips
cho tìm địa điểm, xem tuyến và lưu chuyến. Shared giữ cả contract Auth và Trip.

Bản sửa schema 22/10: Trip/Booking/stop ID dùng UUID; khoảng cách là mét nguyên.
`route.encodedPolyline` chứa đường vẽ cả tuyến; các chặng giữ khoảng cách và ID
điểm đầu/cuối. `arrivalTimeMs`, `route.totalDurationMs` và thời lượng chặng có thể
null với dữ liệu đã lưu; frontend không thay bằng 0. Xem [bàn giao Trip](trips.md)
trước khi tích hợp Booking hoặc deploy frontend/Edge khác phiên bản.

## 1. API nền dự kiến

| Tên dùng trong code | Hàm database dự kiến (RPC) | Gửi lên | Nhận về | Hiện trạng |
|---|---|---|---|---|
| healthCheck | health_check | `{}` | HealthResponse | Chưa có backend |
| getMyProfile | get_my_profile | `{}` | UserProfile | Có migration/RPC local, gồm bootstrap |
| adminFoundationInfo | admin_foundation_info | `{}` | version | Chưa có backend |

`{}` nghĩa là không gửi field nghiệp vụ nào. RPC là gọi hàm trong database qua Supabase. Ví dụ getMyProfile không nhận uid để user tự chọn người khác; backend tự xác định user đang login.

## 2. Code chung ở đâu?

- `shared/contracts.ts`: kiểu và quy tắc kiểm tra dữ liệu trả về.
- `shared/api.ts`: tên API/RPC và schema gửi/nhận. PlannedInputs trong contracts.ts chỉ còn các API Booking/ví dự kiến.
- `web/src/lib/callable.ts`: hàm `callFunction` dùng chung để gọi Supabase RPC hoặc Edge Function trips.

Wrapper (hàm gọi chung) gửi `{ input: … }`, dùng Zod kiểm tra input riêng từng API và kiểm tra kết quả. Có thêm updateMyProfile/adminListUsers/adminReviewUser/adminSetUserStatus; xem [module Auth](auth-module.md). API chưa có thì hiện lỗi “chưa triển khai”, không trả hồ sơ/quyền/số dư giả để làm như đã hoàn thành.

## 3. Quy tắc cả team phải thống nhất

| Nội dung | Quy ước |
|---|---|
| ID user | SDK dùng `user.id`; hồ sơ API vẫn dùng tên `uid`, đều nhận diện user đó |
| Thời gian API | Milliseconds, tức mili giây |
| Khoảng cách | Mét |
| Điểm ví | Số nguyên, chỉ là điểm demo |
| DRIVER | Được dùng chức năng USER |
| ACTIVE/LOCKED | Tài khoản hoạt động/bị khóa; khác trạng thái duyệt sinh viên |

Auth SDK quản lý password/token. Backend lấy uid từ phiên đã xác minh; quyền/status đọc từ dữ liệu server. Không tin role trong user_metadata, giá hoặc số dư frontend gửi. Bootstrap (tạo hồ sơ lần đầu) phải kiểm tra uid, cấp mặc định an toàn; không tự cấp ADMIN. Nghiệp vụ còn phải kiểm tra ACTIVE và điều kiện tham gia.

Khi sửa contract, báo các bạn đang dùng nó. Ví dụ người 3 đổi dữ liệu khoảng cách tuyến thì người 4 tính giá phải biết. Thay contract không tự đổi bảng server; cần migration nếu schema cũng thay đổi.

## 4. Khi triển khai backend

Cùng team chốt bảng, RLS (quyền từng dòng), grants (quyền bảng/hàm), indexes và test trước. Backend RPC/Edge Function phải dùng phiên Auth đã xác minh và kiểm tra quyền. Edge Function trips xử lý các lời gọi VietMap và lưu tuyến.

Booking/ví cần transaction (cùng thành công hoặc cùng thất bại) và idempotency (gửi lại không ghi trùng). Không gọi VietMap/dịch vụ ngoài trong transaction. Dùng user thường để test quyền, không chỉ key quản trị. Xem [ví dụ thuật ngữ](../ke-hoach/07-tech-stack.md) và [quy trình migration](supabase-workflow.md).
