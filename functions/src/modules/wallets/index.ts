import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import type { Booking, LedgerEntry, Payment, Wallet } from '../../../../shared/contracts';
import { db } from '../../shared/admin';
import { requireActiveUser } from '../../shared/auth';
import { emptyInputSchema, parseInput } from '../../shared/validation';

export const SYSTEM_WALLET_ID = 'system-fees';
export const INITIAL_GRANT_POINTS = 1_000_000;
export const DEMO_TOP_UP_POINTS = 100_000;

const topUpInputSchema = z.object({
  requestId: z.string().min(1, 'requestId không được để trống').max(100),
});

const bookingIdInputSchema = z.object({
  bookingId: z.string().min(1, 'bookingId không được để trống'),
});

/**
 * Lấy thông tin ví và lịch sử điểm của tài khoản đang đăng nhập.
 * Nếu ví chưa tồn tại, tự động khởi tạo với 1.000.000 điểm demo đúng một lần.
 */
export const getMyWallet = onCall(async (request) => {
  parseInput(emptyInputSchema, request.data);
  const user = await requireActiveUser(request.auth);
  const uid = user.uid;

  const walletRef = db.doc(`wallets/${uid}`);
  const initialLedgerRef = db.doc(`ledgerEntries/initial_${uid}`);

  await db.runTransaction(async (t) => {
    const walletSnap = await t.get(walletRef);
    if (!walletSnap.exists) {
      const now = Date.now();
      const initialEntry: LedgerEntry = {
        id: `initial_${uid}`,
        walletId: uid,
        deltaPoints: INITIAL_GRANT_POINTS,
        kind: 'INITIAL_GRANT',
        referenceId: uid,
        createdAtMs: now,
      };
      t.set(walletRef, { uid, balancePoints: INITIAL_GRANT_POINTS });
      t.set(initialLedgerRef, initialEntry);
    }
  });

  const walletSnap = await walletRef.get();
  const wallet = walletSnap.data() as Wallet;

  // Lấy lịch sử giao dịch của ví này
  const ledgerSnap = await db.collection('ledgerEntries').where('walletId', '==', uid).get();
  const ledgerEntries: LedgerEntry[] = [];
  ledgerSnap.forEach((docSnap) => {
    ledgerEntries.push(docSnap.data() as LedgerEntry);
  });

  // Sắp xếp mới nhất lên đầu
  ledgerEntries.sort((a, b) => b.createdAtMs - a.createdAtMs);

  return {
    wallet,
    ledgerEntries,
  };
});

/**
 * Thêm cố định 100.000 điểm thử cho ví của user đang đăng nhập.
 * Chống trùng lặp bằng requestId (idempotency): gọi lại cùng requestId sẽ không cộng điểm lần hai.
 */
export const topUpDemo = onCall(async (request) => {
  const { requestId } = parseInput(topUpInputSchema, request.data);
  const user = await requireActiveUser(request.auth);
  const uid = user.uid;

  const walletRef = db.doc(`wallets/${uid}`);
  const topUpEntryRef = db.doc(`ledgerEntries/topup_${uid}_${requestId}`);
  const initialLedgerRef = db.doc(`ledgerEntries/initial_${uid}`);

  const result = await db.runTransaction(async (t) => {
    // 1. Đọc trước tất cả documents
    const topUpSnap = await t.get(topUpEntryRef);
    const walletSnap = await t.get(walletRef);

    // Nếu đã xử lý requestId này rồi -> trả về ngay (idempotency)
    if (topUpSnap.exists) {
      const currentBalance = walletSnap.exists
        ? (walletSnap.data() as Wallet).balancePoints
        : INITIAL_GRANT_POINTS;
      return {
        balancePoints: currentBalance,
        entry: topUpSnap.data() as LedgerEntry,
      };
    }

    const now = Date.now();
    let currentBalance = 0;

    // Nếu ví chưa từng được tạo, cấp ban đầu 1.000.000 điểm trước
    if (!walletSnap.exists) {
      const initialEntry: LedgerEntry = {
        id: `initial_${uid}`,
        walletId: uid,
        deltaPoints: INITIAL_GRANT_POINTS,
        kind: 'INITIAL_GRANT',
        referenceId: uid,
        createdAtMs: now,
      };
      t.set(initialLedgerRef, initialEntry);
      currentBalance = INITIAL_GRANT_POINTS;
    } else {
      currentBalance = (walletSnap.data() as Wallet).balancePoints;
    }

    const newBalance = currentBalance + DEMO_TOP_UP_POINTS;
    const entry: LedgerEntry = {
      id: `topup_${uid}_${requestId}`,
      walletId: uid,
      deltaPoints: DEMO_TOP_UP_POINTS,
      kind: 'DEMO_TOP_UP',
      referenceId: requestId,
      createdAtMs: now,
    };

    // 2. Ghi sau khi đọc xong
    t.set(walletRef, { uid, balancePoints: newBalance });
    t.set(topUpEntryRef, entry);

    return {
      balancePoints: newBalance,
      entry,
    };
  });

  return result;
});

/**
 * Thanh toán chuyến đi bằng điểm demo.
 * Chỉ hành khách của Booking COMPLETED mới được thanh toán.
 * Dùng Firestore transaction nguyên tử:
 * - Đọc Booking, Payment, Ví khách, Ví tài xế, Ví phí hệ thống.
 * - Kiểm tra đủ điểm, chống thanh toán lặp.
 * - Trừ khách, cộng tài xế, cộng phí hệ thống, tạo Payment và 3 LedgerEntries.
 */
export const payBooking = onCall(async (request) => {
  const { bookingId } = parseInput(bookingIdInputSchema, request.data);
  const user = await requireActiveUser(request.auth);
  const uid = user.uid;

  const bookingRef = db.doc(`bookings/${bookingId}`);
  const paymentRef = db.doc(`payments/${bookingId}`);
  const systemWalletRef = db.doc(`wallets/${SYSTEM_WALLET_ID}`);

  const result = await db.runTransaction(async (t) => {
    // === PHẦN 1: ĐỌC TẤT CẢ DOCUMENTS TRƯỚC (Firestore Transaction Rule) ===
    const bookingSnap = await t.get(bookingRef);
    if (!bookingSnap.exists) {
      throw new HttpsError('not-found', 'Không tìm thấy chuyến đặt.');
    }
    const booking = bookingSnap.data() as Booking;

    // Kiểm tra quyền: chỉ khách của booking mới được thanh toán
    if (booking.passengerId !== uid) {
      throw new HttpsError('permission-denied', 'Chỉ hành khách của chuyến đi mới có quyền thanh toán.');
    }

    // Chỉ thanh toán sau khi Booking COMPLETED
    if (booking.status !== 'COMPLETED') {
      throw new HttpsError('failed-precondition', 'Chỉ có thể thanh toán sau khi chuyến đi đã hoàn thành.');
    }

    if (booking.paymentMethod !== 'DEMO_WALLET') {
      throw new HttpsError('failed-precondition', 'Phương thức thanh toán của chuyến đi không hợp lệ.');
    }

    // Kiểm tra xem đã thanh toán thành công trước đó chưa (idempotent retry)
    const paymentSnap = await t.get(paymentRef);
    if (paymentSnap.exists) {
      const existingPayment = paymentSnap.data() as Payment;
      if (existingPayment.status === 'SUCCEEDED') {
        return { payment: existingPayment };
      }
    }

    // Đọc ví khách
    const passengerWalletRef = db.doc(`wallets/${booking.passengerId}`);
    const passengerWalletSnap = await t.get(passengerWalletRef);

    let passengerBalance = 0;
    let passengerNeedsBootstrap = false;
    if (!passengerWalletSnap.exists) {
      passengerBalance = INITIAL_GRANT_POINTS;
      passengerNeedsBootstrap = true;
    } else {
      passengerBalance = (passengerWalletSnap.data() as Wallet).balancePoints;
    }

    // Kiểm tra đủ điểm trong transaction (đảm bảo atomic, không bao giờ để âm ví)
    if (passengerBalance < booking.farePoints) {
      throw new HttpsError(
        'failed-precondition',
        `Số dư điểm không đủ để thanh toán chuyến đi (cần ${booking.farePoints.toLocaleString('vi-VN')} điểm, hiện có ${passengerBalance.toLocaleString('vi-VN')} điểm). Vui lòng thêm điểm thử.`
      );
    }

    // Đọc ví tài xế
    const driverWalletRef = db.doc(`wallets/${booking.driverId}`);
    const driverWalletSnap = await t.get(driverWalletRef);

    let driverBalance = 0;
    let driverNeedsBootstrap = false;
    if (!driverWalletSnap.exists) {
      driverBalance = INITIAL_GRANT_POINTS;
      driverNeedsBootstrap = true;
    } else {
      driverBalance = (driverWalletSnap.data() as Wallet).balancePoints;
    }

    // Đọc ví phí hệ thống
    const systemWalletSnap = await t.get(systemWalletRef);
    let systemBalance = 0;
    if (systemWalletSnap.exists) {
      systemBalance = (systemWalletSnap.data() as Wallet).balancePoints;
    }

    // === PHẦN 2: GHI TẤT CẢ DOCUMENTS NGUYÊN TỬ (Atomic Writes) ===
    const now = Date.now();

    // Khởi tạo ví nếu bên nào chưa có
    if (passengerNeedsBootstrap) {
      t.set(db.doc(`ledgerEntries/initial_${booking.passengerId}`), {
        id: `initial_${booking.passengerId}`,
        walletId: booking.passengerId,
        deltaPoints: INITIAL_GRANT_POINTS,
        kind: 'INITIAL_GRANT',
        referenceId: booking.passengerId,
        createdAtMs: now,
      } as LedgerEntry);
    }

    if (driverNeedsBootstrap) {
      t.set(db.doc(`ledgerEntries/initial_${booking.driverId}`), {
        id: `initial_${booking.driverId}`,
        walletId: booking.driverId,
        deltaPoints: INITIAL_GRANT_POINTS,
        kind: 'INITIAL_GRANT',
        referenceId: booking.driverId,
        createdAtMs: now,
      } as LedgerEntry);
    }

    // Trừ điểm hành khách
    const nextPassengerBalance = passengerBalance - booking.farePoints;
    t.set(passengerWalletRef, { uid: booking.passengerId, balancePoints: nextPassengerBalance });

    // Cộng điểm tài xế
    const nextDriverBalance = driverBalance + booking.driverPoints;
    t.set(driverWalletRef, { uid: booking.driverId, balancePoints: nextDriverBalance });

    // Ghi nhận phí hệ thống
    const nextSystemBalance = systemBalance + booking.feePoints;
    t.set(systemWalletRef, { uid: SYSTEM_WALLET_ID, balancePoints: nextSystemBalance });

    // Lưu thông tin Payment với ID = bookingId
    const paymentRecord: Payment = {
      bookingId: booking.id,
      passengerId: booking.passengerId,
      driverId: booking.driverId,
      farePoints: booking.farePoints,
      feePoints: booking.feePoints,
      driverPoints: booking.driverPoints,
      status: 'SUCCEEDED',
    };
    t.set(paymentRef, paymentRecord);

    // Ghi 3 LedgerEntries với ID xác định chống trùng khi retry
    const passengerLedger: LedgerEntry = {
      id: `ride_pay_${booking.id}`,
      walletId: booking.passengerId,
      deltaPoints: -booking.farePoints,
      kind: 'RIDE_PAYMENT',
      referenceId: booking.id,
      createdAtMs: now,
    };
    const driverLedger: LedgerEntry = {
      id: `driver_inc_${booking.id}`,
      walletId: booking.driverId,
      deltaPoints: booking.driverPoints,
      kind: 'DRIVER_INCOME',
      referenceId: booking.id,
      createdAtMs: now,
    };
    const systemLedger: LedgerEntry = {
      id: `app_fee_${booking.id}`,
      walletId: SYSTEM_WALLET_ID,
      deltaPoints: booking.feePoints,
      kind: 'APP_FEE',
      referenceId: booking.id,
      createdAtMs: now,
    };

    t.set(db.doc(`ledgerEntries/${passengerLedger.id}`), passengerLedger);
    t.set(db.doc(`ledgerEntries/${driverLedger.id}`), driverLedger);
    t.set(db.doc(`ledgerEntries/${systemLedger.id}`), systemLedger);

    return { payment: paymentRecord };
  });

  return result;
});

/**
 * Tra cứu thông tin thanh toán của chuyến đi.
 * Hành khách, tài xế của chuyến hoặc ADMIN mới có quyền tra cứu.
 */
export const getBookingPayment = onCall(async (request) => {
  const { bookingId } = parseInput(bookingIdInputSchema, request.data);
  const user = await requireActiveUser(request.auth);
  const uid = user.uid;

  const bookingSnap = await db.doc(`bookings/${bookingId}`).get();
  if (!bookingSnap.exists) {
    throw new HttpsError('not-found', 'Không tìm thấy chuyến đặt.');
  }
  const booking = bookingSnap.data() as Booking;

  const isPassenger = booking.passengerId === uid;
  const isDriver = booking.driverId === uid;
  const isAdmin = user.roles.includes('ADMIN');

  if (!isPassenger && !isDriver && !isAdmin) {
    throw new HttpsError('permission-denied', 'Bạn không có quyền xem thông tin thanh toán của chuyến này.');
  }

  const paymentSnap = await db.doc(`payments/${bookingId}`).get();
  if (!paymentSnap.exists) {
    return { payment: null };
  }

  return { payment: paymentSnap.data() as Payment };
});
