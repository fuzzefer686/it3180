-- Owner 3: adapt Trip RPCs to the team schema 20261016000000.
-- Existing users/trips/trip_stops/bookings and their UUID foreign keys stay intact.
-- Only route_version is added, to reject saves made from an outdated edit form.
begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
alter table public.trips add column route_version integer not null default 1 check (route_version > 0);

create function private.trip_object(value jsonb, allowed text[], required text[])
returns void language plpgsql set search_path = '' as $$
begin
  if jsonb_typeof(value) is distinct from 'object' then
    raise sqlstate 'PT400' using message = 'Expected JSON object';
  end if;
  if exists(select 1 from jsonb_object_keys(value) k where not (k = any(allowed)))
     or not (value ?& required) then
    raise sqlstate 'PT400' using message = 'Unexpected or missing input field';
  end if;
end $$;

create function private.trip_number(value jsonb, minimum numeric, maximum numeric, integral boolean default false)
returns numeric language plpgsql immutable set search_path = '' as $$
declare n numeric;
begin
  if jsonb_typeof(value) is distinct from 'number' then
    raise sqlstate 'PT400' using message = 'Expected JSON number';
  end if;
  n := value::text::numeric;
  if n < minimum or n > maximum or (integral and n <> trunc(n)) then
    raise sqlstate 'PT400' using message = 'Number out of range';
  end if;
  return n;
end $$;

create function private.trip_text(value jsonb, minimum integer, maximum integer)
returns text language plpgsql immutable set search_path = '' as $$
declare s text;
begin
  if jsonb_typeof(value) is distinct from 'string' then
    raise sqlstate 'PT400' using message = 'Expected JSON string';
  end if;
  s := btrim(value #>> '{}');
  if length(s) < minimum or length(s) > maximum then
    raise sqlstate 'PT400' using message = 'Text length out of range';
  end if;
  return s;
end $$;

create function private.trip_uuid(value jsonb) returns uuid
language plpgsql immutable set search_path = '' as $$
begin
  return private.trip_text(value, 36, 36)::uuid;
exception when invalid_text_representation then
  raise sqlstate 'PT400' using message = 'Invalid UUID';
end $$;

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

create function public.check_trip_access(actor_id uuid, require_driver boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if require_driver is null then raise sqlstate 'PT400' using message = 'require_driver required'; end if;
  return private.require_trip_user(actor_id, require_driver);
end $$;

-- API DTO is assembled from the existing relational tables, not duplicate JSON columns.
create function private.trip_json(t public.trips) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', t.id, 'driverId', t.driver_id,
    'driverName', (select display_name from public.users where id = t.driver_id),
    'departureTimeMs', (extract(epoch from t.departure_time)*1000)::bigint,
    'arrivalTimeMs', (extract(epoch from t.estimated_arrival_time)*1000)::bigint,
    'status', t.status, 'vehicleType', 'MOTORCYCLE',
    'stops', coalesce((select jsonb_agg(jsonb_build_object(
      'id', s.id, 'label', s.label, 'order', s.stop_order,
      'latitude', s.latitude, 'longitude', s.longitude,
      'distanceFromStartMeters', s.distance_from_start_meters) order by s.stop_order)
      from public.trip_stops s where s.trip_id = t.id), '[]'::jsonb),
    'confirmedBookingId', t.confirmed_booking_id, 'hasServedPassenger', t.has_served_passenger,
    'note', coalesce(t.note, ''), 'routeVersion', t.route_version,
    'route', jsonb_build_object('provider', 'VIETMAP', 'vehicleType', 'MOTORCYCLE',
      'encodedPolyline', t.route_polyline, 'totalDistanceMeters', t.route_distance_meters,
      'totalDurationMs', null,
      'segments', coalesce((select jsonb_agg(jsonb_build_object(
        'fromStopId', s.id, 'toStopId', s.next_id,
        'distanceMeters', s.next_distance - s.distance_from_start_meters,
        'durationMs', null) order by s.stop_order)
        from (select id, stop_order, distance_from_start_meters,
          lead(id) over (order by stop_order) next_id,
          lead(distance_from_start_meters) over (order by stop_order) next_distance
          from public.trip_stops where trip_id = t.id) s
        where s.next_id is not null), '[]'::jsonb)),
    'cancellationReason', t.cancellation_reason)
$$;

create function private.trip_bookings_resolved(t public.trips, check_pointer boolean)
returns void language plpgsql set search_path = '' as $$
begin
  if exists(select 1 from public.bookings where trip_id = t.id and status in ('CONFIRMED','ONBOARD')) then
    raise sqlstate 'PT409' using message = 'Passenger unresolved';
  end if;
  if check_pointer and t.confirmed_booking_id is not null and not exists(
    select 1 from public.bookings where id = t.confirmed_booking_id and trip_id = t.id
      and status in ('COMPLETED','CANCELLED','REJECTED','EXPIRED')
  ) then
    raise sqlstate 'PT409' using message = 'Booking pointer unresolved';
  end if;
  if t.has_served_passenger and not exists(
    select 1 from public.bookings where trip_id = t.id and status = 'COMPLETED'
  ) then
    raise sqlstate 'PT409' using message = 'Passenger history unresolved';
  end if;
end $$;

create function public.save_trip_route(actor_id uuid, input jsonb, calculated jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  profile jsonb; t public.trips; departure numeric; arrival numeric;
  source_stop jsonb; stop jsonb; segment jsonb; route jsonb; stops jsonb;
  n integer; i integer; distance numeric := 0; duration numeric := 0;
  ids text[] := array[]::text[]; stop_id text; previous_stop jsonb;
begin
  profile := private.require_trip_user(actor_id, true);
  perform private.trip_object(input,
    array['stops','departureTimeMs','arrivalTimeMs','note','tripId','routeVersion'],
    array['stops','departureTimeMs','arrivalTimeMs','note']);
  if (input ? 'tripId') <> (input ? 'routeVersion') then
    raise sqlstate 'PT400' using message = 'Update requires tripId and routeVersion';
  end if;
  perform private.trip_object(calculated, array['stops','route'], array['stops','route']);
  departure := private.trip_number(input->'departureTimeMs', 0, 8640000000000000, true);
  arrival := private.trip_number(input->'arrivalTimeMs', 0, 8640000000000000, true);
  if departure <= extract(epoch from clock_timestamp())*1000 or arrival <= departure then
    raise sqlstate 'PT400' using message = 'Departure must be future; arrival must be later';
  end if;
  perform private.trip_text(input->'note', 0, 1000);
  stops := calculated->'stops'; route := calculated->'route';
  if jsonb_typeof(input->'stops') is distinct from 'array'
     or jsonb_typeof(stops) is distinct from 'array' then
    raise sqlstate 'PT400' using message = 'Stops must be arrays';
  end if;
  n := jsonb_array_length(stops);
  if n < 2 or n > 8 or n <> jsonb_array_length(input->'stops') then
    raise sqlstate 'PT400' using message = 'Expected 2 to 8 matching stops';
  end if;
  perform private.trip_object(route,
    array['provider','vehicleType','segments','totalDistanceMeters','totalDurationMs','encodedPolyline'],
    array['provider','vehicleType','segments','totalDistanceMeters','totalDurationMs','encodedPolyline']);
  if route->>'provider' is distinct from 'VIETMAP' or route->>'vehicleType' is distinct from 'MOTORCYCLE'
     or jsonb_typeof(route->'segments') is distinct from 'array' then
    raise sqlstate 'PT400' using message = 'Invalid route provider, vehicle or segments';
  end if;
  if jsonb_array_length(route->'segments') <> n-1 then
    raise sqlstate 'PT400' using message = 'Route segment count mismatch';
  end if;
  perform private.trip_text(route->'encodedPolyline', 1, 600000);
  for i in 0..n-1 loop
    source_stop := input->'stops'->i; stop := stops->i;
    perform private.trip_object(source_stop, array['label','latitude','longitude'], array['label','latitude','longitude']);
    perform private.trip_object(stop,
      array['id','label','order','latitude','longitude','distanceFromStartMeters'],
      array['id','label','order','latitude','longitude','distanceFromStartMeters']);
    stop_id := private.trip_uuid(stop->'id')::text;
    if stop_id !~ '^[a-zA-Z0-9_-]+$' or stop_id = any(ids) then
      raise sqlstate 'PT400' using message = 'Stop IDs must be unique';
    end if;
    ids := array_append(ids, stop_id);
    perform private.trip_text(source_stop->'label', 1, 300);
    perform private.trip_number(source_stop->'latitude', 8, 24);
    perform private.trip_number(source_stop->'longitude', 102, 110);
    if stop->'label' is distinct from source_stop->'label'
       or stop->'latitude' is distinct from source_stop->'latitude'
       or stop->'longitude' is distinct from source_stop->'longitude'
       or private.trip_number(stop->'order', 0, 7, true) <> i then
      raise sqlstate 'PT400' using message = 'Calculated stop does not match input';
    end if;
    if i > 0 then
      if stop->'latitude' = previous_stop->'latitude' and stop->'longitude' = previous_stop->'longitude' then
        raise sqlstate 'PT400' using message = 'Adjacent stops must differ';
      end if;
      segment := route->'segments'->(i-1);
      perform private.trip_object(segment,
        array['fromStopId','toStopId','distanceMeters','durationMs','encodedPolyline'],
        array['fromStopId','toStopId','distanceMeters','durationMs','encodedPolyline']);
      if segment->>'fromStopId' is distinct from previous_stop->>'id'
         or segment->>'toStopId' is distinct from stop_id then
        raise sqlstate 'PT400' using message = 'Segment endpoints mismatch';
      end if;
      distance := distance + private.trip_number(segment->'distanceMeters', 1, 10000000, true);
      duration := duration + private.trip_number(segment->'durationMs', 0, 864000000);
      perform private.trip_text(segment->'encodedPolyline', 1, 200000);
    end if;
    if abs(private.trip_number(stop->'distanceFromStartMeters', 0, 70000000, true) - distance) > 0.000001 then
      raise sqlstate 'PT400' using message = 'Cumulative stop distance mismatch';
    end if;
    previous_stop := stop;
  end loop;
  if abs(private.trip_number(route->'totalDistanceMeters', 0.000001, 70000000) - distance) > 0.000001
     or abs(private.trip_number(route->'totalDurationMs', 0, 6048000000) - duration) > 0.000001 then
    raise sqlstate 'PT400' using message = 'Route totals mismatch';
  end if;
  if input ? 'tripId' then
    select * into t from public.trips where id = private.trip_uuid(input->'tripId') for update;
    if not found then raise sqlstate 'PT404' using message = 'Trip not found'; end if;
    if t.driver_id <> actor_id then raise sqlstate 'PT403' using message = 'Trip owner required'; end if;
    if t.status <> 'OPEN' or t.confirmed_booking_id is not null or t.has_served_passenger then
      raise sqlstate 'PT409' using message = 'Trip not editable';
    end if;
    if t.route_version <> private.trip_number(input->'routeVersion', 1, 2147483646, true) then
      raise sqlstate 'PT409' using message = 'Trip route version changed';
    end if;
    perform private.trip_bookings_resolved(t, false);
    -- Booking points reference stop UUIDs. Do not replace stops used by any booking,
    -- including cancelled/history rows, or silently change an existing request's route.
    if exists(select 1 from public.bookings where trip_id = t.id) then
      raise sqlstate 'PT409' using message = 'Trip with booking history is not editable';
    end if;
    update public.trips set route_polyline = route->>'encodedPolyline',
      route_distance_meters = distance::integer,
      departure_time = to_timestamp(departure::double precision/1000),
      estimated_arrival_time = to_timestamp(arrival::double precision/1000),
      note = btrim(input->>'note'), route_version = route_version+1
      where id = t.id returning * into t;
    delete from public.trip_stops where trip_id = t.id;
  else
    insert into public.trips(driver_id, departure_time, estimated_arrival_time,
      route_polyline, route_distance_meters, note)
    values(actor_id, to_timestamp(departure::double precision/1000),
      to_timestamp(arrival::double precision/1000), route->>'encodedPolyline', distance::integer,
      btrim(input->>'note')) returning * into t;
  end if;
  for i in 0..n-1 loop
    stop := stops->i;
    insert into public.trip_stops(id, trip_id, stop_order, label, latitude, longitude, distance_from_start_meters)
    values((stop->>'id')::uuid, t.id, i, stop->>'label', (stop->>'latitude')::double precision,
      (stop->>'longitude')::double precision, (stop->>'distanceFromStartMeters')::integer);
  end loop;
  return jsonb_build_object('trip', private.trip_json(t));
end $$;

create function public.get_trip(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t public.trips;
begin
  perform private.require_trip_user(auth.uid(), false);
  perform private.trip_object(input, array['tripId'], array['tripId']);
  select * into t from public.trips where id = private.trip_uuid(input->'tripId') for share;
  if not found then raise sqlstate 'PT404' using message = 'Trip not found'; end if;
  return jsonb_build_object('trip', private.trip_json(t), 'isOwner', t.driver_id = auth.uid());
end $$;

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
  if action = 'CANCELLED' and exists(select 1 from public.bookings where trip_id = trip.id and status = 'ONBOARD') then
    raise sqlstate 'PT409' using message = 'Cannot cancel with passenger onboard';
  end if;
  if action = 'COMPLETED' then
    perform private.trip_bookings_resolved(trip, true);
  end if;
  update public.trips set status = action,
    cancellation_reason = coalesce(reason, cancellation_reason)
    where id = trip.id returning * into trip;
  return jsonb_build_object('trip', private.trip_json(trip));
end;
$$;

create function public.start_trip(input jsonb) returns jsonb
language sql security definer set search_path = '' as $$ select private.trip_change(input, 'IN_PROGRESS') $$;
create function public.complete_trip(input jsonb) returns jsonb
language sql security definer set search_path = '' as $$ select private.trip_change(input, 'COMPLETED') $$;
create function public.cancel_trip(input jsonb) returns jsonb
language sql security definer set search_path = '' as $$ select private.trip_change(input, 'CANCELLED') $$;

create function public.get_trip_segment_distance(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t public.trips; pickup public.trip_stops; dropoff public.trip_stops;
begin
  perform private.require_trip_user(auth.uid(), false);
  perform private.trip_object(input, array['tripId','pickupStopId','dropoffStopId'], array['tripId','pickupStopId','dropoffStopId']);
  select * into t from public.trips where id = private.trip_uuid(input->'tripId') for share;
  if not found then raise sqlstate 'PT404' using message = 'Trip not found'; end if;
  select * into pickup from public.trip_stops where trip_id = t.id and id = private.trip_uuid(input->'pickupStopId');
  select * into dropoff from public.trip_stops where trip_id = t.id and id = private.trip_uuid(input->'dropoffStopId');
  if pickup.id is null or dropoff.id is null or pickup.stop_order >= dropoff.stop_order then
    raise sqlstate 'PT400' using message = 'Dropoff must follow pickup';
  end if;
  return jsonb_build_object('tripId', t.id, 'routeVersion', t.route_version,
    'distanceMeters', dropoff.distance_from_start_meters - pickup.distance_from_start_meters);
end $$;

-- NFD removes combining accents without depending on extensions.unaccent.
create function private.trip_place(value text) returns text language sql immutable set search_path = '' as $$
  select translate(regexp_replace(normalize(lower(btrim(value)), NFD), U&'[\0300-\036f]', '', 'g'), 'đ', 'd')
$$;
create function public.list_trips(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  origin text := ''; destination text := ''; mine boolean := false; day date;
  cursor_time timestamptz; cursor_id uuid; items jsonb; next_cursor jsonb := 'null'::jsonb;
  rows public.trips[]; t public.trips; count_rows integer;
begin
  perform private.require_trip_user(auth.uid(), false);
  perform private.trip_object(input, array['origin','destination','date','mine','cursor'], array[]::text[]);
  if input ? 'origin' then origin := private.trip_place(private.trip_text(input->'origin', 0, 120)); end if;
  if input ? 'destination' then destination := private.trip_place(private.trip_text(input->'destination', 0, 120)); end if;
  if input ? 'mine' then
    if jsonb_typeof(input->'mine') <> 'boolean' then raise sqlstate 'PT400' using message = 'mine must be boolean'; end if;
    mine := (input->>'mine')::boolean;
  end if;
  if input ? 'date' then
    if private.trip_text(input->'date', 10, 10) !~ '^\d{4}-\d{2}-\d{2}$' then
      raise sqlstate 'PT400' using message = 'Invalid date';
    end if;
    begin day := (input->>'date')::date;
    exception when invalid_datetime_format or datetime_field_overflow then
      raise sqlstate 'PT400' using message = 'Invalid date'; end;
  end if;
  if input ? 'cursor' then
    perform private.trip_object(input->'cursor', array['departureTimeMs','id'], array['departureTimeMs','id']);
    cursor_time := to_timestamp(private.trip_number(input->'cursor'->'departureTimeMs',0,8640000000000000,true)::double precision/1000);
    cursor_id := private.trip_uuid(input->'cursor'->'id');
  end if;
  select array_agg(q::public.trips order by q.departure_time, q.id) into rows from (
    select candidate.* from public.trips candidate
    where (case when mine then candidate.driver_id = auth.uid() else candidate.status = 'OPEN' and candidate.departure_time > now() end)
      and (day is null or (candidate.departure_time >= (day::timestamp at time zone 'Asia/Ho_Chi_Minh')
        and candidate.departure_time < ((day+1)::timestamp at time zone 'Asia/Ho_Chi_Minh')))
      and (cursor_time is null or (candidate.departure_time,candidate.id) > (cursor_time,cursor_id))
      and exists(select 1 from public.trip_stops a, public.trip_stops b
        where a.trip_id = candidate.id and b.trip_id = candidate.id and a.stop_order < b.stop_order
          and strpos(private.trip_place(a.label), origin) > 0
          and strpos(private.trip_place(b.label), destination) > 0)
    order by candidate.departure_time,candidate.id limit 21
  ) q;
  count_rows := coalesce(cardinality(rows), 0); items := '[]'::jsonb;
  for i in 1..least(count_rows,20) loop
    t := rows[i];
    items := items || jsonb_build_array(jsonb_build_object('id',t.id,'driverName',(select display_name from public.users where id = t.driver_id),
      'departureTimeMs',(extract(epoch from t.departure_time)*1000)::bigint,
      'arrivalTimeMs',(extract(epoch from t.estimated_arrival_time)*1000)::bigint,'status',t.status,
      'stopLabels',(select jsonb_agg(s.label order by s.stop_order) from public.trip_stops s where s.trip_id = t.id),
      'totalDistanceMeters',t.route_distance_meters,
      'hasPassenger',t.confirmed_booking_id is not null or t.has_served_passenger));
  end loop;
  if count_rows > 20 then
    t := rows[20]; next_cursor := jsonb_build_object('departureTimeMs',(extract(epoch from t.departure_time)*1000)::bigint,'id',t.id);
  end if;
  return jsonb_build_object('items',items,'nextCursor',next_cursor);
end $$;

revoke all on function private.trip_object(jsonb,text[],text[]), private.trip_number(jsonb,numeric,numeric,boolean),
  private.trip_text(jsonb,integer,integer), private.trip_uuid(jsonb), private.require_trip_user(uuid,boolean),
  private.trip_json(public.trips), private.trip_bookings_resolved(public.trips,boolean),
  private.trip_change(jsonb,text), private.trip_place(text) from public, anon, authenticated, service_role;
revoke all on function public.check_trip_access(uuid,boolean), public.save_trip_route(uuid,jsonb,jsonb)
  from public, anon, authenticated;
grant execute on function public.check_trip_access(uuid,boolean), public.save_trip_route(uuid,jsonb,jsonb) to service_role;
revoke all on function public.list_trips(jsonb), public.get_trip(jsonb), public.start_trip(jsonb),
  public.complete_trip(jsonb), public.cancel_trip(jsonb), public.get_trip_segment_distance(jsonb) from public, anon;
grant execute on function public.list_trips(jsonb), public.get_trip(jsonb), public.start_trip(jsonb),
  public.complete_trip(jsonb), public.cancel_trip(jsonb), public.get_trip_segment_distance(jsonb) to authenticated;
commit;
