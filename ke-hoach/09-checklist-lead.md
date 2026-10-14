# Checklist lead — làm từng bước

Có login/logout và test Auth. Chưa có backend ứng dụng. Mục tiêu là cả nhóm hiểu và thực hành được, không chỉ chạy code do Agent viết.

## Trước khi giao task

- [ ] Gửi README; mỗi người mở được web với env server dev, không cần Docker.
- [ ] Tạo tài khoản test riêng trên server; không chia sẻ tài khoản quản trị.
- [ ] Ai làm database/backend thì cùng thử Docker local và `npm run test:local`.
- [ ] Mỗi task ghi owner (người làm), reviewer (người đọc lại), kết quả cần đạt và test cần thử.
- [ ] Cùng owner chốt bảng và dữ liệu API trước khi viết phần phụ thuộc nhau.

## Task đầu phù hợp

| Người | Bắt đầu nhỏ | Sau đó |
|---|---|---|
| 1 | Team chạy đúng cách, biết tạo PR | Hỗ trợ code chung và cập nhật server |
| 2 | Hiểu login/logout đang có | Đăng ký, tạo hồ sơ ban đầu và quyền |
| 3 | Form tuyến, hiểu điểm đón/trả | Lưu tuyến và xử lý vòng đời chuyến |
| 4 | Hiểu các trạng thái yêu cầu đi cùng | Backend nhận khách, chống nhận trùng |
| 5 | Hiểu sơ đồ chuyển điểm | Tạo ví, lịch sử và trả điểm đúng một lần |

Dữ liệu mẫu để thử phải ghi rõ là mẫu; không trả success giả khi backend chưa có.

## Mỗi PR

- [ ] Owner giải thích được đã thay gì và vì sao.
- [ ] Có kết quả test; GitHub Actions (CI) đã qua.
- [ ] Reviewer khác tác giả đọc code và quyền; PR lead cũng có review.
- [ ] Nếu có migration, thử tái tạo database local; xem module nào bị ảnh hưởng.
- [ ] Merge vào dev; cập nhật server nếu cần rồi thử chung với owner.

## Khi cần cập nhật server

Đọc [hướng dẫn riêng cho lead](../docs/supabase-lead.md): chọn đúng project → đối chiếu migration → xem trước → áp dụng → thử nhanh → ghi lại phiên bản. Không reset remote hoặc chạy lệnh sửa history để né lỗi.

Bản dev ổn mới PR sang main bằng merge commit; Pages tự build/deploy frontend từ các nhánh đã bật; database/backend Supabase cập nhật riêng. Deadline cũ 10/10 đã qua, nhóm tự chốt lịch mới. Giữ scope một khách/chuyến và điểm demo, không thêm tiền thật.
