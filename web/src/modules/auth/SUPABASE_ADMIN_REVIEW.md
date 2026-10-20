# Auth — biên bản rà soát và bàn giao Supabase cho admin

Ngày rà soát: **20/10/2026**. Người review dự kiến: **lead/người 1**, khác người viết code.

## 1. Kết luận và bằng chứng kiểm tra lại

**Code đã có các chức năng Auth/hồ sơ/admin theo kế hoạch, nhưng chưa đủ điều kiện nghiệm thu: Bugbot xác minh 1 lỗi P2 trong luồng duyệt hồ sơ; Docker integration và schema server còn chưa kiểm chứng.** Cần sửa lỗi này và hoàn tất các bước Supabase bên dưới trước khi xác nhận đáp ứng đầy đủ yêu cầu project.

Đã đọc lại [kế hoạch người 2](../../../../ke-hoach/02-ho-so-quan-tri.md), [contract](../../../../docs/contracts.md), [quy trình Supabase](../../../../docs/supabase-workflow.md), code frontend, SQL và tests. Chạy lại `npm run check` bằng **Node 22.23.3**:

- `typecheck`: **PASS**.
- `build`: **PASS**; có cảnh báo bundle JavaScript khoảng **607 kB**, chưa tối ưu trong phạm vi này.
- `npm test`: **45 test / 4 file PASS**: 8 contract/config/validation, 7 phiên, 17 giao diện, 13 SQL/quyền.
- `test:integration`: **BLOCKED**, kết thúc mã 1 vì Docker Desktop/daemon chưa khả dụng. **10 test Supabase local chưa được thực thi**.
- `git diff --check`: **PASS**, chỉ có thông báo chuẩn hóa LF/CRLF trên Windows.

13 test SQL chạy migration/RPC bằng PostgreSQL nhúng PGlite, với fixture mô phỏng `auth.uid()`. Chúng kiểm tra logic và quyền SQL, **không thay cho kiểm thử Supabase Auth, PostgREST, token thật hoặc tranh chấp giữa nhiều kết nối**.

Chưa gọi Supabase cloud/VietMap, chưa áp dụng migration online, chưa cấp ADMIN thật, chưa push/deploy. Không có kết luận rằng schema/quyền/settings trên server hiện tại đã đúng.

### Phát hiện Bugbot — cần sửa trước nghiệm thu

Đã chạy **một lượt review Bugbot** theo lựa chọn của người dùng; reviewer đọc cả file thay đổi và file mới, đồng thời tái hiện lỗi bằng chính migration trên PostgreSQL nhúng. Đây là kết quả rà soát logic, không phải bảo đảm không còn lỗi khác.

| Severity | Location (file:line) | Finding |
|---|---|---|
| P2 | supabase/migrations/20261020090000_auth_profiles.sql:205; web/src/modules/auth/AdminPage.tsx:43 | Admin có thể duyệt phiên bản hồ sơ chưa từng xem nếu user sửa dữ liệu sau khi admin tải danh sách. |

**Cách tái hiện:**

1. User lưu minh chứng `OLD-EVIDENCE`; admin tải danh sách và mở hồ sơ này.
2. User sửa minh chứng thành `NEW-UNREVIEWED-EVIDENCE`; backend đưa về PENDING đúng như thiết kế.
3. Admin vẫn nhìn dữ liệu cũ, bấm Duyệt sinh viên. UI chỉ gửi `{uid, kind, decision, reason}`.
4. RPC khóa và duyệt dòng hiện tại chứa minh chứng mới, trả VERIFIED và `canBook = true`, dù admin chưa xem minh chứng mới. Tương tự với việc đổi xe trước khi duyệt DRIVER.

Kết quả đã tái hiện trên SQL nhúng:

```json
{
  "adminSaw": "OLD-EVIDENCE",
  "approvedEvidence": "NEW-UNREVIEWED-EVIDENCE",
  "studentStatus": "VERIFIED",
  "canBook": true
}
```

**Nguyên nhân:** khóa dòng chỉ bảo vệ dữ liệu trong transaction duyệt, không ràng buộc quyết định với dữ liệu mà admin đã xem trước đó. 45 test hiện tại chưa kiểm tra trường hợp xen kẽ này, nên PASS không phủ nhận lỗi.

**Task cần owner Auth/lead chốt và thực hiện:**

- Gắn yêu cầu duyệt với snapshot hoặc phiên bản của hồ sơ đã hiển thị cho admin; đối chiếu với dữ liệu hiện tại sau khi khóa dòng.
- Nếu dữ liệu liên quan đã đổi, trả PT409, yêu cầu tải lại và xem hồ sơ mới trước khi duyệt. Chỉ thêm thao tác tải lại ở UI không giải quyết được việc user tiếp tục sửa trong khoảng giữa tải và duyệt.
- Có thể dùng snapshot các trường xét duyệt để giữ nguyên thiết kế cột đã chốt. Nếu chọn thêm cột phiên bản, cần team duyệt schema/migration; không tự sửa migration đã áp dụng online.
- Cập nhật đồng bộ `adminReviewInputSchema`, payload `AdminPage`, RPC và tài liệu; thêm test hồi quy cho STUDENT và DRIVER. Kiểm tra cả hai quyết định duyệt/từ chối để không lưu quyết định trên dữ liệu admin chưa xem.

**Trạng thái:** đã ghi nhận và bàn giao hướng sửa; chưa sửa logic trong lượt review này. Cần có kết quả test sau sửa, không đánh dấu hoàn tất chỉ vì đã thêm mục vào checklist.

## 2. Đối chiếu với yêu cầu project

### 2.1. Tài khoản và phiên — đã có code và test

- [AuthPage.tsx](./AuthPage.tsx) dùng `supabase.auth.signUp`, `signInWithPassword`, `signOut`; SDK quản lý token/password. Có nhập lại mật khẩu, chặn gửi lặp và lỗi tiếng Việt. Không lưu password trong bảng ứng dụng.
- Khi đăng ký chưa có session, UI yêu cầu kiểm tra email; không coi user object trả về là đã đăng nhập. Khi local cho phép xác nhận tự động, SDK có thể trả session ngay.
- [SessionProvider.tsx](./SessionProvider.tsx) đọc sự kiện SDK, giữ phiên sau reload; bỏ kết quả hồ sơ cũ khi logout/đổi tài khoản. TOKEN_REFRESHED cùng uid giữ hồ sơ hiện tại.
- [RequireSession.tsx](./RequireSession.tsx) bảo vệ `/dat-chuyen`, `/vi-diem`; `/quan-tri` còn cần ADMIN/ACTIVE. Đang tải hoặc lỗi hồ sơ thì không mở nội dung riêng tư.
- **Ví dụ kiểm tra:** đăng nhập sai phải báo lỗi; đổi từ user A sang B không được hiển thị hồ sơ A. Các ca tương ứng đã PASS trong tests mô phỏng; kiểm tra lại qua Auth thật ở bước 3.

### 2.2. Bootstrap và quyền server — đã có code và test SQL

- [Migration Auth](../../../../supabase/migrations/20261020090000_auth_profiles.sql) lấy uid từ `auth.uid()`; `get_my_profile` tự tạo hồ sơ nếu thiếu, mặc định USER/ACTIVE/PENDING.
- `ON CONFLICT DO NOTHING` giữ nguyên hồ sơ/quyền/trạng thái đã có. Client không gửi uid cho API sửa hồ sơ, không được gửi roles/status/trạng thái duyệt và không có API tự cấp ADMIN.
- Quyền ADMIN/status được đọc từ `public.users`, không đọc `user_metadata`. Các RPC thay đổi dữ liệu dùng transaction và khóa dòng; hàm có `SECURITY DEFINER` đặt `search_path = ''`.
- **Ví dụ kiểm tra:** payload tự thêm `roles: ['ADMIN']` phải bị PT400; USER gọi thao tác admin phải bị PT403. Đã PASS trên SQL nhúng; cần xác nhận lại bằng user thường qua PostgREST.

### 2.3. Hồ sơ, sinh viên và driver — đã có code và test

- [ProfileForm.tsx](./ProfileForm.tsx) lưu họ tên, điện thoại, trường, mã sinh viên, minh chứng hư cấu; tùy chọn loại xe máy/biển số. Dùng đúng các cột `users` trong ảnh thiết kế; DTO trả frontend dùng camelCase.
- [AdminPage.tsx](./AdminPage.tsx) phân trang 20 hồ sơ, duyệt/từ chối sinh viên và driver, lưu lý do, khóa/mở tài khoản. Chỉ duyệt driver khi sinh viên VERIFIED và có xe; thêm DRIVER nhưng vẫn giữ USER.
- Thay trường/mã/minh chứng đưa sinh viên và driver về PENDING, thu hồi DRIVER; thay xe chỉ đưa driver về PENDING và thu hồi DRIVER. Đổi họ tên/điện thoại giữ trạng thái duyệt.
- **Ví dụ kiểm tra:** tài xế đã được duyệt đổi biển số phải mất quyền DRIVER cho đến khi được duyệt lại. Đã PASS trên SQL nhúng.

### 2.4. Dữ liệu riêng tư và tài khoản bị khóa — đã có code, còn kiểm tra server thật

- Bật RLS và thu hồi quyền đọc/ghi trực tiếp `users` của anon/authenticated. Chỉ RPC của chủ hồ sơ hoặc admin ACTIVE trả dữ liệu riêng tư; frontend không dùng `.from('users')`.
- Minh chứng chỉ là text hư cấu; không có upload giấy tờ thật. API hồ sơ không phải API công khai để đưa vào danh sách tìm chuyến.
- LOCKED vẫn xem hồ sơ của mình và logout được; không sửa hồ sơ hoặc dùng RPC admin. Bootstrap không đổi LOCKED thành ACTIVE. Đăng xuất không được coi là thu hồi tức thì mọi access token đã cấp.
- **Ví dụ kiểm tra:** khóa user rồi dùng phiên đã cấp trước đó để lưu hồ sơ phải bị PT403; gọi `.from('users').select('*')` bằng user thường phải bị từ chối. Đã PASS trên SQL nhúng; token/PostgREST thật chưa kiểm chứng.

### 2.5. Bàn giao liên module — mới hoàn thành phía Auth

- [shared/contracts.ts](../../../../shared/contracts.ts) cung cấp uid, roles, status, trạng thái sinh viên/driver, xe và `eligibility.canBook/canDrive`. Các field mới của UserProfile là bắt buộc trong response; module 3/4/5 cần cập nhật fixture cũ.
- `canBook`: ACTIVE + sinh viên VERIFIED. `canDrive`: thêm DRIVER + driver VERIFIED + có xe. Module 3/4 phải gọi `private.require_eligible_user(true/false)` **trong RPC server cùng transaction**, không tin boolean từ frontend. Helper không được cấp cho client và không phải endpoint công khai.
- **Còn thiếu ở phần liên quan:** handler Trip/Booking gọi helper; API chỉ cho hai bên xem điện thoại sau CONFIRMED; ví do người 5 khởi tạo idempotent. Auth không tạo ví hoặc cấp điểm.
- Luồng demo đầy đủ “admin duyệt → driver đăng chuyến” **chưa hoàn tất**, vì backend Trip chưa triển khai. `healthCheck` và `adminFoundationInfo` cũng còn chưa có handler, nhưng không được UI Auth gọi và không bắt buộc để 5 RPC Auth hoạt động.

## 3. Việc admin cần làm, theo thứ tự

“Admin” ở mục này là người có quyền quản lý **project Supabase**. Role ADMIN trong app chỉ cấp quyền trang `/quan-tri`, không tự cấp quyền Dashboard Supabase.

### Bước 1 — chốt sửa lỗi duyệt và đối chiếu schema, khoảng 15–30 phút để review

Trước khi tích hợp, owner Auth xử lý P2 ở mục 1 và bổ sung test hồi quy; timebox dự kiến **1–2 giờ** để sửa và kiểm tra, tùy giải pháp snapshot/phiên bản được lead duyệt. Sau đó cập nhật contract và các ví dụ endpoint bên dưới theo input cuối cùng. Các ví dụ hiện mô tả code **đang có**, chưa chứa cơ chế phát hiện dữ liệu duyệt đã đổi.

**Cần làm:** lấy định nghĩa SQL hiện tại của `public.users`, khóa ngoại, defaults, constraints, grants, policies, trigger liên quan `auth.users` và các hàm cũ có thể đọc/ghi hồ sơ. Ảnh ERD chỉ cho biết cột/quan hệ, chưa chứng minh các phần này khớp.

**Chạy ở đâu:** SQL Editor của đúng project dev, hoặc Studio local khi đối chiếu; các câu sau chỉ đọc metadata, không trả dữ liệu hồ sơ:

```sql
select column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'users'
order by ordinal_position;

select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = to_regclass('public.users');

select policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'users';

select n.nspname as schema_name, c.relname as table_name,
       t.tgname, pg_get_triggerdef(t.oid) as definition
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where not t.tgisinternal
  and t.tgrelid in (to_regclass('auth.users'), to_regclass('public.users'));
```

**Kết quả cần chốt:** `id uuid` gắn đúng Auth ID; `roles text[]` mặc định USER, `status` mặc định ACTIVE, hai trạng thái duyệt mặc định PENDING; các field nullable/độ dài/constraint khớp migration. Không có trigger/hàm cũ tự cấp role từ metadata hoặc mở hồ sơ cho người khác.

**Nếu khác:** lập migration chuyển đổi đã review, kèm cách xử lý dữ liệu hiện có. Không dùng `CREATE TABLE IF NOT EXISTS` để bỏ qua khác biệt, không xóa bảng hoặc mở quyền trực tiếp để làm UI hết lỗi.

**Bắt buộc giải quyết trước khi cập nhật server:** file `20261020090000_auth_profiles.sql` hiện chứa `CREATE TABLE public.users`. Server đã có bảng này không thể chạy nguyên file. Lead cần đưa schema hiện có vào baseline (lịch sử schema được lưu trong repo), đối chiếu lịch sử migration, rồi tách thay đổi Auth cần áp dụng. Chưa tự sửa file này nếu nó đã được áp dụng ở môi trường khác; tạo migration tiếp theo theo quy trình. Xem [hướng dẫn dành cho lead](../../../../docs/supabase-lead.md).

### Bước 2 — chạy integration trên Docker local, khoảng 5–15 phút sau khi có Docker

**Cần làm:** cài/mở Docker Desktop; dùng Node 22 từ 22.12. Không cần Java.

**Chạy ở đâu:** terminal tại thư mục gốc repo, không phải `web/`:

```powershell
npm.cmd ci
npm.cmd run check
```

**Kết quả mong đợi:** typecheck/build và 45 tests PASS; tiếp theo 10 integration tests PASS. Script chỉ lấy URL/key của Supabase local, áp dụng migration local còn thiếu, không fallback cloud và không reset dữ liệu. Nếu chỉ cần chạy lại integration: `npm.cmd run test:integration`.

**Lỗi cần xử lý:** thiếu Docker → mở/cài Docker rồi chạy lại; `users already exists` → đối chiếu baseline, không reset để né lỗi; lỗi migration/RPC → gửi log đã che credentials về owner Auth. Khi chưa chạy qua bước này, chưa đánh dấu backend đạt kiểm thử local.

### Bước 3 — cập nhật RPC và Auth settings trên dev, khoảng 15–30 phút sau review

**Cần làm:** sau khi baseline khớp, local test đạt và PR được người khác review, lead áp dụng các migration đã duyệt lên đúng server dev theo tài liệu lead. Kiểm tra pending migrations bằng dry-run trước. Git push không tự cập nhật database.

**Cấu hình trong Dashboard Supabase:**

- Email/password provider và đăng ký email được bật theo chính sách demo của nhóm. Mật khẩu tối thiểu 8 ký tự, thống nhất với form; server có thể yêu cầu mạnh hơn.
- Chốt bật/tắt Confirm Email. Local đang tắt; nếu server bật, kiểm tra email xác nhận gửi được và tài khoản chưa xác nhận không login được.
- Site URL trỏ tới frontend dev thực tế; Redirect URLs có `http://127.0.0.1:5173/tai-khoan`, `http://localhost:5173/tai-khoan` nếu dùng các địa chỉ này, và `https://TEN_FRONTEND_DEV/tai-khoan` thực tế. Form dùng `${window.location.origin}/tai-khoan`, nên origin chạy UI phải nằm trong cấu hình đã cho phép.
- Data API được bật, schema `public` được expose. Không expose schema `private` hoặc mở quyền bảng `users` để thay cho RPC.

**Cấu hình frontend:** điền URL và publishable key đúng project vào `web/.env.local`, rồi khởi động lại `npm.cmd run dev:web`:

```dotenv
VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_GIA_TRI_DO_LEAD_CAP
```

Publishable key nhận diện ứng dụng; access token từ Auth nhận diện user. Không đặt secret/service_role key vào frontend, không commit `.env.local`. Mọi giá trị trong ví dụ là placeholder.

**Kết quả mong đợi:** sau login, frontend gọi được `get_my_profile` và tải hồ sơ đúng uid. Nếu RPC báo PT401 trong SQL Editor thì SQL Editor chưa có phiên user; kiểm tra qua SDK/HTTP với access token user, không bỏ kiểm tra `auth.uid()`.

### Bước 4 — cấp admin đầu tiên và kiểm tra quyền, khoảng 10–15 phút

**Cần làm:** tạo hoặc chọn một Auth user test tin cậy; đăng nhập mở `/tai-khoan` để bootstrap hồ sơ. Lead xác nhận đúng UUID và chủ tài khoản trước khi cấp quyền qua SQL tin cậy:

```sql
-- Thay UUID_DA_XAC_MINH; không chạy nguyên placeholder này.
update public.users
set roles = array['USER', 'ADMIN']::text[]
where id = 'UUID_DA_XAC_MINH'::uuid
returning id, roles, status;
```

**Kết quả mong đợi:** đúng một dòng được cập nhật, status ACTIVE; user tải lại hồ sơ và thấy liên kết Quản trị hồ sơ. Nếu không có dòng nào thì kiểm tra bootstrap/UUID; không cấp theo tên hiển thị hoặc metadata. Không seed ADMIN lên server từ fixture test.

**Kiểm tra SQL sau migration:**

```sql
select c.relrowsecurity as rls_enabled,
       has_table_privilege('anon', c.oid, 'SELECT') as anon_select,
       has_table_privilege('authenticated', c.oid, 'SELECT') as user_select,
       has_table_privilege('authenticated', c.oid, 'INSERT') as user_insert,
       has_table_privilege('authenticated', c.oid, 'UPDATE') as user_update,
       has_table_privilege('authenticated', c.oid, 'DELETE') as user_delete
from pg_class c where c.oid = to_regclass('public.users');

select p.proname, pg_get_function_identity_arguments(p.oid) as arguments,
       p.prosecdef as security_definer, p.proconfig,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as user_execute
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in
  ('get_my_profile', 'update_my_profile', 'admin_list_users',
   'admin_review_user', 'admin_set_user_status');

select n.nspname,
       has_schema_privilege('anon', n.oid, 'USAGE') as anon_usage,
       has_schema_privilege('authenticated', n.oid, 'USAGE') as user_usage
from pg_namespace n where n.nspname = 'private';
```

**Kết quả cần thấy:** RLS true; các quyền bảng liệt kê false. Đúng 5 RPC, mỗi hàm nhận `input jsonb`, security_definer true, search_path rỗng, anon_execute false, user_execute true. Schema private không cho anon/authenticated USAGE. Có `user_execute = true` không có nghĩa USER được dùng admin: bên trong RPC còn kiểm tra ADMIN/ACTIVE.

### Bước 5 — kiểm tra API/giao diện và bàn giao, khoảng 15–30 phút

**Cần làm:** dùng hai user thường và một admin test để chạy các trường hợp ở mục 5; chỉ dữ liệu hư cấu. Ghi commit, migration versions, URL môi trường và kết quả từng ca; không ghi token/password.

**Kết quả mong đợi:** mọi ca bắt buộc PASS bằng SDK/HTTP user thật; UI và quyền server thống nhất. Không chỉ dùng SQL Editor hoặc service_role để kết luận quyền user đúng.

**Workflow còn phải hoàn tất:** các thay đổi hiện chưa commit trên nhánh local `master`, nền `e070719`. Owner/lead cần bảo toàn working tree và đưa thay đổi vào feature branch dựa trên `dev`, PR vào `dev`, reviewer khác tác giả theo quy trình project. Tài liệu này không tạo PR, push hoặc deploy.

## 4. Danh sách endpoint và ví dụ gọi

Auth dùng SDK có sẵn: `supabase.auth.signUp({ email, password, options: { emailRedirectTo } })`, `signInWithPassword({ email, password })`, `signOut()`. Không cần viết thêm endpoint đăng ký/login/password/token hoặc Edge Function cho phần này.

5 endpoint nghiệp vụ là RPC tự được Data API cung cấp sau khi SQL/quyền đúng. Tất cả dùng **POST** tới `https://PROJECT_REF.supabase.co/rest/v1/rpc/TEN_HAM`, với JSON body **`{ "input": ... }`**, không gửi trực tiếp các field nghiệp vụ ở root.

### Gọi từ code frontend — cách đang dùng

Ví dụ trong một file TypeScript thuộc thư mục Auth; `supabase` đã có phiên do form login tạo. Không dán các dòng import vào browser Console; client không được đưa ra biến global chỉ để thử API.

```ts
import { callFunction } from '../../lib/callable';

// POST /rest/v1/rpc/get_my_profile — mọi user đã login, kể cả LOCKED đọc hồ sơ mình.
const me = await callFunction('getMyProfile', {});

// POST /rest/v1/rpc/update_my_profile — chỉ hồ sơ của user ACTIVE hiện tại.
const updated = await callFunction('updateMyProfile', {
  displayName: 'Sinh viên Demo',
  phone: '0900000000',
  school: 'Trường Demo',
  studentCode: 'DEMO-001',
  studentEvidenceDemo: 'Thẻ hư cấu DEMO-001',
  vehicleModel: 'Xe máy Demo',
  vehiclePlate: 'DEMO-001',
});
// Nếu không đăng ký driver, gửi cả vehicleModel và vehiclePlate là null.

// Các lệnh sau cần phiên của ADMIN ACTIVE; uid là Auth ID của hồ sơ cần xử lý.
// Chữ ký adminReviewUser bên dưới là bản hiện tại đang có lỗi P2;
// sau khi sửa cần gửi thêm snapshot/phiên bản theo contract đã được review.
// POST /rest/v1/rpc/admin_list_users — page từ 1, 20 hồ sơ mỗi trang.
const page = await callFunction('adminListUsers', { page: 1 });

// POST /rest/v1/rpc/admin_review_user — kind STUDENT hoặc DRIVER.
await callFunction('adminReviewUser', {
  uid: me.uid, kind: 'STUDENT', decision: 'VERIFIED', reason: '',
});
// Duyệt STUDENT trước, sau đó gửi kind DRIVER để duyệt tài xế.
// Từ chối: decision REJECTED và reason bắt buộc có nội dung.

// POST /rest/v1/rpc/admin_set_user_status — status LOCKED hoặc ACTIVE.
// Chọn user test khác admin hiện tại; server chặn admin tự khóa mình.
await callFunction('adminSetUserStatus', { uid: 'UUID_USER_TEST_KHAC', status: 'LOCKED' });
```

Đây là các ví dụ **độc lập theo vai trò**, không phải script để chạy liên tiếp; cần thay UUID thật trước khi gọi. Khi review người khác, lấy uid từ hồ sơ đã chọn trong danh sách; `me.uid` ở ví dụ chỉ minh họa định dạng tham số.

Wrapper kiểm tra input và response bằng [shared/api.ts](../../../../shared/api.ts). `getMyProfile`, `updateMyProfile`, `adminReviewUser`, `adminSetUserStatus` trả `UserProfile`; `adminListUsers` trả `{ users: UserProfile[], total: number }`. SDK tự gửi access token. `supabase.rpc('get_my_profile', { input: {} })` là lời gọi tương đương ở mức thấp hơn, nhưng module nên dùng wrapper sẵn có.

### Gọi thử bằng Postman/HTTP

Chỉ dùng để kiểm thử bằng **user test**, sau khi đã đăng nhập lấy session qua Auth SDK trong công cụ thử riêng. Không gửi token cho người review hoặc lưu token trong repo. Người dùng app bình thường dùng form, không tự sao chép token.

```http
POST https://PROJECT_REF.supabase.co/rest/v1/rpc/get_my_profile
apikey: PUBLISHABLE_KEY_CUA_PROJECT
Authorization: Bearer ACCESS_TOKEN_CUA_USER_TEST
Content-Type: application/json

{"input":{}}
```

`apikey` là publishable key; `Authorization` là access token của user, **không phải publishable key hoặc service_role key**. Kiểm tra admin bằng token của app ADMIN, không dùng key quản trị để thay cho quyền ADMIN trong `users`.

Ví dụ body cho các RPC còn lại:

```json
{"input":{"page":1}}
```

```json
{"input":{"uid":"UUID_HO_SO_CAN_DUYET","kind":"STUDENT","decision":"REJECTED","reason":"Minh chứng demo cần bổ sung"}}
```

```json
{"input":{"uid":"UUID_USER_TEST_KHAC","status":"ACTIVE"}}
```

Body `update_my_profile` là `{ "input": { ...các field của ví dụ TypeScript phía trên... } }`; phải gửi đủ họ tên/điện thoại/trường/mã/minh chứng và cặp xe hoặc null. Không thêm uid/role/status vào payload này.

### Lỗi thường gặp

- **PGRST202 / “chưa được triển khai”:** kiểm tra đúng project, đủ 5 tên hàm và tham số `input jsonb`, đúng JSON bọc `input`. Nếu SQL đã đúng nhưng cache chưa cập nhật, admin chạy `NOTIFY pgrst, 'reload schema';` trong SQL Editor rồi thử lại.
- **PT401 / 401:** thiếu/hết hạn/sai access token hoặc đang thử trong SQL Editor không có phiên Auth. Login lại bằng user test.
- **42501 khi `.from('users')`:** đúng với thiết kế hiện tại. Chuyển sang RPC, không mở quyền bảng để hết lỗi. Nếu 42501 khi RPC đúng thì kiểm tra quyền USAGE schema public/EXECUTE và cấu hình Data API.
- **PT403:** tài khoản LOCKED, USER gọi admin, hoặc không đủ eligibility. Đọc trạng thái/quyền trên server bằng người có quyền review; không sửa metadata để né lỗi.
- **PT400:** field thừa/thiếu, số điện thoại sai, thiếu cặp xe, phân trang sai hoặc từ chối không có lý do.
- **PT409:** duyệt khi hồ sơ chưa đủ, driver chưa xác minh sinh viên, hoặc admin tự khóa mình. Tải lại dữ liệu và sửa đúng điều kiện.
- **PT412:** hồ sơ cần thiết chưa tồn tại. User mở `/tai-khoan` để gọi bootstrap; admin dùng đúng Auth ID đã có hồ sơ.
- **Email chưa xác nhận / link quay sai nơi:** đối chiếu Confirm Email, gửi email và danh sách URL với origin frontend thực tế.
- **`users already exists` / lệch migration history:** dừng áp dụng; đối chiếu baseline với lead. Không reset remote, không bỏ CREATE TABLE rồi bỏ qua defaults/constraints/grants.

## 5. Điều kiện admin ký duyệt

- [ ] Đã sửa lỗi P2 duyệt hồ sơ cũ: STUDENT và DRIVER thay đổi sau lúc admin xem phải bị PT409; có test hồi quy PASS và payload/contract/tài liệu được cập nhật.
- [ ] Đã đối chiếu schema/defaults/constraints/trigger/hàm cũ và giải quyết baseline cho bảng `users` đang tồn tại.
- [ ] `npm run check` PASS trên Node 22 + Docker, gồm 45 tests và 10 integration tests; không coi lần chạy bị chặn là PASS.
- [ ] Sau cập nhật dev: signup → xác nhận email nếu bật → login → bootstrap đúng USER/ACTIVE; reload giữ phiên; logout về form.
- [ ] Hai lần gọi bootstrap đồng thời khi hồ sơ chưa tồn tại chỉ tạo một dòng, không đặt lại quyền/trạng thái.
- [ ] User A không đọc/sửa được hồ sơ B; payload tự cấp ADMIN/DRIVER/status bị từ chối; metadata ADMIN không làm user thành admin.
- [ ] USER không gọi được cả ba RPC admin; ADMIN ACTIVE duyệt được; từ chối thiếu lý do bị chặn.
- [ ] Duyệt sinh viên rồi driver cấp DRIVER và giữ USER; đổi xe/thông tin sinh viên thu hồi quyền duyệt tương ứng.
- [ ] Khóa user rồi dùng token đã cấp trước đó vẫn bị chặn thao tác; bootstrap không mở khóa. Khóa admin làm token cũ mất quyền admin. Mở khóa chỉ khôi phục khả năng theo dữ liệu duyệt hiện tại.
- [ ] anon không gọi được 5 RPC; anon/authenticated không truy cập trực tiếp bảng riêng tư hoặc helper private.
- [ ] URL/email frontend dev đúng; không có secret/service_role key trong frontend hoặc Git.
- [ ] Owner 3/4 xác nhận cách kiểm tra eligibility ở server và kế hoạch chia sẻ điện thoại sau CONFIRMED; owner 5 xác nhận uid và khởi tạo ví riêng. Không đánh dấu luồng liên module hoàn tất khi handler còn thiếu.
- [ ] Có feature branch/PR vào dev, reviewer khác tác giả và ghi kết quả kiểm thử; không merge/deploy tự động từ tài liệu này.

**Chốt bàn giao hiện tại:** sẵn sàng để admin review code/contract, giao task sửa P2 và giải quyết các bước Supabase ở trên; chưa xác nhận sẵn sàng cập nhật server. Sửa lỗi duyệt hồ sơ, kiểm thử email thật, schema hiện có và 10 integration tests là việc còn phải làm, không phải kết quả đã đạt. Số lượng test cần cập nhật sau khi bổ sung test hồi quy P2.

## 6. Tài liệu đối chiếu

- [Hướng dẫn Auth chi tiết của repo](../../../../docs/auth-module.md), [kết quả kiểm chứng](../../../../docs/validation.md), [quy trình lead cập nhật Supabase](../../../../docs/supabase-lead.md).
- [Supabase Database Functions](https://supabase.com/docs/guides/database/functions): RPC, SECURITY DEFINER và EXECUTE grants.
- [Supabase Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls): URL sau xác nhận email.
- [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys): phân biệt publishable key và user JWT.
- [Supabase database migrations](https://supabase.com/docs/guides/local-development/database-migrations): lưu schema/lịch sử thay đổi.
- [Làm mới PostgREST schema cache](https://supabase.com/docs/guides/troubleshooting/refresh-postgrest-schema).
