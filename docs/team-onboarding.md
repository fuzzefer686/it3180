# Pull code và bắt đầu task

Mỗi người làm frontend, backend và tests của module mình trong **một repo**. Không cần Firebase account, cloud key hay billing để chạy local. Lead giữ cloud config; cả nhóm phát triển bằng Emulator `demo-vecung`.

## Lần đầu

Cài Git, Node 22 (từ 22.12), npm và Java 21. Có nvm thì dùng `.nvmrc` của repo:

```bash
git clone https://github.com/fuzzefer686/it3180.git
cd it3180
git switch dev
nvm install
nvm use
npm ci
npm run dev
```

Máy không dùng nvm: cài Node 22 trực tiếp; kiểm tra `node --version` và `java -version`. Chờ Functions khởi tạo xong, mở terminal thứ hai ở root:

```bash
npm run seed:local
```

Web: http://127.0.0.1:5173/tai-khoan; Emulator UI: http://127.0.0.1:4000. Login bằng `user@student.example`, `driver@student.example` hoặc `admin@student.example`; mật khẩu hư cấu chung `DemoOnly!2026`. Kiểm tra tên/vai trò hồ sơ xuất hiện, logout được; xem users trong Firestore Emulator. Khi dừng Emulator dữ liệu mất, chạy lại seed lần sau.

Không cần `.env.local`. Nếu đã có, giữ `VITE_USE_EMULATORS=true`, project `demo-vecung` và region `asia-southeast1`. Dev server sẽ từ chối config cloud. File `.env.firebase.*` của lead chỉ được đọc bởi scripts cloud, không tác động `npm run dev`.

## Trước khi code

Đọc `README.md`, `AGENTS.md`, `docs/contracts.md` và kế hoạch module trong `ke-hoach/`. Commit/cất công việc đang làm trước khi đổi branch. Mỗi task lấy dev mới và tạo branch mới:

```bash
git fetch origin
git switch -c codex/2-auth-bootstrap origin/dev
```

Thay tên nhánh cho đúng task; không dùng lại nhánh đã merge. Nếu đang làm task và dev có code mới, commit phần mình rồi `git fetch origin` và `git merge origin/dev` trên feature branch; xử lý conflict và test lại.

## Task đầu tiên của từng người

| Owner | Vùng code | Task đầu / điều kiện xong | Reviewer |
|---|---|---|---|
| 1 | `web/src/lib`, components, `shared`, scripts, config, CI | Cả nhóm chạy local; lead cấu hình cloud theo runbook | 2; 5 review deploy |
| 2 | `web/src/modules/auth`, `functions/src/modules/auth` | Đăng ký Auth và bootstrap users qua callable; không nhận role từ FE; bootstrap retry không ghi đè quyền/status | 1 |
| 3 | `web/src/modules/trips`, `functions/src/modules/trips` | Chốt createTrip; driver đủ điều kiện, tuyến xe máy/stops/distance lưu được; mock VietMap trong tests | 4 |
| 4 | `web/src/modules/bookings`, `functions/src/modules/bookings` | Chốt request/confirm; fixture Trip; hai confirm đồng thời chỉ một người thành công | 3 |
| 5 | `web/src/modules/wallets`, `functions/src/modules/wallets` | Bootstrap ví và ledger; 1.000.000 điểm demo được cấp đúng một lần khi retry | 1 |

Login/logout và getMyProfile đã có ở scaffold. Form đăng ký, Trip/Booking/Wallet chưa có handler. Không coi types trong `PlannedInputs` là API đang chạy. Fixture module phụ thuộc chỉ dùng local/tests, không trả fake success cho người dùng.

## Cách thêm API

1. Chốt input/output/errors với lead và owner phụ thuộc; bổ sung `CallableContracts`/schema trong `shared/contracts.ts` qua PR.
2. Handler trong `functions/src/modules/<module>/`, parseInput và kiểm tra quyền. Bootstrap mới dùng `requireUid`; nghiệp vụ dùng `requireActiveUser` và eligibility. UID chỉ từ request.auth.
3. Export handler ở `functions/src/index.ts`; FE gọi `callFunction` trong `web/src/lib/callable.ts`.
4. Không đọc/ghi Firestore trực tiếp từ React. Admin SDK bỏ qua Rules nên từng function phải kiểm tra quyền/status.
5. Unit tests: `tests/unit/<module>/`; integration: `tests/integration/<module>/`. Booking/ví phải test transaction, concurrency và idempotency bằng Emulator. Không gọi cloud/VietMap thật trong CI.

Không tự đổi config/Rules/indexes/contract chung mà chưa báo lead. Region và project local thống nhất cho mọi module; Firestore Rules vẫn chặn client. VietMap client map key có thể dùng `web/.env.local`; REST key ở backend/Secret Manager, không đặt trong VITE_*.

## Trước PR

Dừng `npm run dev` bằng Ctrl+C (integration tests dùng cùng port), rồi:

```bash
npm run check
git status
git diff
```

Commit các file của task, push feature branch và mở PR base `dev`; dùng template có sẵn. Ghi kiểm thử thực tế, phần chưa làm và module chịu ảnh hưởng. Reviewer khác tác giả; lead merge khi checks/review qua. Không push thẳng dev/main hoặc force push nhánh môi trường. Bản ổn trên dev mới PR dev → main bằng merge commit.

## Khi bị lỗi

- Seed lỗi kết nối: chờ Emulator khởi tạo, kiểm tra port 9099/8080 và project demo-vecung.
- Port bị chiếm: dừng terminal dev/Emulator cũ trước khi chạy lại; không tự đổi port riêng rồi commit config.
- Login được nhưng thiếu profile: tạo account Auth chưa đủ; seed local hoặc triển khai bootstrap đúng contract.
- Dev báo cloud config: xóa export cloud trong terminal/mở terminal mới và kiểm tra web/.env.local; không bỏ guard.
- CI đỏ: đọc job checks, chạy đúng Node 22/Java 21 và `npm ci`; không dùng npm install để thay lockfile ngoài task dependency.
