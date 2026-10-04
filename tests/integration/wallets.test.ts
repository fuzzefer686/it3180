import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initializeApp as initializeAdminApp, deleteApp as deleteAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, terminate } from 'firebase/firestore';
import type { Booking, LedgerEntry, Payment, Wallet } from '../../shared/contracts';

const projectId = 'demo-vecung';
if (
  process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080' ||
  process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099'
) {
  throw new Error('Chạy npm run test:integration; test chỉ được chạy với Emulator.');
}

const adminApp = initializeAdminApp({ projectId }, 'integration-admin-wallets');
const db = getAdminFirestore(adminApp);
const adminAuth = getAdminAuth(adminApp);

const webApp = initializeApp({ apiKey: 'demo-api-key', projectId }, 'integration-client-wallets');
const auth = getAuth(webApp);
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
const clientDb = getFirestore(webApp);
connectFirestoreEmulator(clientDb, '127.0.0.1', 8080);

const testPassword = 'Password!2026';

async function call(name: string, data: unknown = {}, token?: string) {
  const response = await fetch(`http://127.0.0.1:5001/${projectId}/asia-southeast1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ data }),
  });
  return {
    status: response.status,
    body: (await response.json()) as {
      result?: unknown;
      error?: { status: string; message: string };
    },
  };
}

async function loginUser(email: string) {
  const credential = await signInWithEmailAndPassword(auth, email, testPassword);
  return credential.user.getIdToken();
}

beforeAll(async () => {
  // Tạo tài khoản test
  const users = [
    { uid: 'wallet-passenger-1', email: 'passenger1@wallet.test', role: 'USER', status: 'ACTIVE' },
    { uid: 'wallet-passenger-2', email: 'passenger2@wallet.test', role: 'USER', status: 'ACTIVE' },
    { uid: 'wallet-driver-1', email: 'driver1@wallet.test', role: 'DRIVER', status: 'ACTIVE' },
    { uid: 'wallet-stranger', email: 'stranger@wallet.test', role: 'USER', status: 'ACTIVE' },
    { uid: 'wallet-locked', email: 'locked@wallet.test', role: 'USER', status: 'LOCKED' },
  ];

  for (const u of users) {
    try {
      await adminAuth.createUser({ uid: u.uid, email: u.email, password: testPassword });
    } catch {
      // nếu đã tồn tại
    }
    await db.doc(`users/${u.uid}`).set({
      uid: u.uid,
      displayName: `User ${u.uid}`,
      roles: [u.role],
      status: u.status,
      studentVerificationStatus: 'VERIFIED',
    });
  }
});

afterAll(async () => {
  await signOut(auth);
  await terminate(clientDb);
  await deleteApp(webApp);
  await db.terminate();
  await deleteAdminApp(adminApp);
});

describe('Người 5 — Tích hợp Ví điểm demo & Thanh toán qua Emulator', () => {
  it('1. getMyWallet: cấp 1.000.000 điểm khởi tạo đúng 1 lần (Idempotent bootstrap)', async () => {
    const token = await loginUser('passenger1@wallet.test');
    const res1 = await call('getMyWallet', {}, token);

    expect(res1.status).toBe(200);
    const body1 = res1.body.result as { wallet: Wallet; ledgerEntries: LedgerEntry[] };
    expect(body1.wallet.uid).toBe('wallet-passenger-1');
    expect(body1.wallet.balancePoints).toBe(1_000_000);
    expect(body1.ledgerEntries.length).toBe(1);
    expect(body1.ledgerEntries[0].kind).toBe('INITIAL_GRANT');
    expect(body1.ledgerEntries[0].deltaPoints).toBe(1_000_000);

    // Gọi lại lần 2 không bị cấp thêm
    const res2 = await call('getMyWallet', {}, token);
    const body2 = res2.body.result as { wallet: Wallet; ledgerEntries: LedgerEntry[] };
    expect(body2.wallet.balancePoints).toBe(1_000_000);
    expect(body2.ledgerEntries.length).toBe(1);
  });

  it('2. topUpDemo: thêm 100.000 điểm thử; gọi lại cùng requestId không cộng trùng', async () => {
    const token = await loginUser('passenger1@wallet.test');
    const requestId = 'req-topup-idempotent-001';

    // Lần 1: Nạp 100.000 điểm
    const res1 = await call('topUpDemo', { requestId }, token);
    expect(res1.status).toBe(200);
    const body1 = res1.body.result as { balancePoints: number; entry: LedgerEntry };
    expect(body1.balancePoints).toBe(1_100_000);
    expect(body1.entry.kind).toBe('DEMO_TOP_UP');
    expect(body1.entry.deltaPoints).toBe(100_000);

    // Lần 2: Thử gọi lại cùng requestId -> không cộng điểm lần hai
    const res2 = await call('topUpDemo', { requestId }, token);
    expect(res2.status).toBe(200);
    const body2 = res2.body.result as { balancePoints: number };
    expect(body2.balancePoints).toBe(1_100_000);

    // Lần 3: Gọi với requestId khác -> được cộng tiếp
    const res3 = await call('topUpDemo', { requestId: 'req-topup-idempotent-002' }, token);
    expect(res3.status).toBe(200);
    const body3 = res3.body.result as { balancePoints: number };
    expect(body3.balancePoints).toBe(1_200_000);
  });

  it('3. payBooking: thanh toán chuyến đi COMPLETED, nguyên tử trừ khách, cộng tài xế và app fee', async () => {
    const passengerToken = await loginUser('passenger1@wallet.test');

    // Fixture booking COMPLETED: fare = 100.000, fee = 10.000, driver = 90.000
    const bookingId = 'booking-integration-001';
    const bookingFixture: Booking = {
      id: bookingId,
      tripId: 'trip-001',
      passengerId: 'wallet-passenger-1',
      driverId: 'wallet-driver-1',
      pickupStopId: 'stop-1',
      dropoffStopId: 'stop-2',
      status: 'COMPLETED',
      farePoints: 100_000,
      feePoints: 10_000,
      driverPoints: 90_000,
      paymentMethod: 'DEMO_WALLET',
      createdAtMs: Date.now(),
    };
    await db.doc(`bookings/${bookingId}`).set(bookingFixture);

    // Khởi tạo ví tài xế ban đầu 1.000.000
    await db.doc('wallets/wallet-driver-1').set({ uid: 'wallet-driver-1', balancePoints: 1_000_000 });
    // Khách hiện có 1.200.000 điểm từ test trước

    const payRes = await call('payBooking', { bookingId }, passengerToken);
    expect(payRes.status).toBe(200);
    const payResult = payRes.body.result as { payment: Payment };
    expect(payResult.payment.status).toBe('SUCCEEDED');
    expect(payResult.payment.farePoints).toBe(100_000);
    expect(payResult.payment.feePoints).toBe(10_000);
    expect(payResult.payment.driverPoints).toBe(90_000);

    // Kiểm tra số dư các ví trong Firestore
    const pSnap = await db.doc('wallets/wallet-passenger-1').get();
    expect((pSnap.data() as Wallet).balancePoints).toBe(1_100_000); // 1.200.000 - 100.000

    const dSnap = await db.doc('wallets/wallet-driver-1').get();
    expect((dSnap.data() as Wallet).balancePoints).toBe(1_090_000); // 1.000.000 + 90.000

    const sSnap = await db.doc('wallets/system-fees').get();
    expect((sSnap.data() as Wallet).balancePoints).toBe(10_000);

    // Kiểm tra Payment document
    const paymentDoc = await db.doc(`payments/${bookingId}`).get();
    expect(paymentDoc.exists).toBe(true);
    expect((paymentDoc.data() as Payment).status).toBe('SUCCEEDED');

    // Kiểm tra 3 ledger entries
    const pLedger = await db.doc(`ledgerEntries/ride_pay_${bookingId}`).get();
    expect(pLedger.exists).toBe(true);
    expect((pLedger.data() as LedgerEntry).deltaPoints).toBe(-100_000);

    const dLedger = await db.doc(`ledgerEntries/driver_inc_${bookingId}`).get();
    expect(dLedger.exists).toBe(true);
    expect((dLedger.data() as LedgerEntry).deltaPoints).toBe(90_000);

    const sLedger = await db.doc(`ledgerEntries/app_fee_${bookingId}`).get();
    expect(sLedger.exists).toBe(true);
    expect((sLedger.data() as LedgerEntry).deltaPoints).toBe(10_000);
  });

  it('4. payBooking retry: gọi lại không trừ tiền lần hai', async () => {
    const passengerToken = await loginUser('passenger1@wallet.test');
    const bookingId = 'booking-integration-001';

    const payRes2 = await call('payBooking', { bookingId }, passengerToken);
    expect(payRes2.status).toBe(200);

    // Số dư vẫn nguyên vẹn
    const pSnap = await db.doc('wallets/wallet-passenger-1').get();
    expect((pSnap.data() as Wallet).balancePoints).toBe(1_100_000);
  });

  it('5. Phân quyền và trạng thái: người ngoài hoặc booking chưa COMPLETED bị từ chối', async () => {
    const strangerToken = await loginUser('stranger@wallet.test');
    const passengerToken = await loginUser('passenger1@wallet.test');

    // Người ngoài thanh toán -> 403 PERMISSION_DENIED
    const denied = await call('payBooking', { bookingId: 'booking-integration-001' }, strangerToken);
    expect(denied.status).toBe(403);
    expect(denied.body.error?.status).toBe('PERMISSION_DENIED');

    // Booking đang WAITING -> 400 FAILED_PRECONDITION
    const waitingBookingId = 'booking-waiting-001';
    await db.doc(`bookings/${waitingBookingId}`).set({
      id: waitingBookingId,
      tripId: 'trip-001',
      passengerId: 'wallet-passenger-1',
      driverId: 'wallet-driver-1',
      pickupStopId: 'stop-1',
      dropoffStopId: 'stop-2',
      status: 'WAITING',
      farePoints: 50_000,
      feePoints: 5_000,
      driverPoints: 45_000,
      paymentMethod: 'DEMO_WALLET',
      createdAtMs: Date.now(),
    });

    const notCompleted = await call('payBooking', { bookingId: waitingBookingId }, passengerToken);
    expect(notCompleted.status).toBe(400);
    expect(notCompleted.body.error?.status).toBe('FAILED_PRECONDITION');
  });

  it('6. Thiếu điểm: transaction rollback hoàn toàn, không thay đổi ví nào', async () => {
    const passengerToken = await loginUser('passenger2@wallet.test');

    // Passenger 2 có 1.000.000 điểm ban đầu. Đặt chuyến giá 2.000.000 điểm
    const hugeBookingId = 'booking-huge-001';
    await db.doc(`bookings/${hugeBookingId}`).set({
      id: hugeBookingId,
      tripId: 'trip-002',
      passengerId: 'wallet-passenger-2',
      driverId: 'wallet-driver-1',
      pickupStopId: 'stop-1',
      dropoffStopId: 'stop-2',
      status: 'COMPLETED',
      farePoints: 2_000_000,
      feePoints: 200_000,
      driverPoints: 1_800_000,
      paymentMethod: 'DEMO_WALLET',
      createdAtMs: Date.now(),
    });

    // Gọi thanh toán -> phải báo lỗi thiếu điểm
    const res = await call('payBooking', { bookingId: hugeBookingId }, passengerToken);
    expect(res.status).toBe(400);
    expect(res.body.error?.status).toBe('FAILED_PRECONDITION');

    // Xác nhận không có payment document nào được tạo
    const paymentDoc = await db.doc(`payments/${hugeBookingId}`).get();
    expect(paymentDoc.exists).toBe(false);

    // Xác nhận ví khách không bị âm
    const pSnap = await db.doc('wallets/wallet-passenger-2').get();
    if (pSnap.exists) {
      expect((pSnap.data() as Wallet).balancePoints).toBeGreaterThanOrEqual(0);
    }
  });

  it('7. Concurrent payments: 2 giao dịch đồng thời không làm âm ví khách', async () => {
    // Đặt số dư passenger 2 chính xác là 100.000 điểm
    await db.doc('wallets/wallet-passenger-2').set({ uid: 'wallet-passenger-2', balancePoints: 100_000 });
    const passengerToken = await loginUser('passenger2@wallet.test');

    // Tạo 2 bookings COMPLETED, mỗi chuyến 80.000 điểm (tổng 160.000 điểm > 100.000 điểm)
    const b1 = 'booking-concurrent-1';
    const b2 = 'booking-concurrent-2';
    for (const bId of [b1, b2]) {
      await db.doc(`bookings/${bId}`).set({
        id: bId,
        tripId: 'trip-concurrent',
        passengerId: 'wallet-passenger-2',
        driverId: 'wallet-driver-1',
        pickupStopId: 'stop-1',
        dropoffStopId: 'stop-2',
        status: 'COMPLETED',
        farePoints: 80_000,
        feePoints: 8_000,
        driverPoints: 72_000,
        paymentMethod: 'DEMO_WALLET',
        createdAtMs: Date.now(),
      });
    }

    // Bắn 2 request đồng thời
    const [res1, res2] = await Promise.all([
      call('payBooking', { bookingId: b1 }, passengerToken),
      call('payBooking', { bookingId: b2 }, passengerToken),
    ]);

    // 1 chuyến thành công, 1 chuyến thất bại
    const statuses = [res1.status, res2.status];
    expect(statuses).toContain(200);
    expect(statuses).toContain(400);

    // Kiểm tra số dư cuối cùng: 100.000 - 80.000 = 20.000, tuyệt đối không bị âm!
    const pSnap = await db.doc('wallets/wallet-passenger-2').get();
    expect((pSnap.data() as Wallet).balancePoints).toBe(20_000);
  });
});
