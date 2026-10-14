# Kế hoạch hoàn thiện Về Cùng trong 3 tuần

**Lịch dự kiến: 15/10–04/11/2026.** Nhóm 5 sinh viên năm 3; giữ nguyên phần đã giao. Theo dõi bằng task, phần bàn giao và kết quả kiểm thử, không đặt chỉ tiêu số giờ. Nếu nhóm đổi ngày bắt đầu, dịch các mốc tương ứng nhưng giữ thứ tự phụ thuộc.

**Mục tiêu cuối đợt:** đăng ký → gửi hồ sơ → admin duyệt → tài xế đăng chuyến → khách gửi yêu cầu → tài xế nhận một khách → đón/trả giữa tuyến → khách trả điểm demo → hai bên xem ví và lịch sử.

## 1. Điểm xuất phát và việc cần làm trước

Ngày 14/10, bản làm việc local đã chuyển sang Supabase và có login/logout; chưa có bảng ứng dụng hoặc API nghiệp vụ. Kiểm thử Auth local gần nhất được ghi ngày 12/10, không chứng minh các module đã xong. Nhánh `dev` trên GitHub vẫn là nền Firebase. Vì vậy **lead phải đưa bản chuyển Supabase qua PR/review trước khi các bạn tạo nhánh code nghiệp vụ từ dev**.

PR kế hoạch này chỉ bổ sung tài liệu; không đưa bản chuyển Supabase, bảng dữ liệu hoặc backend lên dev. Không chạy các lệnh Supabase bên dưới trên bản Firebase cũ. Sau khi PR nền Supabase được merge, lead cập nhật hướng dẫn chạy và kế hoạch module cho cả nhóm.

Trong ngày đầu, lead đối chiếu các nhánh/PR module đã có với tác giả. Ví dụ đã có nhánh ví `feat/5-wallet`: người 5 kiểm tra phần nào dùng lại được với Supabase, không mặc định nhánh cũ đã đáp ứng kế hoạch hoặc cần viết lại tất cả.

Đây là lịch làm việc, **chưa chốt cấu trúc SQL thay team**. Các owner tự đề xuất bảng/cột/quyền, thống nhất phần liên quan rồi mới viết migration. Migration là file SQL lưu thay đổi database để các máy có thể tạo cùng cấu trúc.

## 2. Ai làm gì?

| Người | Tuần 1: thiết kế và code module | Tuần 2: ghép luồng | Tuần 3: kiểm thử và bàn giao |
|---|---|---|---|
| 1 — Lead | Đưa nền Supabase vào dev; tổ chức chốt dữ liệu; quản lý shared/config/CI và thứ tự migration | Chủ trì tích hợp 2 → 3 → 4 → 5; sửa phần chung, review và điều phối merge | Điều phối test toàn app, tổng hợp lỗi, chốt bản demo |
| 2 — Auth/hồ sơ/admin | Đăng ký, hồ sơ sinh viên/driver, duyệt/từ chối, khóa/mở tài khoản; backend quyền và test | Bàn giao dữ liệu quyền/điều kiện tham gia cho 3/4/5; sửa lỗi của Auth/hồ sơ/admin | Test quyền, dữ liệu riêng tư và tài khoản bị khóa |
| 3 — Trip/VietMap | Thiết kế dữ liệu tuyến/chuyến; bản đồ, đăng/tìm/chi tiết chuyến và thao tác chủ chuyến | Nối điểm dừng/khoảng cách cho 4; cùng 4 hoàn thiện start/cancel/complete | Test tuyến xe máy, sai chủ, lỗi bản đồ và vòng đời chuyến |
| 4 — Booking | Thiết kế yêu cầu/giá; gửi/rút, hàng chờ, nhận/từ chối, hủy, đón/trả và test | Nối quyền từ 2, chuyến từ 3, giá/Booking hoàn thành cho 5 | Test cutoff, nhận khách đồng thời, hủy/thay khách và trả giữa tuyến |
| 5 — Ví điểm demo | Thiết kế ví/thanh toán/lịch sử; khởi tạo ví, thêm điểm, trả Booking và test | Nối user từ 2 và Booking/giá từ 4 vào thanh toán thật trên database local | Test trả trùng, thiếu điểm, đồng thời, lỗi giữa chừng và lịch sử |

**Lead ghép các module, không viết hộ toàn bộ module.** Mỗi owner giao cả giao diện, backend, migration và test; khi tích hợp bị lỗi, owner sửa phần của mình. Người 3/4 phối hợp chặt vì thao tác chuyến và nhận khách có thể xảy ra cùng lúc.

## 3. Hiểu đúng phần Auth của người 2

Supabase Auth có sẵn việc đăng ký tài khoản, kiểm tra email/mật khẩu và quản lý phiên đăng nhập. Người 2 dùng SDK để nối các form vào dịch vụ này; không tự lưu password hoặc viết bộ cấp token.

Phần người 2 còn phải làm cho Về Cùng là hồ sơ, xác minh sinh viên, hồ sơ xe/tài xế, duyệt quyền và khóa tài khoản. Ví dụ đăng nhập đúng chưa có nghĩa được đăng chuyến: backend phải đọc trạng thái tài khoản và điều kiện làm tài xế hiện tại từ dữ liệu server. Không tin quyền trong `user_metadata` hoặc frontend gửi lên.

| Cần làm | Người 2 cần gì? | Có phải được mời vào Dashboard Supabase không? |
|---|---|---|
| Viết/test Auth và database trên máy | Code nền Supabase, Node 22, Docker; dùng Supabase local | Không |
| Chạy frontend với server dev | URL, publishable key và tài khoản thử của app | Không |
| Xem/cấu hình Auth trong Dashboard của server | Tài khoản Supabase riêng, được lead mời và cấp quyền phù hợp | Có, nếu được giao việc quản trị server |

Mặc định lead quản lý Dashboard/server dev; người 2 gửi code và migration qua PR. Quyền quản trị Supabase khác với ADMIN trong app Về Cùng. Lead không chia sẻ tài khoản quản trị hoặc secret/service-role key cho frontend. Cách cấp ADMIN đầu tiên trong app phải được team thiết kế và lead thực hiện bằng cách tin cậy; user không tự cấp ADMIN.

Tài liệu chính thức: [Supabase Auth](https://supabase.com/docs/guides/auth) và [quyền quản trị Supabase](https://supabase.com/docs/guides/platform/access-control).

## 4. Tuần 1 — 15/10–21/10: chốt bảng và code từng module

**Kết quả cần có:** mỗi người 2–5 có module chạy được trên Supabase local, có phần bàn giao rõ ràng. Luồng riêng dùng database thật; dữ liệu thay cho module chưa sẵn sàng chỉ được dùng làm mẫu kiểm thử có ghi nhãn, không trả thành công giả trong app.

### Các mốc chung

| Mốc | Việc cần làm | Kết quả mong đợi |
|---|---|---|
| 15/10 | Lead chuẩn bị PR chuyển Supabase dựa trên dev mới, rà phần code cũ; mỗi owner đề xuất dữ liệu/quyền và chia task nhỏ | Có PR nền, danh sách việc và người review; owner có thể thiết kế trong khi chờ merge |
| Chậm nhất 16/10 | Nền Supabase được review/test rồi merge; cả nhóm thử local và thống nhất dữ liệu liên quan | Mỗi người chạy được nền chung; chốt API gửi/nhận, bảng cần có, quyền đọc/ghi và thứ tự migration |
| 19/10 | 2 bàn giao hồ sơ/quyền ban đầu; 3 bàn giao tuyến/điểm dừng/khoảng cách; 4 bàn giao dữ liệu Booking/giá cho 5 | Các bạn phụ thuộc có dữ liệu ổn định để code, không tự đoán field |
| 20/10 | Các owner nối UI với backend phần mình và bổ sung test quan trọng | Đọc/ghi dữ liệu local thật; lỗi và phần chưa làm hiện rõ |
| 21/10 | Demo từng module, review các PR nhỏ và ghi phần chưa đạt | Có danh sách module đủ điều kiện tích hợp tuần 2; chưa đạt thì ghi task còn thiếu và owner |

Nếu nền Supabase hoặc thiết kế chung chưa chốt ngày 16/10, lead cập nhật lịch và gỡ vướng ngay. Các owner tiếp tục thiết kế/UI với mẫu có nhãn; không triển khai bảng trên nền Firebase hoặc tùy ý sửa server chung để chạy kịp.

### Task nhỏ theo người

Mỗi dòng có thể chia thành vài PR nhỏ, làm xong một việc có thể kiểm tra rồi mới làm việc tiếp theo.

| Mã | Người | Task theo thứ tự | Điều kiện bàn giao cuối tuần |
|---|---|---|---|
| N1 | 1 | PR nền Supabase → chạy lại kiểm tra → tổ chức chốt dữ liệu/quyền → rà shared/config/CI và thứ tự migration | Dev có nền Supabase; nhóm chạy được local; mọi thay đổi chung có owner/reviewer và thông báo người phụ thuộc |
| A1 | 2 | Đăng ký qua SDK, lỗi đăng nhập, phiên/logout → tạo hồ sơ ban đầu đúng một lần và sửa hồ sơ của mình | Có user thật và hồ sơ local; mặc định USER/ACTIVE; không tự cấp quyền; test sai password/sai chủ |
| A2 | 2 | Thông tin sinh viên, xe và driver → admin duyệt/từ chối có lý do, khóa/mở tài khoản | API trả điều kiện tham gia cho 3/4; user thường bị từ chối khi gọi thao tác admin; dùng minh chứng hư cấu |
| T1 | 3 | Đề xuất dữ liệu điểm dừng/tuyến/chuyến → hiển thị bản đồ và tính tuyến xe máy → lưu tuyến/khoảng cách đáng tin cậy | Tuyến A→B→C→D có điểm dừng đúng thứ tự, khoảng cách mét; REST key ở backend; lỗi map không lưu khoảng cách giả |
| T2 | 3 | Đăng, tìm theo điểm/ngày, xem chi tiết → start/cancel/complete theo quyền chủ chuyến | Có chuyến local; kiểm tra quyền/trạng thái ở server; thống nhất với 4 cách bảo vệ thao tác chuyến và nhận khách |
| B1 | 4 | Đề xuất dữ liệu Booking/giá → chọn đón/trả → gửi/rút yêu cầu → hàng chờ và từ chối | Điểm trả sau điểm đón trên cùng tuyến; mỗi khách một yêu cầu hoạt động/chuyến; gửi lại không tạo trùng; không tự đặt chuyến mình |
| B2 | 4 | Nhận một khách, hủy/thay người dự phòng → đón/trả → kiểm tra cutoff/giá phía server | Có luồng WAITING→CONFIRMED→ONBOARD→COMPLETED; transaction chống nhận hai khách; giao giá chốt cho 5 |
| W1 | 5 | Đề xuất dữ liệu ví/thanh toán/lịch sử → cấp ban đầu → số dư/lịch sử → thêm điểm thử | Một ví/user; 1.000.000 điểm ban đầu đúng một lần; thêm 100.000 điểm/lần, retry không cấp lại |
| W2 | 5 | Thanh toán Booking COMPLETED → trừ/cộng/ghi phí/lịch sử trong một transaction → lỗi thiếu điểm/sai người trả | Test local với Booking mẫu đã thống nhất cùng 4; giá lấy từ server; không trùng thanh toán hoặc thay đổi ví dở dang |

Người 2–5 đều viết migration cho phần mình **sau khi thiết kế được nhóm chốt**, kèm quyền truy cập và test. RLS là luật cho phép user đọc/sửa từng dòng; grants là quyền truy cập bảng/hàm. Lead kiểm tra phần giao nhau, không tự thiết kế tất cả bảng thay owner.

## 5. Tuần 2 — 22/10–28/10: lead ghép module, owner hỗ trợ

**Kết quả cần có:** chạy được một luồng hoàn chỉnh trên Supabase local bằng tài khoản và dữ liệu thật trong database. Lead điều phối từng bước dưới đây, không đợi đến cuối tuần mới ghép tất cả.

| Mốc | Lead làm gì? | Owner hỗ trợ gì? | Cách biết đã nối được |
|---|---|---|---|
| 22/10: 2 + 3 | Review/merge hồ sơ và Trip theo thứ tự; thống nhất code chung lấy user/quyền | 2 cung cấp điều kiện làm driver; 3 kiểm tra điều kiện ở backend | Admin duyệt driver → driver đăng chuyến; chưa duyệt/bị khóa thì bị từ chối |
| 23/10: 3 + 4 | Ghép chi tiết chuyến, điểm dừng, gửi yêu cầu và queue | 3 giao tuyến đã lưu; 4 nối điểm đón/trả và giá; cùng bảo vệ confirm/start/cancel | Hai khách xin đi A→C; driver tự nhận một người; chỉ một Booking được xác nhận |
| 26/10: 2 + 4 + 5 | Ghép tạo ví, Booking hoàn thành và nút trả điểm | 2 giao uid; 4 giao trạng thái/giá chốt; 5 nối thanh toán và lịch sử | Trả khách ở C → trả điểm được dù Trip chưa kết thúc; các ví và phí đúng |
| 27/10: toàn app | Chạy lại từ database local được tạo bằng migrations; kiểm tra API/UI dùng cùng dữ liệu | Mỗi owner sửa lỗi phần mình, xử lý test thất bại và thông báo thay đổi contract | Không cần sửa tay database để chạy demo; không dùng fixture thay cho module đã nối |
| 28/10: nghiệm thu luồng | Demo luồng chính; tổng hợp lỗi và trạng thái PR/CI | 2–5 giải thích phần mình, ghi bằng chứng test và task còn thiếu | Luồng chính qua trên local; có danh sách lỗi được giao người sửa cho tuần 3 |

Sau khi code/migration đã review và test local qua, **nếu đã có server dev và lead được giao cập nhật server**, lead áp dụng code đã review theo workflow Supabase rồi cả nhóm thử chung. Nếu thiếu server/config/quyền, tiếp tục nghiệm thu local và ghi rõ chưa test server. Kế hoạch không tự cho phép tạo project, bật billing hoặc deploy; Git push không tự cập nhật database.

Khi module giao chậm: lead ghi rõ dữ liệu/API thiếu, owner chịu trách nhiệm sửa; các phần độc lập vẫn tiếp tục. Mẫu kiểm thử giúp module khác làm việc, nhưng không được tính là đã tích hợp thành công.

## 6. Tuần 3 — 29/10–04/11: kiểm thử, sửa lỗi và demo

**Kết quả cần có:** các trường hợp bắt buộc dưới đây đều qua, có tài liệu ngắn và bản dev ổn định. Không thêm tính năng mới làm chậm luồng chính.

| Mốc | Công việc | Người chịu trách nhiệm |
|---|---|---|
| 29/10 | Test quyền, sai chủ, user chưa duyệt/bị khóa; thử gửi request trực tiếp chứ không chỉ bấm UI | 2 kiểm tra Auth/quyền; 3/4/5 xác nhận từng API của mình từ chối đúng |
| 30/10 | Test hai thao tác cùng lúc, cutoff, hủy/thay khách, thiếu điểm, retry và lỗi giữa chừng | 3 + 4 kiểm tra Trip/Booking; 5 kiểm tra ví; lead rà bằng chứng |
| 02/11 | Sửa lỗi đã phát hiện, chạy lại test liên quan; test tạo database local từ migrations | Owner sửa module của mình; lead kiểm tra thứ tự và ghép PR đã qua review |
| 03/11 | Chạy toàn bộ kiểm tra trên dev; thử UI mobile, lỗi/màn hình trống; diễn tập demo | Lead điều phối; cả nhóm dùng các tài khoản test riêng |
| 04/11 | Demo cuối, bàn giao use case/dữ liệu/API/test và phần còn thiếu; xem có đủ điều kiện PR dev→main không | Mỗi owner giải thích phần mình; lead tổng hợp, chỉ chuyển bản ổn sau review |

### Các ca bắt buộc để được coi là xong

| Phần | Cần thử | Kết quả mong đợi |
|---|---|---|
| Auth/hồ sơ | Sai mật khẩu, tải lại trang, logout; gọi tạo hồ sơ lặp | Lỗi dễ hiểu; phiên đúng; hồ sơ không tạo trùng hoặc tự cấp ADMIN |
| Quyền và riêng tư | User sửa hồ sơ người khác, tự đổi role, gọi admin; tài khoản LOCKED gọi nghiệp vụ | Server từ chối; minh chứng chỉ chủ/admin xem; điện thoại chỉ hai bên sau confirmed |
| Trip | Sai chủ start/cancel/complete, chưa đủ điều kiện đăng; VietMap lỗi | Server từ chối thao tác sai; không lưu tuyến/khoảng cách giả; báo lỗi rõ |
| Giá | Đoạn A→C dùng AB+BC của tuyến đã lưu; FE gửi giá sửa; sửa tuyến/giờ khi đã confirmed | Backend tính 5.000 điểm/km, làm tròn tới điểm nguyên; phí 10% làm tròn xuống; không tin giá FE; khóa sửa tuyến/giờ |
| Queue | Gửi lặp, đặt chuyến mình, điểm trả trước điểm đón, gửi mới tại/sau T−30 | Không tạo yêu cầu sai/trùng; server khóa request mới từ 30 phút trước giờ đi |
| Confirm | Hai confirm đồng thời; confirm cùng start/cancel; confirm sau giờ đi hoặc sau start | Tối đa một khách được nhận; trạng thái không mâu thuẫn; không nhận người thay thế quá hạn |
| Hủy/thay khách | Khách confirmed hủy trước pickup; driver hủy chuyến; khách WAITING rút | Hủy/rút không trừ điểm trong V1; chọn người dự phòng thủ công trước giờ đi/start; chuyến hủy thì yêu cầu không dùng được |
| Đón/trả | Chỉ chủ Trip được pickup/dropoff; khách xuống C trên tuyến A→D | Booking COMPLETED ở C; Trip có thể tiếp tục; không đón khách thứ hai hoặc xóa cờ đã phục vụ; không complete Trip khi khách chưa xử lý |
| Khởi tạo/thêm điểm | Tạo ví lặp; top-up cùng requestId; FE gửi số điểm khác | Cấp ban đầu 1.000.000 đúng một lần; cùng requestId chỉ thêm 100.000 một lần; không nhận số tùy ý |
| Thanh toán | Sai người trả, Booking chưa COMPLETED, thiếu điểm, bấm lại với cùng hoặc khác requestId | Từ chối đúng; thiếu điểm không đổi ví; một Booking chỉ trả thành công một lần |
| Transaction ví | Hai thanh toán đồng thời và lỗi giữa trừ khách/cộng driver/ghi lịch sử | Không âm ví; tất cả cùng thành công hoặc cùng hủy; số dư nhất quán với lịch sử |

Transaction nghĩa là các thay đổi phải cùng xong hoặc cùng hủy, ví dụ không được trừ khách rồi lỗi trước khi cộng tài xế. Idempotency nghĩa là gửi lại một yêu cầu không làm lại giao dịch, ví dụ bấm thanh toán hai lần không mất điểm hai lần. Hai kiểm tra này phải làm trong backend/database, không chỉ khóa nút UI. Không gọi VietMap trong transaction.

## 7. Cách làm một task mỗi ngày

1. Chọn một task nhỏ trong bảng, ghi owner, reviewer và kết quả cần thấy. Ví dụ: “khách rút yêu cầu WAITING của mình được, user khác bị từ chối”.
2. Lấy dev mới và tạo nhánh riêng cho task, sau khi nền Supabase đã merge. PR là yêu cầu ghép nhánh của mình vào dev; không push thẳng dev/main.
3. Sửa giao diện/backend/test của phần mình. Nếu đổi dữ liệu chung, báo người phụ thuộc trước; lead quản lý thay đổi shared/config.
4. Thử đúng trường hợp thành công và ít nhất một trường hợp bị từ chối. Backend/database phải test với Supabase local trong Docker.
5. Gửi PR nhỏ vào dev: ghi đã làm gì, test gì, còn thiếu gì. Reviewer khác tác giả đọc code và test; CI, tức kiểm tra GitHub tự chạy, phải qua trước merge.
6. Cập nhật cuối buổi bằng ba dòng: đã xong gì, tiếp theo làm gì, đang vướng ai/phần nào. Vướng đến buổi kế tiếp thì báo lead để gỡ, không im lặng chờ.

Review chéo giữ như phân công: 1↔2, 3↔4; 1 review 5, 5 review CI/config của 1. Mỗi người có một task chính đang làm; sửa lỗi tích hợp phần mình được ưu tiên.

### Lệnh chạy sau khi nền Supabase có trên dev

Tất cả lệnh ở **thư mục gốc CNPM**, nơi có `package.json`, không ở `web/`. Cài Node 22 (từ 22.12) và chạy `npm ci` lần đầu.

| Cần làm gì? | Lệnh tại gốc CNPM | Kết quả mong đợi | Lỗi thường gặp |
|---|---|---|---|
| Chạy UI dùng server dev đã cấu hình | `npm run dev:web` | Web mở được, login bằng tài khoản thử trên server | Thiếu URL/publishable key; tài khoản local không tồn tại trên server; đổi env phải chạy lại web |
| Code/test backend trên máy | Mở Docker Desktop, rồi `npm run dev` | Supabase local và web chạy; script tạo Auth user thử | Docker chưa mở, trùng cổng; env server có thể bị đổi sang local nên lưu bản cấu hình riêng trước |
| Kiểm tra UI khi chưa có Docker | `npm run typecheck`, rồi `npm run build`, rồi `npm test` | Không lỗi kiểu/build; unit tests qua | Đây chưa phải kiểm chứng backend/transaction |
| Kiểm tra trước PR nghiệp vụ | `npm run check` | Kiểm tra kiểu, build, unit và integration local đều qua | Docker chưa chạy; migration/test chưa đồng bộ; không dùng server cloud để né lỗi local |
| Kiểm tra migrations tái tạo được | Sau khi giữ dữ liệu mẫu cần thiết: `npx --no-install supabase db reset --local`, rồi `npm run seed:local`, rồi `npm run check` | Database local được tạo lại từ code, test qua | Reset xóa dữ liệu local; seed ban đầu chỉ tạo Auth user, owner bổ sung mẫu nghiệp vụ theo bảng đã chốt |

Lead cung cấp hướng dẫn chi tiết Supabase từ PR nền; kiểm tra tên script theo README đã merge. Migration/RLS/grants/API qua PR, lead cập nhật server từ code đã review. Không sửa migration đã chạy online; sửa tiếp bằng migration mới. Không reset database remote.

## 8. Bàn giao cuối tuần và xử lý trễ

Mỗi owner gửi PR hoặc commit liên quan, cách thử, kết quả test, dữ liệu/API đã bàn giao và danh sách còn thiếu. Sau khi thay đổi shared/contracts/config, nêu rõ ảnh hưởng tới 2/3/4/5 thay vì để bạn khác tự đoán.

| Cuối tuần | Điều kiện qua mốc |
|---|---|
| 1 — 21/10 | Nền Supabase chung sẵn sàng; thiết kế được thống nhất; module có migration, backend/UI local và test riêng; dữ liệu phụ thuộc được bàn giao |
| 2 — 28/10 | Luồng đăng ký→duyệt→đăng chuyến→nhận→đón/trả→trả điểm chạy trên local; fixture không thay thế module; lỗi còn lại có owner |
| 3 — 04/11 | Các ca bắt buộc qua, CI xanh, review khác tác giả, dev ổn, mỗi người giải thích được code/test và demo lặp lại được |

Nếu trễ, cắt giao diện cầu kỳ, dashboard thống kê, tìm địa chỉ nâng cao và lọc phụ. Có thể cho chọn địa điểm/điểm dừng đơn giản trên bản đồ, nhưng vẫn phải tính/lưu tuyến xe máy và khoảng cách đúng. Không cắt kiểm tra quyền, một khách/chuyến, transaction, chống trùng hoặc lịch sử điểm. Không tính chức năng chưa có backend là hoàn thành. Nếu cắt phần phụ vẫn không đủ, ghi rõ phần thiếu và dời mốc nghiệm thu.

Chưa làm trong đợt này: rating, GPS trực tiếp, upload giấy tờ thật, ô tô, ghép khách nối tiếp, tiền thật/PayOS/rút điểm và deploy tự động. Điểm demo không quy đổi thành tiền. Kiểm thử/CI không gọi Supabase cloud hoặc VietMap thật; người 3 thử một tuyến thật có xe máy riêng khi được cấu hình, không đưa key vào Git.

## 9. Kịch bản demo cuối đợt

1. Dùng tài khoản test riêng cho admin, tài xế và hai hành khách. Admin app được cấp bằng quy trình tin cậy đã review, không tự đăng ký thành admin.
2. Tài xế đăng ký/gửi hồ sơ; admin duyệt; tài xế đăng tuyến A→B→C→D bằng dữ liệu bản đồ đúng.
3. Hai khách gửi yêu cầu; tài xế tự chọn một người. Người còn lại thấy mình đang chờ dự phòng; chuyến không nhận request mới khi đã confirmed.
4. Tài xế bắt đầu, đón khách, trả tại C. Booking hoàn thành; không được nhận thêm người dù còn đoạn C→D.
5. Khách trả điểm khi Trip chưa kết thúc. Ví khách giảm đúng giá; driver nhận phần sau phí 10%; phí và lịch sử cùng được ghi. Bấm lại không trừ lần hai.
6. Thử thiếu điểm: không ví nào thay đổi; thêm 100.000 điểm thử rồi thanh toán lại. Dùng dữ liệu mẫu hợp lệ để tạo tình huống, không sửa balance bằng frontend.
7. Tài xế kết thúc Trip; cả hai xem lịch sử. Mỗi owner trình bày một ca sai quyền hoặc lỗi quan trọng của module mình.

Giữ video/ảnh minh họa nếu nhóm cần, chỉ dùng dữ liệu hư cấu. Bản dev đạt các điều kiện mới mở PR dev→main bằng merge commit và review; không tự merge hoặc deploy chỉ vì tới ngày demo.

## 10. Tài liệu phân công

[Kế hoạch chung](00-ke-hoach-tong-the.md), [người 1](01-lead.md), [người 2](02-ho-so-quan-tri.md), [người 3](03-chuyen-vietmap.md), [người 4](04-dat-cho.md), [người 5](05-thanh-toan.md).

Các file module trên dev tại thời điểm mở PR này còn mô tả stack Firebase và lịch cũ. Dùng chúng để đối chiếu phạm vi đã giao; lịch 3 tuần và cách phối hợp Supabase theo tài liệu này. Lead đồng bộ hướng dẫn kỹ thuật của các file đó trong PR nền Supabase trước khi nhóm thực hành.
