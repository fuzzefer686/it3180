# Giao diện Về Cùng

## Thiết kế

Áp dụng skill `design-taste-frontend` theo chế độ overhaul cho web ghép xe sinh viên. Dials: variance 6, motion 3, density 4. Bản cũ dùng sidebar, font hệ thống, nhiều card nhiệm vụ; có 5 trang và lộ owner/đường dẫn code/Emulator/CI. Các khối này được bỏ khỏi UI, tài liệu và callable nền vẫn giữ.

Bản mới dùng navigation ngang trên desktop và navigation đáy trên mobile; một accent xanh, font Be Vietnam Pro tự host, hero ảnh + form tuyến/ngày. Radius: panel 24px (20px mobile), input 12px, CTA/chip pill. Có sáng/tối toàn ứng dụng, focus bàn phím, reduced-motion. Không thêm thư viện animation hoặc bản đồ giả.

## Bốn trang và điểm nối module

| Trang | URL | Owner và việc nối tiếp |
|---|---|---|
| Tìm chuyến | /chuyen-di | 3: nối callable tìm tuyến và VietMap; state form hiện ở TripsPage |
| Chuyến của tôi | /dat-chuyen | 4: nối Booking theo trạng thái; phối hợp 3 cho tab cầm lái/đăng chuyến |
| Ví điểm | /vi-diem | 5: nối balance/ledger và giao dịch điểm, không tiền thật |
| Tài khoản | /tai-khoan | 2: login/logout đã nối Auth; bổ sung bootstrap/đăng ký/hồ sơ/quản trị |

Root `/` redirect tới `/chuyen-di`. Không đổi các URL module cũ. Không thay contracts, Rules, indexes, Functions hoặc guard cloud deploy. SessionProvider thuộc auth và cấp phiên/hồ sơ cho các trang; đây chỉ là trạng thái hiển thị, không cấp quyền. Backend vẫn kiểm tra uid và users hiện tại. Lỗi SDK được dịch thành thông báo người dùng, không hiển thị lệnh terminal hay lỗi raw.

Các tính năng không có handler được ghi rõ chưa sẵn sàng. Không gọi callable dự kiến, không ghi Firestore client, không hiển thị số dư hoặc danh sách chuyến hư cấu. Đăng chuyến/Thêm điểm đang disabled. Bộ lọc và tìm kiếm mới xử lý UI, chưa trả dữ liệu nghiệp vụ.

## Ảnh và font

- Font `@fontsource/be-vietnam-pro`, các subset latin/vietnamese 400/500/600/700, font-display swap.
- Ảnh `web/public/images/ride-home.jpg`: tạo bằng built-in imagegen, tối ưu JPEG 1400px. Có `ride-home-small.jpg` 720px và `ride-home-medium.jpg` 960px; `srcSet` chọn ảnh theo màn hình. Không có danh tính/tài khoản thật; dùng cho hero và trang tài khoản. Đây là ảnh minh họa, không phải ảnh tài xế trong hệ thống.
- Prompt ảnh: “Use case: photorealistic-natural. Asset type: wide editorial hero photograph for Về Cùng, a Vietnamese student motorbike ridesharing web application. Primary request: two Vietnamese university students in their early twenties riding together on one everyday dark-green commuter motorbike along a quiet rural Vietnamese road, both wearing properly fastened helmets, casual clothing, passenger with small backpack. Scene: expansive green rice fields, distant limestone hills, subtle roadside trees and pale soft blue sky. Composition: landscape 3:2, riders visible in middle-right area and road leading into distance, calm open space on left, natural believable proportions, documentary travel photograph. Lighting: soft sunny late afternoon, fresh and welcoming. Constraints: no text, no logos, no watermarks, no interface elements, no cars, no exaggerated motorcycle sport styling, no unsafe riding, realistic hands and bike anatomy.”

## Kiểm tra bàn giao

`npm run check` PASS ngày 04/10/2026: typecheck, build web/functions, 3 unit và 8 integration tests nền. Không sửa logic backend, không thêm test sao chép CSS/markup. Emulator vẫn chặn đọc/ghi client và kiểm tra quyền từ DB.

Đã xem bốn trang ở viewport mobile 385px, kiểm tra bố cục sáng/tối; trang tìm chuyến/tài khoản/ví cũng được xem desktop. Đã thử chọn nhanh điểm đến, các tab hành khách/tài xế/lịch sử, form login sai mật khẩu (lỗi dễ hiểu), login đúng (hồ sơ từ server) và quay lại trạng thái đăng xuất. Nút Đăng chuyến/Thêm điểm không thực hiện thao tác giả. Date picker mở được; các thao tác tìm kiếm đầy đủ vẫn cần QA tiếp khi owner 3 nối handler. Không gọi cloud/VietMap thật.

Sau test đã mở lại dev server và seed tài khoản hư cấu local. Không push hoặc deploy.

Lighthouse mobile trên Vite dev: Accessibility 100, Best Practices 100, SEO 92, Performance 43. Lần chạy này tải module chưa minify của dev và có cảnh báo extension/IndexedDB, không dùng làm kết luận hiệu năng release. Sau đó bổ sung ảnh responsive, favicon từ icon Bike hiện có và robots.txt hợp lệ; build web lại PASS. Bản build được kiểm tra riêng ở localhost:4173.

Lighthouse mobile **bản build** ở localhost:4173, cửa sổ riêng tư, Moto G Power/Slow 4G: **Performance 91, Accessibility 100, Best Practices 100, SEO 100**; FCP 2,5s, LCP 3,1s, TBT 30ms, CLS 0. Vẫn có cảnh báo IndexedDB do Firebase Auth khởi tạo; đây là đo local, không phải benchmark cloud hay chứng nhận accessibility toàn diện. Không cần lặp lại audit sau khi đạt kiểm tra bàn giao; owner nối nghiệp vụ cần đo lại khi thay đổi tải trang.
