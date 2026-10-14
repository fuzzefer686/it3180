# Git/GitHub — gửi code từng bước

Team dùng một repo. Mọi lệnh dưới đây chạy tại **gốc CNPM**. Đây là hướng dẫn để bạn tự làm, không phải lệnh cần chạy hết ngay khi đọc.

## 1. Các từ cần biết

| Từ | Nghĩa |
|---|---|
| Repo | Thư mục code được Git quản lý |
| Clone | Tải repo về máy, thường làm một lần |
| Branch / nhánh | Bản làm việc riêng; feature branch là nhánh cho một task |
| Commit | Lưu một mốc thay đổi trong lịch sử trên máy |
| Push | Gửi các commit lên GitHub |
| PR | Pull Request: đề nghị ghép nhánh của bạn vào nhánh chung |
| Review | Người khác đọc code và test, góp ý hoặc đồng ý |
| Merge | Ghép code của một nhánh vào nhánh khác |
| Conflict | Hai nhánh sửa chỗ không tự ghép được; cần đọc và giải quyết |

`dev` là nhánh ghép các phần đang phát triển; `main` giữ bản ổn. `origin/dev` là bản dev lấy từ GitHub. Không code rồi push thẳng vào dev/main.

## 2. Bắt đầu một task mới

Clone/cài/chạy app theo [README](../README.md) trước. Nếu máy đang có sửa đổi chưa lưu, commit hoặc nhờ lead giúp trước khi đổi nhánh; không xóa chúng để bắt đầu task khác.

Ví dụ bạn 2 làm task login:

```bash
git fetch origin
git switch -c feat/2-login origin/dev
```

`fetch` lấy thông tin code mới từ GitHub; lệnh sau tạo nhánh riêng từ dev mới nhất. Mong đợi Git báo đang ở nhánh `feat/2-login`. Dùng tên mới phù hợp task, không dùng lại nhánh đã merge.

Bạn viết code và thử trên máy. Làm giao diện có thể dùng `npm run dev:web` với server dev; làm bảng/backend dùng Docker local theo [workflow](../docs/supabase-workflow.md).

## 3. Kiểm tra rồi lưu thay đổi

Chạy các kiểm tra theo README; backend dùng `npm run check` với Docker. Sau đó xem đã sửa file nào:

```bash
git status
git diff
```

`status` liệt kê file thay đổi; `diff` cho thấy nội dung thêm/xóa. Đọc để chắc không sửa nhầm module hoặc đưa env/key/dữ liệu cá nhân vào Git.

Ví dụ task chỉ sửa trang Auth, chọn đúng file đó:

```bash
git add web/src/modules/auth/AuthPage.tsx
git diff --cached
git commit -m "feat(auth): improve login form"
```

`add` chọn file đưa vào commit; `diff --cached` xem lại phần đã chọn; `commit` lưu mốc trên máy. Ví dụ trên chỉ chọn một file; nếu task có nhiều file thì chọn thêm từng đường dẫn thật của task. Không copy lệnh ví dụ nếu bạn làm file khác.

Mong đợi Git báo tạo commit. Lưu code rồi chạy:

```bash
git push -u origin feat/2-login
```

Push lần đầu đưa nhánh lên GitHub. Những lần sửa tiếp trên nhánh này dùng `git push`. **Pages tự build/deploy frontend các nhánh đã bật trong Dashboard; push không tự sửa database/backend Supabase.**

## 4. Mở PR và nhận review

1. Trên GitHub mở Pull requests → New pull request.
2. Chọn **base: dev**, **compare: nhánh task của bạn**.
3. Ghi đã làm gì, cách thử, kết quả test và phần chưa làm. Nếu có migration, ghi file/thay đổi bảng/quyền và ai bị ảnh hưởng.
4. Mời reviewer khác tác giả. Reviewer đọc code, hỏi cách làm và test; bạn cần giải thích được code mình gửi.
5. Nếu có góp ý, sửa trên cùng nhánh, test lại, commit rồi push. PR tự cập nhật.
6. CI (test tự động GitHub) phải qua và review được đồng ý thì lead mới merge.

Gợi ý mô tả ngắn:

```text
Làm gì: hiện lỗi dễ hiểu khi mật khẩu sai.
Thử thế nào: nhập sai → thấy lỗi; nhập đúng → login được.
Kiểm tra: typecheck/build/unit test đã qua.
Database: không thay đổi.
Chưa làm: đăng ký tài khoản.
```

UI owner chưa có Docker chạy kiểm tra không Docker trên máy; CI vẫn phải qua integration local trước merge. Backend owner tự chạy test Supabase local để dễ tìm lỗi.

## 5. Nếu dev có code mới khi bạn đang làm

Commit công việc hiện tại trước, rồi trên nhánh task chạy:

```bash
git fetch origin
git merge origin/dev
```

Nếu tự ghép được thì test lại. Nếu Git báo conflict, đọc các chỗ cùng bị sửa và nhờ lead/người sửa file đó giải quyết; không chọn xóa một bên hoặc force push khi chưa hiểu. Chạy lại kiểm tra trước khi push tiếp.

## 6. Lead làm gì?

- Mời các thành viên vào repo bằng tài khoản riêng.
- Bảo vệ dev/main: bắt buộc PR, review khác tác giả, các kiểm tra qua; chặn force push/xóa nhánh. PR lead cũng cần review.
- Review chéo: 1↔2, 3↔4; 1 review 5, 5 review CI/deploy của 1.
- Merge từng task nhỏ vào dev, cập nhật database server khi có migration đã duyệt, thử luồng cùng team. Lệnh server ở [phần lead](../docs/supabase-lead.md).
- Bản dev ổn mới mở PR dev → main bằng merge commit, tức ghép giữ lịch sử hai nhánh. Không force push dev/main.

Sau khi task merge, task mới lại tạo nhánh mới từ origin/dev. Không cần copy code của bạn khác thủ công; Git giữ lịch sử và ghép code chung. GitHub Actions chỉ test; Pages tự build/deploy frontend theo cấu hình Dashboard. Database/backend Supabase cập nhật riêng sau review.
