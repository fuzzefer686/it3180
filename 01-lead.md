# Người 1 — Lead và nền tảng

**Mục tiêu:** cả nhóm chạy cùng một app, đăng nhập đúng quyền và ghép code được trước 10/10.

## Việc cần làm

1. Tạo repo/cấu trúc đơn giản, database và lệnh chạy chung.
2. Làm đăng ký, đăng nhập, đăng xuất; kiểm tra ADMIN/DRIVER/USER ở backend.
3. Chốt schema/API cùng nhóm; cung cấp thông tin user hiện tại cho các module.
4. Tạo CI kiểm tra build/test; deploy dev, staging, production-demo theo nhánh.
5. Ghép và chạy thử toàn bộ luồng. Thông báo V1 hiển thị trạng thái trong trang, chưa cần email/realtime.

**Bàn giao:** app nền chạy được, auth/quyền, CI/deploy, README hướng dẫn chạy. 2 review auth; 5 review deploy. Xem [hosting](06-hosting-cicd.md).

## Cách lead đơn giản

- Trước code: thống nhất tên bảng, trạng thái và dữ liệu mỗi API nhận/trả.
- Mỗi ngày 10 phút: từng người nói đã chạy được gì và đang kẹt chỗ nào.
- Chia việc nhỏ, mỗi người một task chính; PR có một reviewer khác tác giả.
- Xem demo chung ngày 05, 07, 09/10; sau 08/10 chỉ sửa lỗi.
- Yêu cầu mỗi người giải thích được code AI viết. Nếu không hiểu, đọc/sửa trước khi merge.
- Lead điều phối và giúp debug; owner vẫn chịu trách nhiệm sửa module của mình.

## Kiểm tra tối thiểu

USER không gọi được API admin; người dùng không tự cấp DRIVER/ADMIN. Build/test lỗi không deploy. Ba môi trường không dùng chung DB/secrets. Không đưa key thật vào repo công khai.

## Mốc của bạn

04–05/10: scaffold/auth/dev. 06–07/10: stage/prod skeleton và tích hợp. 08–10/10: test, release và demo.

Mỗi người chỉ cần tài liệu ngắn: chức năng làm gì, schema/API, test và kết quả. Không cần báo cáo dài trước khi có luồng chạy được; đối chiếu yêu cầu giảng viên khi có.

## Prompt gửi Agent

```text
Tôi là người 1/Lead của nhóm sinh viên. Đọc ke-hoach/00-ke-hoach-tong-the.md và ke-hoach/01-lead.md. Giúp tôi làm nền tảng, auth/RBAC, CI/deploy và tích hợp theo từng task nhỏ. Dùng stack cả nhóm đã chọn, một ứng dụng đơn giản. Trước khi code mỗi task, giải thích ngắn thiết kế và dữ liệu liên quan để tôi hiểu. Không tự sửa nghiệp vụ/module người khác. Viết test quyền quan trọng, hướng dẫn tôi chạy và giải thích code. Hosting theo ke-hoach/06-hosting-cicd.md; chỉ triển khai account/hosting khi tôi yêu cầu. V1 dùng ví điểm demo, không cash/PayOS/công nợ. Thống nhất việc cấp điểm ban đầu với người 5, tránh cấp lặp.
```
