# Chuyến đi và VietMap — Người 3

Đã ghép nhánh `feat/auth` tại commit `6b1c3e2` (20/10/2026) vào nhánh
`feat/3-trips-vietmap-supabase`. Lead quản lý Supabase nhóm; người 3 bàn giao
code, migration và kết quả kiểm thử. Thay đổi Git không tự cập nhật server.

## Chạy frontend

Tại `D:\trip-vietmap-demo\team-repo-supabase`:

```powershell
npm ci
npm run dev:web
```

Điền cấu hình public trong `web/.env.local` theo `web/.env.example`:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=PUBLIC_KEY_FROM_LEAD
VITE_VIETMAP_MAP_KEY=TILEMAP_KEY
```

Mở http://127.0.0.1:5173. Cách này không cần Docker. Đổi env thì khởi động
lại Vite. REST key và service-role key chỉ ở backend, không đặt vào biến VITE_.

| Địa chỉ | Chức năng |
|---|---|
| `/tai-khoan` | Đăng ký, đăng nhập, hoàn thiện hồ sơ và xe |
| `/quan-tri` | Admin duyệt sinh viên/tài xế, khóa/mở tài khoản |
| `/chuyen-di` | Tìm chuyến theo điểm đi, điểm đến, ngày |
| `/chuyen-di/ban-do` | Xem bản đồ VietMap, không cần đăng nhập hoặc RPC Trip |
| `/chuyen-di/dang` | Chọn 2–8 điểm, giờ đi/đến, xem tuyến và đăng chuyến |
| `/chuyen-di/cua-toi` | Chuyến tài xế đã đăng |
| `/chuyen-di/:tripId` | Bản đồ, khoảng cách từng đoạn, bắt đầu/hủy/kết thúc |
| `/chuyen-di/:tripId/sua` | Sửa chuyến còn mở và chưa nhận khách |

Trong mục “Chuyến của tôi”, nút “Tôi cầm lái” mở `/chuyen-di/cua-toi`.
Để xem bản đồ ngay, bấm “Xem bản đồ” tại trang tìm chuyến hoặc mở
http://127.0.0.1:5173/chuyen-di/ban-do. Trang này tải nền bản đồ thật bằng
`VITE_VIETMAP_MAP_KEY` trong `web/.env.local`; không cần REST key, hồ sơ tài xế
hoặc migration Trip. Tìm địa điểm/tính tuyến/đăng chuyến vẫn dùng backend như bên dưới.
Phần hành khách và nhận khách thuộc Booking của Người 4, chưa triển khai trong nhánh này.

## Luồng hoạt động

1. Auth SDK quản lý phiên. `SessionProvider` tải hồ sơ.
2. Form chỉ cho đăng/sửa khi `profile.eligibility.canDrive` là true.
3. `PlaceSearch` gọi Edge Function tìm địa điểm và lấy tọa độ qua VietMap.
4. Xem trước tuyến: backend tính từng đoạn xe máy A→B, B→C… rồi trả kết quả.
5. `RouteMap` tải nền bằng Tilemap key, vẽ tuyến và các điểm dừng.
6. Lưu chuyến: backend xác minh token, kiểm tra quyền, tính lại tuyến bằng
   VietMap, rồi gọi `save_trip_route` để kiểm tra và lưu trong transaction.
7. Tìm/xem/đổi trạng thái gọi SQL RPC. Backend lấy người gọi từ `auth.uid()`.

Không nhận uid, role, giá hoặc tuyến do frontend tự tính để lưu. Khi VietMap
lỗi, giao diện hiển thị lỗi và giữ dữ liệu form; không lưu khoảng cách giả.

## Code nằm ở đâu?

| File/thư mục | Nhiệm vụ |
|---|---|
| `web/src/modules/trips/TripFormPage.tsx` | Form đăng/sửa, preview, trạng thái chờ/lỗi |
| `PlaceSearch.tsx`, `RouteMap.tsx`, `RouteSummary.tsx` | Tìm điểm, vẽ bản đồ, hiển thị tuyến |
| `TripsPage.tsx`, `TripResults.tsx`, `TripDetailPage.tsx` | Tìm kiếm, danh sách và quản lý chuyến |
| `TripsModule.tsx` | Đường dẫn và bảo vệ các trang cần hồ sơ ACTIVE |
| `web/src/lib/callable.ts` | Gọi RPC hoặc Edge Function, kiểm tra input/output |
| `shared/trips.ts` | Kiểu dữ liệu Trip và API |
| `shared/trip-schemas.ts`, `shared/trip-responses.ts` | Kiểm tra input và response |
| `shared/trip-polyline.ts` | Giải mã tuyến để vẽ |
| `shared/trip-errors.ts` | Lỗi nghiệp vụ dùng chung frontend/backend |
| `supabase/functions/trips/index.ts` | Khởi tạo Edge Function và kết nối Supabase |
| `supabase/functions/trips/handler.ts` | Xác minh người gọi, điều phối yêu cầu |
| `supabase/functions/trips/vietmap.ts` | Gọi VietMap Autocomplete/Place/Route v4 |
| `supabase/migrations/20261015000100_trips.sql` | Bảng và hàm Trip ban đầu, giữ nguyên lịch sử |
| `supabase/migrations/20261021000100_trips_auth_profiles.sql` | Nối Trip với bảng users của Auth mới |

`vietmap-gl.d.ts` vẫn cần cho TypeScript vì đang import file SDK dist.
SDK và CSS được import ngay trong `RouteMap`, không cần `vietmapSetup.ts`.

## Điều kiện và quyền

Trip đọc `public.users.id`, `display_name`, `status`, `roles`,
`student_verification_status`, `driver_verification_status`, `vehicle_model`,
`vehicle_plate`. Không còn cần bảng driver_profiles hoặc vehicles riêng.

- Xem danh sách/chi tiết: tài khoản có hồ sơ ACTIVE.
- Tìm địa điểm/xem tuyến/đăng/sửa/bắt đầu: ACTIVE, DRIVER, sinh viên và
  tài xế VERIFIED, có xe. Điều kiện khớp `eligibility.canDrive` của Auth.
- Hủy/kết thúc: chủ chuyến còn ACTIVE; vẫn được xử lý chuyến cũ nếu quyền
  tài xế bị thu hồi. Kết thúc chỉ khi chuyến đang đi và Booking đã được xử lý.
- Đã nhận hoặc đã phục vụ khách: không sửa tuyến/giờ hay xóa cờ lịch sử.
- Client không đọc/ghi trực tiếp trips hoặc gọi check_trip_access/save_trip_route
  dành cho service_role. Auth user_metadata không cấp quyền.

Edge xác minh token bằng `auth.getUser`, rồi truyền uid đã xác minh vào SQL.
Vì service_role không có phiên người dùng, adapter nhận uid tường minh;
RPC client luôn truyền `auth.uid()`. Khóa dòng hồ sơ giữ kiểm tra quyền và thao tác
lưu trong cùng transaction. Frontend chỉ dùng eligibility để hiển thị.

## Bàn giao cho lead: server khác repo

Kiểm tra chỉ đọc ngày 21/10/2026 trên project `wrvcvxirfwxgkaranlgk`:

- Lịch sử server chỉ có `20261016000000`, file này chưa có trên các nhánh đã tải.
- Server đã có users/trips/bookings, nhưng chưa có get_my_profile, list_trips,
  save_trip_route hay các helper Auth/Trip trong nhánh này.
- Chưa có secret VIETMAP_REST_KEY và TRIPS_ALLOWED_ORIGINS.

| Repo hiện tại | Server nhóm ngày 21/10 |
|---|---|
| trips.arrival_time | trips.estimated_arrival_time |
| trips.stops, trips.route JSONB, driver_name, route_version, updated_at | Chưa có các cột này trong trips; có route_polyline, route_distance_meters |
| confirmed_booking_id text; adapter Booking so sánh text | ID Trip/Booking/điểm đón trả dùng UUID |

**Không chạy nguyên db push của nhánh này lên server hiện tại:** các migration
tạo bảng sẽ trùng bảng sẵn có và lịch sử không khớp. Lead cần đưa baseline
20261016000000 vào repo, chốt contract Trip/Booking rồi tạo migration chuyển
đổi có bảo toàn dữ liệu. Không reset server hoặc sửa lịch sử để bỏ qua lỗi.
Các kiểm thử hiện chứng minh bản ghép theo migration trong repo; chưa chứng minh
tương thích schema server mới. Lead phụ trách việc đối chiếu và cập nhật server.

Sau khi thống nhất schema, lead áp dụng Auth + Trip/RPC, cấu hình secrets,
triển khai Edge Function trips (có thể dùng --use-api không cần Docker).
REST key đặt trong Supabase Secrets; supabase/functions/.env.local chỉ phục vụ
backend local, không tự đồng bộ server. CORS mặc định chấp nhận localhost:5173
và 127.0.0.1:5173; thêm origin đầy đủ của domain Pages khi cần.

Sau triển khai, thử bằng tài khoản demo riêng: đăng ký → hoàn thiện hồ sơ/xe →
admin duyệt sinh viên và driver → tìm địa điểm → xem tuyến → đăng/sửa → tìm/xem
chi tiết → bắt đầu/kết thúc; thử một chuyến khác để hủy. Không chạy fixture test
hoặc tự cấp ADMIN qua form trên server nhóm.

## Bàn giao cho Người 4

API camelCase, thời gian milliseconds, khoảng cách mét có số lẻ.
getTripSegmentDistance trả khoảng cách giữa hai điểm theo snapshot đã lưu;
A→C bằng AB+BC. Giá do Người 4 tính. Sửa chuyến tăng routeVersion; Booking
phải giữ và đối chiếu version khi nhận khách. V1 chỉ một khách trong cả chuyến.

Khi cập nhật nhiều bảng, thứ tự khóa cần thống nhất: hồ sơ → Trip → Booking.
Trip bị hủy/bắt đầu phải chặn nhận khách mới; không gọi VietMap trong transaction.
Giữ confirmedBookingId và hasServedPassenger khi khách xuống sớm để không
nhận người tiếp theo. Kết thúc chặn nếu còn CONFIRMED/ONBOARD hoặc lịch sử
Booking không khớp. Adapter text hiện tại cần đổi cùng baseline UUID của lead.

## Kiểm thử

```powershell
npm run typecheck
npm run build
npm test
```

Kiểm chứng ngày 21/10: TypeScript, build và Deno check đạt; 79 kiểm thử đạt.
Chrome ở chiều rộng 1365px và 390px chạy luồng đăng nhập → chọn điểm → xem tuyến
→ lưu → bắt đầu/kết thúc → danh sách chuyến, không lỗi JavaScript hay tràn ngang.
Lần thử trình duyệt dùng API/nền bản đồ mô phỏng; không chứng minh kết nối server
hoặc key VietMap thật. Supabase integration chưa chạy vì máy thiếu Docker.

- tests/unit/trip-database.test.ts áp dụng tất cả migration lên PostgreSQL
  nhúng PGlite; dùng RPC Auth để hoàn thiện/duyệt hồ sơ, rồi thử Trip,
  khóa tài khoản, thu hồi driver, ownership, routeVersion và contract Booking.
- tests/unit/trips.test.ts kiểm tra Edge/VietMap bằng phản hồi mô phỏng.
- tests/unit/trips-ui.test.tsx kiểm tra điều kiện driver, chọn điểm/preview/lưu,
  lỗi bản đồ và điều hướng “Tôi cầm lái”.
- tests/integration/trips.test.ts kiểm tra quyền qua Supabase local thực.

PGlite mô phỏng Auth claims; không thay thế Auth/PostgREST thật. Chạy
npm run test:integration khi có Docker; script chỉ dùng local, không gọi cloud.
CI không dùng VietMap key thật. Backend local:

```powershell
npx --no-install supabase functions serve trips --env-file supabase/functions/.env.local
```

## Lịch sử để đối chiếu

Ngày 15/10 đã triển khai migration 20261015000100 và Edge trips version 1;
HTTP thiếu/sai token bị chặn 401. SHA256 migration:
`D0DD64A34F309B18E0D2706E1DB64061182391217F13DC9F3771721C81AE1BA0`.
Server đã đổi schema/lịch sử sau lần này. Bản dự phòng Git trước khi ghép Auth
vẫn giữ trong stash `backup Trip VietMap before auth integration 2026-10-21`.
