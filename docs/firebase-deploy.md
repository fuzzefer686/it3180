# Runbook Firebase cloud — lead

Các scripts đã chuẩn bị để deploy **scaffold hiện tại**, không tạo thêm handler Trip/Booking/Wallet. Chưa xác minh deploy trên cloud. Lead cấu hình account/project/billing trước; teammates dùng [onboarding local](team-onboarding.md).

## Project và dịch vụ

| Code ổn | Cloud config local | GitHub Environment |
|---|---|---|
| dev | `.env.firebase.dev` | dev |
| main (production-demo) | `.env.firebase.production-demo` | production-demo |

Hai môi trường phải dùng hai Firebase projects khác nhau, dữ liệu/Auth riêng. Không thay `.firebaserc` mặc định `demo-vecung`; scripts luôn truyền project cloud cụ thể. Không chạy firebase init ghi đè scaffold.

Trong [Firebase Console](https://console.firebase.google.com/), tạo project, đăng ký Web app và lấy config. Bật Email/Password Auth; tạo Firestore Standard `(default)`, production mode, location Singapore `asia-southeast1`. Functions đã cố định region đó, Node 22, minInstances=0/maxInstances=2. Đây là giới hạn mỗi function, không phải trần chi phí toàn project. Hosting dùng React SPA, không cần App Hosting/Storage.

Deploy Functions cần Blaze + billing. Đặt budget alerts/usage controls; alerts không tự dừng dịch vụ. Lead quyết định billing, không đưa private key vào repo. Nguồn: [Functions](https://firebase.google.com/docs/functions/get-started), [Firestore](https://firebase.google.com/docs/firestore/quickstart), [Web config](https://firebase.google.com/docs/web/setup), [billing](https://firebase.google.com/docs/projects/billing/avoid-surprise-bills).

## Chuẩn bị và build từ máy lead

Root repo, Node 22/Java 21; dừng dev Emulator trước check:

```bash
nvm use
npm ci
npm run check
npx firebase login
npx firebase projects:list
cp .env.firebase.example .env.firebase.dev
```

Điền file `.env.firebase.dev` (được gitignore) bằng config thật. `FIREBASE_PROJECT_ID` và `VITE_FIREBASE_PROJECT_ID` phải khớp; appId phải là Web app; region phải `asia-southeast1`. Giữ `ENABLE_FIREBASE_DEPLOY=false` để chuẩn bị mà chưa deploy:

```bash
npm run cloud:check -- dev
npm run build:cloud -- dev
```

Hai lệnh này không gọi cloud, không bật billing. Script dùng Node parseEnv, không thực thi file như shell; điền giá trị đầy đủ, không dùng nội suy `$FIREBASE_PROJECT_ID` trong file. Nó chỉ nhận các biến trong mẫu, không nhận backend secrets. Config cloud được truyền cho build và không tải web/.env.local. Vì thế lead có thể giữ nguyên env Emulator cho công việc local của nhóm.

Khi project/billing/quyền deploy sẵn sàng và đang ở bản code đã kiểm thử, đặt `ENABLE_FIREBASE_DEPLOY=true` **trong file dev**, rồi:

```bash
npm run deploy:cloud -- dev
```

Script validate → build lại FE/BE → gọi Firebase CLI với `--project` rõ ràng. Guard predeploy chặn config thiếu, khác project, deploy chưa bật, hoặc Hosting build dùng Emulator/khác app. Không xóa guard để vượt lỗi billing/permissions. Không dùng chỉ `firebase deploy --only hosting` để đưa bản build local lên cloud.

Firebase CLI sẽ hỏi các thiết lập/API cần thiết lần đầu và chính sách lưu artifact. Đọc lựa chọn trước khi chấp nhận, chọn retention phù hợp nhóm. Lỗi billing/quyền/API cần sửa ở project/IAM, không sửa rules thành public. [CLI](https://firebase.google.com/docs/cli), [quản lý Functions](https://firebase.google.com/docs/functions/manage-functions).

Production-demo: copy mẫu thành `.env.firebase.production-demo`, đổi `FIREBASE_DEPLOY_ENV=production-demo`, config sang project riêng và giữ guard false trước khi chuẩn bị. Chỉ deploy code ổn đã phát hành main:

```bash
npm run cloud:check -- production-demo
npm run build:cloud -- production-demo
# Sau khi lead bật guard trong file production-demo:
npm run deploy:cloud -- production-demo
```

## Tài khoản cloud đầu tiên

Không dùng seed local hoặc copy password mẫu lên cloud. Đăng ký/bootstrap chưa được người 2 triển khai; lead tạm tạo tài khoản thử riêng trong Console Authentication, password riêng, rồi tạo document `users/{uid}` trong Firestore Console. UID trong document và document ID phải bằng UID Auth:

```json
{
  "uid": "UID_AUTH_THAT",
  "displayName": "Người thử nghiệm",
  "roles": ["USER"],
  "status": "ACTIVE",
  "studentVerificationStatus": "PENDING"
}
```

Các trường string, riêng roles là array. Admin đầu tiên do lead quản lý bằng Console/tác vụ tin cậy; không có endpoint tự cấp ADMIN. Sau khi người 2 bàn giao bootstrap, tài khoản thường được tạo qua luồng đăng ký. Ví do người 5 khởi tạo riêng, không tự thêm balance vào users.

## Kiểm tra sau deploy

- CLI báo hoàn tất tất cả Firestore/Functions/Hosting; kiểm tra indexes mới đã ready nếu module bổ sung.
- Mở Hosting URL CLI trả về; truy cập trực tiếp `/tai-khoan`, đăng nhập tài khoản cloud, tải hồ sơ, logout, reload đường dẫn SPA.
- Browser Network gọi Functions `asia-southeast1` của đúng project, không 127.0.0.1:5001/9099.
- Kiểm tra health callable public (thay PROJECT_ID_THAT):

```bash
curl -f -X POST 'https://asia-southeast1-PROJECT_ID_THAT.cloudfunctions.net/healthCheck' \
  -H 'Content-Type: application/json' -d '{"data":{}}'
```

Kỳ vọng result `status=ok`, `database=connected`, `environment=cloud`; `sampleMessage=null` là hợp lệ khi cloud chưa có fixture appMeta. Thiếu fixture không phải lý do seed dữ liệu local lên cloud. Health chỉ kiểm tra nền tảng, không chứng minh booking/ví đã triển khai.

- Xem logs Functions khi lỗi; không nới Firestore Rules, FE vẫn gọi callable.
- Ghi commit/version, project và kết quả smoke test. Rollback code không rollback dữ liệu. Chưa test cloud thì ghi rõ, không báo release hoàn tất.

## GitHub Actions tự deploy

Workflow `.github/workflows/ci.yml` có checks trước deploy; PR/fork không có credentials cloud. Deploy **mặc định tắt** nếu repository variable `ENABLE_FIREBASE_DEPLOY` chưa là true.

Tạo GitHub Environments `dev` và `production-demo`. Giới hạn deployment branches lần lượt dev/main; production-demo nên yêu cầu reviewer theo khả năng tài khoản GitHub. Trong từng Environment điền Variables:

| Variable | Giá trị |
|---|---|
| FIREBASE_PROJECT_ID | Project ID của môi trường |
| FIREBASE_API_KEY | apiKey của Web app |
| FIREBASE_AUTH_DOMAIN | authDomain |
| FIREBASE_APP_ID | appId của Web app |
| WIF_PROVIDER | Full resource name của Workload Identity Provider |
| DEPLOY_SERVICE_ACCOUNT | Email service account deploy |
| VIETMAP_MAP_KEY | Tùy chọn, client key khi người 3 đã tích hợp |

Workflow tự đặt FIREBASE_DEPLOY_ENV theo branch, VITE_USE_EMULATORS=false, region asia-southeast1 và build isolation. Không lấy cloud config từ .env của teammates.

Thiết lập Google Workload Identity Federation với GitHub OIDC và service account deploy riêng cho mỗi project. Trust chỉ repository `fuzzefer686/it3180` (ưu tiên immutable repository/owner IDs) và branch/environment tương ứng; không mở trust toàn GitHub. Cho principal WIF quyền impersonate service account (Workload Identity User), cấp service account quyền deploy Firebase/Functions/Firestore/Hosting và actAs runtime service account trong **project tương ứng**. Quyền cụ thể do lead kiểm tra theo hướng dẫn IAM/CLI; không cấp Owner để né lỗi. [Hướng dẫn Google action](https://github.com/google-github-actions/auth), [Firebase CLI trong CI](https://firebase.google.com/docs/cli#use_the_cli_with_ci_systems).

Chỉ khi cả hai Environment đã đủ config/credentials và smoke test dev đã qua mới bật repository variable `ENABLE_FIREBASE_DEPLOY=true`. Không lưu service-account JSON vào Git, không dùng login:ci token cho pipeline mới. Workflow hiện chưa nghiệm thu trên account cloud. Nhánh dev nhận PR feature; bản ổn mở PR dev → main bằng merge commit, review khác tác giả.

## Ảnh hưởng các module

Thay đổi chung ở config/scripts/CI: tất cả dùng cùng project local và region; build/deploy cloud bắt buộc đầy đủ Web config. Contract/schema, Rules chặn client và indexes không đổi. Owner 2 vẫn phụ trách đăng ký/bootstrap; owner 3 thêm map client key qua env và REST secret ở Functions; owner 4/5 giữ transaction/idempotency. Chỉ lead quản lý file cloud và project; module owner không cần key cloud để bắt đầu.
