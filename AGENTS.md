# Hướng dẫn Agent cho Về Cùng

Đọc README.md, docs/contracts.md và kế hoạch module trước khi sửa code.

- Đây là môn học CNPM, nhóm cần hiểu code. Giải thích ngắn thiết kế và kiểm thử.
- Stack: React/Vite/TypeScript/Tailwind; Firebase Auth, callable Functions, Firestore, Hosting; VietMap.
- Owner: 1 nền tảng/config/shared/CI; 2 auth/hồ sơ/admin; 3 Trip/VietMap; 4 Booking; 5 ví điểm demo.
- Một repo; FE/BE/test tách theo module. Không microservices hoặc abstraction dư thừa.
- Thay đổi shared/contracts.ts, Rules, indexes hoặc config phải nêu ảnh hưởng tới các module.
- Auth SDK quản lý token/password. Backend lấy uid từ request.auth, quyền/status từ users; không tin quyền/giá/số dư FE.
- Firestore client đọc/ghi trực tiếp bị chặn. Admin SDK bỏ qua Rules, từng function phải kiểm tra quyền.
- Bootstrap user dùng requireUid; nghiệp vụ dùng requireActiveUser và kiểm tra eligibility phù hợp.
- Một Trip chỉ phục vụ một khách, được xuống sớm; driver chọn queue thủ công; cutoff và trạng thái do server quyết định.
- Ví chỉ là điểm demo, không tiền thật/PayOS/đổi điểm thành tiền. Transaction và idempotency bắt buộc khi làm Booking/ví.
- Chưa có handler thì ghi rõ chưa triển khai, không trả fake success.
- Test local bằng Emulator project demo-vecung; không gọi Firebase cloud/VietMap thật trong CI.
- Có Java 21, Node 22. Chạy kiểm tra phù hợp thay đổi; sửa logic backend cần unit/integration. Dừng dev Emulator trước npm run check vì chung port.
- Không thêm secrets/giấy tờ thật/build output vào Git. Chỉ push/deploy/tạo project/bật billing nếu nằm trong yêu cầu của người dùng.
- Cloud deploy mặc định tắt; không bỏ guard để né config/billing.
- Nhánh môi trường hiện là dev/staging/main. Owner feature branch → PR dev; reviewer khác tác giả. Không force push nhánh môi trường.
