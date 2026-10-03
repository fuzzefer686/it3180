# Kế hoạch chung — bản tối giản

Mục tiêu: có web demo ngày 10/10/2026. Nhóm 5 người, số 1 là Lead. Đây là kế hoạch, chưa phải ứng dụng đã triển khai. Cập nhật stack Firebase ngày 03/10/2026.

## 1. V1 làm gì?

Tài xế đăng tuyến xe máy → khách chọn điểm đón/trả → gửi yêu cầu → tài xế nhận một người → đón/trả khách → trả bằng điểm demo → cập nhật ví và lịch sử.

- Ba quyền: ADMIN, DRIVER, USER. DRIVER được dùng chức năng của USER.
- Một chuyến chỉ phục vụ một khách, khách được đi một phần tuyến.
- Tài xế khai báo các điểm dừng; khách chọn trong danh sách đó.
- VietMap vẽ đường xe máy và cung cấp khoảng cách.
- Giá demo: 5.000 điểm/km trên đoạn khách đi, chốt khi xác nhận; làm tròn tới một điểm nguyên.
- Chỉ có một phương thức: ví điểm demo. Mỗi tài khoản khởi tạo 1.000.000 điểm ảo, có nút thêm 100.000 điểm thử; không dùng tiền thật.
- Xác thực sinh viên bằng thông tin và minh chứng mẫu hư cấu, admin duyệt.
- Chưa làm rating, báo cáo đầy đủ, upload thật, GPS, ô tô, chi tiền thật hoặc ghép khách nối tiếp.

## 2. Chốt hàng chờ

Hàng chờ chính là danh sách yêu cầu chưa được tài xế quyết định. Không cần xây hệ thống xếp hàng riêng.

| Tình huống | Quy tắc V1 |
|---|---|
| Khách gửi yêu cầu | Chọn điểm đón/trả, xem giá điểm demo; trạng thái WAITING, chưa giữ chỗ |
| Thứ tự hiển thị | Người gửi trước hiển thị trước; tài xế tự chọn, không tự động ưu tiên |
| Số yêu cầu | Mỗi khách tối đa một yêu cầu đang hoạt động trên một chuyến; không đặt chuyến mình |
| Tài xế nhận khách | Chuyển một yêu cầu sang CONFIRMED; tối đa một khách confirmed/onboard mỗi chuyến |
| Những người còn lại | Vẫn WAITING, thấy chuyến đã có khách và biết mình đang dự phòng |
| Yêu cầu mới khi đã có khách | Không nhận thêm. Nếu khách confirmed hủy trước thời điểm khóa, mở lại đăng ký |
| Khách đang chờ rút | Được rút trước khi yêu cầu hết hạn; không mất phí |
| Khách đã confirmed hủy | Được hủy trước khi được đón, có lý do; không trừ điểm trong V1 |
| Chọn người thay thế | Driver chọn thủ công trong WAITING trước giờ xuất phát và trước khi Trip bắt đầu; không tự chuyển người kế tiếp |
| Trước giờ đi 30 phút | Khóa yêu cầu mới; vẫn được rút/hủy và chọn người từ hàng chờ hiện có trước giờ xuất phát |
| Đến giờ xuất phát hoặc Trip bắt đầu | WAITING còn lại hết hạn; không xác nhận người thay thế nữa |
| Tài xế hủy chuyến | Hủy toàn bộ yêu cầu liên quan, hiển thị lý do |
| Đã đón một khách | Không nhận thêm khách trong phần đường còn lại, dù khách xuống sớm |

Ví dụ: tuyến A→B→C→D; khách1 xin A→C, khách2 xin B→D. Driver nhận khách1, khách2 là dự phòng. Nếu khách1 hủy trước giờ đi, driver có thể nhận khách2. Nếu khách1 đã đi và xuống tại C, chuyến không đón thêm khách khác.

Một yêu cầu bị hủy/từ chối được lưu lịch sử. Khách có thể gửi lại nếu chuyến còn mở và chưa có yêu cầu hoạt động của mình.

Không cần cron cho V1: backend kiểm tra thời gian mỗi lần đọc/thao tác; yêu cầu quá hạn không thể được xác nhận. Kiểm tra cả giờ khởi hành lẫn trạng thái Trip.

## 3. Phân công

| Người | Module | Bàn giao chính |
|---|---|---|
| 1 — Lead | Nền tảng | Cấu trúc repo, Firebase/Emulator, contract chung, CI/deploy, tích hợp |
| 2 | Auth/hồ sơ/quản trị | Đăng ký/login/logout, phân quyền, sinh viên, xe, duyệt driver, khóa tài khoản |
| 3 | Chuyến/VietMap | Đăng/tìm chuyến, điểm dừng, đường đi, bắt đầu/kết thúc/hủy |
| 4 | Đặt chuyến | Giá đoạn đi, hàng chờ, xác nhận/hủy, đón/trả khách |
| 5 | Ví điểm demo | Thanh toán bằng điểm, phí mô phỏng, thêm điểm thử và lịch sử |

Mỗi người làm FE+BE+test. Một repository, một ứng dụng; không microservices, không bắt buộc tạo đủ 23 service trước đó.

## 4. Những điểm cần thống nhất khi bắt đầu

- Stack chốt: React + Vite + TypeScript + Tailwind CSS; Firebase Auth, Firestore, Cloud Functions TypeScript và Firebase Hosting. React Router cho điều hướng, Zod kiểm tra input; Vitest + Firebase Emulator Suite để test.
- 1 dựng Firebase client/Admin SDK, Emulator, wrapper callable và cấu hình môi trường. 2 cung cấp uid/roles/status, driver đủ điều kiện và xe; login/logout dùng Firebase Auth, không tự ký JWT hay lưu mật khẩu.
- 3 cung cấp tripId, stops có thứ tự và khoảng cách từng đoạn trên tuyến đã lưu.
- 4 cung cấp bookingId, người trả/nhận, trạng thái, giá/phí bằng điểm đã chốt cho 5; chỉ dùng phương thức DEMO_WALLET.
- 5 quản lý ví điểm và trạng thái thanh toán. Tạm bỏ số dư âm, công nợ, nộp phí và chặn driver vì nợ.
- Contract function/collection dùng chung có một owner; sửa phải báo người dùng dữ liệu đó. Cả nhóm dùng callable functions cho API nghiệp vụ, FE gọi bằng Firebase SDK.

### Cách dùng Firebase tối giản

- `web/` chứa React; `functions/` chứa backend theo module; root chứa `firebase.json`, `.firebaserc`, `firestore.rules`, `firestore.indexes.json` và kế hoạch. Một repo, không microservices.
- Firestore là database document, không dùng schema/constraint SQL. Collections dự kiến: users, studentVerifications, driverProfiles, vehicles, trips, bookings, wallets, payments, ledgerEntries; stops/route snapshot lưu trong Trip nếu nhỏ và có giới hạn.
- Firebase Auth quản lý tài khoản email/mật khẩu và ID token. Function lấy uid từ `request.auth`, từ chối nếu thiếu; đọc roles/status từ users do backend quản lý. Người dùng không tự sửa quyền/trạng thái duyệt.
- V1 đưa đọc/ghi nghiệp vụ qua callable functions. Firestore Rules mặc định chặn mọi truy cập trực tiếp từ client; Admin SDK ở Functions không chịu Rules, nên từng function phải kiểm tra quyền và Zod input.
- Không trả số điện thoại/minh chứng qua API danh sách chuyến. Contact chỉ cấp cho hai bên có Booking xác nhận; admin có quyền xem hồ sơ duyệt.
- Firestore transaction chống nhận hai khách và trả điểm trùng. Function transaction có thể chạy lại: đọc trước khi ghi, không gọi VietMap hoặc làm tác vụ bên ngoài trong transaction.
- Chưa thêm Realtime Database, Storage/upload thật, FCM/push hoặc listener realtime. Dùng refresh dữ liệu khi thao tác để giảm việc tuần đầu.
- Lead tạo admin đầu tiên qua script tin cậy/local seed; không có API công khai tự cấp ADMIN. Tài khoản cloud và demo dùng dữ liệu hư cấu.

Deploy Cloud Functions cần **Blaze + billing**; có quota miễn phí nhưng có thể phát sinh phí. Emulator chạy local không cần bật billing. Ba môi trường cloud dùng ba Firebase project riêng, xem [hosting](06-hosting-cicd.md).

## 5. Trạng thái và ví điểm demo

Trip: OPEN → IN_PROGRESS → COMPLETED; có CANCELLED trước khi bắt đầu.
Booking: WAITING → CONFIRMED → ONBOARD → COMPLETED; có REJECTED/CANCELLED/EXPIRED.
Payment: PENDING → SUCCEEDED hoặc FAILED.

Khách xuống xe thì Booking hoàn thành và được thanh toán bằng điểm; Trip có thể vẫn đi đến cuối tuyến. Trip không kết thúc khi còn khách confirmed/onboard chưa được xử lý.

| Ví dụ chuyến 100.000 điểm, phí 10% | Thay đổi |
|---|---:|
| Ví hành khách | −100.000 điểm |
| Ví tài xế | +90.000 điểm |
| Tài khoản phí mô phỏng của app | +10.000 điểm |

Điểm là số nguyên, không có giá trị tiền và không quy đổi ra tiền. Cấp điểm ban đầu và thêm điểm thử đều lưu lịch sử riêng. Nút thêm điểm chỉ cấp cho ví của người đang đăng nhập; backend cố định 100.000 điểm/lần, không nhận số tùy ý từ FE.

Chỉ trả sau Booking COMPLETED. Thiếu điểm thì báo lỗi, giữ nguyên các ví; khách thêm điểm thử rồi trả lại. Một Booking chỉ thanh toán thành công một lần. Trừ khách, cộng tài xế, ghi phí và lịch sử phải cùng thành công hoặc cùng thất bại; không để số dư âm kể cả hai giao dịch đồng thời.

V1 tạm bỏ cash, PayOS, công nợ và rút tiền. Sau này có thể bổ sung provider thanh toán thật, nhưng phải thiết kế luồng tiền thật riêng; không đổi trực tiếp điểm đã cấp thử thành tiền.

## 6. Lịch một tuần

| Mốc | Cả nhóm cần có |
|---|---|
| 03/10 | Đọc kế hoạch, chốt contract function/collections và thời gian mỗi người; kiểm tra điều kiện billing |
| 04–05/10 | Repo chạy bằng Emulator; Firebase Auth/hồ sơ; VietMap; fixture cho Booking/Payment; deploy dev nếu đã có billing |
| 06–07/10 | Đăng chuyến → hàng chờ → nhận một khách → đón/trả → trả điểm |
| 08/10 | Nối ví điểm/lịch sử; kiểm tra thiếu điểm và bấm lặp; dừng thêm chức năng |
| 09/10 | Kiểm thử staging; đưa bản ổn lên production-demo |
| 10/10 | Demo và thời gian dự phòng |

Nếu trễ, cắt dashboard/UI cầu kỳ và tìm địa chỉ nâng cao trước. Giữ luồng trả điểm hoàn chỉnh, RBAC, chống nhận hai khách và lịch sử giao dịch.

## 7. Hoàn thành khi nào?

- Chạy được luồng chính, dữ liệu lưu ở DB, backend kiểm tra quyền.
- Hai thao tác nhận khách đồng thời chỉ một người thành công.
- Khách xuống giữa tuyến có thể thanh toán; Trip chưa buộc kết thúc.
- Thanh toán điểm không ghi trùng, không âm ví; thiếu điểm không làm thay đổi ví nào.
- Mỗi người có use case ngắn, collection/contract function, test quan trọng và giải thích được code.
- Client không tự đổi quyền, trạng thái chuyến/Booking hay số dư; Functions kiểm tra quyền cả khi dùng Admin SDK. Test chạy với Auth/Firestore/Functions Emulator.
- Có một người khác review; build/test qua trước merge.

Review chéo: 2↔1, 3↔4; 1 review 5, 5 review phần deploy của 1. Lead giúp gỡ vướng và tích hợp, không sửa hộ toàn bộ module.

Nguồn kỹ thuật: [Callable functions](https://firebase.google.com/docs/functions/callable), [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions), [Emulator Suite](https://firebase.google.com/docs/emulator-suite).
