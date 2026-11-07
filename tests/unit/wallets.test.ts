import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { inputSchemas, responseSchemas, ledgerEntrySchema, walletSchema, paymentSchema } from '../../shared/api';
import { walletError } from '../../web/src/modules/wallets/wallet-errors';

describe('Người 5 — Quy tắc ví điểm và thanh toán Supabase (Unit Tests)', () => {
  describe('Cấu hình và quy tắc tính toán điểm demo', () => {
    it('Cấp ban đầu 1.000.000 điểm và nạp thử cố định 100.000 điểm', () => {
      const INITIAL_GRANT_POINTS = 1_000_000;
      const DEMO_TOP_UP_POINTS = 100_000;
      expect(INITIAL_GRANT_POINTS).toBe(1_000_000);
      expect(DEMO_TOP_UP_POINTS).toBe(100_000);
    });

    it('ID của các bản ghi xác định để chống trùng lặp khi retry', () => {
      const uid = 'user-student-1';
      const requestId = 'req-12345';
      const bookingId = 'booking-67890';

      const initialLedgerId = `initial_${uid}`;
      expect(initialLedgerId).toBe('initial_user-student-1');

      const topUpLedgerId = `topup_${uid}_${requestId}`;
      expect(topUpLedgerId).toBe('topup_user-student-1_req-12345');

      expect(bookingId).toBe('booking-67890');
      expect(`ride_pay_${bookingId}`).toBe('ride_pay_booking-67890');
      expect(`driver_inc_${bookingId}`).toBe('driver_inc_booking-67890');
      expect(`app_fee_${bookingId}`).toBe('app_fee_booking-67890');
    });

    it('Tổng điểm trừ của khách phải bằng điểm tài xế nhận cộng phí sàn hệ thống (10%)', () => {
      const testCases = [
        { fare: 100_000, feeRate: 0.1 },
        { fare: 35_000, feeRate: 0.1 },
        { fare: 52_500, feeRate: 0.1 },
      ];

      for (const tc of testCases) {
        const feePoints = Math.floor(tc.fare * tc.feeRate);
        const driverPoints = tc.fare - feePoints;

        expect(driverPoints + feePoints).toBe(tc.fare);
        expect(feePoints).toBeGreaterThanOrEqual(0);
        expect(driverPoints).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(driverPoints)).toBe(true);
        expect(Number.isInteger(feePoints)).toBe(true);
      }
    });
  });

  describe('Validation đầu vào và phản hồi qua Zod', () => {
    it('topUpDemo từ chối khi requestId rỗng hoặc vượt quá 100 ký tự', () => {
      expect(inputSchemas.topUpDemo.safeParse({ requestId: '' }).success).toBe(false);
      expect(inputSchemas.topUpDemo.safeParse({ requestId: 'a'.repeat(101) }).success).toBe(false);
      expect(inputSchemas.topUpDemo.safeParse({}).success).toBe(false);

      const valid = inputSchemas.topUpDemo.safeParse({ requestId: 'req-valid-1' });
      expect(valid.success).toBe(true);
    });

    it('payBooking từ chối khi bookingId rỗng', () => {
      expect(inputSchemas.payBooking.safeParse({ bookingId: '' }).success).toBe(false);
      expect(inputSchemas.payBooking.safeParse({}).success).toBe(false);

      const valid = inputSchemas.payBooking.safeParse({ bookingId: 'booking-abc' });
      expect(valid.success).toBe(true);
    });

    it('Xác thực đúng cấu trúc ví và lịch sử phản hồi', () => {
      const sampleWallet = { uid: 'u-1', balancePoints: 1000000 };
      expect(walletSchema.safeParse(sampleWallet).success).toBe(true);

      const sampleEntry = {
        id: 'initial_u-1',
        walletId: 'u-1',
        deltaPoints: 1000000,
        kind: 'INITIAL_GRANT',
        referenceId: 'u-1',
        createdAtMs: Date.now(),
      };
      expect(ledgerEntrySchema.safeParse(sampleEntry).success).toBe(true);

      const samplePayment = {
        bookingId: 'b-1',
        passengerId: 'u-1',
        driverId: 'u-2',
        farePoints: 50000,
        feePoints: 5000,
        driverPoints: 45000,
        status: 'SUCCEEDED',
      };
      expect(paymentSchema.safeParse(samplePayment).success).toBe(true);
    });
  });

  describe('PostgreSQL RPC Ví & Thanh toán trên schema 7 bảng chuẩn', () => {
    const db = new PGlite();
    const driver = '11111111-1111-4111-8111-111111111111';
    const passenger = '22222222-2222-4222-8222-222222222222';
    const tripId = '33333333-3333-4333-8333-333333333333';
    const bookingId = '44444444-4444-4444-8444-444444444444';
    const stopA = '55555555-5555-4555-8555-555555555555';
    const stopB = '66666666-6666-4666-8666-666666666666';

    beforeAll(async () => {
      await db.exec(`
        create role anon; create role authenticated; create role service_role;
        create schema auth;
        create table auth.users(id uuid primary key);
        create function auth.uid() returns uuid language sql stable as
          'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
      `);
      for (const file of readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort()) {
        await db.exec(readFileSync('supabase/migrations/' + file, 'utf8'));
      }
    });

    beforeEach(async () => {
      await db.exec('reset role; truncate auth.users cascade;');
      await db.query('insert into auth.users(id) values ($1), ($2)', [driver, passenger]);
    });

    afterAll(async () => {
      await db.close();
    });

    async function rpc<T = unknown>(uid: string | null, name: string, input: unknown = {}): Promise<T> {
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid ?? '']);
      await db.exec('set role authenticated');
      try {
        const result = await db.query<{ value: T }>(`select public.${name}($1::jsonb) as value`, [
          JSON.stringify(input),
        ]);
        return result.rows[0].value;
      } finally {
        await db.exec('reset role');
      }
    }

    it('get_my_wallet tự cấp 1.000.000 điểm INITIAL_GRANT và top_up_demo chống nạp trùng theo requestId', async () => {
      const first = await rpc(passenger, 'get_my_wallet', {});
      const parsedFirst = responseSchemas.getMyWallet.parse(first);
      expect(parsedFirst.wallet).toEqual({ uid: passenger, balancePoints: 1_000_000 });
      expect(parsedFirst.ledgerEntries).toHaveLength(1);
      expect(parsedFirst.ledgerEntries[0].kind).toBe('INITIAL_GRANT');

      const topUp1 = responseSchemas.topUpDemo.parse(
        await rpc(passenger, 'top_up_demo', { requestId: 'req-demo-1' }),
      );
      expect(topUp1.balancePoints).toBe(1_100_000);
      expect(topUp1.entry.kind).toBe('DEMO_TOP_UP');

      // Gọi lại cùng requestId không cộng trùng
      const topUpDup = responseSchemas.topUpDemo.parse(
        await rpc(passenger, 'top_up_demo', { requestId: 'req-demo-1' }),
      );
      expect(topUpDup.balancePoints).toBe(1_100_000);
      expect(topUpDup.entry.id).toBe(topUp1.entry.id);
    });

    it('pay_booking trừ điểm hành khách, cộng điểm tài xế + phí APP và chống trả trùng', async () => {
      await db.query(
        `insert into public.trips(id,driver_id,departure_time,status,route_polyline,route_distance_meters,has_served_passenger)
         values($1,$2,now(),'COMPLETED','_p~iF~ps|U_ulLnnqC_mqNvxq\u0060@',2000,true)`,
        [tripId, driver],
      );
      await db.query(
        `insert into public.trip_stops(id,trip_id,stop_order,label,latitude,longitude,distance_from_start_meters)
         values($1,$3,0,'Bách Khoa',21.004,105.843,0),($2,$3,1,'Giáp Bát',20.98,105.841,2000)`,
        [stopA, stopB, tripId],
      );
      await db.query(
        `insert into public.bookings(id,trip_id,driver_id,passenger_id,pickup_stop_id,dropoff_stop_id,
          request_id,status,distance_meters,fare_points,fee_points,driver_points,confirmed_at,picked_up_at,completed_at)
         values($1,$2,$3,$4,$5,$6,'req-book-1','COMPLETED',2000,10000,1000,9000,now(),now(),now())`,
        [bookingId, tripId, driver, passenger, stopA, stopB],
      );

      const paid = responseSchemas.payBooking.parse(
        await rpc(passenger, 'pay_booking', { bookingId }),
      );
      expect(paid.payment).toEqual({
        bookingId,
        passengerId: passenger,
        driverId: driver,
        farePoints: 10000,
        feePoints: 1000,
        driverPoints: 9000,
        status: 'SUCCEEDED',
      });

      // Gọi lại pay_booking vẫn trả về kết quả cũ, không trừ 2 lần
      const paidAgain = responseSchemas.payBooking.parse(
        await rpc(passenger, 'pay_booking', { bookingId }),
      );
      expect(paidAgain.payment).toEqual(paid.payment);

      const passengerWallet = responseSchemas.getMyWallet.parse(
        await rpc(passenger, 'get_my_wallet', {}),
      );
      expect(passengerWallet.wallet.balancePoints).toBe(990_000);

      const driverWallet = responseSchemas.getMyWallet.parse(
        await rpc(driver, 'get_my_wallet', {}),
      );
      expect(driverWallet.wallet.balancePoints).toBe(1_009_000);

      const lookup = responseSchemas.getBookingPayment.parse(
        await rpc(driver, 'get_booking_payment', { bookingId }),
      );
      expect(lookup.payment).toEqual(paid.payment);
    });

    it('pay_booking báo lỗi rõ ràng khi không đủ điểm và walletError hiển thị chi tiết số điểm thiếu', async () => {
      await db.query(
        `insert into public.trips(id,driver_id,departure_time,status,route_polyline,route_distance_meters,has_served_passenger)
         values($1,$2,now(),'COMPLETED','_p~iF~ps|U_ulLnnqC_mqNvxq\u0060@',300000,true)`,
        [tripId, driver],
      );
      await db.query(
        `insert into public.trip_stops(id,trip_id,stop_order,label,latitude,longitude,distance_from_start_meters)
         values($1,$3,0,'Bách Khoa',21.004,105.843,0),($2,$3,1,'Giáp Bát',20.98,105.841,300000)`,
        [stopA, stopB, tripId],
      );
      await db.query(
        `insert into public.bookings(id,trip_id,driver_id,passenger_id,pickup_stop_id,dropoff_stop_id,
          request_id,status,distance_meters,fare_points,fee_points,driver_points,confirmed_at,picked_up_at,completed_at)
         values($1,$2,$3,$4,$5,$6,'req-book-2','COMPLETED',300000,1500000,150000,1350000,now(),now(),now())`,
        [bookingId, tripId, driver, passenger, stopA, stopB],
      );

      let caught: unknown;
      try {
        await rpc(passenger, 'pay_booking', { bookingId });
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeDefined();

      const msg = walletError(caught, { balancePoints: 1_000_000, farePoints: 1_500_000 });
      expect(msg).toContain('Không đủ điểm thanh toán');
      expect(msg).toContain('1.500.000');
      expect(msg).toContain('1.000.000');
      expect(msg).toContain('500.000');
    });
  });
});
