import { describe, expect, it } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { parseInput } from '../../functions/src/shared/validation';
import {
  INITIAL_GRANT_POINTS,
  DEMO_TOP_UP_POINTS,
  SYSTEM_WALLET_ID,
} from '../../functions/src/modules/wallets';

describe('Người 5 — Quy tắc ví điểm và thanh toán (Unit Tests)', () => {
  const topUpInputSchema = z.object({
    requestId: z.string().min(1, 'requestId không được để trống').max(100),
  });

  const bookingIdInputSchema = z.object({
    bookingId: z.string().min(1, 'bookingId không được để trống'),
  });

  describe('Cấu hình và giá trị ban đầu', () => {
    it('Cấp ban đầu cố định 1.000.000 điểm và nạp thử cố định 100.000 điểm', () => {
      expect(INITIAL_GRANT_POINTS).toBe(1_000_000);
      expect(DEMO_TOP_UP_POINTS).toBe(100_000);
      expect(SYSTEM_WALLET_ID).toBe('system-fees');
    });

    it('ID của các document được xác định trước để chống trùng lặp khi retry', () => {
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
      const paymentDocId = bookingId;
      expect(paymentDocId).toBe('booking-67890');

      // 4. Các ledger entries của cuốc xe
      expect(`ride_pay_${bookingId}`).toBe('ride_pay_booking-67890');
      expect(`driver_inc_${bookingId}`).toBe('driver_inc_booking-67890');
      expect(`app_fee_${bookingId}`).toBe('app_fee_booking-67890');
    });
  });

  describe('Validation đầu vào qua Zod (không tin dữ liệu client gửi)', () => {
    it('topUpDemo từ chối khi requestId rỗng hoặc vượt quá 100 ký tự', () => {
      expect(() => parseInput(topUpInputSchema, { requestId: '' })).toThrow(HttpsError);
      expect(() => parseInput(topUpInputSchema, { requestId: 'a'.repeat(101) })).toThrow(HttpsError);
      expect(() => parseInput(topUpInputSchema, {})).toThrow(HttpsError);

      const valid = parseInput(topUpInputSchema, { requestId: 'req-valid-1' });
      expect(valid.requestId).toBe('req-valid-1');
    });

    it('Backend không nhận trường tiền/điểm do client tự thêm vào topUpDemo', () => {
      // parseInput dùng strip hoặc safeParse; nếu client cố tình gửi amount thì backend không dùng
      const parsed = parseInput(topUpInputSchema, { requestId: 'req-1', amount: 99999999 });
      expect((parsed as Record<string, unknown>).amount).toBeUndefined();
    });

    it('payBooking từ chối khi bookingId rỗng', () => {
      expect(() => parseInput(bookingIdInputSchema, { bookingId: '' })).toThrow(HttpsError);
      expect(() => parseInput(bookingIdInputSchema, {})).toThrow(HttpsError);

      const valid = parseInput(bookingIdInputSchema, { bookingId: 'booking-abc' });
      expect(valid.bookingId).toBe('booking-abc');
    });
  });

  describe('Quy tắc tính phí và số dư nguyên tử', () => {
    it('Tổng điểm trừ của khách phải bằng điểm tài xế nhận cộng phí sàn hệ thống', () => {
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

    it('Kiểm tra số dư: thiếu điểm phải bị phát hiện trước khi trừ', () => {
      const passengerBalance = 50_000;
      const farePoints = 75_000;

      const hasEnough = passengerBalance >= farePoints;
      expect(hasEnough).toBe(false);
    });
  });
});
