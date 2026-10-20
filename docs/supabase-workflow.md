# Làm việc với Supabase — hướng dẫn cho cả team

Team là sinh viên năm 3, chưa có nhiều kinh nghiệm. Bắt đầu bằng một việc nhỏ, chạy được và hiểu được trước khi làm tiếp. Không cần học toàn bộ cách vận hành server ngay.

## 1. Hiểu app của mình trước

| Phần | Nghĩa đơn giản | Ví dụ Về Cùng |
|---|---|---|
| Frontend (FE) | Giao diện chạy trong trình duyệt | Form login, danh sách chuyến |
| Backend (BE) | Xử lý và kiểm tra nghiệp vụ ở server | Ai được nhận khách, giá bao nhiêu |
| Database (DB) | Nơi lưu dữ liệu theo các bảng | Hồ sơ, chuyến, Booking, ví |
| Supabase Auth | Dịch vụ đăng nhập của Supabase | Kiểm tra email/password, quản lý phiên |
| Server dev | Supabase online để nhóm thử chung | Các thành viên dùng tài khoản test riêng |
| Local | Chạy trên máy của bạn | Web local hoặc cả web + Supabase local |

**Mọi người đều sửa code trên máy.** GitHub giữ code; Supabase giữ tài khoản và database. Gửi code lên GitHub không tự đưa thay đổi lên Supabase.

Repo đã bổ sung đăng ký/hồ sơ/admin và migration `users` theo thiết kế nhóm cung cấp; xem [phạm vi và kết quả kiểm thử Auth](auth-module.md). Chưa áp dụng bản này lên server. Trip (chuyến), Booking (yêu cầu đi cùng), ví vẫn chưa có backend; các kế hoạch đó chưa phải chức năng đã hoàn thành.

## 2. Chọn cách chạy

| Công việc hôm nay | Dùng cách nào? | Lệnh tại gốc CNPM |
|---|---|---|
| Làm giao diện hoặc thử login bằng server team | Web trên máy + Supabase server dev; không cần Docker | `npm run dev:web` |
| Viết bảng/hàm backend, thử độc lập | Web + Supabase trên máy; cần Docker | `npm run dev` |

Lần đầu cài Node 22 và chạy `npm ci`. Khi dùng server, điền URL/key do lead cung cấp vào `web/.env.local`; xem [README](../README.md). Khi chuyển qua Supabase local, làm theo [hướng dẫn thực hành](supabase-local.md); đừng ghi đè cấu hình server mà chưa lưu lại.

Ví dụ: bạn 3 chỉnh form tìm chuyến có thể dùng server. Khi bạn 3 tạo bảng chuyến hoặc viết xử lý hủy chuyến, chuyển sang Supabase local để thử mà không ảnh hưởng team.

## 3. Mỗi người làm phần nào?

“Owner” nghĩa là người phụ trách phần đó. Người này làm giao diện, xử lý backend và test của phần mình, không chỉ vẽ màn hình.

| Người | Phụ trách | Cần giao cho người khác |
|---|---|---|
| 1 — Lead | Cấu hình, code chung, kiểm tra tự động, ghép code và cập nhật server | Hướng dẫn chạy app, hỗ trợ các phần dùng chung |
| 2 | Đăng nhập, hồ sơ, duyệt/khóa tài khoản | ID user, quyền, điều kiện được làm driver/đặt chuyến |
| 3 | Chuyến và VietMap | Điểm đón/trả, đường đi, khoảng cách |
| 4 | Yêu cầu đi cùng, hàng chờ, nhận khách và giá | Booking đã hoàn thành, giá/phí đã chốt |
| 5 | Ví điểm demo, trả điểm và lịch sử | Số dư và kết quả trả điểm đúng |

Ví dụ bạn 4 cần biết user được đặt chuyến hay chưa: trao đổi với bạn 2 về dữ liệu trả về trước. Không tự đoán tên field hoặc tự viết lại phần kiểm tra của bạn 2.

## 4. Một vòng làm việc hằng ngày

1. **Nhận một task nhỏ.** Ví dụ “hiện lỗi khi login sai”, thay vì “làm hết module Auth”. Task cần ghi kết quả mong đợi và ai review.
2. **Tạo nhánh riêng từ dev mới nhất.** Nhánh là bản làm việc riêng để bạn sửa mà chưa ảnh hưởng code chung. Lệnh ở [hướng dẫn Git](../ke-hoach/08-github-workflow.md).
3. **Làm và thử trên máy.** UI có thể gọi server dev; bảng/backend phải thử Supabase local. Đọc kế hoạch phần của mình và [contract](contracts.md) trước.
4. **Chạy kiểm tra.** UI chưa có Docker: typecheck/build/unit test theo README. Backend: chạy `npm run check` với Docker và thêm test nghiệp vụ.
5. **Gửi PR vào dev.** PR là đề nghị ghép code; ghi đã sửa gì, thử thế nào, phần nào chưa làm. Người khác đọc code, góp ý rồi bạn sửa lại.
6. **Lead ghép code và cập nhật server khi cần.** Nếu chỉ sửa UI thì không cần đưa migration lên database. Nếu sửa bảng/backend thì lead xử lý phần đó sau review.
7. **Thử cùng nhau trên server dev.** Ví dụ 3 đăng chuyến, 4 đặt chuyến, 5 trả điểm. Bản dev ổn mới gửi PR sang main, là nhánh giữ bản ổn định.

CI là bộ kiểm tra GitHub tự chạy khi có PR. “CI xanh” nghĩa là các kiểm tra đã qua. Review phải do người khác tác giả; PR của lead cũng vậy. GitHub Actions chỉ test; Cloudflare Pages tự build/deploy frontend các nhánh đã bật, xem [hướng dẫn Pages](cloudflare-pages.md). Database/backend Supabase vẫn cập nhật riêng từ code đã review. Pages build thành công không thay thế kiểm tra CI hoặc tự chờ reviewer.

## 5. Khi bạn cần thêm hoặc sửa bảng dữ liệu

**Schema** là cấu trúc database: có bảng gì, cột gì và quan hệ gì. **Migration** là file SQL ghi lại một thay đổi cấu trúc. Lưu file vào Git để máy của người khác và server làm được cùng thay đổi.

Ví dụ: cần thêm cột ghi chú cho chuyến. Chỉ thêm bằng nút trong Studio trên máy bạn thì máy bạn khác vẫn chưa có cột. Ghi thay đổi trong migration rồi gửi PR giúp cả nhóm đồng bộ được.

Chỉ làm phần này khi đã cùng team thống nhất bảng/cột/quyền cần có. Repo có migration Auth `users` dựa trên thiết kế đã cung cấp; các bảng module khác vẫn cần được chốt riêng. Server đã có bảng phải đối chiếu lịch sử/schema trước, không chạy lại CREATE TABLE hoặc reset remote.

### Bước A — mở Supabase local

Mở Docker Desktop, chọn cấu hình local và chạy `npm run dev` theo [hướng dẫn local](supabase-local.md). Giữ terminal chạy app, mở terminal thứ hai tại gốc CNPM để chạy lệnh database.

### Bước B — tạo file thay đổi

```bash
npx --no-install supabase migration new auth_profile
```

`npx --no-install supabase` gọi CLI, tức công cụ Supabase trong terminal đã cài cùng repo. `auth_profile` là tên ví dụ; thay bằng tên việc đang làm. Lệnh tạo file SQL trong `supabase/migrations/`, chưa tự tạo bảng. Điền SQL theo thiết kế team đã chốt.

### Bước C — áp dụng lên máy mình

```bash
npx --no-install supabase migration up --local
```

Lệnh chạy những migration chưa áp dụng **trên database local**. Mở Studio tại http://127.0.0.1:54323 để xem kết quả. Sau đó thử chức năng và test. Khi nhận code mới có migration từ dev, cũng chạy lệnh này để cập nhật database local của mình.

### Bước D — kiểm tra người khác có tái tạo được không

Nếu PR có thay đổi cấu trúc database, cần thử tạo lại từ các file đã lưu. **Lệnh reset dưới đây xóa dữ liệu local hiện có**, nên lưu dữ liệu mẫu cần giữ trước:

```bash
npx --no-install supabase db reset --local
npm run seed:local
npm run check
```

Mong đợi: các bảng/hàm được tạo lại đúng và test qua. `seed` nghĩa là tạo dữ liệu mẫu; script hiện chỉ tạo tài khoản Auth, chưa tạo hồ sơ/Booking/ví. Dữ liệu mẫu cho phần nghiệp vụ phải được owner bổ sung khi bảng đã có.

Gửi migration, code và test cùng một PR. Không sửa file migration đã merge/đã chạy trên server; muốn sửa tiếp thì tạo migration mới. Nếu bị lỗi thứ tự file, trao đổi với lead, không tự bỏ qua lịch sử.

Cách quản lý bằng file này dựa trên [hướng dẫn migrations của Supabase](https://supabase.com/docs/guides/local-development/database-migrations). Cập nhật server là [phần riêng cho lead](supabase-lead.md).

## 6. Test cần hiểu và tự thử

Unit test kiểm tra code nhỏ, giao diện và SQL/quyền trên PostgreSQL nhúng; test SQL này mô phỏng claim Auth. Integration test mới kiểm tra với Supabase thật trên máy. `npm run test:local` chạy cả hai; `npm run check` thêm kiểm tra TypeScript và build. Test Auth/hồ sơ/admin chưa chứng minh Booking/ví đúng.

| Phần bạn làm | Ví dụ phải thử |
|---|---|
| Hồ sơ/admin | User sửa hồ sơ mình được; sửa hồ sơ người khác bị từ chối; USER không tự thành ADMIN |
| Trip | Chỉ chủ chuyến được hủy; tài khoản bị khóa không đăng chuyến được |
| Booking | Hai yêu cầu được nhận cùng lúc: chỉ một khách thành công; hết giờ thì không được nhận |
| Ví | Thiếu điểm không bị trừ; bấm trả hai lần không trả trùng; lỗi giữa chừng không mất điểm |

Đừng chỉ ẩn nút trên UI: người dùng vẫn có thể tự gửi request. Backend phải kiểm tra. Dùng tài khoản thường để thử quyền, không chỉ dùng key quản trị.

## 7. Những quy tắc cần nhớ

- Dùng tài khoản test riêng trên server, không xóa dữ liệu test của người khác.
- Thay đổi bảng/quyền/hàm: làm local → migration → PR → lead cập nhật server. Không thử sửa bảng ngay trên server chung.
- Không đưa `.env.local`, mật khẩu database, token quản trị hoặc key backend lên Git. Publishable key là loại dùng cho frontend; secret/service-role là loại quyền cao, không dùng ở frontend.
- Quyền user, giá chuyến và số dư phải do server quyết định. Supabase Auth quản lý password/phiên đăng nhập; nhóm không tự lưu password.
- Docker không cần cho `dev:web` nhưng cần cho Supabase local/test integration. CI không gọi server cloud hoặc VietMap thật.
- Điểm ví chỉ là điểm demo, không mua/bán/rút thành tiền.

Gặp từ lạ, xem [giải thích thuật ngữ bằng ví dụ](../ke-hoach/07-tech-stack.md). Chưa hiểu bước nào thì hỏi trước khi chạy lệnh cập nhật/xóa dữ liệu server.
