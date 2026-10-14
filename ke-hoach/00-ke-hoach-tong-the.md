# Kế hoạch chung — bản tối giản

Nhóm 5 người, số 1 là Lead. Đây là kế hoạch, chưa phải ứng dụng đã triển khai. Cập nhật stack Supabase ngày 12/10/2026. Mốc demo 10/10 là mục tiêu lịch sử, nhóm cần chốt lịch tiếp theo. Đọc [workflow Supabase](../docs/supabase-workflow.md) để chọn cách chạy và gửi thay đổi database.

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

Không cần cron (tác vụ chạy theo lịch) cho V1: backend kiểm tra thời gian mỗi lần đọc/thao tác; yêu cầu quá hạn không thể được xác nhận. Kiểm tra cả giờ khởi hành lẫn trạng thái Trip.

## 3. Phân công

| Người | Module | Bàn giao chính |
|---|---|---|
| 1 — Lead | Nền tảng | Cấu trúc repo, Supabase/config/local Docker, contract chung, CI/deploy, tích hợp |
| 2 | Auth/hồ sơ/quản trị | Đăng ký/login/logout, phân quyền, sinh viên, xe, duyệt driver, khóa tài khoản |
| 3 | Chuyến/VietMap | Đăng/tìm chuyến, điểm dừng, đường đi, bắt đầu/kết thúc/hủy |
| 4 | Đặt chuyến | Giá đoạn đi, hàng chờ, xác nhận/hủy, đón/trả khách |
| 5 | Ví điểm demo | Thanh toán bằng điểm, phí mô phỏng, thêm điểm thử và lịch sử |

Mỗi người làm giao diện, xử lý backend và test phần mình. Một repo dùng chung cho cả nhóm, không tách thành nhiều hệ thống.

## 4. Thống nhất trước khi code

1. Người 1 giữ cấu hình và code chung. Người 2 quản lý đăng nhập, quyền và điều kiện được tham gia.
2. Người 3 giao điểm dừng/khoảng cách cho 4. Người 4 giao Booking đã hoàn thành và giá/phí đã chốt cho 5.
3. Mỗi người mô tả API của mình gửi/nhận gì (contract), rồi team thống nhất bảng và quyền. Contract không tự quyết định cấu trúc bảng.
4. Làm giao diện có thể dùng server dev, không Docker. Làm database/backend thì Docker local, migration và test trước PR. Lead cập nhật server sau review. Xem [workflow từng bước](../docs/supabase-workflow.md).

Các quy tắc không được bỏ khi làm đơn giản:

- SDK quản lý password/phiên; server kiểm tra ai đang login, quyền và trạng thái, không tin dữ liệu quyền do frontend gửi.
- Tạo hồ sơ lần đầu chỉ cấp mặc định an toàn, không ADMIN. Nghiệp vụ kiểm tra ACTIVE và đủ điều kiện (eligibility).
- Frontend không tự sửa role, giá hoặc ví. Luật truy cập bảng (RLS/grants) và quyền hàm backend phải được thiết kế/test cùng nhau.
- Booking/ví cùng thành công hoặc cùng thất bại (transaction), gửi lại không ghi trùng (idempotency). Không gọi VietMap trong transaction.
- Số điện thoại chỉ cho hai bên sau khi nhận khách; minh chứng mẫu chỉ chủ hồ sơ/admin xem.
- Seed hiện chỉ tạo Auth user, chưa có hồ sơ/admin/ví. API thiếu phải báo chưa triển khai; không trả thành công giả.

[Tài liệu công cụ](07-tech-stack.md) có ví dụ giải thích từng thuật ngữ. Team không cần dựng pipeline deploy database/backend tự động hoặc thêm Storage/realtime lúc bắt đầu. Pages có thể tự build/deploy frontend qua kết nối Git trên Dashboard.

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

## 6. Thứ tự triển khai tiếp theo

1. Cả nhóm chạy đúng cách, chốt dữ liệu API/bảng/quyền và biết phần mình cần dữ liệu của ai.
2. Người 2 làm hồ sơ ban đầu/điều kiện tham gia; 3 làm tuyến/chuyến; 4/5 dùng dữ liệu mẫu ghi rõ là mẫu trong lúc chờ phần của bạn khác.
3. Hoàn thiện hàng chờ → nhận một khách → đón/trả → điểm demo bằng transaction.
4. Tích hợp migrations và module đã review lên server dev, kiểm thử luồng chung rồi PR dev → main.

Nhóm tự chốt ngày mới theo tiến độ; nếu trễ, cắt dashboard/UI cầu kỳ và tìm địa chỉ nâng cao trước. Giữ kiểm tra quyền, chống nhận hai khách và lịch sử điểm/chống trả trùng.

## 7. Hoàn thành khi nào?

- Chạy được luồng chính, dữ liệu lưu ở database, backend kiểm tra quyền.
- Hai thao tác nhận khách đồng thời chỉ một người thành công.
- Khách xuống giữa tuyến có thể thanh toán; Trip chưa buộc kết thúc.
- Thanh toán điểm không ghi trùng, không âm ví; thiếu điểm không làm thay đổi ví nào.
- Mỗi người có use case ngắn, mô tả bảng/dữ liệu API, test quan trọng và giải thích được code.
- Client không tự đổi quyền, trạng thái chuyến/Booking hay số dư; backend kiểm tra quyền cả khi dùng service-role. Test chạy với Supabase local Docker.
- Có một người khác review; build/test qua trước merge.

Review chéo: 2↔1, 3↔4; 1 review 5, 5 review phần deploy của 1. Lead giúp gỡ vướng và tích hợp, không sửa hộ toàn bộ module.

Quy trình kỹ thuật: [Supabase workflow của team](../docs/supabase-workflow.md), [contracts](../docs/contracts.md).
