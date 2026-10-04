# Kiểm chứng scaffold — 04/10/2026

- Runtime kiểm tra phần chuẩn bị deploy/bàn giao: Node 22.23.3, Java 21; phiên bản dependency đã cố định trong package-lock.json.
- `npm run check`: PASS (typecheck, build frontend/backend, 26 unit tests + 8 integration tests).
- Emulator thật xác nhận health đọc Firestore, token uid, input giả quyền, USER bị chặn admin, ADMIN được phép, khóa user theo trạng thái DB, thiếu profile và Rules chặn client.
- Giao diện đã làm lại thành 4 trang; bỏ các khối kiểm tra Firebase/tài khoản mẫu/phân công khỏi UI. Login bằng form email/mật khẩu vẫn đọc được hồ sơ từ server. Chi tiết kiểm tra giao diện ở [ui-redesign.md](ui-redesign.md).
- Seed local chạy xong; chỉ tạo fixture trong localhost demo project. `npm run deploy:check` chặn cấu hình cloud thiếu như thiết kế.
- Chưa chạy CI trên GitHub, deploy cloud, VietMap thật hoặc nghiệm thu nghiệp vụ Trip/Booking/ví; các phần đó chưa triển khai.

## Chuẩn bị deploy và bàn giao nhóm

- `cloud:check`, `build:cloud`, `deploy:cloud` nhận dev/production-demo và file config riêng; mẫu deploy tắt mặc định. Predeploy guard kiểm tra project cloud, Web config, region, ENABLE_FIREBASE_DEPLOY và project CLI chọn. Hosting kiểm tra dấu config của artifact để chặn build Emulator/khác app.
- Unit regression tests xác nhận config thiếu/placeholder, sai project/region, thiếu WIF, guard tắt và Hosting build sai môi trường đều bị chặn trước upload. Hai file môi trường local dùng cùng project cũng bị chặn.
- Thử `npm run cloud:check -- dev` và `npm run build:cloud -- dev` với config **hư cấu**, đồng thời web/.env.local trỏ Emulator: build thành công, manifest là cloud project/app fixture. Hosting hook chấp nhận đúng artifact; deploy:cloud với guard false bị từ chối. Không gọi Firebase cloud. Fixture config đã xóa, build cuối khôi phục local bằng npm run check.
- `npm ci` thành công; config cloud thật và build output được gitignore, mẫu .env.firebase.example được phép commit. Không thêm dependency, không đổi shared/contracts.ts/Rules/indexes hoặc handler nghiệp vụ.
- [Runbook cloud](firebase-deploy.md) gồm Auth + users đầu tiên, smoke test, WIF/GitHub Environments và giới hạn nghiệm thu. [Onboarding](team-onboarding.md) gồm clone/pull, branch, chạy local, task đầu từng owner và PR dev.
- Emulator integration tests đã chạy với quyền mở port localhost (sandbox mặc định chặn listen); tiến trình test dừng sau khi hoàn tất. Không có deploy, tạo project hoặc thay billing trong lần kiểm chứng này.

## Dependency audit

Đã chốt override @grpc/grpc-js 1.14.5 để sửa dependency gRPC cũ của Firebase client SDK; chạy lại toàn bộ check thành công.

`npm audit --omit=dev` còn 2 cảnh báo moderate trong chuỗi gaxios/uuid. Audit đầy đủ còn cảnh báo ở dependency gián tiếp của Firebase CLI, trong đó có high. Không chạy audit fix --force vì npm đề xuất downgrade Firebase/CLI và có thể phá API. Lead kiểm tra bản cập nhật upstream trước khi phát hành cloud; đây không phải chứng nhận ứng dụng đã được kiểm toán bảo mật.
