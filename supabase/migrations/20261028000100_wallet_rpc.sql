-- Owner 5: RPC ví điểm demo, nạp thử và thanh toán chuyến đi COMPLETED.
-- Áp dụng trên schema 7 bảng chuẩn của nhóm; không tạo lại bảng hay đổi RLS/grants bảng.
begin;

insert into public.wallets(kind) values ('APP') on conflict do nothing;

create or replace function private.wallet_entry_json(we public.wallet_entries)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'id', we.id::text,
    'walletId', we.wallet_id::text,
    'deltaPoints', we.delta_points,
    'kind', we.kind,
    'referenceId', coalesce(we.payment_id::text, we.request_id, we.id::text),
    'createdAtMs', floor(extract(epoch from we.created_at) * 1000)::bigint
  );
$$;

create or replace function private.payment_json(b public.bookings)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'bookingId', b.id::text,
    'passengerId', b.passenger_id::text,
    'driverId', b.driver_id::text,
    'farePoints', b.fare_points,
    'feePoints', b.fee_points,
    'driverPoints', b.driver_points,
    'status', 'SUCCEEDED'
  );
$$;

create or replace function private.ensure_user_wallet(target_uid uuid)
returns public.wallets language plpgsql set search_path = '' as $$
declare w public.wallets;
begin
  insert into public.wallets (user_id, kind, balance_points)
  values (target_uid, 'USER', 1000000)
  on conflict (user_id) do nothing;

  select * into strict w from public.wallets where user_id = target_uid for update;

  if not exists (
    select 1 from public.wallet_entries where wallet_id = w.id and kind = 'INITIAL_GRANT'
  ) then
    insert into public.wallet_entries (wallet_id, payment_id, request_id, kind, delta_points)
    values (w.id, null, null, 'INITIAL_GRANT', 1000000);
  end if;

  return w;
end;
$$;

create or replace function public.get_my_wallet(input jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.auth_uid();
  u public.users;
  w public.wallets;
  entries jsonb;
begin
  perform private.check_auth_input(coalesce(input, '{}'::jsonb), array[]::text[]);
  insert into public.users(id) values (uid) on conflict (id) do nothing;
  u := private.require_active_user();
  w := private.ensure_user_wallet(u.id);

  select coalesce(
    jsonb_agg(private.wallet_entry_json(we) order by we.created_at desc, we.id desc),
    '[]'::jsonb
  ) into entries
  from public.wallet_entries we
  where we.wallet_id = w.id;

  return jsonb_build_object(
    'wallet', jsonb_build_object('uid', u.id::text, 'balancePoints', w.balance_points),
    'ledgerEntries', entries
  );
end;
$$;

create or replace function public.top_up_demo(input jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.auth_uid();
  u public.users;
  w public.wallets;
  req_id text;
  we public.wallet_entries;
begin
  perform private.check_auth_input(input, array['requestId']);
  req_id := private.auth_text(input, 'requestId', 100);
  insert into public.users(id) values (uid) on conflict (id) do nothing;
  u := private.require_active_user();
  w := private.ensure_user_wallet(u.id);

  select * into we from public.wallet_entries
  where wallet_id = w.id and kind = 'DEMO_TOP_UP' and request_id = req_id
  limit 1;

  if not found then
    update public.wallets
    set balance_points = balance_points + 100000
    where id = w.id
    returning * into w;

    insert into public.wallet_entries (wallet_id, payment_id, request_id, kind, delta_points)
    values (w.id, null, req_id, 'DEMO_TOP_UP', 100000)
    returning * into we;
  end if;

  return jsonb_build_object(
    'balancePoints', w.balance_points,
    'entry', private.wallet_entry_json(we)
  );
end;
$$;

create or replace function public.pay_booking(input jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  u public.users := private.require_active_user();
  bid uuid;
  b public.bookings;
  p public.payments;
  pw public.wallets;
  dw public.wallets;
  aw public.wallets;
  paid_time timestamptz := clock_timestamp();
begin
  perform private.check_auth_input(input, array['bookingId']);
  begin
    bid := private.auth_text(input, 'bookingId', 36)::uuid;
  exception when invalid_text_representation then
    raise sqlstate 'PT400' using message = 'Invalid booking ID';
  end;

  select * into b from public.bookings where id = bid for update;
  if not found then
    raise sqlstate 'PT404' using message = 'Booking not found';
  end if;
  if b.passenger_id <> u.id then
    raise sqlstate 'PT403' using message = 'Only passenger can pay';
  end if;

  select * into p from public.payments where booking_id = b.id;
  if found then
    return jsonb_build_object('payment', private.payment_json(b));
  end if;

  if b.status <> 'COMPLETED' or b.fare_points is null or b.fee_points is null or b.driver_points is null then
    raise sqlstate 'PT409' using message = 'Booking not ready for payment';
  end if;

  pw := private.ensure_user_wallet(b.passenger_id);
  dw := private.ensure_user_wallet(b.driver_id);

  insert into public.wallets(kind) values ('APP') on conflict do nothing;
  select * into strict aw from public.wallets where kind = 'APP' for update;
  perform id from public.wallets where id in (pw.id, dw.id, aw.id) order by id for update;
  select * into strict pw from public.wallets where id = pw.id;

  if pw.balance_points < b.fare_points then
    raise sqlstate 'PT409' using message = 'Insufficient balance';
  end if;

  insert into public.payments (booking_id, paid_at)
  values (b.id, paid_time)
  returning * into p;

  update public.wallets set balance_points = balance_points - b.fare_points where id = pw.id;
  insert into public.wallet_entries (wallet_id, payment_id, request_id, kind, delta_points, created_at)
  values (pw.id, p.id, null, 'RIDE_PAYMENT', -b.fare_points, paid_time);

  update public.wallets set balance_points = balance_points + b.driver_points where id = dw.id;
  insert into public.wallet_entries (wallet_id, payment_id, request_id, kind, delta_points, created_at)
  values (dw.id, p.id, null, 'DRIVER_INCOME', b.driver_points, paid_time);

  update public.wallets set balance_points = balance_points + b.fee_points where id = aw.id;
  insert into public.wallet_entries (wallet_id, payment_id, request_id, kind, delta_points, created_at)
  values (aw.id, p.id, null, 'APP_FEE', b.fee_points, paid_time);

  return jsonb_build_object('payment', private.payment_json(b));
end;
$$;

create or replace function public.get_booking_payment(input jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  u public.users := private.require_active_user();
  bid uuid;
  b public.bookings;
  p public.payments;
begin
  perform private.check_auth_input(input, array['bookingId']);
  begin
    bid := private.auth_text(input, 'bookingId', 36)::uuid;
  exception when invalid_text_representation then
    raise sqlstate 'PT400' using message = 'Invalid booking ID';
  end;

  select * into b from public.bookings
  where id = bid and u.id in (passenger_id, driver_id);
  if not found then
    raise sqlstate 'PT404' using message = 'Booking not found';
  end if;

  select * into p from public.payments where booking_id = b.id;
  if not found then
    return jsonb_build_object('payment', null);
  end if;

  return jsonb_build_object('payment', private.payment_json(b));
end;
$$;

revoke all on function
  private.wallet_entry_json(public.wallet_entries),
  private.payment_json(public.bookings),
  private.ensure_user_wallet(uuid)
  from public, anon, authenticated, service_role;

revoke all on function
  public.get_my_wallet(jsonb),
  public.top_up_demo(jsonb),
  public.pay_booking(jsonb),
  public.get_booking_payment(jsonb)
  from public, anon, authenticated, service_role;

grant execute on function
  public.get_my_wallet(jsonb),
  public.top_up_demo(jsonb),
  public.pay_booking(jsonb),
  public.get_booking_payment(jsonb)
  to authenticated;

commit;
