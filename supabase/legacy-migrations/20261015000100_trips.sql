-- Owner 3. No dependency tables are created here.
-- Owner 2 contract: users(uid uuid, display_name text, roles text[], status text,
-- student_verification_status text); driver_profiles(user_id uuid, status text,
-- vehicle_id uuid); vehicles(id uuid, owner_id uuid, vehicle_type text).
-- Existing server contract: bookings(id text, trip_id text, status text). Confirm/pickup/
-- dropoff must lock trips FIRST, then booking rows, in the same transaction.
-- Edge verifies auth.getUser(token), computes VietMap route, then calls service
-- RPCs with actor_id. Never forward calculated from a browser request.
begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null,
  driver_name text not null,
  departure_time timestamptz not null,
  arrival_time timestamptz not null check (arrival_time > departure_time),
  status text not null default 'OPEN' check (status in ('OPEN','IN_PROGRESS','COMPLETED','CANCELLED')),
  vehicle_type text not null default 'MOTORCYCLE' check (vehicle_type = 'MOTORCYCLE'),
  stops jsonb not null check (jsonb_typeof(stops) = 'array'),
  route jsonb not null check (jsonb_typeof(route) = 'object'),
  note text not null check (length(note) <= 1000),
  route_version integer not null default 1 check (route_version > 0),
  confirmed_booking_id text,
  has_served_passenger boolean not null default false,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index trips_departure_id on public.trips(departure_time, id);
create index trips_driver_departure_id on public.trips(driver_id, departure_time, id);
alter table public.trips enable row level security;
revoke all on public.trips from public, anon, authenticated;
-- Booking service transactions need table access; ordinary clients use RPC only.
grant select, insert, update, delete on public.trips to service_role;

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

-- Explicit contract, not get_my_profile(): service_role has no auth.uid().
-- FOR SHARE prevents status/role/vehicle revocation until the save commits.
create function private.require_trip_user(uid uuid, driver boolean)
returns jsonb language plpgsql set search_path = '' as $$
declare u record; d record; v record;
begin
  if uid is null then raise sqlstate 'PT401' using message = 'Authentication required'; end if;
  execute 'select uid, display_name, roles, status, student_verification_status
           from public.users where uid = $1 for share' into u using uid;
  if u.uid is null or u.display_name is null or btrim(u.display_name) = ''
     or u.roles is null or cardinality(u.roles) = 0
     or not (u.roles <@ array['USER','DRIVER','ADMIN']::text[])
     or array_position(u.roles, null) is not null
     or u.status is distinct from 'ACTIVE'
     or u.student_verification_status is null
     or u.student_verification_status not in ('PENDING','VERIFIED','REJECTED') then
    raise sqlstate 'PT403' using message = 'Active valid profile required';
  end if;
  if driver then
    if not ('DRIVER' = any(u.roles)) or u.student_verification_status <> 'VERIFIED' then
      raise sqlstate 'PT403' using message = 'Verified driver required';
    end if;
    execute 'select user_id, status, vehicle_id from public.driver_profiles
             where user_id = $1 for share' into d using uid;
    if d.user_id is null or d.status is distinct from 'VERIFIED' or d.vehicle_id is null then
      raise sqlstate 'PT403' using message = 'Verified driver profile required';
    end if;
    execute 'select id, owner_id, vehicle_type from public.vehicles
             where id = $1 for share' into v using d.vehicle_id;
    if v.id is null or v.owner_id is distinct from uid or v.vehicle_type is distinct from 'MOTORCYCLE' then
      raise sqlstate 'PT403' using message = 'Owned motorcycle required';
    end if;
  end if;
  return jsonb_build_object('uid', u.uid, 'displayName', u.display_name,
    'roles', u.roles, 'status', u.status, 'studentVerificationStatus', u.student_verification_status);
exception when undefined_table or undefined_column or datatype_mismatch or undefined_function then
  raise sqlstate 'PT412' using message = 'Owner 2 profile/driver/vehicle contract unavailable';
end $$;

create function public.check_trip_access(actor_id uuid, require_driver boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if require_driver is null then raise sqlstate 'PT400' using message = 'require_driver required'; end if;
  return private.require_trip_user(actor_id, require_driver);
end $$;

create function private.trip_json(t public.trips) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('id', t.id, 'driverId', t.driver_id, 'driverName', t.driver_name,
    'departureTimeMs', (extract(epoch from t.departure_time)*1000)::bigint,
    'arrivalTimeMs', (extract(epoch from t.arrival_time)*1000)::bigint,
    'status', t.status, 'vehicleType', t.vehicle_type, 'stops', t.stops,
    'confirmedBookingId', t.confirmed_booking_id, 'hasServedPassenger', t.has_served_passenger,
    'note', t.note, 'routeVersion', t.route_version, 'route', t.route,
    'cancellationReason', t.cancellation_reason)
$$;

-- Caller already holds the trip lock. Missing booking infrastructure is safe only
-- for a trip with no passenger history and no pointer. Never clear passenger flags.
create function private.trip_bookings_resolved(t public.trips, check_pointer boolean)
returns void language plpgsql set search_path = '' as $$
declare unresolved boolean; booking_status text;
begin
  if to_regclass('public.bookings') is null then
    if t.confirmed_booking_id is not null or t.has_served_passenger then
      raise sqlstate 'PT412' using message = 'Booking contract required for passenger trip';
    end if;
    return;
  end if;
  execute 'select exists(select 1 from public.bookings where trip_id = $1
           and status in (''CONFIRMED'',''ONBOARD''))' into unresolved using t.id::text;
  if unresolved then raise sqlstate 'PT409' using message = 'Passenger unresolved'; end if;
  if check_pointer and t.confirmed_booking_id is not null then
    execute 'select status from public.bookings where id = $1 and trip_id = $2'
      into booking_status using t.confirmed_booking_id, t.id::text;
    if booking_status is null or booking_status not in ('COMPLETED','CANCELLED') then
      raise sqlstate 'PT409' using message = 'Passenger booking unresolved or missing';
    end if;
  elsif check_pointer and t.has_served_passenger then
    -- A served trip must have a completed record even if a pointer was lost.
    execute 'select exists(select 1 from public.bookings where trip_id = $1
             and status = ''COMPLETED'')' into unresolved using t.id::text;
    if not unresolved then raise sqlstate 'PT409' using message = 'Passenger history missing'; end if;
  end if;
exception when undefined_column or datatype_mismatch or undefined_function then
  raise sqlstate 'PT412' using message = 'Owner 4 booking contract unavailable';
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
    array['provider','vehicleType','segments','totalDistanceMeters','totalDurationMs'],
    array['provider','vehicleType','segments','totalDistanceMeters','totalDurationMs']);
  if route->>'provider' is distinct from 'VIETMAP' or route->>'vehicleType' is distinct from 'MOTORCYCLE'
     or jsonb_typeof(route->'segments') is distinct from 'array' then
    raise sqlstate 'PT400' using message = 'Invalid route provider, vehicle or segments';
  end if;
  if jsonb_array_length(route->'segments') <> n-1 then
    raise sqlstate 'PT400' using message = 'Route segment count mismatch';
  end if;
  for i in 0..n-1 loop
    source_stop := input->'stops'->i; stop := stops->i;
    perform private.trip_object(source_stop, array['label','latitude','longitude'], array['label','latitude','longitude']);
    perform private.trip_object(stop,
      array['id','label','order','latitude','longitude','distanceFromStartMeters'],
      array['id','label','order','latitude','longitude','distanceFromStartMeters']);
    stop_id := private.trip_text(stop->'id', 1, 128);
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
      distance := distance + private.trip_number(segment->'distanceMeters', 0.000001, 10000000);
      duration := duration + private.trip_number(segment->'durationMs', 0, 864000000);
      perform private.trip_text(segment->'encodedPolyline', 1, 200000);
    end if;
    if abs(private.trip_number(stop->'distanceFromStartMeters', 0, 70000000) - distance) > 0.000001 then
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
    update public.trips set driver_name = profile->>'displayName', stops = calculated->'stops',
      route = calculated->'route', departure_time = to_timestamp(departure::double precision/1000),
      arrival_time = to_timestamp(arrival::double precision/1000), note = btrim(input->>'note'),
      route_version = route_version+1, updated_at = now() where id = t.id returning * into t;
  else
    insert into public.trips(driver_id, driver_name, departure_time, arrival_time, stops, route, note)
    values(actor_id, profile->>'displayName', to_timestamp(departure::double precision/1000),
      to_timestamp(arrival::double precision/1000), stops, route, btrim(input->>'note')) returning * into t;
  end if;
  return jsonb_build_object('trip', private.trip_json(t));
end $$;

create function public.get_trip(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t public.trips;
begin
  perform private.require_trip_user(auth.uid(), false);
  perform private.trip_object(input, array['tripId'], array['tripId']);
  select * into t from public.trips where id = private.trip_uuid(input->'tripId');
  if not found then raise sqlstate 'PT404' using message = 'Trip not found'; end if;
  return jsonb_build_object('trip', private.trip_json(t), 'isOwner', t.driver_id = auth.uid());
end $$;

create function private.trip_change(input jsonb, action text) returns jsonb
language plpgsql set search_path = '' as $$
declare t public.trips; reason text;
begin
  perform private.require_trip_user(auth.uid(), false);
  if action = 'CANCELLED' then
    perform private.trip_object(input, array['tripId','reason'], array['tripId','reason']);
    reason := private.trip_text(input->'reason', 1, 500);
  else perform private.trip_object(input, array['tripId'], array['tripId']); end if;
  select * into t from public.trips where id = private.trip_uuid(input->'tripId') for update;
  if not found then raise sqlstate 'PT404' using message = 'Trip not found'; end if;
  if t.driver_id <> auth.uid() then raise sqlstate 'PT403' using message = 'Trip owner required'; end if;
  if (action = 'COMPLETED' and t.status <> 'IN_PROGRESS')
     or (action <> 'COMPLETED' and t.status <> 'OPEN') then
    raise sqlstate 'PT409' using message = 'Invalid trip status';
  end if;
  if action = 'COMPLETED' then perform private.trip_bookings_resolved(t, true); end if;
  update public.trips set status = action, updated_at = now(),
    cancellation_reason = coalesce(reason, cancellation_reason) where id = t.id returning * into t;
  return jsonb_build_object('trip', private.trip_json(t));
end $$;
create function public.start_trip(input jsonb) returns jsonb
language sql security definer set search_path = '' as $$ select private.trip_change(input, 'IN_PROGRESS') $$;
create function public.complete_trip(input jsonb) returns jsonb
language sql security definer set search_path = '' as $$ select private.trip_change(input, 'COMPLETED') $$;
create function public.cancel_trip(input jsonb) returns jsonb
language sql security definer set search_path = '' as $$ select private.trip_change(input, 'CANCELLED') $$;

create function public.get_trip_segment_distance(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t public.trips; pickup jsonb; dropoff jsonb;
begin
  perform private.require_trip_user(auth.uid(), false);
  perform private.trip_object(input, array['tripId','pickupStopId','dropoffStopId'], array['tripId','pickupStopId','dropoffStopId']);
  perform private.trip_text(input->'pickupStopId', 1, 128);
  perform private.trip_text(input->'dropoffStopId', 1, 128);
  select * into t from public.trips where id = private.trip_uuid(input->'tripId');
  if not found then raise sqlstate 'PT404' using message = 'Trip not found'; end if;
  select s into pickup from jsonb_array_elements(t.stops) s where s->>'id' = input->>'pickupStopId';
  select s into dropoff from jsonb_array_elements(t.stops) s where s->>'id' = input->>'dropoffStopId';
  if pickup is null or dropoff is null or (pickup->>'order')::integer >= (dropoff->>'order')::integer then
    raise sqlstate 'PT400' using message = 'Dropoff must follow pickup';
  end if;
  return jsonb_build_object('tripId', t.id, 'routeVersion', t.route_version,
    'distanceMeters', (dropoff->>'distanceFromStartMeters')::numeric - (pickup->>'distanceFromStartMeters')::numeric);
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
      and exists(select 1 from jsonb_array_elements(candidate.stops) a, jsonb_array_elements(candidate.stops) b
        where (a->>'order')::integer < (b->>'order')::integer
          and strpos(private.trip_place(a->>'label'), origin) > 0
          and strpos(private.trip_place(b->>'label'), destination) > 0)
    order by candidate.departure_time,candidate.id limit 21
  ) q;
  count_rows := coalesce(cardinality(rows), 0); items := '[]'::jsonb;
  for i in 1..least(count_rows,20) loop
    t := rows[i];
    items := items || jsonb_build_array(jsonb_build_object('id',t.id,'driverName',t.driver_name,
      'departureTimeMs',(extract(epoch from t.departure_time)*1000)::bigint,
      'arrivalTimeMs',(extract(epoch from t.arrival_time)*1000)::bigint,'status',t.status,
      'stopLabels',(select jsonb_agg(s->'label' order by (s->>'order')::integer) from jsonb_array_elements(t.stops) s),
      'totalDistanceMeters',t.route->'totalDistanceMeters',
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
