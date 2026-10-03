# Người 1 — Lead và nền tảng Firebase

**Mục tiêu:** cả nhóm chạy cùng một app, ghép code và demo được trước 10/10. Auth/hồ sơ do người 2 làm.

## Việc cần làm

1. Dựng React/Vite/TypeScript/Tailwind ở `web/`, Cloud Functions TypeScript ở `functions/`; cấu hình Firebase SDK và Admin SDK.
2. Tạo cấu hình Auth/Firestore/Functions Emulator và dữ liệu mẫu hư cấu; mọi người có cùng lệnh chạy/test.
3. Chốt collections, trạng thái, contract callable và lỗi với nhóm. Dựng layout/component chung và wrapper gọi function, không làm thay module.
4. Quản lý `firestore.rules` mặc định chặn client truy cập trực tiếp, indexes và CI build/test; deploy theo ba môi trường khi có billing.
5. Tích hợp luồng từ đăng nhập đến trả điểm; thông báo V1 hiển thị trạng thái trong trang, chưa cần push/realtime.

**Stack:** stack chung Firebase; công cụ riêng Firebase CLI, Emulator Suite, GitHub Actions. Test: Vitest + Emulator, checklist luồng toàn ứng dụng. Xem [giải thích tech stack](07-tech-stack.md).

**Bàn giao:** repo chạy local, contract chung, CI/deploy, README. Người 2 review nền tảng; người 5 review deploy. Xem [hosting](06-hosting-cicd.md).

## Cách lead đơn giản

- Trước code: thống nhất collection và input/output function; owner module chịu trách nhiệm FE/BE/test.
- Mỗi ngày 10 phút: đã chạy được gì, đang kẹt gì, cần ai giúp.
- Một task chính/người; mỗi PR có reviewer khác tác giả. Demo chung ngày 05, 07, 09/10; sau 08/10 chỉ sửa lỗi.
- Mỗi người viết use case, contract và test ngắn; phải giải thích được code AI viết trước khi merge.
- Review thay đổi Rules/indexes/config chung. Lead hỗ trợ debug và tích hợp, không sửa hộ toàn bộ module.

## Kiểm tra tối thiểu

Client không sửa trực tiếp roles/ví; Functions kiểm tra quyền vì Admin SDK bỏ qua Rules. CI test không chạm cloud. Ba project không dùng chung tài khoản/dữ liệu/secrets. Không đưa service account/VietMap REST key vào repo. Không tự bật billing.

## Mốc của bạn

04–05/10: scaffold/Emulator/CI, smoke test Auth → callable → Firestore. 06–07/10: ghép module, dev/stage/prod nếu đủ điều kiện. 08–10/10: test, release và demo.

## Prompt gửi Agent

```text
Tôi là người 1/Lead. Đọc ke-hoach/00-ke-hoach-tong-the.md, ke-hoach/01-lead.md, ke-hoach/06-hosting-cicd.md và ke-hoach/07-tech-stack.md. Dựng một repo React/Vite/TypeScript/Tailwind + Firebase Auth/Firestore/Cloud Functions TypeScript/Firebase Hosting. Auth nghiệp vụ thuộc người 2; tôi làm scaffold, Emulator, wrapper callable, contract chung, Rules/indexes, CI và tích hợp. FE gọi callable bằng Firebase SDK; mặc định chặn client đọc/ghi Firestore trực tiếp, backend dùng Admin SDK và phải kiểm tra quyền. Test bằng Vitest + Auth/Firestore/Functions Emulator. Chia task nhỏ, giải thích thiết kế trước code để tôi học; không tự sửa module người khác. V1 chỉ ví điểm demo và VietMap. Không tạo project cloud, bật billing hoặc deploy nếu chưa được tôi yêu cầu; chuẩn bị cấu hình và README trước. Không commit credentials.
```
