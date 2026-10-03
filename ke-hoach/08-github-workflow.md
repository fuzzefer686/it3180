# GitHub — mỗi người làm và push như thế nào?

Một repo public cho cả nhóm, mỗi task một nhánh. Tất cả code FE/BE/test cùng nằm trong repo; không tạo 5 app hay 5 repo.

## Lead chuẩn bị trước

1. Tạo repo public, mời 4 người vào Settings → Collaborators; không chia sẻ tài khoản GitHub.
2. Push scaffold chạy được, tài liệu `ke-hoach/`, README, lockfile, `.gitignore` và `.env.example` không chứa secrets. Nếu chưa có scaffold thì chưa yêu cầu mọi người tự dựng app riêng.
3. Tạo `dev`, `staging` từ bản khởi tạo trên `main`. `dev` nhận module; `staging` nghiệm thu; `main` là production-demo.
4. Bật branch protection cho ba nhánh: yêu cầu PR, một approval của người khác tác giả, resolve conversations, CI check qua; chặn force push/xóa. Áp dụng cả admin nếu cấu hình cho phép. Chọn check sau khi workflow đã chạy lần đầu.
5. Tạo Issues nhỏ, mỗi Issue có owner, yêu cầu, điều kiện hoàn thành và reviewer. Một task chính/người; Project board Todo/Doing/Review/Done nếu cần.
6. Lead quản lý file chung/config, review tích hợp và bấm merge theo quy ước nhóm. PR của lead cũng phải được người khác review. Firebase project/secrets/CI do lead cấu hình; mỗi thành viên chạy local bằng Emulator.

GitHub Free hỗ trợ branch protection cho repo public. [Tài liệu](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches)

## Phần code từng người

| Người | Vùng code chính dự kiến | Ví dụ nhánh/task đầu |
|---|---|---|
| 1 — Lead | Layout/shared components, Firebase config, scripts, CI | feat/1-foundation |
| 2 | web Auth/profile/admin; functions auth/profile/admin | feat/2-login |
| 3 | web Trip/map; functions trips/VietMap | feat/3-create-trip |
| 4 | web Booking/queue; functions bookings/fare | feat/4-request-ride |
| 5 | web Wallet/payment/history; functions wallets/payments | feat/5-wallet |

Tên thư mục cụ thể do lead dựng và chốt. Tránh tất cả sửa cùng một file lớn: functions entrypoint/shared types do lead quản lý; module export handler riêng. Owner gửi đề xuất sửa contract/config chung trong PR, báo các người phụ thuộc.

## Một vòng làm việc của thành viên

1. Clone repo một lần; cài theo README, chạy app/Emulator. Lần làm task mới, lấy `dev` mới nhất rồi tạo nhánh riêng.
2. Làm FE/BE/test của task. Commit từng phần rõ ràng; có thể push khi đang làm và mở Draft PR để nhóm thấy tiến độ.
3. Trước review: chạy check, đọc diff, kiểm tra file định push; không đưa `.env`, service-account JSON, key REST, node_modules hay dữ liệu cá nhân lên repo.
4. Push nhánh feature rồi mở PR **base=dev**. Gắn Issue, nêu thay đổi, cách chạy/test và ảnh giao diện nếu hữu ích; yêu cầu reviewer.
5. Reviewer góp ý → owner sửa/test rồi push tiếp cùng nhánh; PR tự cập nhật. CI qua và được approve thì lead merge.
6. Task đã merge: lấy dev mới, xóa nhánh cũ khi an toàn, tạo nhánh mới cho task kế tiếp. Không dùng nhánh cũ cho việc mới.

Ví dụ người 2, sau khi clone và cài theo README:

```bash
git switch dev
git pull --ff-only origin dev
git switch -c feat/2-login

# Code, chạy app/test theo README trước khi commit.
git status
git diff
git add <cac-file-cua-task>
git diff --cached
git commit -m "feat(auth): add Firebase login and logout"
git push -u origin feat/2-login
```

Thay `<cac-file-cua-task>` bằng đường dẫn thật; không chạy nguyên placeholder. Lead cung cấp lệnh `npm run check` ở root để chạy typecheck/build/test; test dùng Emulator, không cloud.

Nếu dev thay đổi lúc bạn đang code: commit công việc của mình trước, `git fetch origin`, rồi `git merge origin/dev` trên nhánh feature. Nếu conflict, owner cùng người sửa file liên quan giải quyết, chạy lại check rồi push; không ghi đè file hoặc force push để né conflict.

## Lead làm gì với code mọi người?

- Xem PR và CI; reviewer chéo 1↔2, 3↔4; 1 review 5. Người 5 review CI/deploy của lead.
- Review nghiệp vụ/quyền, contract, test và khả năng giải thích code; không chỉ thấy trang chạy là merge.
- Merge từng PR vào dev, chạy luồng chung khi module phụ thuộc đã vào. Có lỗi thì tạo Issue/PR sửa, owner chịu trách nhiệm.
- Bản ổn: mở PR dev → staging, test luồng toàn app; mở PR staging → main để phát hành. Dùng merge commit cho hai PR giữa nhánh môi trường để giữ lịch sử, không squash riêng từng đợt phát hành.
- CI/CD chỉ deploy khi push dev/staging/main và checks qua, nếu đã cấu hình Firebase/billing; push feature chỉ lưu code/kiểm tra PR. Không copy code từng người thủ công và không push thẳng ba nhánh sau bước khởi tạo.
- Cập nhật 04/10: scaffold và CI mẫu đã có local; remote có dev/staging/main. Lead review và đưa baseline qua PR. Firebase cloud/deploy chưa cấu hình.

Xem [kế hoạch lead](01-lead.md), [tech stack](07-tech-stack.md) và [hosting/CI](06-hosting-cicd.md).
