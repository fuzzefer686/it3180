import { useEffect, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  ArrowUpDown,
  CheckCircle2,
  CircleAlert,
  CircleHelp,
  CreditCard,
  Loader2,
  Plus,
  RefreshCw,
  WalletCards,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import type { LedgerEntry, Wallet } from '../../../../shared/contracts';
import { callFunction } from '../../lib/callable';
import { useSession } from '../auth/SessionProvider';
import { listMyBookings, type Booking } from '../bookings/booking-api';
import { walletError } from './wallet-errors';

type FeedbackNotice = {
  scope: 'wallet' | 'payment';
  tone: 'success' | 'warning';
  text: string;
};

export function WalletsPage() {
  const { user, loading: authLoading } = useSession();
  const [searchParams] = useSearchParams();

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [unpaidBookings, setUnpaidBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [isToppingUp, setIsToppingUp] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackNotice | null>(null);

  // Thanh toán chuyến đi qua bookingId
  const [bookingIdInput, setBookingIdInput] = useState(searchParams.get('payBookingId') || '');
  const [isPaying, setIsPaying] = useState(false);

  const fetchWallet = async (preserveFeedback = false) => {
    if (!user) return;
    setLoading(true);
    if (!preserveFeedback) setFeedback(null);

    try {
      const data = await callFunction('getMyWallet', {});
      setWallet(data.wallet);
      setLedgerEntries(data.ledgerEntries);
    } catch (err) {
      setFeedback({ scope: 'wallet', tone: 'warning', text: walletError(err) });
    } finally {
      setLoading(false);
    }

    try {
      const history = await listMyBookings({ group: 'HISTORY' });
      setUnpaidBookings(
        history.items.filter(
          (item) => item.status === 'COMPLETED' && !item.paymentId && item.passengerId === user.id,
        ),
      );
    } catch {
      // Bỏ qua nếu danh sách booking chưa tải được
    }
  };

  useEffect(() => {
    const paramId = searchParams.get('payBookingId');
    if (paramId) setBookingIdInput(paramId);
  }, [searchParams]);

  useEffect(() => {
    if (user) {
      void fetchWallet();
    } else {
      setWallet(null);
      setLedgerEntries([]);
      setUnpaidBookings([]);
      setFeedback(null);
    }
  }, [user?.id]);

  // Xử lý nạp cố định 100.000 điểm thử (idempotent qua requestId)
  const handleTopUp = async () => {
    if (!user || isToppingUp) return;
    setIsToppingUp(true);
    setFeedback(null);

    const requestId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    try {
      const res = await callFunction('topUpDemo', { requestId });
      setWallet((prev) =>
        prev ? { ...prev, balancePoints: res.balancePoints } : { uid: user.id, balancePoints: res.balancePoints },
      );
      setLedgerEntries((prev) => [res.entry, ...prev.filter((e) => e.id !== res.entry.id)]);
      setFeedback({
        scope: 'wallet',
        tone: 'success',
        text: 'Đã cộng thành công 100.000 điểm thử nghiệm vào ví!',
      });
    } catch (err) {
      setFeedback({ scope: 'wallet', tone: 'warning', text: walletError(err) });
    } finally {
      setIsToppingUp(false);
    }
  };

  const executePayBooking = async (bookingId: string) => {
    const id = bookingId.trim();
    if (!id || isPaying || !user) return;

    const matchedBooking = unpaidBookings.find((b) => b.id === id);
    if (
      wallet &&
      matchedBooking &&
      typeof matchedBooking.farePoints === 'number' &&
      wallet.balancePoints < matchedBooking.farePoints
    ) {
      setFeedback({
        scope: 'payment',
        tone: 'warning',
        text: walletError(
          { message: 'Insufficient balance' },
          { balancePoints: wallet.balancePoints, farePoints: matchedBooking.farePoints },
        ),
      });
      return;
    }

    setIsPaying(true);
    setFeedback(null);

    try {
      const res = await callFunction('payBooking', { bookingId: id });
      setBookingIdInput('');
      await fetchWallet(true);
      setFeedback({
        scope: 'payment',
        tone: 'success',
        text: `Thanh toán thành công ${res.payment.farePoints.toLocaleString('vi-VN')} điểm cho chuyến đi #${res.payment.bookingId}!`,
      });
    } catch (err) {
      setFeedback({
        scope: 'payment',
        tone: 'warning',
        text: walletError(err, {
          balancePoints: wallet?.balancePoints,
          farePoints: matchedBooking?.farePoints,
        }),
      });
    } finally {
      setIsPaying(false);
    }
  };

  const handlePayBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    await executePayBooking(bookingIdInput);
  };

  const getKindLabel = (kind: LedgerEntry['kind']) => {
    switch (kind) {
      case 'INITIAL_GRANT':
        return 'Cấp điểm ban đầu';
      case 'DEMO_TOP_UP':
        return 'Thêm điểm thử nghiệm';
      case 'RIDE_PAYMENT':
        return 'Thanh toán chuyến đi';
      case 'DRIVER_INCOME':
        return 'Thu nhập tài xế';
      case 'APP_FEE':
        return 'Phí mô phỏng hệ thống';
      default:
        return kind;
    }
  };

  return (
    <div className="inner-page">
      <header className="page-heading">
        <div>
          <h1>Ví điểm</h1>
          <p>Điểm mô phỏng cho các chuyến đi cùng sinh viên, minh bạch theo từng ki-lô-mét lộ trình.</p>
        </div>
        <span className="status-pill amber">Mô phỏng học phần · Không dùng tiền thật</span>
      </header>

      {feedback?.scope === 'wallet' && (
        <div
          className={`notice ${feedback.tone === 'warning' ? 'warning' : 'success'}`}
          style={{ marginBottom: 20 }}
          role={feedback.tone === 'warning' ? 'alert' : 'status'}
        >
          {feedback.tone === 'warning' ? <CircleAlert size={18} /> : <CheckCircle2 size={18} />}
          <span>{feedback.text}</span>
          <button type="button" className="text-button" onClick={() => setFeedback(null)}>
            Đóng
          </button>
        </div>
      )}

      <div className="wallet-layout">
        <section className="balance-panel" aria-labelledby="balance-title">
          <div>
            <div className="balance-top">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="balance-icon-box">
                  <WalletCards size={24} />
                </span>
                <span className="balance-badge">Điểm mô phỏng</span>
              </div>
              {user && (
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => void fetchWallet()}
                  disabled={loading}
                  title="Làm mới số dư"
                  aria-label="Làm mới số dư"
                >
                  <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
              )}
            </div>

            <h2 id="balance-title">Số điểm của bạn</h2>

            {authLoading || (loading && !wallet) ? (
              <p className="balance-value">Đang tải...</p>
            ) : !user ? (
              <>
                <p className="balance-value">Chưa đăng nhập</p>
                <p className="balance-caption">
                  Đăng nhập tài khoản để nhận 1.000.000 điểm khởi tạo và quản lý ví.
                </p>
                <Link className="button primary" to="/tai-khoan">
                  Đăng nhập ngay <ArrowRight size={17} />
                </Link>
              </>
            ) : (
              <>
                <p className="balance-value">
                  {wallet ? `${wallet.balancePoints.toLocaleString('vi-VN')} điểm` : '0 điểm'}
                </p>
                <p className="balance-caption">
                  Tài khoản: <strong>{user.email || user.id}</strong>. Mỗi thành viên có một ví điểm riêng biệt.
                </p>
                <button
                  type="button"
                  className="button primary"
                  onClick={() => void handleTopUp()}
                  disabled={isToppingUp}
                >
                  {isToppingUp ? <Loader2 size={17} className="animate-spin" /> : <Plus size={17} />}
                  Thêm 100.000 điểm thử
                </button>
              </>
            )}
          </div>
          <p className="wallet-footnote">
            Điểm chỉ phục vụ mô phỏng môn học, không có giá trị tiền tệ và không thể quy đổi.
          </p>
        </section>

        <section className="wallet-explainer">
          <div className="wallet-explainer-head">
            <CircleHelp size={22} />
            <h2>Nguyên tắc tính điểm minh bạch</h2>
          </div>
          <p>
            Ví mô phỏng cách chia sẻ chi phí xăng xe giữa sinh viên cùng trường, không liên kết ngân hàng hay ví điện tử thật.
          </p>
          <div className="wallet-rules">
            <div className="wallet-rule">
              <span>Đơn giá tham khảo</span>
              <strong>5.000 điểm / km</strong>
            </div>
            <div className="wallet-rule">
              <span>Thời điểm đối soát</span>
              <strong>Sau khi bạn xuống xe (COMPLETED)</strong>
            </div>
            <div className="wallet-rule">
              <span>Phí hệ thống mô phỏng</span>
              <strong>10% làm tròn xuống</strong>
            </div>
          </div>
          {!user && (
            <Link className="text-link" to="/tai-khoan">
              Đăng nhập để liên kết tài khoản
              <ArrowRight size={17} />
            </Link>
          )}
        </section>
      </div>

      {/* Khối thanh toán chuyến đi đã hoàn thành */}
      {user && (
        <section
          className="payment-box"
          style={{
            marginTop: 32,
            padding: '24px 28px',
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 20,
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <CreditCard size={22} color="var(--accent-text)" />
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Thanh toán chuyến đi bằng điểm</h2>
            </div>
            {unpaidBookings.length > 0 && (
              <span className="status-pill teal">
                {unpaidBookings.length} chuyến chờ thanh toán
              </span>
            )}
          </div>
          <p style={{ fontSize: 13.5, color: 'var(--muted)', marginBottom: 18 }}>
            Sau khi tài xế đánh dấu đã trả khách (COMPLETED), bạn có thể chọn chuyến cần thanh toán trong danh sách cuộn bên dưới hoặc nhập mã Booking ID.
          </p>

          {unpaidBookings.length > 0 && (
            <div className="unpaid-booking-list" role="region" aria-label="Danh sách chuyến cần thanh toán">
              {unpaidBookings.map((b) => (
                <div key={b.id} className="unpaid-booking-item">
                  <div>
                    <strong style={{ fontSize: 14 }}>
                      {b.pickupLabel} → {b.dropoffLabel}
                    </strong>
                    <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>
                      Tài xế: {b.driverName} · Cần thanh toán:{' '}
                      <strong>{(b.farePoints ?? 0).toLocaleString('vi-VN')} điểm</strong> · Mã: {b.id}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="button primary compact"
                    disabled={isPaying}
                    onClick={() => void executePayBooking(b.id)}
                  >
                    {isPaying ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                    Thanh toán {(b.farePoints ?? 0).toLocaleString('vi-VN')} điểm
                  </button>
                </div>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => void handlePayBooking(e)}
            style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}
          >
            <div className="form-input" style={{ flex: '1 1 260px', minHeight: 48 }}>
              <input
                type="text"
                placeholder="Nhập mã đặt chuyến (Booking UUID)"
                value={bookingIdInput}
                onChange={(e) => setBookingIdInput(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              className="button primary"
              disabled={isPaying || !bookingIdInput.trim()}
              style={{ minHeight: 48 }}
            >
              {isPaying ? <Loader2 size={17} className="animate-spin" /> : <CreditCard size={17} />}
              Thanh toán ngay
            </button>
          </form>

          {feedback?.scope === 'payment' && (
            <div
              className={`notice ${feedback.tone === 'warning' ? 'warning' : 'success'}`}
              style={{ marginTop: 14 }}
              role={feedback.tone === 'warning' ? 'alert' : 'status'}
            >
              {feedback.tone === 'warning' ? <CircleAlert size={16} /> : <CheckCircle2 size={16} />}
              <span>{feedback.text}</span>
              <button type="button" className="text-button" onClick={() => setFeedback(null)}>
                Đóng
              </button>
            </div>
          )}
        </section>
      )}

      {/* Lịch sử điểm (Ledger Entries) */}
      <section className="transactions" aria-labelledby="transactions-title">
        <div className="transactions-head">
          <h2 id="transactions-title">Lịch sử điểm</h2>
          {user && ledgerEntries.length > 0 && (
            <span className="status-pill neutral">{ledgerEntries.length} giao dịch gần nhất</span>
          )}
        </div>

        {!user ? (
          <div className="transaction-empty">
            <span className="transaction-empty-icon">
              <ArrowUpDown size={22} />
            </span>
            <div>
              <h3>Vui lòng đăng nhập để xem lịch sử</h3>
              <p>Lịch sử biến động điểm ví của bạn sẽ xuất hiện tại đây.</p>
            </div>
          </div>
        ) : ledgerEntries.length === 0 ? (
          <div className="transaction-empty">
            <span className="transaction-empty-icon">
              <ArrowUpDown size={22} />
            </span>
            <div>
              <h3>Chưa có giao dịch nào</h3>
              <p>Khi bạn nhận điểm khởi tạo, nạp thử hoặc thanh toán chuyến đi, lịch sử sẽ xuất hiện tại đây.</p>
            </div>
          </div>
        ) : (
          <div className="transaction-list" role="region" aria-label="Lịch sử giao dịch điểm">
            {ledgerEntries.map((entry) => {
              const isPositive = entry.deltaPoints > 0;
              return (
                <div key={entry.id} className="transaction-item">
                  <div className="transaction-details">
                    <div className={`transaction-icon-box ${isPositive ? 'positive' : 'negative'}`}>
                      {isPositive ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                    </div>
                    <div className="transaction-text">
                      <h3>{getKindLabel(entry.kind)}</h3>
                      <p>
                        {new Date(entry.createdAtMs).toLocaleString('vi-VN')} &bull; Mã tham chiếu: {entry.referenceId}
                      </p>
                    </div>
                  </div>

                  <div className="transaction-amount">
                    <div className={`delta ${isPositive ? 'positive' : 'negative'}`}>
                      {isPositive
                        ? `+${entry.deltaPoints.toLocaleString('vi-VN')}`
                        : entry.deltaPoints.toLocaleString('vi-VN')}{' '}
                      điểm
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
