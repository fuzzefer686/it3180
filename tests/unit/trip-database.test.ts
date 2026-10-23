import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { TripDetails, ListTripsInput, TripListItem } from '../../shared/trips';
import { tripResponseSchemas } from '../../shared/trip-responses';
import { profileInputFixture } from '../fixtures/auth';

// Chạy SQL thật với toàn bộ migrations; Auth claims được giả lập, không gọi cloud.
const db = new PGlite();
const driver = '11111111-1111-4111-8111-111111111111';
const passenger = '22222222-2222-4222-8222-222222222222';
const admin = '33333333-3333-4333-8333-333333333333';
const stops = [
  { label: 'Hà Nội', latitude: 21.01, longitude: 105.81 },
  { label: 'Phủ Lý', latitude: 20.54, longitude: 105.91 },
  { label: 'Ninh Bình', latitude: 20.25, longitude: 105.97 },
];
const stopIds = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
const bookingId = '44444444-4444-4444-8444-444444444444';
const calculated = {
  stops: stops.map((stop, order) => ({ ...stop, id: stopIds[order], order, distanceFromStartMeters: order * 1200 })),
  route: {
    encodedPolyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@',
    provider: 'VIETMAP', vehicleType: 'MOTORCYCLE', totalDistanceMeters: 2400, totalDurationMs: 180000,
    segments: [0, 1].map(order => ({ fromStopId: stopIds[order], toStopId: stopIds[order + 1],
      distanceMeters: 1200, durationMs: 90000, encodedPolyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' })),
  },
};
function tripInput() {
  return { stops, departureTimeMs: Date.now() + 3600000, arrivalTimeMs: Date.now() + 7200000, note: 'Chuyến test' };
}

beforeAll(async () => {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
  `);
  for (const file of readdirSync('supabase/migrations').filter(file => file.endsWith('.sql')).sort()) {
    await db.exec(readFileSync('supabase/migrations/' + file, 'utf8'));
  }
});
beforeEach(async () => {
  await db.exec('reset role; truncate auth.users cascade;');
  await db.query('insert into auth.users(id) values ($1), ($2), ($3)', [driver, passenger, admin]);
  await db.query("update public.users set roles=array['USER','ADMIN'] where id=$1", [admin]);
});
afterAll(async () => { await db.close(); });

async function rpc<T = unknown>(uid: string | null, name: string, input: unknown = {}): Promise<T> {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid ?? '']);
  await db.exec('set role authenticated');
  try {
    const result = await db.query<{ value: T }>(`select public.${name}($1::jsonb) as value`, [JSON.stringify(input)]);
    return result.rows[0].value;
  } finally { await db.exec('reset role'); }
}
async function approveDriver() {
  await rpc(driver, 'update_my_profile', profileInputFixture);
  for (const kind of ['STUDENT', 'DRIVER']) {
    await rpc(admin, 'admin_review_user', { uid: driver, kind, decision: 'VERIFIED', reason: '' });
  }
}
async function save(actor = driver, input: unknown = tripInput()): Promise<TripDetails> {
  await db.exec('set role service_role');
  try {
    const result = await db.query<{ value: { trip: TripDetails } }>(
      'select public.save_trip_route($1::uuid, $2::jsonb, $3::jsonb) as value',
      [actor, JSON.stringify(input), JSON.stringify(calculated)],
    );
    return tripResponseSchemas.createTrip.parse(result.rows[0].value).trip;
  } finally { await db.exec('reset role'); }
}

async function insertBooking(trip: TripDetails, status = 'CONFIRMED') {
  await db.query(`insert into public.bookings(id, trip_id, driver_id, passenger_id,
    pickup_stop_id, dropoff_stop_id, request_id, status, distance_meters,
    fare_points, fee_points, driver_points, confirmed_at, picked_up_at)
    values($1,$2,$3,$4,$5,$6,'test-request',$7,2400,12000,1200,10800,now(),
      case when $7 = 'ONBOARD' then now() else null end)`,
    [bookingId, trip.id, driver, passenger, trip.stops[0].id, trip.stops[2].id, status]);
}

describe('Trip kết hợp migration Auth mới', () => {
  it('đăng ký tạo hồ sơ; phải duyệt sinh viên và tài xế trước khi đăng chuyến', async () => {
    await expect(save()).rejects.toMatchObject({ code: 'PT403' });
    await rpc(driver, 'update_my_profile', profileInputFixture);
    await rpc(admin, 'admin_review_user', { uid: driver, kind: 'STUDENT', decision: 'VERIFIED', reason: '' });
    await expect(save()).rejects.toMatchObject({ code: 'PT403' });
    await rpc(admin, 'admin_review_user', { uid: driver, kind: 'DRIVER', decision: 'VERIFIED', reason: '' });
    const trip = await save();
    expect(trip).toMatchObject({ driverId: driver, driverName: profileInputFixture.displayName, status: 'OPEN', routeVersion: 1 });
    expect(trip.route.totalDistanceMeters).toBe(2400);
    expect(trip).not.toHaveProperty('studentEvidenceDemo');
  });

  it('từ chối client đọc/ghi trực tiếp và giả actor_id qua RPC quản trị', async () => {
    for (const role of ['anon', 'authenticated']) {
      await db.exec('set role ' + role);
      try {
        if (role === 'anon') await expect(db.query('select * from public.trips')).rejects.toMatchObject({ code: '42501' });
        else expect((await db.query('select * from public.trips')).rows).toHaveLength(0);
        await expect(db.query("update public.trips set status='COMPLETED'")).rejects.toMatchObject({ code: '42501' });
        await expect(db.query('select public.check_trip_access($1, true)', [driver])).rejects.toMatchObject({ code: '42501' });
        await expect(db.query("select public.save_trip_route($1, '{}'::jsonb, '{}'::jsonb)", [driver])).rejects.toMatchObject({ code: '42501' });
      } finally { await db.exec('reset role'); }
    }
    await expect(rpc(null, 'list_trips')).rejects.toMatchObject({ code: 'PT401' });
  });

  it('khóa tài khoản chặn đọc/lưu/start bằng phiên cũ; đổi xe thu hồi quyền đăng', async () => {
    await approveDriver();
    const trip = await save();
    await rpc(admin, 'admin_set_user_status', { uid: driver, status: 'LOCKED' });
    await expect(save()).rejects.toMatchObject({ code: 'PT403' });
    await expect(rpc(driver, 'list_trips')).rejects.toMatchObject({ code: 'PT403' });
    await expect(rpc(driver, 'start_trip', { tripId: trip.id })).rejects.toMatchObject({ code: 'PT403' });
    await rpc(admin, 'admin_set_user_status', { uid: driver, status: 'ACTIVE' });
    await rpc(driver, 'update_my_profile', { ...profileInputFixture, vehiclePlate: 'DEMO-002' });
    await expect(save()).rejects.toMatchObject({ code: 'PT403' });
    await expect(rpc(driver, 'start_trip', { tripId: trip.id })).rejects.toMatchObject({ code: 'PT403' });
    const cancelled = await rpc<{ trip: TripDetails }>(driver, 'cancel_trip', { tripId: trip.id, reason: 'Đổi xe' });
    expect(cancelled.trip.status).toBe('CANCELLED');
  });

  it('sửa đúng chủ/version và không sửa khi đã nhận hoặc đã phục vụ khách', async () => {
    await approveDriver();
    const trip = await save();
    const input = { ...tripInput(), tripId: trip.id, routeVersion: 1, note: 'Giờ mới' };
    expect((await save(driver, input)).routeVersion).toBe(2);
    await expect(save(driver, input)).rejects.toMatchObject({ code: 'PT409' });
    await db.query("update public.users set roles=array['USER','DRIVER'], student_verification_status='VERIFIED', driver_verification_status='VERIFIED', vehicle_model='Demo', vehicle_plate='Demo' where id=$1", [passenger]);
    await expect(save(passenger, { ...input, routeVersion: 2 })).rejects.toMatchObject({ code: 'PT403' });
    await insertBooking(trip);
    await db.query('update public.trips set confirmed_booking_id=$2 where id=$1', [trip.id, bookingId]);
    await expect(save(driver, { ...input, routeVersion: 2 })).rejects.toMatchObject({ code: 'PT409' });
    await db.query('update public.trips set confirmed_booking_id=null, has_served_passenger=true where id=$1', [trip.id]);
    await expect(save(driver, { ...input, routeVersion: 2 })).rejects.toMatchObject({ code: 'PT409' });
  });

  it('Booking WAITING giữ nguyên UUID điểm dừng và chặn thay tuyến', async () => {
    await approveDriver();
    const trip = await save();
    await db.query(`insert into public.bookings(id,trip_id,driver_id,passenger_id,pickup_stop_id,dropoff_stop_id,request_id)
      values($1,$2,$3,$4,$5,$6,'waiting-test')`,
      [bookingId, trip.id, driver, passenger, trip.stops[0].id, trip.stops[2].id]);
    await expect(save(driver, { ...tripInput(), tripId: trip.id, routeVersion: 1 })).rejects.toMatchObject({ code: 'PT409' });
    const unchanged = await rpc<{ trip: TripDetails }>(passenger, 'get_trip', { tripId: trip.id });
    expect(unchanged.trip.stops).toEqual(trip.stops);
    expect(unchanged.trip.routeVersion).toBe(1);
  });

  it('chỉ chủ chuyến được đổi trạng thái và không thực hiện lặp', async () => {
    await approveDriver();
    const trip = await save();
    await expect(rpc(passenger, 'cancel_trip', { tripId: trip.id, reason: 'Giả chủ' })).rejects.toMatchObject({ code: 'PT403' });
    await expect(rpc(driver, 'complete_trip', { tripId: trip.id })).rejects.toMatchObject({ code: 'PT409' });
    await rpc(driver, 'start_trip', { tripId: trip.id });
    await expect(rpc(driver, 'start_trip', { tripId: trip.id })).rejects.toMatchObject({ code: 'PT409' });
    const completed = await rpc<{ trip: TripDetails }>(driver, 'complete_trip', { tripId: trip.id });
    expect(completed.trip.status).toBe('COMPLETED');
    await expect(rpc(driver, 'complete_trip', { tripId: trip.id })).rejects.toMatchObject({ code: 'PT409' });
  });

  it('Booking UUID: khách ONBOARD chặn kết thúc, COMPLETED giữ nguyên lịch sử', async () => {
    await approveDriver();
    const trip = await save();
    await insertBooking(trip, 'ONBOARD');
    await db.query('update public.trips set confirmed_booking_id=$2, has_served_passenger=true where id=$1', [trip.id, bookingId]);
    await rpc(driver, 'start_trip', { tripId: trip.id });
    await expect(rpc(driver, 'complete_trip', { tripId: trip.id })).rejects.toMatchObject({ code: 'PT409' });
    await db.exec("update public.bookings set status='COMPLETED', completed_at=now()");
    const result = await rpc<{ trip: TripDetails }>(driver, 'complete_trip', { tripId: trip.id });
    expect(result.trip).toMatchObject({ status: 'COMPLETED', confirmedBookingId: bookingId, hasServedPassenger: true });
  });

  it('đọc chi tiết và khoảng cách từng đoạn từ snapshot, không lộ hồ sơ riêng tư', async () => {
    await approveDriver();
    const trip = await save();
    const detail = await rpc<{ trip: TripDetails; isOwner: boolean }>(passenger, 'get_trip', { tripId: trip.id });
    expect(detail.isOwner).toBe(false);
    expect(tripResponseSchemas.getTrip.safeParse(detail).success).toBe(true);
    const input = { tripId: trip.id, pickupStopId: stopIds[0], dropoffStopId: stopIds[2] };
    expect(await rpc(passenger, 'get_trip_segment_distance', input)).toMatchObject({ distanceMeters: 2400, routeVersion: 1 });
    expect(await rpc(passenger, 'get_trip_segment_distance', { ...input, dropoffStopId: stopIds[1] })).toMatchObject({ distanceMeters: 1200 });
    await expect(rpc(passenger, 'get_trip_segment_distance', { ...input, pickupStopId: stopIds[2] })).rejects.toMatchObject({ code: 'PT400' });
  });

  it('lọc có/không dấu theo đúng thứ tự điểm, ngày Việt Nam và chuyến của tôi', async () => {
    await approveDriver();
    const trip = await save();
    async function list(input: ListTripsInput, uid = passenger) {
      return rpc<{ items: TripListItem[] }>(uid, 'list_trips', input);
    }
    expect((await list({ origin: 'ha noi', destination: 'ninh binh' })).items).toHaveLength(1);
    expect((await list({ origin: 'Ninh Bình', destination: 'Hà Nội' })).items).toHaveLength(0);
    const day = new Date(trip.departureTimeMs + 7 * 3600000).toISOString().slice(0, 10);
    expect((await list({ date: day })).items).toHaveLength(1);
    expect((await list({ date: '2000-01-01' })).items).toHaveLength(0);
    expect((await list({ mine: true })).items).toHaveLength(0);
    expect((await list({ mine: true }, driver)).items).toHaveLength(1);
  });
});
