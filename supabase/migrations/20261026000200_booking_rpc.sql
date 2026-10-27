-- Owner 4. Requires the baseline, Auth, Trip and default-verified migrations.
-- No table recreation or change to existing table grants/RLS.
-- Trip integration: cancellation cancels its single confirmed Booking atomically.
begin;

create function private.booking_lock_users(ids uuid[]) returns void
language plpgsql set search_path = '' as $$
begin
  -- All Booking writers use users (ordered) -> Trip -> Booking.
  perform id from public.users where id = any(ids) order by id for share;
end $$;

create function private.booking_user(uid uuid, eligible boolean default false, driver boolean default false)
returns public.users language plpgsql set search_path = '' as $$
declare u public.users;
begin
  if uid is null then raise sqlstate 'PT401' using message = 'Authentication required'; end if;
  select * into u from public.users where id = uid;
  if not found then raise sqlstate 'PT412' using message = 'Profile required'; end if;
  if u.status <> 'ACTIVE' then raise sqlstate 'PT403' using message = 'Account locked'; end if;
  if (eligible or driver) and u.student_verification_status <> 'VERIFIED' then
    raise sqlstate 'PT403' using message = 'Not eligible';
  end if;
  if driver and (not ('DRIVER' = any(u.roles)) or u.driver_verification_status <> 'VERIFIED'
    or nullif(btrim(u.vehicle_model), '') is null or nullif(btrim(u.vehicle_plate), '') is null) then
    raise sqlstate 'PT403' using message = 'Driver required';
  end if;
  return u;
end $$;

create function private.booking_status(b public.bookings, t public.trips, at_time timestamptz)
returns text language sql immutable set search_path = '' as $$
  select case
    when b.status in ('WAITING','CONFIRMED') and t.status = 'CANCELLED' then 'CANCELLED'
    when b.status = 'WAITING' and (t.status <> 'OPEN' or t.departure_time <= at_time) then 'EXPIRED'
    else b.status end
$$;

create function private.booking_json(b public.bookings, t public.trips, at_time timestamptz)
returns jsonb language plpgsql stable set search_path = '' as $$
declare s text := private.booking_status(b,t,at_time); caller uuid := auth.uid();
  driver public.users; passenger public.users; actions jsonb := '[]'::jsonb; can_drive boolean;
begin
  select * into driver from public.users where id=b.driver_id;
  select * into passenger from public.users where id=b.passenger_id;
  can_drive := driver.status='ACTIVE' and driver.student_verification_status='VERIFIED'
    and driver.driver_verification_status='VERIFIED' and 'DRIVER'=any(driver.roles)
    and nullif(btrim(driver.vehicle_model),'') is not null and nullif(btrim(driver.vehicle_plate),'') is not null;
  if caller=b.passenger_id and s in ('WAITING','CONFIRMED') then
    actions := actions || '"cancelBooking"'::jsonb;
  end if;
  if caller=b.driver_id then
    if s='WAITING' and t.status='OPEN' and t.departure_time>at_time then
      actions := actions || '"rejectBooking"'::jsonb;
      if can_drive and passenger.status='ACTIVE' and passenger.student_verification_status='VERIFIED'
        and t.confirmed_booking_id is null and not t.has_served_passenger then
        actions := actions || '"confirmBooking"'::jsonb;
      end if;
    end if;
    if s='CONFIRMED' and can_drive and passenger.status='ACTIVE' and passenger.student_verification_status='VERIFIED'
      and t.status='IN_PROGRESS' and t.confirmed_booking_id=b.id
      and not t.has_served_passenger then actions := actions || '"markPickup"'::jsonb; end if;
    if s='ONBOARD' and t.status='IN_PROGRESS' and t.confirmed_booking_id=b.id then
      actions := actions || '"markDropoff"'::jsonb;
    end if;
  end if;
  return jsonb_build_object(
    'id',b.id,'tripId',b.trip_id,'passengerId',b.passenger_id,'driverId',b.driver_id,
    'pickupStopId',b.pickup_stop_id,'dropoffStopId',b.dropoff_stop_id,
    'pickupLabel',(select label from public.trip_stops where id=b.pickup_stop_id),
    'dropoffLabel',(select label from public.trip_stops where id=b.dropoff_stop_id),
    'passengerName',passenger.display_name,'driverName',driver.display_name,
    'status',s,'storedStatus',b.status,'tripStatus',t.status,
    'departureTimeMs',floor(extract(epoch from t.departure_time)*1000)::bigint,
    'createdAtMs',floor(extract(epoch from b.created_at)*1000)::bigint,
    'confirmedAtMs',floor(extract(epoch from b.confirmed_at)*1000)::bigint,
    'pickedUpAtMs',floor(extract(epoch from b.picked_up_at)*1000)::bigint,
    'completedAtMs',floor(extract(epoch from b.completed_at)*1000)::bigint,
    'distanceMeters',b.distance_meters,'farePoints',b.fare_points,'feePoints',b.fee_points,
    'driverPoints',b.driver_points,'paymentMethod','DEMO_WALLET',
    'cancellationReason',case when t.status='CANCELLED' and s='CANCELLED'
      then coalesce(b.cancellation_reason,t.cancellation_reason) else b.cancellation_reason end,
    'contactPhone',case when s in ('CONFIRMED','ONBOARD') and t.status in ('OPEN','IN_PROGRESS')
      and driver.status='ACTIVE' and passenger.status='ACTIVE'
      then case when caller=b.passenger_id then driver.phone when caller=b.driver_id then passenger.phone end
      else null end,
    'paymentId',(select id from public.payments where booking_id=b.id), 'actions',actions);
end $$;

create function public.check_booking_map_access(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform private.trip_object(input,array[]::text[],array[]::text[]);
  perform private.booking_user(auth.uid(),true);
  return jsonb_build_object('allowed',true);
end $$;

create function public.get_booking(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare b public.bookings; t public.trips;
begin
  perform private.booking_user(auth.uid());
  perform private.trip_object(input,array['bookingId'],array['bookingId']);
  select * into b from public.bookings where id=private.trip_uuid(input->'bookingId')
    and auth.uid() in (passenger_id,driver_id);
  if not found then raise sqlstate 'PT404' using message='Booking not found'; end if;
  select * into t from public.trips where id=b.trip_id;
  return private.booking_json(b,t,clock_timestamp());
end $$;

create function private.booking_list(input jsonb, as_driver boolean) returns jsonb
language plpgsql set search_path = '' as $$
declare tid uuid; group_value text := 'ALL'; ct timestamptz; cid uuid; b public.bookings;
  t public.trips; items jsonb := '[]'::jsonb; next_cursor jsonb := 'null'::jsonb;
  count_rows int := 0; at_time timestamptz := clock_timestamp();
begin
  perform private.booking_user(auth.uid());
  perform private.trip_object(input,array['tripId','group','cursor'],array[]::text[]);
  if as_driver then
    tid := private.trip_uuid(input->'tripId');
    if not exists(select 1 from public.trips where id=tid and driver_id=auth.uid()) then
      raise sqlstate 'PT404' using message='Trip not found'; end if;
  elsif input ? 'tripId' then raise sqlstate 'PT400' using message='Unexpected tripId'; end if;
  if input ? 'group' then group_value := private.trip_text(input->'group',1,12); end if;
  if group_value not in ('ALL','WAITING','UPCOMING','HISTORY') then
    raise sqlstate 'PT400' using message='Invalid filter'; end if;
  if input ? 'cursor' then
    perform private.trip_object(input->'cursor',array['createdAt','id'],array['createdAt','id']);
    cid := private.trip_uuid(input->'cursor'->'id');
    begin ct := private.trip_text(input->'cursor'->'createdAt',1,64)::timestamptz;
    exception when invalid_datetime_format or datetime_field_overflow then
      raise sqlstate 'PT400' using message='Invalid cursor'; end;
    if not isfinite(ct) then raise sqlstate 'PT400' using message='Invalid cursor'; end if;
  end if;
  for b in
    select candidate.* from public.bookings candidate join public.trips tr on tr.id=candidate.trip_id
    where (case when as_driver then candidate.trip_id=tid else candidate.passenger_id=auth.uid() end)
      and (group_value='ALL'
        or (group_value='WAITING' and private.booking_status(candidate,tr,at_time)='WAITING')
        or (group_value='UPCOMING' and private.booking_status(candidate,tr,at_time) in ('CONFIRMED','ONBOARD'))
        or (group_value='HISTORY' and private.booking_status(candidate,tr,at_time) in ('COMPLETED','CANCELLED','REJECTED','EXPIRED')))
      and (ct is null or (as_driver and (candidate.created_at,candidate.id)>(ct,cid))
        or (not as_driver and (candidate.created_at,candidate.id)<(ct,cid)))
    order by case when as_driver then candidate.created_at end asc,
      case when as_driver then candidate.id end asc,
      case when not as_driver then candidate.created_at end desc,
      case when not as_driver then candidate.id end desc limit 21
  loop
    count_rows := count_rows+1;
    if count_rows>20 then exit; end if;
    select * into t from public.trips where id=b.trip_id;
    items := items || jsonb_build_array(private.booking_json(b,t,at_time));
    -- Keep full timestamp precision in the cursor, not rounded milliseconds.
    next_cursor := jsonb_build_object('createdAt',b.created_at::text,'id',b.id);
  end loop;
  if count_rows<=20 then next_cursor := 'null'::jsonb; end if;
  return jsonb_build_object('items',items,'nextCursor',next_cursor);
end $$;

create function public.list_my_bookings(input jsonb) returns jsonb
language sql security definer set search_path = '' as $$ select private.booking_list(input,false) $$;
create function public.list_trip_bookings(input jsonb) returns jsonb
language sql security definer set search_path = '' as $$ select private.booking_list(input,true) $$;

create function public.request_ride(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); tid uuid; pid uuid; did uuid; request_key text;
  t public.trips; b public.bookings; pickup public.trip_stops; dropoff public.trip_stops;
begin
  perform private.trip_object(input,array['tripId','pickupStopId','dropoffStopId','requestId'],
    array['tripId','pickupStopId','dropoffStopId','requestId']);
  perform private.booking_user(uid,true);
  tid := private.trip_uuid(input->'tripId'); pid := private.trip_uuid(input->'pickupStopId');
  did := private.trip_uuid(input->'dropoffStopId'); request_key := private.trip_text(input->'requestId',1,128);
  select * into t from public.trips where id=tid;
  if not found then raise sqlstate 'PT404' using message='Trip not found'; end if;
  perform private.booking_lock_users(array[uid,t.driver_id]);
  perform private.booking_user(uid,true);
  -- Same key on different Trips must serialize too; this is not a seat reservation.
  perform pg_advisory_xact_lock(hashtextextended(uid::text||':'||request_key,0));
  select * into b from public.bookings where passenger_id=uid and request_id=request_key;
  if found then
    if b.trip_id<>tid or b.pickup_stop_id<>pid or b.dropoff_stop_id<>did then
      raise sqlstate 'PT409' using message='Request ID used for different input'; end if;
    select * into t from public.trips where id=b.trip_id;
    return private.booking_json(b,t,clock_timestamp());
  end if;
  select * into t from public.trips where id=tid for update;
  perform private.booking_user(t.driver_id,true,true);
  if t.driver_id=uid then raise sqlstate 'PT403' using message='Cannot book own Trip'; end if;
  if t.status<>'OPEN' or t.confirmed_booking_id is not null or t.has_served_passenger
    or clock_timestamp()>=t.departure_time-interval '30 minutes' then
    raise sqlstate 'PT409' using message='Trip not accepting requests'; end if;
  select * into pickup from public.trip_stops where id=pid and trip_id=tid;
  select * into dropoff from public.trip_stops where id=did and trip_id=tid;
  if pickup.id is null or dropoff.id is null or pickup.stop_order>=dropoff.stop_order
    or dropoff.distance_from_start_meters<=pickup.distance_from_start_meters then
    raise sqlstate 'PT400' using message='Invalid pickup/dropoff'; end if;
  begin
    insert into public.bookings(trip_id,driver_id,passenger_id,pickup_stop_id,dropoff_stop_id,request_id)
      values(tid,t.driver_id,uid,pid,did,request_key) returning * into b;
  exception when unique_violation then raise sqlstate 'PT409' using message='Active request already exists'; end;
  return private.booking_json(b,t,clock_timestamp());
end $$;

create function private.booking_change(input jsonb, action text) returns jsonb
language plpgsql set search_path = '' as $$
declare uid uuid := auth.uid(); b public.bookings; t public.trips; s text;
  reason text; at_time timestamptz; meters int;
begin
  perform private.booking_user(uid);
  if action='cancelBooking' then
    perform private.trip_object(input,array['bookingId','reason'],array['bookingId','reason']);
    reason := private.trip_text(input->'reason',0,500);
  else perform private.trip_object(input,array['bookingId'],array['bookingId']); end if;
  select * into b from public.bookings where id=private.trip_uuid(input->'bookingId')
    and (case when action='cancelBooking' then passenger_id=uid else driver_id=uid end);
  if not found then raise sqlstate 'PT404' using message='Booking not found'; end if;
  perform private.booking_lock_users(array[b.passenger_id,b.driver_id]);
  perform private.booking_user(uid);
  select * into t from public.trips where id=b.trip_id for update;
  select * into b from public.bookings where id=b.id for update;
  at_time := clock_timestamp(); s := private.booking_status(b,t,at_time);
  -- Retry returns the current record without replaying timestamps/price/flags.
  if (action='cancelBooking' and b.status='CANCELLED')
    or (action='rejectBooking' and b.status='REJECTED')
    or (action='confirmBooking' and b.status in ('CONFIRMED','ONBOARD','COMPLETED'))
    or (action='markPickup' and b.status in ('ONBOARD','COMPLETED'))
    or (action='markDropoff' and b.status='COMPLETED') then
    return private.booking_json(b,t,at_time);
  end if;
  if action='cancelBooking' then
    if s not in ('WAITING','CONFIRMED') or (s='CONFIRMED' and reason='') then
      raise sqlstate 'PT409' using message='Cannot cancel Booking'; end if;
    update public.bookings set status='CANCELLED',cancellation_reason=nullif(reason,'') where id=b.id returning * into b;
    update public.trips set confirmed_booking_id=null where id=t.id and confirmed_booking_id=b.id returning * into t;
    if not found then select * into t from public.trips where id=b.trip_id; end if;
  elsif action='rejectBooking' then
    if s<>'WAITING' then raise sqlstate 'PT409' using message='Request expired or resolved'; end if;
    update public.bookings set status='REJECTED' where id=b.id returning * into b;
  elsif action='confirmBooking' then
    perform private.booking_user(uid,true,true);
    perform private.booking_user(b.passenger_id,true);
    if s<>'WAITING' or t.status<>'OPEN' or t.departure_time<=at_time
      or t.confirmed_booking_id is not null or t.has_served_passenger then
      raise sqlstate 'PT409' using message='Trip not available for confirmation'; end if;
    select d.distance_from_start_meters-p.distance_from_start_meters into meters
      from public.trip_stops p join public.trip_stops d on d.trip_id=p.trip_id
      where p.id=b.pickup_stop_id and d.id=b.dropoff_stop_id and p.trip_id=t.id and p.stop_order<d.stop_order;
    if meters is null or meters<=0 then raise sqlstate 'PT400' using message='Invalid stops'; end if;
    update public.bookings set status='CONFIRMED',distance_meters=meters,fare_points=meters::bigint*5,
      fee_points=(meters::bigint*5)/10,driver_points=meters::bigint*5-(meters::bigint*5)/10,
      confirmed_at=at_time where id=b.id returning * into b;
    update public.trips set confirmed_booking_id=b.id where id=t.id returning * into t;
  elsif action='markPickup' then
    perform private.booking_user(uid,true,true);
    perform private.booking_user(b.passenger_id,true);
    if s<>'CONFIRMED' or t.status<>'IN_PROGRESS' or t.confirmed_booking_id is distinct from b.id
      or t.has_served_passenger then raise sqlstate 'PT409' using message='Cannot pick up'; end if;
    update public.bookings set status='ONBOARD',picked_up_at=at_time where id=b.id returning * into b;
    update public.trips set has_served_passenger=true where id=t.id returning * into t;
  elsif action='markDropoff' then
    if s<>'ONBOARD' or t.status<>'IN_PROGRESS' or t.confirmed_booking_id is distinct from b.id then
      raise sqlstate 'PT409' using message='Cannot drop off'; end if;
    update public.bookings set status='COMPLETED',completed_at=at_time where id=b.id returning * into b;
  else raise sqlstate 'PT400' using message='Unknown action'; end if;
  return private.booking_json(b,t,at_time);
end $$;

create function public.confirm_booking(input jsonb) returns jsonb
language sql security definer set search_path = '' as $$ select private.booking_change(input,'confirmBooking') $$;
create function public.reject_booking(input jsonb) returns jsonb
language sql security definer set search_path = '' as $$ select private.booking_change(input,'rejectBooking') $$;
create function public.cancel_booking(input jsonb) returns jsonb
language sql security definer set search_path = '' as $$ select private.booking_change(input,'cancelBooking') $$;
create function public.mark_pickup(input jsonb) returns jsonb
language sql security definer set search_path = '' as $$ select private.booking_change(input,'markPickup') $$;
create function public.mark_dropoff(input jsonb) returns jsonb
language sql security definer set search_path = '' as $$ select private.booking_change(input,'markDropoff') $$;

-- Existing Trip RPC already locks the Trip; this trigger locks no additional users.
-- WAITING expiry/cancellation is derived on read so starting a Trip does not update a large queue.
create function private.booking_trip_cancelled() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status='CANCELLED' and old.status is distinct from new.status then
    if exists(select 1 from public.bookings where trip_id=new.id and status='ONBOARD') then
      raise sqlstate 'PT409' using message='Passenger onboard'; end if;
    update public.bookings set status='CANCELLED',cancellation_reason=new.cancellation_reason
      where trip_id=new.id and status='CONFIRMED';
    new.confirmed_booking_id := null;
  end if;
  return new;
end $$;
create trigger booking_on_trip_cancel before update of status on public.trips
  for each row execute function private.booking_trip_cancelled();

revoke all on function private.booking_lock_users(uuid[]),private.booking_user(uuid,boolean,boolean),
  private.booking_status(public.bookings,public.trips,timestamptz),
  private.booking_json(public.bookings,public.trips,timestamptz),private.booking_list(jsonb,boolean),
  private.booking_change(jsonb,text),private.booking_trip_cancelled() from public,anon,authenticated,service_role;
revoke all on function public.check_booking_map_access(jsonb),public.get_booking(jsonb),
  public.list_my_bookings(jsonb),public.list_trip_bookings(jsonb),public.request_ride(jsonb),
  public.confirm_booking(jsonb),public.reject_booking(jsonb),public.cancel_booking(jsonb),
  public.mark_pickup(jsonb),public.mark_dropoff(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.check_booking_map_access(jsonb),public.get_booking(jsonb),
  public.list_my_bookings(jsonb),public.list_trip_bookings(jsonb),public.request_ride(jsonb),
  public.confirm_booking(jsonb),public.reject_booking(jsonb),public.cancel_booking(jsonb),
  public.mark_pickup(jsonb),public.mark_dropoff(jsonb) to authenticated;
commit;
