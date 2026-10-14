# Hướng dẫn Agent cho Về Cùng

Đọc README.md, docs/contracts.md, docs/supabase-workflow.md và kế hoạch module trước khi sửa code.

- Cả team là sinh viên năm 3, chưa có nhiều kinh nghiệm thực hành. Ưu tiên cách làm đơn giản, rõ ràng, ít bước và dễ giải thích lại; không giả định đã biết Git, Docker, Supabase hoặc backend.
- Viết hướng dẫn theo thứ tự: cần làm gì → lệnh chạy ở đâu → kết quả mong đợi → lỗi thường gặp. Giải thích thuật ngữ khi xuất hiện, dùng ví dụ của Về Cùng; tránh gom nhiều từ viết tắt trong một câu.
- Tách bước bắt buộc để bắt đầu khỏi phần nâng cao/chỉ dành cho lead. Chia task nhỏ, giải thích ngắn lý do thiết kế và cách kiểm thử để nhóm hiểu code; đơn giản hóa cách trình bày nhưng giữ kiểm tra quyền, transaction và idempotency cần thiết.
- Stack: React/Vite/TypeScript/Tailwind; Supabase Auth/SDK; backend/database Supabase do team thiết kế; Cloudflare Pages frontend; VietMap. Không thêm cấu hình Workers/Wrangler khi chưa được yêu cầu.
- Owner: 1 nền tảng/config/shared/CI; 2 auth/hồ sơ/admin; 3 Trip/VietMap; 4 Booking; 5 ví điểm demo.
- Một repo; FE/BE/test tách theo module. Không microservices hoặc abstraction dư thừa.
- Thay đổi shared/contracts.ts, Rules, indexes hoặc config phải nêu ảnh hưởng tới các module.
- Auth SDK quản lý token/password. Backend lấy uid từ phiên Supabase đã xác minh, quyền/status từ users; không tin quyền/giá/số dư FE.
- Không cho client tự sửa quyền/giá/số dư. Backend phải tự kiểm tra quyền; không tin Auth user_metadata. Schema/RLS/grants do team thiết kế.
- Bootstrap kiểm tra uid đã xác minh; nghiệp vụ kiểm tra trạng thái ACTIVE và eligibility phù hợp. Các handler Supabase hiện chưa triển khai.
- Một Trip chỉ phục vụ một khách, được xuống sớm; driver chọn queue thủ công; cutoff và trạng thái do server quyết định.
- Ví chỉ là điểm demo, không tiền thật/PayOS/đổi điểm thành tiền. Transaction và idempotency bắt buộc khi làm Booking/ví.
- Chưa có handler thì ghi rõ chưa triển khai, không trả fake success.
- Test Supabase local trong Docker; không gọi cloud/VietMap thật trong CI. Chưa có migration/bảng ứng dụng; không tự thiết kế bảng nếu team chưa yêu cầu.
- Node 22 và Docker cho local; không cần Java. Chạy kiểm tra phù hợp thay đổi; sửa logic backend cần unit/integration.
- Không thêm secrets/giấy tờ thật/build output vào Git. Chỉ push/deploy/tạo project/bật billing nếu nằm trong yêu cầu của người dùng.
- Cloud deploy mặc định tắt; không bỏ guard để né config/billing.
- Nhánh môi trường hiện là dev/main. Owner feature branch từ dev → PR dev; reviewer khác tác giả. Kiểm thử bản ổn trên dev rồi PR dev → main bằng merge commit. Không force push nhánh môi trường.

- UI có thể chạy frontend local + Supabase server dev bằng dev:web, không cần Docker; backend/database làm/test Docker local trước. Migration/RLS/grants/RPC qua PR, lead cập nhật server từ code đã review; Git push không tự deploy. Không sửa migration đã áp dụng online; không reset remote.
