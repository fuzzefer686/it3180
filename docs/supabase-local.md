# Chạy và thử app trên máy — từng bước

Nếu chỉ làm giao diện với server dev của nhóm, dùng [README](../README.md), không cần Docker. Tài liệu này dành cho lúc muốn **chạy cả Supabase trên máy mình**, ví dụ thử bảng hoặc backend mà không ảnh hưởng người khác.

## 1. Chuẩn bị một lần

1. Cài Node 22 (từ 22.12); Node giúp chạy công cụ dev của app.
2. Cài Docker Desktop, mở lên và chờ engine chạy. Engine là phần Docker dùng để chạy các dịch vụ.
3. Mở terminal ở thư mục gốc CNPM, nơi có README và package.json. Nếu dùng nvm, chạy `nvm install 22` rồi `nvm use`; `node -v` cần ra `v22…`.
4. Chạy `npm ci` để cài thư viện. Nếu đã cài đúng lockfile rồi, không cần chạy mỗi buổi.

Không cần tài khoản Supabase online hoặc Java. Lần đầu Docker cần tải bộ dịch vụ qua mạng, có thể mất vài phút; lần sau dùng lại. Mỗi máy có dữ liệu riêng.

## 2. Nếu env đang trỏ server, lưu lại trước

Env là file cấu hình app. `web/.env.local` chứa địa chỉ Supabase mà web đang dùng. Tên file có “local” chỉ nói file nằm trên máy; nội dung vẫn có thể trỏ server online.

1. Dừng web bằng Ctrl+C nếu đang chạy.
2. Copy nội dung `web/.env.local` sang `web/.env.cloud.local` để giữ cấu hình server.
3. Trong `web/.env.local`, xóa hai dòng `VITE_SUPABASE_URL` và `VITE_SUPABASE_PUBLISHABLE_KEY`; giữ biến khác nếu có.

File dự phòng `.env.cloud.local` không tự được lệnh dev nạp. Khi quay về server, bạn phải copy hai dòng server trở lại `.env.local`. Cả hai file đều được Git bỏ qua, không commit.

Nếu chưa có env hoặc env đã trỏ `127.0.0.1:54321`, bỏ qua bước này. Script cố ý không ghi đè URL server để tránh đổi nhầm nơi kết nối.

## 3. Chạy app: một lệnh

Tại gốc CNPM, với Docker đang mở:

```bash
npm run dev
```

Lệnh tự làm bốn việc: chạy Supabase → điền env local → tạo tài khoản mẫu → chạy web. Giữ terminal mở. Mong đợi thấy thông báo Supabase sẵn sàng và Vite hiển thị địa chỉ web.

- Web đăng nhập: http://127.0.0.1:5173/tai-khoan
- Email mẫu: `user@vecung.test`
- Mật khẩu mẫu: `12345678`
- Studio: http://127.0.0.1:54323 — trang quản lý Supabase **trên máy**, dùng để xem user/bảng.

Tài khoản mẫu chỉ để login local, không có quyền admin, hồ sơ hoặc ví. Tài khoản này không tự xuất hiện trên server online.

## 4. Tự thử đăng nhập

| Thao tác | Kết quả cần thấy |
|---|---|
| Nhập email mẫu và mật khẩu sai | Có lỗi, không đăng nhập |
| Nhập đúng email/mật khẩu mẫu | Hiện email tài khoản |
| Tải lại trang | Vẫn đăng nhập |
| Bấm đăng xuất | Trở về form login |

Hồ sơ báo chưa triển khai là đúng với bản hiện tại: backend hồ sơ chưa có. Đừng cố tạo dữ liệu giả để che thông báo này.

## 5. Chạy test tự động

Mở terminal thứ hai cũng tại gốc CNPM, giữ Docker mở:

```bash
npm run test:local
```

Mong đợi tests đều passed, không có failed. Test tự tạo/xóa tài khoản test riêng và kiểm tra Auth local; không cần nhập tài khoản mẫu vào script. Nếu chưa có Supabase chạy, script tự khởi động rồi dừng; nếu đang chạy app thì giữ Supabase đó.

Trước PR có thể chạy `npm run check`: thêm kiểm tra TypeScript và build. Test nghiệp vụ cho bảng/API mới do owner bổ sung, các test Auth hiện tại chưa kiểm tra hết app.

## 6. Dừng app

Nhấn Ctrl+C tại terminal chạy web, rồi chạy:

```bash
npm run supabase:stop
```

Web và Supabase là hai phần riêng, nên cần dừng cả hai. Lệnh stop giữ dữ liệu Supabase local để dùng lần sau; không cần tắt cả Docker Desktop nếu đang dùng cho việc khác.

## 7. Quay lại server của team

1. Dừng app local như bước 6.
2. Copy hai dòng URL/key server từ `web/.env.cloud.local` trở lại `web/.env.local`.
3. Chạy `npm run dev:web`.
4. Login bằng tài khoản **trên server**, không phải tài khoản seed local nếu chưa tạo riêng trên server.

Muốn xác nhận nơi web đang gọi: mở DevTools bằng F12 hoặc menu công cụ trình duyệt → Network, thử login và nhìn địa chỉ request. `127.0.0.1:54321` là local; domain project Supabase online là server. Không chia sẻ token trong request.

## 8. Lỗi hay gặp

| Lỗi | Làm gì trước? |
|---|---|
| Không kết nối được Docker daemon | Mở Docker Desktop, chờ engine chạy rồi thử lại |
| Node sai phiên bản | Tại gốc repo chạy `nvm use` nếu dùng nvm; kiểm tra `node -v` |
| Tải Docker images lâu hoặc lỗi | Kiểm tra mạng/dung lượng rồi chạy lại `npm run dev` |
| Env đang trỏ cloud | Làm bước 2, không ép script ghi đè |
| Port 54321–54324 bị chiếm | Có dịch vụ khác dùng cùng cổng; nhờ lead xác định và dừng đúng dịch vụ |
| Đổi env nhưng app dùng cấu hình cũ | Ctrl+C rồi chạy lại lệnh dev tương ứng |
| Tài khoản demo không login được | Chạy `npm run seed:local`; nếu báo email đã có mật khẩu khác, sửa user trong Studio local |
| Login được, hồ sơ chưa triển khai | Phần hồ sơ chưa có backend, không phải lỗi Docker |

Tiếp theo: [quy trình gửi code/migration](supabase-workflow.md). Tài liệu chính thức: [Supabase local](https://supabase.com/docs/guides/local-development), [React + Supabase](https://supabase.com/docs/guides/getting-started/quickstarts/reactjs).
