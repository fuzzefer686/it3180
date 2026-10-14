# Contract — frontend gửi gì, backend trả gì?

Contract là quy ước giữa người viết giao diện và người viết backend. Ví dụ khi hỏi “hồ sơ của tôi”, frontend gửi gì, backend trả những trường nào? Chốt trước giúp các bạn không đoán tên field của nhau.

**Contract không phải cấu trúc bảng database.** Team còn phải thiết kế bảng, quyền và viết phần xử lý. Hiện các API dưới đây chưa triển khai trên Supabase.

## 1. API nền dự kiến

| Tên dùng trong code | Hàm database dự kiến (RPC) | Gửi lên | Nhận về | Hiện trạng |
|---|---|---|---|---|
| healthCheck | health_check | `{}` | HealthResponse | Chưa có backend |
| getMyProfile | get_my_profile | `{}` | UserProfile | Chưa có backend |
| adminFoundationInfo | admin_foundation_info | `{}` | version | Chưa có backend |

`{}` nghĩa là không gửi field nghiệp vụ nào. RPC là gọi hàm trong database qua Supabase. Ví dụ getMyProfile không nhận uid để user tự chọn người khác; backend tự xác định user đang login.

## 2. Code chung ở đâu?

- `shared/contracts.ts`: kiểu và quy tắc kiểm tra dữ liệu trả về.
- `shared/api.ts`: tên API/RPC, kiểu dữ liệu gửi và nhận. PlannedInputs là input dự kiến cho Trip/Booking/ví, chưa có handler.
- `web/src/lib/callable.ts`: hàm `callFunction` dùng chung để gọi API. Tên file còn là callable, nhưng hiện gọi Supabase RPC.

Wrapper (hàm gọi chung) gửi `{ input: … }`, dùng Zod kiểm tra kết quả. API chưa có thì hiện lỗi “chưa triển khai”, không trả hồ sơ/quyền/số dư giả để làm như đã hoàn thành.

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

Cùng team chốt bảng, RLS (quyền từng dòng), grants (quyền bảng/hàm), indexes và test trước. Backend RPC/Edge Function phải dùng phiên Auth đã xác minh và kiểm tra quyền. Edge Functions hiện chưa có.

Booking/ví cần transaction (cùng thành công hoặc cùng thất bại) và idempotency (gửi lại không ghi trùng). Không gọi VietMap/dịch vụ ngoài trong transaction. Dùng user thường để test quyền, không chỉ key quản trị. Xem [ví dụ thuật ngữ](../ke-hoach/07-tech-stack.md) và [quy trình migration](supabase-workflow.md).
