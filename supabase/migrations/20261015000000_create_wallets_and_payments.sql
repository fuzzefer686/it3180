-- Migration Người 5: Tạo bảng ví điểm, thanh toán, lịch sử giao dịch và các hàm RPC
-- Dự án: Về Cùng (IT3180)

-- 1. Bảng ví điểm (wallets)
create table if not exists public.wallets (
    uid text primary key,
    balance_points bigint not null default 1000000 check (balance_points >= 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 2. Bảng thanh toán chuyến đi (payments)
create table if not exists public.payments (
    booking_id text primary key,
    passenger_id text not null,
    driver_id text not null,
    fare_points bigint not null check (fare_points >= 0),
    fee_points bigint not null check (fee_points >= 0),
    driver_points bigint not null check (driver_points >= 0),
    status text not null default 'SUCCEEDED' check (status in ('PENDING', 'SUCCEEDED', 'FAILED')),
    created_at timestamptz not null default now()
);

-- 3. Bảng lịch sử biến động số dư (ledger_entries)
create table if not exists public.ledger_entries (
    id text primary key,
    wallet_id text not null,
    delta_points bigint not null,
    kind text not null check (kind in ('INITIAL_GRANT', 'DEMO_TOP_UP', 'RIDE_PAYMENT', 'DRIVER_INCOME', 'APP_FEE')),
    reference_id text not null,
    created_at timestamptz not null default now(),
    created_at_ms bigint not null
);

-- 4. Bảng đặt chuyến (bookings) phục vụ kiểm tra trạng thái và giá chuyến đi
create table if not exists public.bookings (
    id text primary key,
    trip_id text not null,
    passenger_id text not null,
    driver_id text not null,
    status text not null default 'COMPLETED' check (status in ('WAITING', 'CONFIRMED', 'ONBOARD', 'COMPLETED', 'REJECTED', 'CANCELLED', 'EXPIRED')),
    fare_points bigint not null default 0,
    fee_points bigint not null default 0,
    driver_points bigint not null default 0,
    payment_method text not null default 'DEMO_WALLET',
    created_at timestamptz not null default now()
);

-- Chỉ mục tối ưu truy vấn
create index if not exists idx_ledger_wallet on public.ledger_entries (wallet_id, created_at_ms desc);
create index if not exists idx_payments_passenger on public.payments (passenger_id);
create index if not exists idx_payments_driver on public.payments (driver_id);

-- Kích hoạt Row Level Security (RLS)
alter table public.wallets enable row level security;
alter table public.payments enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.bookings enable row level security;

-- Chính sách RLS
drop policy if exists "Users can view own wallet" on public.wallets;
create policy "Users can view own wallet" on public.wallets
    for select using (auth.uid()::text = uid);

drop policy if exists "Users can view related payments" on public.payments;
create policy "Users can view related payments" on public.payments
    for select using (auth.uid()::text = passenger_id or auth.uid()::text = driver_id);

drop policy if exists "Users can view own ledger entries" on public.ledger_entries;
create policy "Users can view own ledger entries" on public.ledger_entries
    for select using (auth.uid()::text = wallet_id);

drop policy if exists "Users can view own bookings" on public.bookings;
create policy "Users can view own bookings" on public.bookings
    for select using (auth.uid()::text = passenger_id or auth.uid()::text = driver_id);

-- Cấp quyền truy cập các bảng cho authenticated users
grant select on public.wallets to authenticated;
grant select on public.payments to authenticated;
grant select on public.ledger_entries to authenticated;
grant select on public.bookings to authenticated;

-- ==========================================================
-- 5. CÁC HÀM XỬ LÝ DATABASE (RPC FUNCTIONS)
-- ==========================================================

-- Hàm 1: Lấy thông tin ví và lịch sử (tự động cấp 1.000.000 điểm nếu là tài khoản mới)
create or replace function public.get_my_wallet(input jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid text;
    v_balance bigint;
    v_entries jsonb;
    v_now_ms bigint;
begin
    v_uid := auth.uid()::text;
    if v_uid is null then
        raise exception 'unauthenticated: Vui lòng đăng nhập lại.';
    end if;

    v_now_ms := (extract(epoch from clock_timestamp()) * 1000)::bigint;

    -- Kiểm tra ví đã tồn tại chưa, nếu chưa thì cấp 1.000.000 điểm ban đầu (Idempotent bootstrap)
    if not exists (select 1 from public.wallets where uid = v_uid) then
        insert into public.wallets (uid, balance_points, created_at, updated_at)
        values (v_uid, 1000000, now(), now())
        on conflict (uid) do nothing;

        insert into public.ledger_entries (id, wallet_id, delta_points, kind, reference_id, created_at, created_at_ms)
        values ('initial_' || v_uid, v_uid, 1000000, 'INITIAL_GRANT', v_uid, now(), v_now_ms)
        on conflict (id) do nothing;
    end if;

    -- Đọc số dư ví
    select balance_points into v_balance from public.wallets where uid = v_uid;

    -- Đọc danh sách lịch sử biến động điểm
    select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'id', id,
                'walletId', wallet_id,
                'deltaPoints', delta_points,
                'kind', kind,
                'referenceId', reference_id,
                'createdAtMs', created_at_ms
            ) order by created_at_ms desc
        ),
        '[]'::jsonb
    ) into v_entries
    from public.ledger_entries
    where wallet_id = v_uid;

    return jsonb_build_object(
        'wallet', jsonb_build_object('uid', v_uid, 'balancePoints', v_balance),
        'ledgerEntries', v_entries
    );
end;
$$;

-- Hàm 2: Thêm cố định 100.000 điểm thử nghiệm (idempotency qua requestId)
create or replace function public.top_up_demo(input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid text;
    v_req_id text;
    v_ledger_id text;
    v_balance bigint;
    v_entry jsonb;
    v_now_ms bigint;
begin
    v_uid := auth.uid()::text;
    if v_uid is null then
        raise exception 'unauthenticated: Vui lòng đăng nhập lại.';
    end if;

    v_req_id := trim(input->>'requestId');
    if v_req_id is null or v_req_id = '' then
        raise exception 'invalid_argument: requestId không được để trống.';
    end if;

    v_ledger_id := 'topup_' || v_uid || '_' || v_req_id;
    v_now_ms := (extract(epoch from clock_timestamp()) * 1000)::bigint;

    -- Nếu requestId này đã được nạp rồi thì trả về ngay kết quả cũ (chống nạp trùng)
    if exists (select 1 from public.ledger_entries where id = v_ledger_id) then
        select balance_points into v_balance from public.wallets where uid = v_uid;
        select jsonb_build_object(
            'id', id,
            'walletId', wallet_id,
            'deltaPoints', delta_points,
            'kind', kind,
            'referenceId', reference_id,
            'createdAtMs', created_at_ms
        ) into v_entry from public.ledger_entries where id = v_ledger_id;

        return jsonb_build_object(
            'balancePoints', v_balance,
            'entry', v_entry
        );
    end if;

    -- Khởi tạo ví nếu chưa có
    if not exists (select 1 from public.wallets where uid = v_uid) then
        insert into public.wallets (uid, balance_points) values (v_uid, 1000000) on conflict (uid) do nothing;
        insert into public.ledger_entries (id, wallet_id, delta_points, kind, reference_id, created_at, created_at_ms)
        values ('initial_' || v_uid, v_uid, 1000000, 'INITIAL_GRANT', v_uid, now(), v_now_ms) on conflict (id) do nothing;
    end if;

    -- Cộng cố định 100.000 điểm
    update public.wallets
    set balance_points = balance_points + 100000,
        updated_at = now()
    where uid = v_uid
    returning balance_points into v_balance;

    -- Ghi nhận lịch sử nạp
    insert into public.ledger_entries (id, wallet_id, delta_points, kind, reference_id, created_at, created_at_ms)
    values (v_ledger_id, v_uid, 100000, 'DEMO_TOP_UP', v_req_id, now(), v_now_ms);

    v_entry := jsonb_build_object(
        'id', v_ledger_id,
        'walletId', v_uid,
        'deltaPoints', 100000,
        'kind', 'DEMO_TOP_UP',
        'referenceId', v_req_id,
        'createdAtMs', v_now_ms
    );

    return jsonb_build_object(
        'balancePoints', v_balance,
        'entry', v_entry
    );
end;
$$;

-- Hàm 3: Thanh toán chuyến đi bằng điểm demo (PostgreSQL Transaction nguyên tử)
create or replace function public.pay_booking(input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid text;
    v_booking_id text;
    v_booking record;
    v_existing_payment record;
    v_passenger_balance bigint;
    v_now_ms bigint;
    v_payment jsonb;
begin
    v_uid := auth.uid()::text;
    if v_uid is null then
        raise exception 'unauthenticated: Vui lòng đăng nhập lại.';
    end if;

    v_booking_id := trim(input->>'bookingId');
    if v_booking_id is null or v_booking_id = '' then
        raise exception 'invalid_argument: bookingId không được để trống.';
    end if;

    -- 1. Kiểm tra nếu chuyến này đã thanh toán thành công rồi (idempotent retry)
    select * into v_existing_payment from public.payments where booking_id = v_booking_id;
    if found and v_existing_payment.status = 'SUCCEEDED' then
        return jsonb_build_object(
            'payment', jsonb_build_object(
                'bookingId', v_existing_payment.booking_id,
                'passengerId', v_existing_payment.passenger_id,
                'driverId', v_existing_payment.driver_id,
                'farePoints', v_existing_payment.fare_points,
                'feePoints', v_existing_payment.fee_points,
                'driverPoints', v_existing_payment.driver_points,
                'status', v_existing_payment.status
            )
        );
    end if;

    -- 2. Kiểm tra thông tin chuyến đặt
    select * into v_booking from public.bookings where id = v_booking_id;
    if not found then
        raise exception 'not_found: Không tìm thấy chuyến đặt.';
    end if;

    if v_booking.passenger_id <> v_uid then
        raise exception 'permission_denied: Chỉ hành khách của chuyến đi mới có quyền thanh toán.';
    end if;

    if v_booking.status <> 'COMPLETED' then
        raise exception 'failed_precondition: Chỉ có thể thanh toán sau khi chuyến đi đã hoàn thành.';
    end if;

    if v_booking.payment_method <> 'DEMO_WALLET' then
        raise exception 'failed_precondition: Phương thức thanh toán của chuyến đi không hợp lệ.';
    end if;

    -- Khởi tạo ví khách nếu chưa có
    if not exists (select 1 from public.wallets where uid = v_uid) then
        insert into public.wallets (uid, balance_points) values (v_uid, 1000000) on conflict (uid) do nothing;
        insert into public.ledger_entries (id, wallet_id, delta_points, kind, reference_id, created_at, created_at_ms)
        values ('initial_' || v_uid, v_uid, 1000000, 'INITIAL_GRANT', v_uid, now(), (extract(epoch from clock_timestamp()) * 1000)::bigint) on conflict (id) do nothing;
    end if;

    -- Khóa bản ghi ví khách để kiểm tra số dư nguyên tử (chống race condition khi 2 request gửi đồng thời)
    select balance_points into v_passenger_balance
    from public.wallets
    where uid = v_uid
    for update;

    if v_passenger_balance < v_booking.fare_points then
        raise exception 'failed_precondition: Số dư điểm không đủ để thanh toán chuyến đi (cần %, hiện có %). Vui lòng thêm điểm thử.',
            v_booking.fare_points, v_passenger_balance;
    end if;

    v_now_ms := (extract(epoch from clock_timestamp()) * 1000)::bigint;

    -- 3. Trừ điểm ví hành khách
    update public.wallets
    set balance_points = balance_points - v_booking.fare_points,
        updated_at = now()
    where uid = v_uid;

    -- 4. Cộng điểm ví tài xế
    insert into public.wallets (uid, balance_points, created_at, updated_at)
    values (v_booking.driver_id, 1000000 + v_booking.driver_points, now(), now())
    on conflict (uid) do update
    set balance_points = wallets.balance_points + v_booking.driver_points,
        updated_at = now();

    -- 5. Cộng điểm ví sàn hệ thống
    insert into public.wallets (uid, balance_points, created_at, updated_at)
    values ('system-fees', v_booking.fee_points, now(), now())
    on conflict (uid) do update
    set balance_points = wallets.balance_points + v_booking.fee_points,
        updated_at = now();

    -- 6. Tạo bản ghi payment
    insert into public.payments (booking_id, passenger_id, driver_id, fare_points, fee_points, driver_points, status, created_at)
    values (v_booking_id, v_booking.passenger_id, v_booking.driver_id, v_booking.fare_points, v_booking.fee_points, v_booking.driver_points, 'SUCCEEDED', now())
    on conflict (booking_id) do update
    set status = 'SUCCEEDED';

    -- 7. Ghi nhận 3 dòng lịch sử giao dịch với ID cố định
    insert into public.ledger_entries (id, wallet_id, delta_points, kind, reference_id, created_at, created_at_ms)
    values
        ('ride_pay_' || v_booking_id, v_booking.passenger_id, -v_booking.fare_points, 'RIDE_PAYMENT', v_booking_id, now(), v_now_ms),
        ('driver_inc_' || v_booking_id, v_booking.driver_id, v_booking.driver_points, 'DRIVER_INCOME', v_booking_id, now(), v_now_ms),
        ('app_fee_' || v_booking_id, 'system-fees', v_booking.fee_points, 'APP_FEE', v_booking_id, now(), v_now_ms)
    on conflict (id) do nothing;

    v_payment := jsonb_build_object(
        'bookingId', v_booking_id,
        'passengerId', v_booking.passenger_id,
        'driverId', v_booking.driver_id,
        'farePoints', v_booking.fare_points,
        'feePoints', v_booking.fee_points,
        'driverPoints', v_booking.driver_points,
        'status', 'SUCCEEDED'
    );

    return jsonb_build_object('payment', v_payment);
end;
$$;

-- Hàm 4: Tra cứu trạng thái thanh toán chuyến đi
create or replace function public.get_booking_payment(input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid text;
    v_booking_id text;
    v_payment record;
begin
    v_uid := auth.uid()::text;
    if v_uid is null then
        raise exception 'unauthenticated: Vui lòng đăng nhập lại.';
    end if;

    v_booking_id := trim(input->>'bookingId');
    if v_booking_id is null or v_booking_id = '' then
        raise exception 'invalid_argument: bookingId không được để trống.';
    end if;

    select * into v_payment from public.payments where booking_id = v_booking_id;
    if not found then
        return jsonb_build_object('payment', null);
    end if;

    if v_payment.passenger_id <> v_uid and v_payment.driver_id <> v_uid then
        raise exception 'permission_denied: Bạn không có quyền xem thông tin thanh toán chuyến này.';
    end if;

    return jsonb_build_object(
        'payment', jsonb_build_object(
            'bookingId', v_payment.booking_id,
            'passengerId', v_payment.passenger_id,
            'driverId', v_payment.driver_id,
            'farePoints', v_payment.fare_points,
            'feePoints', v_payment.fee_points,
            'driverPoints', v_payment.driver_points,
            'status', v_payment.status
        )
    );
end;
$$;

-- Cấp quyền gọi các hàm RPC cho authenticated users
grant execute on function public.get_my_wallet(jsonb) to authenticated;
grant execute on function public.top_up_demo(jsonb) to authenticated;
grant execute on function public.pay_booking(jsonb) to authenticated;
grant execute on function public.get_booking_payment(jsonb) to authenticated;
