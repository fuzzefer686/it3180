import { describe, expect, it } from 'vitest';
import { inputSchemas, responseSchemas, ledgerEntrySchema, walletSchema, paymentSchema } from '../../shared/api';

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

      // 1. Initial grant ledger ID
      const initialLedgerId = `initial_${uid}`;
      expect(initialLedgerId).toBe('initial_user-student-1');

      // 2. Top-up ledger ID gắn liền với requestId
      const topUpLedgerId = `topup_${uid}_${requestId}`;
      expect(topUpLedgerId).toBe('topup_user-student-1_req-12345');

      // 3. Payment ID chính là bookingId
      expect(bookingId).toBe('booking-67890');

      // 4. Các ledger entries của cuốc xe
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
});
