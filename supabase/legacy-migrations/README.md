# Migration của thiết kế trước baseline nhóm

Bốn file SQL ở đây được giữ nguyên nội dung để tra cứu lịch sử. Chúng không
nằm trong `supabase/migrations`, nên Supabase CLI không tự áp dụng.

Server nhóm hiện ghi nhận `20261016000000_initial_schema`, tạo sẵn 7 bảng.
Các file cũ tạo lại `users`/`trips`, dùng Trip JSON và Booking text ID, nên không
thể áp dụng tiếp vào schema đó. Không đổi version cũ hoặc đánh dấu chúng đã chạy
để bỏ qua lỗi. Xem [hướng dẫn bàn giao](../../docs/trips.md).

Nếu một database local khác đã chạy các file cũ, không áp dụng chuỗi mới chồng
lên nó. Giữ dữ liệu cần thiết và dùng môi trường local mới để kiểm thử; việc
chuyển dữ liệu của database cũ cần một kế hoạch riêng, không reset server nhóm.
