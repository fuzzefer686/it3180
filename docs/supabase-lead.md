# Supabase — phần dành cho lead

Chỉ đọc khi cần cập nhật database server của team. Thành viên làm giao diện có thể bỏ qua tài liệu này và dùng [hướng dẫn chung](supabase-workflow.md).

## 1. Hiểu các từ trước khi chạy lệnh

| Từ trong hướng dẫn | Nghĩa đơn giản |
|---|---|
| Project ref | Mã nhận diện project Supabase; lead dùng để chọn đúng server |
| Link | Nối công cụ dòng lệnh trên máy với một project server |
| Migration | File SQL ghi thay đổi bảng/quyền/hàm, lưu cùng code trong Git |
| Migration history | Danh sách migration đã chạy trên database |
| Baseline | Bộ file mô tả cấu trúc server đang có, làm điểm bắt đầu chung |
| Pending migration | File thay đổi mới mà server chưa chạy |
| Dry-run | Xem trước những migration sẽ chạy, chưa áp dụng chúng |
| Smoke test | Thử nhanh chức năng chính sau cập nhật, ví dụ login và tạo Booking |
| Deploy | Đưa bản thay đổi lên server hoặc hosting để người khác dùng |

Lead cũng học từng bước; không cần xây pipeline deploy tự động ngay. Pipeline là chuỗi công việc tự động, ví dụ kiểm tra code rồi phát hành. GitHub Actions chỉ kiểm tra code; Pages tự build/deploy frontend theo cấu hình Dashboard. Database/backend Supabase vẫn do lead cập nhật từ code đã review.

## 2. Đưa thay đổi database lên server

Đây là hướng dẫn thao tác tương lai, **không phải lệnh mỗi thành viên chạy sau khi push code**. Chỉ lead/người được giao cập nhật đúng project dev, từ code đã merge và qua CI; không tự tạo project hoặc bật billing.

Lần đầu cấu hình CLI trên máy lead, thay `YOUR_DEV_PROJECT_REF` bằng project ref dev đã xác nhận:

```bash
npx --no-install supabase login
npx --no-install supabase link --project-ref YOUR_DEV_PROJECT_REF
```

CLI account/database password khác publishable key. Giữ credentials ở nơi riêng, không ghi vào tài liệu/commit. Đối chiếu project đã link trước mỗi lần cập nhật. Nếu server đã có schema sửa tay mà repo chưa có, lead cần lấy baseline có review trước; `supabase db pull` tạo migration schema và có thể đề nghị cập nhật migration history remote, không phải tải user/dữ liệu về máy. Không push chồng lên schema chưa đối chiếu.

Sau khi baseline/history khớp và migration được duyệt:

```bash
npx --no-install supabase migration list --linked
npx --no-install supabase db push --linked --dry-run
```

Đọc danh sách pending migrations, kiểm tra tác động dữ liệu, bảo đảm có phương án phục hồi phù hợp; sau đó lead mới áp dụng:

```bash
npx --no-install supabase db push --linked
```

`db push` áp dụng migrations; không tự deploy frontend, Edge Functions, Auth users hay toàn bộ Auth settings. Không đưa seed local lên server. Không chạy reset với `--linked`/remote URL; không dùng repair/include-all để né lệch history. Xem [CLI reference](https://supabase.com/docs/reference/cli/supabase-db-push).

Lead ghi commit, migration versions và kết quả smoke test. Lỗi sau deploy thì dừng cập nhật tiếp, phối hợp owner viết migration sửa; rollback frontend không tự rollback database. Nếu có Edge Functions sau này, cần quy trình secrets/deploy và test riêng; hiện chưa có để triển khai.

Server dev chung dùng để tích hợp; production-demo khi có sẽ được tách project/config/dữ liệu và cập nhật từ main. Nhánh Git dev/main không tự tạo Supabase branch hoặc tự link project. Team chưa cần mở thêm project chỉ để mỗi người làm một module.


## 3. Kiểm tra sau cập nhật

Ghi lại commit Git và tên các migration vừa áp dụng. Nhờ owner thử chức năng của mình, sau đó team thử luồng ghép xe chung. Ví dụ: login → đăng chuyến → xin đi → driver nhận → trả khách → trả điểm. Chỉ thử những phần đã được triển khai.

Nếu thất bại, ghi bước gây lỗi và giao lại owner. Không chạy thêm lệnh sửa lịch sử migration khi chưa hiểu nguyên nhân. Rollback là quay lại phiên bản code trước; nó không tự trả database về trạng thái trước.

Auth users (tài khoản đăng nhập), cấu hình email/redirect, frontend Cloudflare và Edge Functions là những phần cần quản lý riêng, không tự đi theo mọi migration. Edge Function là code backend chạy trên Supabase; repo hiện chưa có phần này và local runtime đang tắt.
