# Về Cùng — khung web ghép xe sinh viên

React + TypeScript + Firebase, dành cho nhóm 5 sinh viên HUST. **Đây là scaffold**, chưa có đặt chuyến, bản đồ VietMap hoặc thanh toán. Bộ [kế hoạch](ke-hoach/README.md) vẫn giữ trong repo.

- **Thành viên mới:** [pull code, chạy local và task đầu tiên](docs/team-onboarding.md).
- **Lead chuẩn bị cloud:** [runbook cấu hình/build/deploy Firebase](docs/firebase-deploy.md).

## Chạy local

Cần Node **22** (từ 22.12), npm và Java **21**. Nếu dùng nvm: `nvm install` rồi `nvm use`. Mọi người chạy từ root repo.

```bash
npm ci
npm run dev
```

- Web: http://127.0.0.1:5173
- Emulator UI: http://127.0.0.1:4000
- Auth 9099, Firestore 8080, Functions 5001. Chờ Functions báo khởi tạo xong.
- Terminal thứ hai: `npm run seed:local`. Mở **Tài khoản**, nhập tài khoản mẫu bên dưới để thử đăng nhập, tải hồ sơ qua Functions và đăng xuất.
- Không cần tài khoản Firebase, key thật hoặc billing để chạy Emulator. Lần đầu CLI cần internet tải emulator. Dữ liệu local mất khi dừng; chạy lại seed.
- Không cần tạo `.env.local` cho local mặc định. Mẫu cấu hình ở `web/.env.example`; nếu có config local, giữ project `demo-vecung` và `VITE_USE_EMULATORS=true`.
- `npm run dev` chặn config cloud. File `.env.firebase.*` chỉ dành cho lệnh cloud của lead, không tác động local của nhóm.

Seed chỉ chạy localhost, tạo `user@student.example`, `driver@student.example`, `admin@student.example`, mật khẩu `DemoOnly!2026`. Đây là tài khoản hư cấu của Emulator, không dùng trên cloud. Chưa có điểm hoặc ví thực hiện nghiệp vụ.

## Giao diện người dùng

Chỉ có bốn trang: **Tìm chuyến** `/chuyen-di`, **Chuyến của tôi** `/dat-chuyen`, **Ví điểm** `/vi-diem`, **Tài khoản** `/tai-khoan`. `/` chuyển sang trang tìm chuyến; các URL module cũ được giữ lại. Thông tin owner, contract, Emulator, CI và tài khoản mẫu chỉ nằm trong tài liệu, không xuất hiện trên UI.

Form login/logout dùng Firebase Auth thật; hồ sơ dùng `getMyProfile`. Form tìm chuyến, bộ lọc chuyến, giao diện ví đã có nhưng chưa có handler nghiệp vụ; UI báo chưa khả dụng, không tạo chuyến/số dư/thanh toán giả. Font và ảnh được phục vụ cùng ứng dụng. Xem [thiết kế và bàn giao UI](docs/ui-redesign.md).

## Kiểm tra

```bash
npm run typecheck
npm run build
npm test
npm run test:integration
# Hoặc toàn bộ:
npm run check
```

Dừng `npm run dev` trước test integration/check vì Emulator test dùng cùng port. Tests chứng minh callable đọc DB, token uid, phân quyền, khóa user hiện tại và Rules chặn client. Test chỉ dùng Emulator, không VietMap/cloud. `npm run preview` phục vụ bản build web; để kiểm tra backend vẫn cần `npm run emulators`.

## Cấu trúc và phân công

| Người | Frontend | Backend / phần chung |
|---|---|---|
| 1 — Lead | App/layout, components, lib | Foundation, shared, scripts, config, CI |
| 2 | web/src/modules/auth | functions/src/modules/auth |
| 3 | web/src/modules/trips | functions/src/modules/trips |
| 4 | web/src/modules/bookings | functions/src/modules/bookings |
| 5 | web/src/modules/wallets | functions/src/modules/wallets |

- `shared/contracts.ts`: types/schema chung; báo lead trước khi đổi.
- `functions/src/index.ts`: nơi đăng ký/export callable; handler nằm riêng từng module.
- `functions/lib/`: code build gồm Functions và shared contract; Firebase deploy lấy main `lib/functions/src/index.js`. Không commit build output.
- `tests/unit`, `tests/integration`: test nghiệp vụ/luồng/permission của các owner.
- `docs/contracts.md`: API nền và hướng dẫn thêm chức năng.
- Firestore Rules chặn client; FE đọc/ghi nghiệp vụ qua Functions. Đây là lựa chọn kiến trúc V1, chưa dùng realtime listeners.

## Làm việc trên GitHub

Remote dùng hai nhánh môi trường: **dev** để tích hợp và kiểm thử, **main** cho production-demo. Scaffold đã được merge vào cả hai nhánh. Mỗi task mới tạo feature branch từ `origin/dev` mới nhất; không dùng các nhánh local cũ có lịch sử riêng để mở PR.

Mỗi task: lấy dev mới → tạo feature branch → code/test → push feature → PR base dev → reviewer → lead merge. Kiểm thử luồng chung trên dev; bản ổn mở PR **dev → main**, dùng merge commit để giữ lịch sử giữa hai nhánh môi trường. Không copy code của nhau hoặc push thẳng nhánh môi trường. Xem [workflow](ke-hoach/08-github-workflow.md).

CI job **checks** chạy trên PR vào dev/main và push dev/main. Sau khi CI chạy lần đầu, chọn checks làm required status check cho hai nhánh.

## Cloud và deploy — chưa bật

Cloud Functions cần **Blaze + billing**, không bảo đảm free hoàn toàn. Hiện chưa tạo/cấu hình project cloud hoặc deploy. Firebase Hosting dùng domain `<project-id>.web.app`.

Lệnh thủ công đã chuẩn bị (Node 22, từ root). Sau khi kiểm tra code bằng `npm run check`, copy mẫu và điền config thật:

```bash
cp .env.firebase.example .env.firebase.dev
npm run cloud:check -- dev
npm run build:cloud -- dev
# Chỉ sau khi project/billing/quyền sẵn sàng và lead bật guard trong file:
npm run deploy:cloud -- dev
```

Mẫu mặc định `ENABLE_FIREBASE_DEPLOY=false`; check/build không gọi cloud. File thật được gitignore, tách khỏi `web/.env.local`; build cloud không nhận config local. Production-demo dùng file và project riêng, tham số `production-demo`. Predeploy guard kiểm tra project/region/config/guard và dấu cấu hình trong Hosting build. Các kiểm tra này không xác nhận billing hoặc quyền IAM; Firebase kiểm tra khi deploy. Xem runbook để tạo tài khoản cloud đầu tiên (Auth + users), smoke test và WIF. Scaffold chưa có đăng ký/bootstrap nên tạo tài khoản Auth đơn thuần chưa đủ để tải hồ sơ.

Pipeline deploy mặc định bị tắt. Khi lead quyết định triển khai:

1. Tạo 2 Firebase projects riêng và GitHub Environments: dev, production-demo. Bật email/password Auth, Firestore và billing cho từng project; cùng Functions region asia-southeast1.
2. Mỗi GitHub Environment cấu hình Variables: FIREBASE_PROJECT_ID, FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_APP_ID, WIF_PROVIDER, DEPLOY_SERVICE_ACCOUNT; VIETMAP_MAP_KEY tùy chọn khi người 3 tích hợp. Web config không phải private credential; vẫn phải giữ quyền backend/Rules.
3. Cấu hình Google Workload Identity Federation, giới hạn trust theo repo/nhánh/environment và quyền deploy cần thiết. Không lưu service-account private key trong repo. CI checks không cần Google credentials.
4. Đặt budget/usage controls; rồi mới bật repository variable ENABLE_FIREBASE_DEPLOY=true. Test dev trước khi phát hành main. Xem [hosting](ke-hoach/06-hosting-cicd.md).

CI build web đúng Firebase project cloud, kiểm tra config trước deploy, dùng ADC và deploy Functions/Rules/indexes/Hosting. Workflow chưa được thử trên account cloud. Kiểm tra index readiness và smoke test sau release; rollback code không rollback dữ liệu.

Không dùng `firebase init` để ghi đè scaffold. Không seed admin mẫu lên cloud. VietMap map client key do người 3 bổ sung; VietMap REST key giữ backend/Secret Manager. Điểm demo không có giá trị tiền.

Kết quả kiểm chứng và giới hạn dependency xem [báo cáo](docs/validation.md).

## Việc của lead

Đọc [checklist lead](ke-hoach/09-checklist-lead.md) và [tech stack](ke-hoach/07-tech-stack.md). Đầu tiên cho cả 5 người chạy cùng scaffold thành công; sau đó giao task nhỏ và chốt contract trước khi code.
