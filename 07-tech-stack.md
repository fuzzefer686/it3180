# Tech stack — cả nhóm đọc trước khi code

Chốt ngày 03/10/2026. Cả 5 người dùng cùng stack và làm FE + BE + test theo module. Không cần mỗi người chọn framework riêng.

## Công cụ chung và tác dụng

| Công nghệ | Dùng để làm gì? | Ai cần hiểu? |
|---|---|---|
| TypeScript | Ngôn ngữ chung, kiểm tra kiểu dữ liệu trước khi chạy | Cả nhóm |
| React | Viết trang, component, form và trạng thái giao diện | Cả nhóm |
| Vite | Chạy frontend local và build frontend | Cả nhóm dùng; 1 cấu hình |
| React Router | Chuyển giữa các trang trong app | Cả nhóm |
| Tailwind CSS | Viết giao diện bằng utility classes, dùng component chung | Cả nhóm |
| Firebase Web SDK (`firebase`) | FE gọi Auth và callable Functions | Cả nhóm |
| Firebase Authentication | Đăng ký email/mật khẩu, login/logout, quản lý ID token | 2 làm; cả nhóm hiểu uid |
| Cloud Functions (`firebase-functions`) | Backend TypeScript kiểm tra quyền và xử lý nghiệp vụ | Cả nhóm |
| Firebase Admin SDK (`firebase-admin`) | Backend truy cập Firestore với quyền server | Cả nhóm làm BE |
| Cloud Firestore | Lưu document trong collections, có transaction | Cả nhóm |
| Zod | Kiểm tra dữ liệu function nhận, không tin input FE | Cả nhóm |
| Vitest | Test giá, trạng thái, quyền và xử lý đồng thời | Cả nhóm |
| Firebase Emulator Suite | Chạy Auth/Firestore/Functions local và test không chạm cloud | Cả nhóm dùng; 1 cấu hình |
| Firebase CLI (`firebase-tools`) | Chạy Emulator, quản lý cấu hình, deploy | 1 cấu hình; cả nhóm dùng local |
| Firebase Hosting | Đưa React SPA lên domain web.app | 1 |
| Git/GitHub + GitHub Actions | Branch, PR, review, tự kiểm tra và deploy | Cả nhóm; 1 cấu hình CI |
| VietMap GL JS + REST API | Hiển thị bản đồ, tìm địa chỉ, định tuyến xe máy | 3 làm; 4 dùng dữ liệu tuyến |

Node.js và npm là công cụ phát triển/build. Lead chọn bản Node được Cloud Functions hỗ trợ và tương thích Vite/Vitest; cố định version và lockfile để cả nhóm chạy giống nhau. Emulator cần Java theo yêu cầu Firebase CLI; ghi version trong README setup.

## Từng người tập trung gì?

| Người | Module | Phần cần học kỹ nhất | Kết quả đầu tiên |
|---|---|---|---|
| 1 — Lead | Nền tảng/tích hợp | CLI, Emulator, config, GitHub Actions, Rules/indexes | Một trang React gọi function và đọc Firestore được |
| 2 | Auth/hồ sơ/admin | Auth SDK, uid, phân quyền server, dữ liệu hồ sơ | Login/logout và user gọi admin bị chặn |
| 3 | Trip/VietMap | VietMap GL JS/REST, tọa độ, khoảng cách, lưu route | Đăng tuyến xe máy, vẽ đường và lưu stops |
| 4 | Booking/hàng chờ | Firestore transaction, trạng thái, server time | Hai confirm đồng thời chỉ một khách được nhận |
| 5 | Ví điểm | Transaction, ledger, idempotency | Trả điểm đúng một lần, thiếu điểm không đổi ví |

## Luồng kỹ thuật cần hiểu

1. Người 2 đăng nhập bằng Firebase Auth; Firebase cấp uid/ID token, không tự viết JWT.
2. React gọi callable function bằng SDK; SDK gửi token, Functions xác minh token nếu có.
3. Function bắt buộc kiểm tra request.auth và đọc quyền/status hiện tại; Zod kiểm tra input.
4. Function dùng Admin SDK đọc/ghi Firestore; Booking/ví cần transaction.
5. Function trả dữ liệu cho React hiển thị; FE không ghi trực tiếp roles, Trip, Booking hoặc ví.

Admin SDK bỏ qua Firestore Rules, nên Rules không thay thế việc kiểm tra quyền trong function. V1 chặn toàn bộ client đọc/ghi Firestore trực tiếp; các màn hình đọc dữ liệu cũng gọi Functions. Dùng refresh sau thao tác, chưa cần realtime listener.

## Những gì cần thống nhất

- Lead cung cấp Firebase client, Functions region, wrapper gọi callable và cấu hình Emulator. Mọi người dùng cùng instance và region; không tự tạo project riêng cho module.
- Mỗi function có input/output và lỗi rõ ràng; uid lấy từ auth, không lấy ID người thao tác từ FE. Có pagination/giới hạn ở API danh sách.
- Khoảng cách lưu theo mét; giờ lưu Timestamp, backend quyết định cutoff; điểm là số nguyên. Cùng dùng types và trạng thái đã chốt.
- Test unit và test Functions/Firestore bằng Emulator; test Rules xác nhận client bị chặn. Không gọi cloud hoặc VietMap thật trong CI.
- Thư viện và file config chung do lead quản lý; cần thêm dependency thì ghi lý do trong PR. Mỗi người phải giải thích được code trước khi merge.

**Hosting:** deploy Functions cần Blaze + billing; demo local bằng Emulator không cần bật billing. Xem [hosting/CI](06-hosting-cicd.md). Đây là danh sách công nghệ và kế hoạch, chưa có ứng dụng đã triển khai.

Nguồn: [Firebase Web setup](https://firebase.google.com/docs/web/setup), [Callable Functions](https://firebase.google.com/docs/functions/callable), [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions), [Emulator](https://firebase.google.com/docs/emulator-suite), [VietMap](https://maps.vietmap.vn/docs/).
