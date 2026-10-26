-- Về Cùng V1: schema chung gồm 7 bảng, chốt ngày 16/10/2026.
-- Nguồn chuẩn duy nhất cho cả nhóm; đọc docs/database-design.md trước khi dùng.
-- Migration ban đầu dành cho database chưa có bảng ứng dụng cũ.
-- Không DROP bảng, không tạo Auth user/admin, không cấp điểm tự động.
-- Chỉ tạo cấu trúc và quyền đọc; CHƯA có RPC nghiệp vụ/ghi dữ liệu.
-- File không tự COMMIT: migration/công cụ gọi phải bọc trong transaction.
-- Khi dùng psql để áp dụng thật: --single-transaction -v ON_ERROR_STOP=1.

-- Không tự xóa/chuyển dữ liệu của schema cũ; báo rõ để tránh trộn hai thiết kế.
do $$
begin
  if exists (
    select 1 from pg_tables where schemaname = 'public' and tablename in (
      'users', 'trips', 'trip_stops', 'bookings', 'wallets', 'payments',
      'wallet_entries', 'ledger_entries'
    )
  ) then
    raise exception 'Database còn bảng ứng dụng cũ. Migration ban đầu cần database chưa có các bảng Về Cùng; không tự xóa dữ liệu để tiếp tục.';
  end if;
end;
$$;

-- 1. Hồ sơ riêng tư. Password/token/email đăng nhập do auth.users quản lý.
-- Gộp sinh viên + driver + một xe máy hiện tại để giảm số bảng.
create table public.users (
  id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null check (length(btrim(display_name)) between 1 and 100),
  phone text,
  school text,
  student_code text,
  student_evidence_demo text, -- Chỉ nội dung hư cấu; không lưu giấy tờ thật.
  roles text[] not null default array['USER']::text[],
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'LOCKED')),
  student_verification_status text not null default 'PENDING'
    check (student_verification_status in ('PENDING', 'VERIFIED', 'REJECTED')),
  student_review_note text,
  driver_verification_status text not null default 'PENDING'
    check (driver_verification_status in ('PENDING', 'VERIFIED', 'REJECTED')),
  driver_review_note text,
  vehicle_model text,
  vehicle_plate text,
  created_at timestamptz not null default now(),
  constraint users_roles_allowed check (
    roles <@ array['USER', 'DRIVER', 'ADMIN']::text[]
    and 'USER' = any(roles)
    and array_position(roles, null) is null
  ),
  constraint users_driver_eligible check (
    not ('DRIVER' = any(roles)) or (
      student_verification_status = 'VERIFIED'
      and driver_verification_status = 'VERIFIED'
      and vehicle_model is not null and length(btrim(vehicle_model)) > 0
      and vehicle_plate is not null and length(btrim(vehicle_plate)) > 0
    )
  )
);

-- 2. Tuyến đã lưu nằm ngay trong Trip + các điểm dừng, không cần RouteSnapshot.
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.users(id) on delete restrict,
  departure_time timestamptz not null,
  estimated_arrival_time timestamptz,
  status text not null default 'OPEN'
    check (status in ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  route_polyline text not null check (length(btrim(route_polyline)) > 0),
  route_distance_meters integer not null check (route_distance_meters > 0),
  note text,
  cancellation_reason text,
  confirmed_booking_id uuid,
  has_served_passenger boolean not null default false,
  created_at timestamptz not null default now(),
  constraint trips_arrival_after_departure check (
    estimated_arrival_time is null or estimated_arrival_time > departure_time
  ),
  -- Khóa ghép này giúp Booking bảo đảm driver_id khớp chủ Trip.
  constraint trips_id_driver_unique unique (id, driver_id)
);

-- 3. Điểm dừng: khoảng cách CỘNG DỒN từ đầu tuyến, đơn vị mét.
-- A=0, B=1200, C=3000 thì đoạn B→C dài 1800 m.
create table public.trip_stops (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete restrict,
  stop_order integer not null check (stop_order >= 0),
  label text not null check (length(btrim(label)) > 0),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  distance_from_start_meters integer not null check (distance_from_start_meters >= 0),
  constraint trip_stops_order_unique unique (trip_id, stop_order),
  constraint trip_stops_trip_id_unique unique (trip_id, id),
  constraint trip_stops_first_distance check (
    stop_order <> 0 or distance_from_start_meters = 0
  )
);

-- 4. WAITING chính là hàng chờ; không cần bảng queue.
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null,
  driver_id uuid not null,
  passenger_id uuid not null references public.users(id) on delete restrict,
  pickup_stop_id uuid not null,
  dropoff_stop_id uuid not null,
  request_id text not null check (length(btrim(request_id)) between 1 and 128),
  status text not null default 'WAITING' check (status in (
    'WAITING', 'CONFIRMED', 'ONBOARD', 'COMPLETED', 'REJECTED', 'CANCELLED', 'EXPIRED'
  )),
  -- NULL trước khi confirm: chưa chốt giá. Backend tính, không nhận giá từ FE.
  distance_meters integer,
  fare_points bigint,
  fee_points bigint,
  driver_points bigint,
  cancellation_reason text,
  confirmed_at timestamptz,
  picked_up_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint bookings_trip_driver_fk foreign key (trip_id, driver_id)
    references public.trips(id, driver_id) on delete restrict,
  constraint bookings_pickup_same_trip_fk foreign key (trip_id, pickup_stop_id)
    references public.trip_stops(trip_id, id) on delete restrict,
  constraint bookings_dropoff_same_trip_fk foreign key (trip_id, dropoff_stop_id)
    references public.trip_stops(trip_id, id) on delete restrict,
  constraint bookings_not_own_trip check (passenger_id <> driver_id),
  constraint bookings_different_stops check (pickup_stop_id <> dropoff_stop_id),
  constraint bookings_request_once unique (passenger_id, request_id),
  constraint bookings_id_trip_unique unique (id, trip_id),
  constraint bookings_price_snapshot check (
    (distance_meters is null and fare_points is null and fee_points is null
      and driver_points is null and confirmed_at is null)
    or (
      distance_meters is not null and distance_meters > 0
      and fare_points is not null and fare_points = distance_meters::bigint * 5
      and fee_points is not null and fee_points = fare_points / 10
      and driver_points is not null and driver_points = fare_points - fee_points
      and confirmed_at is not null
    )
  ),
  constraint bookings_confirmed_requires_price check (
    status not in ('CONFIRMED', 'ONBOARD', 'COMPLETED') or confirmed_at is not null
  ),
  constraint bookings_pickup_required check (
    status not in ('ONBOARD', 'COMPLETED') or picked_up_at is not null
  ),
  constraint bookings_completed_required check (
    status <> 'COMPLETED' or completed_at is not null
  ),
  constraint bookings_pickup_after_confirm check (
    picked_up_at is null or (confirmed_at is not null and picked_up_at >= confirmed_at)
  ),
  constraint bookings_dropoff_after_pickup check (
    completed_at is null or (picked_up_at is not null and completed_at >= picked_up_at)
  )
);

-- Trip chỉ có thể trỏ tới Booking thuộc chính Trip đó.
-- DEFERRABLE: cho phép backend ghi cả hai phía trong cùng transaction.
alter table public.trips add constraint trips_confirmed_booking_same_trip_fk
  foreign key (confirmed_booking_id, id) references public.bookings(id, trip_id)
  deferrable initially deferred;

-- Mỗi khách tối đa một yêu cầu hoạt động trên một Trip.
create unique index bookings_one_active_request
  on public.bookings(trip_id, passenger_id)
  where status in ('WAITING', 'CONFIRMED', 'ONBOARD');

-- Giữ cả COMPLETED: đã trả khách rồi vẫn không nhận người kế tiếp.
-- CONFIRMED bị hủy trước pickup không chiếm index này nữa.
create unique index bookings_one_passenger_per_trip
  on public.bookings(trip_id)
  where status in ('CONFIRMED', 'ONBOARD', 'COMPLETED');

-- 5. Một ví/user và một ví APP để ghi phí demo; không tạo user giả cho app.
create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.users(id) on delete restrict,
  kind text not null default 'USER' check (kind in ('USER', 'APP')),
  balance_points bigint not null default 0
    check (balance_points between 0 and 9007199254740991),
  created_at timestamptz not null default now(),
  constraint wallets_owner check (
    (kind = 'USER' and user_id is not null) or (kind = 'APP' and user_id is null)
  )
);

create unique index wallets_one_app on public.wallets(kind) where kind = 'APP';

insert into public.wallets(kind) values ('APP');

-- 0 điểm, chưa phát sinh phí.

-- 6. Chỉ lưu thanh toán THÀNH CÔNG. Lỗi/thiếu điểm phải rollback toàn bộ.
-- booking_id là khóa chống trả trùng, không cần thêm request_id cho payBooking.
-- Người trả/nhận và giá lấy từ Booking đã chốt, tránh lưu lặp ở Payment.
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete restrict,
  paid_at timestamptz not null default now()
);

-- 7. Mỗi dòng là một thay đổi số dư. Giữ lịch sử, không sửa/xóa.
create table public.wallet_entries (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id) on delete restrict,
  payment_id uuid references public.payments(id) on delete restrict,
  request_id text check (request_id is null or length(btrim(request_id)) between 1 and 128),
  kind text not null check (kind in (
    'INITIAL_GRANT', 'DEMO_TOP_UP', 'RIDE_PAYMENT', 'DRIVER_INCOME', 'APP_FEE'
  )),
  delta_points bigint not null check (delta_points between -9007199254740991 and 9007199254740991),
  created_at timestamptz not null default now(),
  constraint wallet_entries_kind_amount check (
    (kind = 'INITIAL_GRANT' and delta_points = 1000000
      and payment_id is null and request_id is null)
    or (kind = 'DEMO_TOP_UP' and delta_points = 100000
      and payment_id is null and request_id is not null)
    or (kind = 'RIDE_PAYMENT' and delta_points < 0
      and payment_id is not null and request_id is null)
    or (kind in ('DRIVER_INCOME', 'APP_FEE') and delta_points >= 0
      and payment_id is not null and request_id is null)
  ),
  -- Cùng một Payment không thể ghi hai lần cùng loại cho cùng ví.
  constraint wallet_entries_payment_once unique (wallet_id, payment_id, kind)
);

create unique index wallet_entries_initial_once on public.wallet_entries(wallet_id)
  where kind = 'INITIAL_GRANT';

create unique index wallet_entries_top_up_once on public.wallet_entries(wallet_id, request_id)
  where kind = 'DEMO_TOP_UP';

-- Index phục vụ danh sách chuyến, queue và lịch sử; index = mục lục tra nhanh.
create index trips_search on public.trips(status, departure_time);

create index trips_driver_history on public.trips(driver_id, departure_time desc);

create index bookings_queue on public.bookings(trip_id, status, created_at, id);

create index bookings_passenger_history on public.bookings(passenger_id, created_at desc);

create index wallet_entries_history on public.wallet_entries(wallet_id, created_at desc);

create index wallet_entries_payment on public.wallet_entries(payment_id);

-- RLS = quyền theo dòng. Quyền đọc tối thiểu; KHÔNG cho client ghi trực tiếp.
alter table public.users enable row level security;

alter table public.trips enable row level security;

alter table public.trip_stops enable row level security;

alter table public.bookings enable row level security;

alter table public.wallets enable row level security;

alter table public.payments enable row level security;

alter table public.wallet_entries enable row level security;

-- Chỉ tác động đúng 7 bảng mới; không đụng quyền các bảng/hàm khác.
-- service_role cũng không được ghi bảng qua API; RPC có kiểm tra phiên sẽ làm.
revoke all on table public.users, public.trips, public.trip_stops, public.bookings,
  public.wallets, public.payments, public.wallet_entries
  from public, anon, authenticated, service_role;

grant select on table public.users, public.trips, public.trip_stops, public.bookings,
  public.wallets, public.payments, public.wallet_entries to authenticated;

-- Kể cả LOCKED vẫn đọc hồ sơ mình để UI giải thích bị khóa.
-- Người khác/admin không đọc bảng users trực tiếp: dùng RPC trả đúng trường.
create policy users_read_self on public.users for select to authenticated
  using (id = (select auth.uid()));

-- SELECT users bên dưới chỉ thấy hồ sơ chính mình nhờ policy phía trên.
create policy trips_read_active on public.trips for select to authenticated
  using (exists (
    select 1 from public.users u where u.id = (select auth.uid()) and u.status = 'ACTIVE'
  ));

create policy trip_stops_read_active on public.trip_stops for select to authenticated
  using (exists (
    select 1 from public.users u where u.id = (select auth.uid()) and u.status = 'ACTIVE'
  ));

create policy bookings_read_participant on public.bookings for select to authenticated
  using (
    (passenger_id = (select auth.uid()) or driver_id = (select auth.uid()))
    and exists (
      select 1 from public.users u where u.id = (select auth.uid()) and u.status = 'ACTIVE'
    )
  );

create policy wallets_read_self on public.wallets for select to authenticated
  using (
    user_id = (select auth.uid()) and exists (
      select 1 from public.users u where u.id = (select auth.uid()) and u.status = 'ACTIVE'
    )
  );

create policy payments_read_participant on public.payments for select to authenticated
  using (exists (
    select 1 from public.bookings b where b.id = payments.booking_id
  ));

-- bookings đã lọc đúng hai bên và ACTIVE bằng RLS.

create policy wallet_entries_read_self on public.wallet_entries for select to authenticated
  using (exists (
    select 1 from public.wallets w where w.id = wallet_entries.wallet_id
  ));

-- wallets đã lọc chủ ví và ACTIVE; ví APP không lộ ra client.

comment on table public.users is 'Hồ sơ riêng tư; không lưu password/token; thay đổi qua RPC có kiểm tra quyền.';

comment on table public.trips is 'Một Trip chỉ phục vụ một khách trong cả hành trình; snapshot tuyến do backend lưu.';

comment on table public.bookings is 'WAITING là queue; cutoff, chuyển trạng thái, thứ tự stops và khóa Trip do RPC kiểm tra.';

comment on table public.wallets is 'Chỉ điểm DEMO. Balance và ledger phải cập nhật trong cùng transaction có khóa ví.';

comment on table public.payments is 'Chỉ thanh toán đã thành công; một Booking tối đa một Payment. Chưa có RPC thanh toán.';

comment on table public.wallet_entries is 'Lịch sử điểm bất biến ở API; không có quyền ghi trực tiếp cho client.';
