import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { tripResponseSchemas } from '../../shared/trip-responses';

// Dựng đúng baseline lấy từ lịch sử server; chỉ dùng dữ liệu hư cấu.
const db = new PGlite();
const driver = '11111111-1111-4111-8111-111111111111';
const passenger = '22222222-2222-4222-8222-222222222222';
const tripId = '33333333-3333-4333-8333-333333333333';
const bookingId = '44444444-4444-4444-8444-444444444444';
const stopA = '55555555-5555-4555-8555-555555555555';
const stopB = '66666666-6666-4666-8666-666666666666';
let beforeData: unknown;
let beforeConstraints: unknown;
let beforeGrants: unknown;

async function rows() {
  const result = await db.query(`select jsonb_build_object(
    'users', (select jsonb_agg(to_jsonb(u) order by id) from public.users u),
    'trips', (select jsonb_agg(to_jsonb(t) - 'route_version' order by id) from public.trips t),
    'stops', (select jsonb_agg(to_jsonb(s) order by id) from public.trip_stops s),
    'bookings', (select jsonb_agg(to_jsonb(b) order by id) from public.bookings b),
    'wallets', (select jsonb_agg(to_jsonb(w) order by id) from public.wallets w),
    'payments', (select jsonb_agg(to_jsonb(p) order by id) from public.payments p),
    'entries', (select jsonb_agg(to_jsonb(e) order by id) from public.wallet_entries e)
  ) as data`);
  return result.rows;
}
async function constraints() {
  return (await db.query(`select c.conname, pg_get_constraintdef(c.oid) as definition
    from pg_constraint c join pg_namespace n on n.oid=c.connamespace
    where n.nspname='public' and c.contype='f' order by c.conname`)).rows;
}
async function grants() {
  return (await db.query(`select table_name, grantee, privilege_type
    from information_schema.role_table_grants where table_schema='public'
    order by table_name, grantee, privilege_type`)).rows;
}
beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';`);
  await db.exec(readFileSync('supabase/migrations/20261016000000_initial_schema.sql', 'utf8'));
  // Catalog server ngày 22/10 không còn CHECK này. Chỉ tái hiện trong fixture;
  // migration mới không xóa constraint nào của server hoặc baseline.
  await db.exec('alter table public.users drop constraint users_driver_eligible');
  await db.query('insert into auth.users values ($1),($2)', [driver, passenger]);
  await db.query("insert into public.users(id,display_name,roles) values($1,'Driver demo',array['USER','DRIVER']),($2,'Passenger demo',array['USER'])", [driver, passenger]);
  await db.query(`insert into public.trips(id,driver_id,departure_time,status,route_polyline,route_distance_meters,has_served_passenger)
    values($1,$2,now(),'COMPLETED','_p~iF~ps|U_ulLnnqC_mqNvxq\u0060@',1200,true)`, [tripId, driver]);
  await db.query(`insert into public.trip_stops values
    ($1,$3,0,'A',21.01,105.81,0),($2,$3,1,'B',21.02,105.82,1200)`, [stopA, stopB, tripId]);
  await db.query(`insert into public.bookings(id,trip_id,driver_id,passenger_id,pickup_stop_id,dropoff_stop_id,
    request_id,status,distance_meters,fare_points,fee_points,driver_points,confirmed_at,picked_up_at,completed_at)
    values($1,$2,$3,$4,$5,$6,'legacy','COMPLETED',1200,6000,600,5400,now(),now(),now())`,
    [bookingId, tripId, driver, passenger, stopA, stopB]);
  await db.query('update public.trips set confirmed_booking_id=$1 where id=$2', [bookingId, tripId]);
  await db.query('insert into public.payments(booking_id) values($1)', [bookingId]);
  await db.query("insert into public.wallets(user_id,kind,balance_points) values($1,'USER',1000000)", [passenger]);
  await db.query(`insert into public.wallet_entries(wallet_id,kind,delta_points)
    select id,'INITIAL_GRANT',1000000 from public.wallets where user_id=$1`, [passenger]);
  // Server đã có trigger signup ngoài lịch sử migration; chạy lại không được trùng trigger.
  await db.exec(readFileSync('supabase/migrations/20261022000200_auth_signup_existing_schema.sql', 'utf8'));
  beforeData = await rows();
  beforeConstraints = await constraints();
  beforeGrants = await grants();
  for (const file of readdirSync('supabase/migrations').filter(file => file.startsWith('20261022')).sort()) {
    await db.exec(readFileSync('supabase/migrations/' + file, 'utf8'));
  }
});
afterAll(async () => { await db.close(); });

it('áp dụng trên schema có dữ liệu: giữ 7 bảng, dữ liệu, khóa ngoại UUID và grants', async () => {
  expect(await rows()).toEqual(beforeData);
  expect(await constraints()).toEqual(beforeConstraints);
  expect(await grants()).toEqual(beforeGrants);
  const versions = await db.query<{ route_version: number }>('select route_version from public.trips');
  expect(versions.rows[0].route_version).toBe(1);
});

it('đọc chuyến cũ và khoảng cách bằng UUID; không bịa giờ đến hay thời lượng', async () => {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [passenger]);
  await db.exec('set role authenticated');
  try {
    const result = await db.query<{ value: unknown }>('select public.get_trip($1::jsonb) as value', [JSON.stringify({ tripId })]);
    const parsed = tripResponseSchemas.getTrip.parse(result.rows[0].value);
    expect(parsed.trip.arrivalTimeMs).toBeNull();
    expect(parsed.trip.route.totalDurationMs).toBeNull();
    expect(parsed.trip.stops.map(stop => stop.id)).toEqual([stopA, stopB]);
    expect(parsed.trip.confirmedBookingId).toBe(bookingId);
    const distance = await db.query<{ value: { distanceMeters: number } }>('select public.get_trip_segment_distance($1::jsonb) as value',
      [JSON.stringify({ tripId, pickupStopId: stopA, dropoffStopId: stopB })]);
    expect(distance.rows[0].value.distanceMeters).toBe(1200);
  } finally { await db.exec('reset role'); }
});
