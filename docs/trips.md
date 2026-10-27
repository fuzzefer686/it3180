# Trip/VietMap — bàn giao theo schema server nhóm

Ngày 22/10/2026 đã đọc catalog và lịch sử migration của project
`wrvcvxirfwxgkaranlgk` bằng Supabase CLI. Chỉ đọc cấu trúc, không lấy dữ liệu
người dùng, không áp dụng migration hoặc deploy Edge Function trong lần sửa này.

## Lead cần review gì?

Migration trước đây tạo lại `trips` và giả định Booking ID là text, không tương
thích server đã có 7 bảng và các khóa ngoại UUID. Chuỗi migration mới dùng bảng
nhóm làm nguồn dữ liệu, không tạo thêm bảng Trip hoặc bản sao JSON của stops.

| File trong `supabase/migrations/` | Mục đích |
|---|---|
| `20261016000000_initial_schema.sql` | Lấy nguyên 43 SQL statements từ lịch sử server. Server đã ghi nhận version này; không chạy lại CREATE TABLE trên server. |
| `20261022000100_auth_existing_schema.sql` | Cài các RPC Auth hiện có lên bảng users của nhóm, thêm default display_name. Giữ RLS và grants của baseline. |
| `20261022000200_auth_signup_existing_schema.sql` | Tạo/thay thế trigger signup đã có, bù hồ sơ thiếu; không đặt lại roles/status của hồ sơ cũ. |
| `20261022000300_trips_existing_schema.sql` | RPC Trip, dùng trips/trip_stops/bookings hiện có; thêm route_version để chống lưu đè bản sửa cũ. |

Bốn migration của thiết kế trước nằm trong `supabase/legacy-migrations/`, giữ
nguyên nội dung để tra cứu và không được CLI tự chạy. Không sửa lịch sử server
bằng `migration repair` để giả vờ các file đó đã áp dụng.

Các RPC ví đã tồn tại trên server nhưng chưa được ghi trong baseline lấy về.
Nhánh này không thay thế chúng. Owner ví/lead cần đưa lịch sử thay đổi đó vào
repo riêng; database mới dựng từ baseline chưa có các RPC ví của server.

Catalog hiện tại cũng không còn CHECK `users_driver_eligible` có trong baseline.
Migration này không xóa/thêm lại CHECK đó trên server. Kiểm tra quyền đăng chuyến
vẫn thực hiện trong RPC. Bộ test gồm cả baseline đầy đủ và fixture phản ánh sự
khác biệt này của server, không dựa riêng vào CHECK để cấp quyền.

## Những thay đổi ảnh hưởng module khác

- Trip lưu giờ đến vào `estimated_arrival_time`, tuyến vào `route_polyline`, tổng
  mét vào `route_distance_meters`; tên tài xế lấy từ `users.display_name`.
- Điểm dừng nằm trong `trip_stops`, ID là UUID. Khoảng cách mỗi chặng VietMap được
  làm tròn tới mét nguyên trước khi cộng dồn, phù hợp Booking và giá điểm của nhóm.
  Đoạn B→C bằng `distance_from_start_meters(C) - distance_from_start_meters(B)`.
- `route_version` là cột mới duy nhất của Trip, mặc định 1 cho chuyến cũ. Sửa tăng
  version; form cũ nhận PT409. Backend Booking cần khóa Trip trước khi nhận khách.
- Không sửa chuyến đã có bất kỳ Booking nào, kể cả lịch sử/hàng chờ: các Booking
  đang tham chiếu UUID điểm đón/trả. Không xóa điểm dừng được Booking sử dụng.
- Giữ `confirmed_booking_id`, `has_served_passenger`, dữ liệu ví và các khóa ngoại.
  Không kết thúc khi còn CONFIRMED/ONBOARD; không hủy khi còn khách ONBOARD.
- RLS đọc của baseline được giữ: user đọc hồ sơ mình, user ACTIVE đọc chuyến/điểm
  dừng. Client và service_role không được ghi trực tiếp các bảng qua API.
  Edge được phép gọi riêng `check_trip_access` và `save_trip_route`.
- DTO frontend có `route.encodedPolyline` cho cả tuyến. Sau khi lưu, thời lượng
  route là null vì schema nhóm không lưu thời lượng; không trả 0 giả. Giờ đến
  chuyến cũ cũng có thể null. UI đã xử lý các trường hợp này.

## Thứ tự cập nhật server — lead thực hiện sau review

1. Đối chiếu lịch sử hiện tại vẫn có baseline `20261016000000`, kiểm tra schema
   chưa bị thay đổi thêm kể từ lần đọc ngày 22/10. Lưu backup theo quy trình nhóm.
2. Review ba migration mới. Auth RPC là bản tương thích schema, không sửa lỗi
   duyệt hồ sơ thay đổi giữa lúc xem và lúc duyệt; xem [Auth](auth-module.md).
3. Tại gốc repo, xem kế hoạch áp dụng bằng `npx --no-install supabase db push --dry-run`.
   Mong đợi chỉ ba file `20261022000...`, không có CREATE TABLE baseline hoặc file legacy.
4. Sau review, lead chạy `npx --no-install supabase db push`. Không reset remote.
5. Cấu hình secret `VIETMAP_REST_KEY` và origin frontend trong `TRIPS_ALLOWED_ORIGINS`,
   rồi deploy `trips` bằng `npx --no-install supabase functions deploy trips --use-api`.
   File `supabase/functions/.env.local` không tự đồng bộ secrets lên server.
6. Deploy frontend cùng bản Edge mới vì DTO tuyến đã thay đổi. Thử đăng nhập →
   hoàn thiện hồ sơ (nhập xe) → xem chuyến cũ → đăng/sửa chuyến mới → bắt đầu/kết thúc.

Giữ frontend/Edge bản trước nếu cần dừng rollout. Không xóa cột hoặc rollback dữ
liệu để quay về thiết kế JSON cũ. Nếu SQL lỗi, kiểm tra transaction và migration
history rồi báo lead; không đánh dấu migration applied bằng tay để vượt lỗi.

Nguồn: [quy trình migration Supabase](https://supabase.com/docs/guides/deployment/database-migrations).

## Chạy frontend và xem bản đồ

Tại `D:\trip-vietmap-demo\team-repo-supabase`, chạy `npm run dev:web`.
`web/.env.local` cần URL/key public Supabase và `VITE_VIETMAP_MAP_KEY` (Tilemap).
REST key chỉ đặt ở backend. Mở http://127.0.0.1:5173.

| Địa chỉ | Chức năng |
|---|---|
| `/tai-khoan` | Đăng ký, đăng nhập, hồ sơ và xe |
| `/quan-tri` | Admin duyệt sinh viên/tài xế |
| `/chuyen-di` | Danh sách, tìm chuyến |
| `/chuyen-di/dang` | Chọn điểm, xem tuyến, đăng chuyến; cần hồ sơ có loại xe + biển số (mặc định đã xác minh sinh viên/tài xế) |
| `/chuyen-di/cua-toi` | Chuyến tôi đăng |
| `/chuyen-di/:tripId` | Bản đồ tuyến, khoảng cách, quản lý chuyến |
| `/chuyen-di/:tripId/sua` | Sửa chuyến còn mở, chưa có Booking |

User ACTIVE xem được bản đồ trong chi tiết chuyến. Trang tìm chuyến không có
bản đồ riêng. Nếu `list_trips` trả 404 thì server chưa có RPC khớp; key Tilemap
không sửa được lỗi đó. Nhánh Git được push không tự cập nhật Supabase.

## Khi VietMap lỗi (Edge trả 5xx)

Frontend không nhận lỗi thô của nhà cung cấp; nó nhận một trong các mã dưới đây. Nguyên nhân thật
được ghi vào Dashboard → Edge Functions → `trips` → Logs với tiền tố `[vietmap]`.

| Mã trả về | HTTP | Nghĩa | Việc cần làm |
|---|---|---|---|
| `MAP_NOT_CONFIGURED` | 412 | Secret `VIETMAP_REST_KEY` rỗng | Đặt secret rồi deploy lại `trips` |
| `MAP_INVALID_KEY` | 503 | VietMap trả 401/403 cho key | Kiểm tra key và quyền dịch vụ trên trang VietMap |
| `MAP_QUOTA` | 429 | VietMap trả 429 (hết hạn mức hoặc giới hạn tần suất) | Chờ theo `Retry-After` hoặc nâng gói; giảm số lần gọi |
| `MAP_UNAVAILABLE` | 503 | Timeout 7 giây, lỗi mạng hoặc JSON sai dạng | Xem log `[vietmap] fetch/http/schema` |

Log chỉ ghi tên endpoint, mã HTTP, query không chứa khoá và tối đa 300 ký tự đầu của body;
chuỗi trùng key được thay bằng `[key]` nên không đưa key vào log. Mỗi dòng log còn kèm dấu vân tay
`key len=<số ký tự> sha256=<12 ký tự đầu SHA-256>` để đối chiếu khoá đang dùng với key thật:

```bash
printf '%s' 'KEY_TREN_TRANG_VIETMAP' | shasum -a 256 | cut -c1-12
```

Hai chuỗi `sha256` trùng nhau nghĩa là Edge đang dùng đúng key; khác nhau thì secret chưa được cập
nhật (thường do thiếu quyền Owner/Administrator hoặc thao tác trên project khác).

Key đúng là điều kiện cần nhưng chưa đủ. Nếu gọi bằng `curl` từ máy cá nhân thấy 200 mà Edge vẫn
503 thì đọc log để biết VietMap trả gì cho IP của Edge (thường là 429 do dùng chung IP, hoặc 403
do chặn theo IP) trước khi sửa secret hay deploy lại frontend.

## Code và kiểm thử

- `web/src/modules/trips/`: màn hình, tìm địa điểm, RouteMap và hiển thị tuyến.
- `web/src/lib/callable.ts`: gọi SQL RPC hoặc Edge Function, kiểm tra input/output.
- `shared/trips.ts`, `trip-responses.ts`: contract tuyến và chuyến.
- `supabase/functions/trips/`: xác minh token, kiểm tra quyền, gọi VietMap và lưu.
- `tests/unit/trip-migration.test.ts`: dữ liệu cũ có Booking/ví, giữ hàng và FK/grants.
- `tests/unit/trip-database.test.ts`: CRUD, quyền, UUID, thứ tự điểm và trạng thái.

Hoàn tất kiểm chứng ngày 23/10: typecheck/build, Deno check và 83 unit tests PASS. Kiểm tra trình
duyệt desktop/mobile PASS với API/map fixtures, không gọi server thật. Build còn
cảnh báo kích thước bundle SDK bản đồ; ở chế độ dev SDK có log AbortError khi
React StrictMode hủy bản đồ đang tải, không có pageerror trong luồng thử. Supabase integration chưa chạy được vì
Docker không khả dụng; không coi PGlite/fixture là kiểm thử cloud hoặc tải đồng thời.

Nếu local đã chạy migration legacy, dùng môi trường local mới cho chuỗi baseline
này sau khi giữ lại dữ liệu cần thiết. Không tự reset local/server trong script.
