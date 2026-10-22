begin;

-- Auth mới lưu hồ sơ và xe trong users. Giữ migration Trip cũ vì đã deploy.
-- Edge gọi bằng service_role sau khi xác minh token nên nhận uid tường minh;
-- RPC gọi bằng người dùng truyền auth.uid(), không lấy uid từ input frontend.
create or replace function private.require_trip_user(uid uuid, driver boolean)
returns jsonb language plpgsql set search_path = '' as $$
declare profile public.users;
begin
  if uid is null then
    raise sqlstate 'PT401' using message = 'Authentication required';
  end if;
  if driver is null then
    raise sqlstate 'PT400' using message = 'Driver requirement required';
  end if;

  -- Giữ hồ sơ ổn định đến khi lưu xong; admin không thể khóa giữa transaction.
  select * into profile from public.users where id = uid for share;
  if not found then
    raise sqlstate 'PT412' using message = 'Profile required';
  end if;
  if profile.status <> 'ACTIVE' then
    raise sqlstate 'PT403' using message = 'Account locked';
  end if;
  if driver and (
    not ('DRIVER' = any(profile.roles))
    or profile.student_verification_status <> 'VERIFIED'
    or profile.driver_verification_status <> 'VERIFIED'
    or profile.vehicle_model is null
    or profile.vehicle_plate is null
  ) then
    raise sqlstate 'PT403' using message = 'Verified driver with vehicle required';
  end if;

  -- Chỉ trả thông tin Trip cần, không trả điện thoại/minh chứng riêng tư.
  return jsonb_build_object('uid', profile.id, 'displayName', profile.display_name);
end;
$$;

create or replace function private.trip_change(input jsonb, action text) returns jsonb
language plpgsql set search_path = '' as $$
declare trip public.trips; reason text;
begin
  -- Bắt đầu chuyến cần còn đủ điều kiện tài xế. Tài khoản ACTIVE bị thu hồi
  -- quyền tài xế vẫn được hủy/kết thúc chuyến của mình để xử lý chuyến đang có.
  perform private.require_trip_user(auth.uid(), action = 'IN_PROGRESS');
  if action = 'CANCELLED' then
    perform private.trip_object(input, array['tripId','reason'], array['tripId','reason']);
    reason := private.trip_text(input->'reason', 1, 500);
  else
    perform private.trip_object(input, array['tripId'], array['tripId']);
  end if;

  select * into trip from public.trips where id = private.trip_uuid(input->'tripId') for update;
  if not found then raise sqlstate 'PT404' using message = 'Trip not found'; end if;
  if trip.driver_id <> auth.uid() then raise sqlstate 'PT403' using message = 'Trip owner required'; end if;
  if (action = 'COMPLETED' and trip.status <> 'IN_PROGRESS')
    or (action <> 'COMPLETED' and trip.status <> 'OPEN') then
    raise sqlstate 'PT409' using message = 'Invalid trip status';
  end if;
  if action = 'COMPLETED' then
    perform private.trip_bookings_resolved(trip, true);
  end if;
  update public.trips set status = action, updated_at = now(),
    cancellation_reason = coalesce(reason, cancellation_reason)
    where id = trip.id returning * into trip;
  return jsonb_build_object('trip', private.trip_json(trip));
end;
$$;

revoke all on function private.require_trip_user(uuid,boolean), private.trip_change(jsonb,text)
  from public, anon, authenticated, service_role;
commit;
