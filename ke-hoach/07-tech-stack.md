# Công cụ và thuật ngữ — giải thích cho team

Không cần thuộc hết bảng này trước khi code. Gặp từ nào trong task thì đọc dòng tương ứng. Team là sinh viên năm 3; mục tiêu là hiểu công cụ giải quyết việc gì và giải thích được code mình viết.

## 1. Công cụ đang dùng

| Công cụ | Dùng để làm gì? |
|---|---|
| React | Viết giao diện: form, nút, danh sách chuyến |
| Vite | Chạy web khi phát triển và đóng gói bản web để đưa lên hosting |
| TypeScript | Kiểm tra kiểu dữ liệu, ví dụ số dư phải là số chứ không phải chuỗi |
| Tailwind CSS | Công cụ viết style bằng các class CSS có sẵn |
| React Router | Chuyển trang theo URL như `/tai-khoan` |
| Node 22 + npm | Chạy công cụ dev và cài các thư viện trong repo |
| Supabase Auth | Quản lý tài khoản, login/logout và phiên đăng nhập |
| Supabase Postgres | Database SQL: lưu dữ liệu trong bảng có dòng/cột |
| Supabase SDK | Thư viện có sẵn để code gọi Supabase, ví dụ `auth.signInWithPassword` |
| Supabase CLI | Công cụ chạy lệnh Supabase trong terminal; repo đã có, không cần cài global |
| Docker Desktop | Chạy bộ Supabase trên máy mà không tự cài từng dịch vụ |
| Zod | Kiểm tra dữ liệu nhận/gửi đúng cấu trúc, kể cả lúc app đang chạy |
| Vitest | Tự chạy các ca kiểm tra code |
| Git/GitHub | Lưu lịch sử code, làm nhánh riêng, gửi code để review |
| GitHub Actions | Tự chạy kiểm tra khi có PR/push vào dev/main |
| Cloudflare Pages | Nơi đưa frontend lên cho người khác truy cập; tự build/deploy các nhánh đã bật trong Dashboard |
| VietMap | Bản đồ, địa điểm và tuyến đường; người 3 phụ trách |

Docker cần khi chạy Supabase hoặc integration test trên máy. `npm run dev:web` dùng server dev của nhóm không cần Docker. Không cần Java. Supabase Storage/realtime/Edge runtime local đang tắt; chưa có Edge Functions.

## 2. Thuật ngữ thường gặp

| Từ | Nghĩa và ví dụ Về Cùng |
|---|---|
| FE / frontend | Giao diện trình duyệt, ví dụ nút nhận khách |
| BE / backend | Xử lý ở server, ví dụ kiểm tra driver có phải chủ chuyến |
| API | Cách frontend gửi yêu cầu và nhận kết quả từ backend |
| RPC | Gọi một hàm ở database qua Supabase; ví dụ hàm trả hồ sơ của người đang login |
| Handler | Phần code xử lý một yêu cầu API; chưa có thì báo chưa triển khai |
| Contract / DTO | Quy ước dữ liệu API gửi/nhận, ví dụ hồ sơ trả về có `uid`; không phải thiết kế bảng |
| Schema | Cấu trúc database: bảng, cột, quan hệ và các ràng buộc |
| Migration | File SQL lưu một thay đổi schema vào Git để cả team chạy giống nhau |
| Seed / fixture | Dữ liệu mẫu để thử; script seed hiện chỉ tạo Auth user, chưa tạo hồ sơ/ví |
| uid | ID nhận diện user; Supabase SDK gọi là `user.id`, hồ sơ API gọi là `uid` |
| Role / status | Quyền / trạng thái; ADMIN khác USER, ACTIVE khác LOCKED |
| Bootstrap | Tạo dữ liệu ban đầu cho user, ví dụ hồ sơ mặc định; không được tự cấp ADMIN |
| Eligibility | Điều kiện được làm việc gì; ví dụ driver đã duyệt và tài khoản ACTIVE mới được đăng chuyến |
| Token / session | Thông tin chứng minh đã đăng nhập / phiên đăng nhập; SDK quản lý |
| RLS | Luật truy cập từng dòng trong bảng; ví dụ chỉ chủ hồ sơ được xem dữ liệu riêng của mình |
| Grants | Quyền được phép truy cập bảng/hàm; RLS còn kiểm tra dòng nào được phép |
| Constraint | Ràng buộc database để dữ liệu không sai; ví dụ giá trị không được trùng khi cần duy nhất |
| Index | Cấu trúc giúp database tìm dữ liệu nhanh hơn; thêm khi truy vấn cần |
| Transaction | Nhóm thay đổi cùng thành công hoặc cùng thất bại |
| Idempotency | Gửi lại cùng một yêu cầu thì không làm việc đó thêm lần nữa |
| Ledger | Lịch sử tăng/giảm điểm để biết số dư thay đổi vì đâu |
| Concurrent | Hai thao tác xảy ra đồng thời, ví dụ driver nhận hai khách gần như cùng lúc |
| Mock | Thay dịch vụ ngoài bằng dữ liệu kiểm soát được trong test; ví dụ test không gọi VietMap thật |
| PR / review / merge | Yêu cầu ghép code / người khác đọc code / ghép nhánh vào nhánh chung |
| CI | Bộ kiểm tra code tự chạy trên GitHub; “xanh” nghĩa là kiểm tra đã qua |
| Deploy | Đưa thay đổi lên server/hosting; push Git không tự làm việc này trong repo hiện tại |

## 3. Hai khái niệm cần hiểu cho Booking/ví

**Transaction:** khách trả 100.000 điểm, driver nhận 90.000 và app ghi 10.000 phí demo. Nếu ghi ví driver lỗi, cả việc trừ khách cũng phải được hủy. Không được để khách mất điểm mà driver chưa nhận. Nhiều lệnh SDK liên tiếp không tự thành một transaction; owner phải xử lý nguyên tử tại database.

**Idempotency:** khách bấm trả, mạng chậm nên bấm lại. Hai lần gửi cùng yêu cầu chỉ được trả một lần. Với nút thêm điểm thử, gửi lại cùng `requestId` chỉ cấp một lần; lần bấm mới có request mới thì được thêm tiếp. Owner 4/5 cùng team thiết kế cách lưu khóa yêu cầu và test trường hợp này.

## 4. Vì sao backend vẫn phải kiểm tra quyền?

Ẩn nút admin trên giao diện chưa đủ: người dùng có thể tự gửi request. Backend phải lấy user từ phiên đã xác minh và kiểm tra quyền/trạng thái trong dữ liệu server, không tin role hoặc giá do frontend gửi.

Publishable/anon key là key frontend được dùng. Secret/service-role là key quyền cao, có thể bỏ qua RLS nên không đặt trong frontend/Git; backend dùng nó vẫn phải kiểm tra quyền nghiệp vụ. `user_metadata` là thông tin user có thể tác động, không dùng làm nguồn quyền.

API chung dùng giờ theo milliseconds (mili giây), khoảng cách mét, điểm nguyên. Bảng SQL có thể lưu theo kiểu thích hợp rồi chuyển thành API; không tự suy ra schema từ DTO.

Bắt đầu thực hành ở [README](../README.md) và [workflow Supabase](../docs/supabase-workflow.md). Nguồn chính thức khi cần đọc sâu: [React + Supabase](https://supabase.com/docs/guides/getting-started/quickstarts/reactjs), [migrations](https://supabase.com/docs/guides/local-development/database-migrations), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
