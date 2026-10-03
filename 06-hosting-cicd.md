# Hosting và CI/CD — Firebase

Kế hoạch cập nhật 03/10/2026, chưa tạo account/project hoặc triển khai cloud.

## Stack chốt

React/Vite/TypeScript/Tailwind + Firebase Authentication + Cloud Firestore + Cloud Functions TypeScript + Firebase Hosting. Một repo, một ứng dụng. VietMap giữ nguyên; không cần Hono/Workers/D1, Vercel hoặc Supabase.

FE gọi callable functions bằng Firebase SDK; function tự kiểm tra request.auth, quyền/trạng thái trong users và input. React SPA dùng Firebase Hosting. [Callable](https://firebase.google.com/docs/functions/callable), [Hosting](https://firebase.google.com/docs/hosting)

## Chi phí cần biết

- Spark có hạn mức miễn phí cho Auth/Firestore/Hosting, nhưng **deploy Cloud Functions cần Blaze và liên kết Cloud Billing**. Có quota miễn phí, có thể phát sinh phí; không cam kết free hoàn toàn. [Điều kiện Functions](https://firebase.google.com/docs/functions/get-started), [Pricing plans](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans)
- Chưa có billing: chạy toàn bộ local bằng Auth/Firestore/Functions Emulator với project ID `demo-...`. Không đưa ví/confirm về FE để né điều kiện backend. Emulator không dùng làm production server. [Emulator](https://firebase.google.com/docs/emulator-suite)
- Khi chủ tài khoản đồng ý bật billing: đặt budget alerts, giới hạn function instances, `minInstances=0`, theo dõi usage và dọn artifact cũ. Alerts không tự chặn chi phí; giới hạn instances cũng không bảo đảm hóa đơn bằng 0. Xem khả năng [spend caps](https://firebase.google.com/docs/projects/billing/spend-caps) của dịch vụ trước khi cấu hình.
- VietMap có quota/chi phí riêng. Điểm demo không có giá trị tiền ở tất cả môi trường; không PayOS/webhook/bank account. V1 không Storage/upload thật, SMS login hoặc dịch vụ bổ sung.

## Ba môi trường, một workflow

| Nhánh | Môi trường | Firebase project |
|---|---|---|
| develop | Dev | Project dev riêng |
| staging | Staging | Project staging riêng |
| main | Production-demo | Project prod riêng |

Local dùng Emulator; ba môi trường cloud có Auth/Firestore/Functions/Hosting độc lập. Cùng code, khác Firebase config/VietMap keys; người demo đăng ký/seed riêng từng môi trường. Firebase khuyến nghị một project/môi trường. [Tài liệu](https://firebase.google.com/docs/projects/dev-workflows/general-best-practices)

Domain miễn phí: `<project-id>.web.app` hoặc `<project-id>.firebaseapp.com`; không cần mua domain.

Feature branch → PR vào develop → review → merge. Lead đưa bản ổn sang staging, kiểm thử rồi merge main. GitHub Actions:

1. PR: install từ lockfile, typecheck, build web/functions, Vitest và test Emulator; không cấp deploy credentials cho PR/fork.
2. Push ba nhánh: chạy checks, chọn đúng Firebase project và build config môi trường; chỉ deploy nếu checks qua.
3. Dùng Firebase CLI deploy Functions, Firestore Rules/indexes và Hosting với project ID rõ ràng. Chặn job deploy cùng môi trường chạy đè nhau. Chờ index cần thiết sẵn sàng rồi smoke test trước khi báo release xong.

CI dùng Application Default Credentials; ưu tiên GitHub OIDC/Workload Identity Federation. Nếu dùng service-account JSON thì chỉ lưu trong GitHub Environment Secrets, dùng account deploy riêng, không commit hoặc chia sẻ password. Không dùng `firebase login:ci` token cho pipeline mới. [Firebase CLI CI](https://firebase.google.com/docs/cli#use_the_cli_with_ci_systems)

Lead giữ mapping project/config và owner Rules/indexes; module owner gửi thay đổi qua PR. Repo public bật branch protection, một review và CI qua. Firebase web config/API key dùng ở browser không phải Admin credential; service-account private key và VietMap REST key là secret, giữ ở backend. Quyền truy cập vẫn phải do Functions/Rules kiểm soát.

## Thứ tự làm trong tuần

1. 04–05/10: scaffold/Emulator, thử Auth → callable → Firestore; deploy dev nếu đủ điều kiện billing.
2. 06–07/10: tích hợp module; tạo staging/prod và pipeline cùng code, dữ liệu riêng nếu đã được yêu cầu.
3. 08–09/10: test staging, phát hành demo, ghi commit/version. Nếu chưa có billing thì ghi rõ demo local, chưa có web cloud hoàn chỉnh.

Không reset dữ liệu prod khi deploy. Firestore dùng thay đổi document có tương thích và version dữ liệu, không SQL migration. Rules/indexes phải review. Rollback code không hoàn tác dữ liệu; đọc logs và sửa cùng module owner.
