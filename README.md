# Về Cùng — project CNPM

Team gồm 5 sinh viên năm 3. Tài liệu được viết để có thể làm từng bước, hiểu lý do và giải thích lại cho nhau.

App dùng React/Vite/TypeScript/Tailwind, Supabase và VietMap; frontend dùng **Cloudflare Pages**.
Nhánh này đã ghép [Auth/hồ sơ/admin](docs/auth-module.md) và [Trip/VietMap](docs/trips.md).
Lead quản lý Supabase nhóm. Migration đã được viết lại theo schema đọc từ server
ngày 22/10; xem [thứ tự review và áp dụng](docs/trips.md) trước khi cập nhật server.
Booking/ví do owner khác phụ trách. Thay đổi chưa được áp dụng lên server.

## 1. Bắt đầu theo cách đơn giản nhất

Cả team sửa code trên máy. Khi làm giao diện, dùng Supabase server dev chung của nhóm. “Dev” là nơi thử nghiệm; dữ liệu trên server này dùng chung. Cách này **không cần Docker**.

Làm tại thư mục gốc `CNPM`, nơi có README này và `package.json`, không phải thư mục `web/`.

1. Cài Node 22 (từ 22.12). Nếu đã dùng nvm để quản lý phiên bản Node, chạy `nvm install 22` rồi `nvm use`.
2. Chạy `npm ci` một lần để cài các thư viện đúng phiên bản của repo.
3. Nhận URL và publishable key từ lead, điền vào `web/.env.local`:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
```

Thay phần `YOUR_…` bằng giá trị lead cung cấp. URL là địa chỉ server; publishable key là key được phép dùng ở frontend. Không điền secret/service-role key. File env là file cấu hình; không đưa `.env.local` lên Git.

4. Chạy:

```bash
npm run dev:web
```

Khi terminal hiện địa chỉ web, mở http://127.0.0.1:5173/tai-khoan. Đăng nhập bằng tài khoản test riêng mà lead tạo **trên server**. Thử đăng nhập, tải lại trang và đăng xuất. Nhấn Ctrl+C tại terminal để dừng web.

Nếu hồ sơ báo “chưa triển khai” sau khi login, server đang dùng chưa có RPC Auth mới; lead cần đối chiếu schema và cập nhật từ code đã review, không phải login thất bại. Đổi env thì dừng và chạy lại web để đọc cấu hình mới.

## 2. Khi nào cần Docker?

Docker cần khi muốn chạy **cả Supabase trên máy mình**, thường là lúc làm bảng dữ liệu hoặc xử lý backend. Docker giúp chạy bộ dịch vụ Supabase mà không phải tự cài từng dịch vụ.

| Bạn đang làm gì? | Lệnh tại gốc CNPM | Docker |
|---|---|---|
| Làm giao diện, dùng server dev của team | `npm run dev:web` | Không cần |
| Làm database/backend, dùng dữ liệu riêng trên máy | `npm run dev` | Cần |
| Chạy unit test: kiểm tra từng phần code nhỏ | `npm test` | Không cần |
| Chạy cả unit và Auth test với Supabase local | `npm run test:local` | Cần |

Local nghĩa là chạy trên máy mình. Hai dòng đầu đều có web local, nhưng dòng thứ hai còn có Supabase local. Xem [các bước thực hành local](docs/supabase-local.md) khi bắt đầu làm backend; chưa cần cài Docker chỉ để làm giao diện.

## 3. Mỗi người giao code như thế nào?

Tạo nhánh riêng từ `dev` → làm một việc nhỏ → test → gửi PR vào `dev` → người khác đọc/review → lead ghép code. PR là yêu cầu ghép nhánh của bạn vào nhánh chung. Sau đó lead cập nhật server nếu có thay đổi database và team thử cùng nhau.

**Push lên GitHub chỉ gửi code, không tự sửa database server.** Không tự thử thay đổi bảng trên server chung vì có thể làm phần của người khác bị lỗi. Bản ổn trên dev mới được đưa vào main bằng PR.

Đọc theo thứ tự:

1. [Quy trình Supabase cho cả team](docs/supabase-workflow.md).
2. [Cách dùng Git/PR từng bước](ke-hoach/08-github-workflow.md).
3. [Kế hoạch đúng phần của mình](ke-hoach/README.md).

Lead đọc thêm [cách cập nhật server](docs/supabase-lead.md) khi cần; mọi người không phải chạy các lệnh đó mỗi ngày.

## 4. Kiểm tra trước khi gửi code

Nếu đang làm giao diện và chưa có Docker, chạy lần lượt:

```bash
npm run typecheck
npm run build
npm test
```

`typecheck` tìm lỗi kiểu TypeScript; `build` kiểm tra app có đóng gói được; `test` chạy các ca kiểm tra nhỏ. Kết quả mong đợi là lệnh kết thúc không lỗi, tests đều passed.

Nếu có Docker, chạy `npm run check` để kiểm tra thêm đăng nhập với Supabase local. GitHub Actions cũng chạy lệnh này tự động khi có PR; phải qua trước merge. GitHub Actions chỉ kiểm tra code; Cloudflare Pages tự build/deploy frontend qua kết nối Git đã cấu hình trên Dashboard. Database Supabase được cập nhật riêng.

## 5. Tài liệu và code để đọc khi cần

- [Giải thích thuật ngữ và công cụ](ke-hoach/07-tech-stack.md).
- [Contract: frontend gửi gì, backend trả gì](docs/contracts.md).
- [Kết quả kiểm chứng](docs/validation.md).
- [Cấu hình Pages, chuyển domain và xóa Worker cũ](docs/cloudflare-pages.md).
- `web/src/lib/supabase.ts`: kết nối Supabase dùng chung.
- `web/src/modules/auth/`: màn hình và phiên đăng nhập.
- `supabase/config.toml`: cấu hình Supabase trên máy.

## 6. Ảnh và font giao diện

Font Be Vietnam Pro được đóng gói qua `@fontsource/be-vietnam-pro`, hỗ trợ Latin/tiếng Việt ở các độ đậm 400/500/600/700.

Ảnh `web/public/images/ride-home.jpg` là ảnh minh họa tạo bằng AI, không phải tài xế thật trong hệ thống. Ảnh chính rộng 1400px; hai bản `ride-home-small.jpg` (720px) và `ride-home-medium.jpg` (960px) giúp trình duyệt chọn kích thước phù hợp màn hình.
