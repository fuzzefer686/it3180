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
import { callFunction, errorMessage } from '../../lib/callable';
import { useSession } from '../auth/SessionProvider';

export function WalletsPage() {
  const { user, loading: authLoading } = useSession();
  const [searchParams] = useSearchParams();

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isToppingUp, setIsToppingUp] = useState(false);

  // Thanh toán chuyến đi qua bookingId
  const [bookingIdInput, setBookingIdInput] = useState(searchParams.get('payBookingId') || '');
  const [isPaying, setIsPaying] = useState(false);
  const [paymentMsg, setPaymentMsg] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const fetchWallet = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await callFunction('getMyWallet', {});
      setWallet(data.wallet);
      setLedgerEntries(data.ledgerEntries);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchWallet();
    } else {
      setWallet(null);
      setLedgerEntries([]);
    }
  }, [user]);

  // Xử lý nạp cố định 100.000 điểm thử (idempotent qua requestId)
  const handleTopUp = async () => {
    if (!user || isToppingUp) return;
    setIsToppingUp(true);
    setError(null);
    setSuccessMsg(null);

    // Sinh requestId ngẫu nhiên duy nhất cho mỗi lần click
    const requestId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    try {
      const res = await callFunction('topUpDemo', { requestId });
      setWallet((prev) => (prev ? { ...prev, balancePoints: res.balancePoints } : { uid: user.uid, balancePoints: res.balancePoints }));
      setLedgerEntries((prev) => [res.entry, ...prev.filter((e) => e.id !== res.entry.id)]);
      setSuccessMsg('Đã cộng thành công 100.000 điểm thử nghiệm vào ví!');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsToppingUp(false);
    }
  };

  // Xử lý thanh toán chuyến đi COMPLETED
  const handlePayBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = bookingIdInput.trim();
    if (!id || isPaying) return;

    setIsPaying(true);
    setPaymentMsg(null);
    setPaymentError(null);

    try {
      const res = await callFunction('payBooking', { bookingId: id });
      setPaymentMsg(`Thanh toán thành công ${res.payment.farePoints.toLocaleString('vi-VN')} điểm cho chuyến đi #${res.payment.bookingId}!`);
      // Làm mới lại ví và lịch sử
      await fetchWallet();
      setBookingIdInput('');
    } catch (err) {
      setPaymentError(errorMessage(err));
    } finally {
      setIsPaying(false);
    }
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
        <h1>Ví điểm</h1>
        <p>Điểm cho chuyến đi cùng, lịch sử cho mỗi lần sử dụng.</p>
      </header>

      {error && (
        <div className="notice warning" style={{ marginBottom: 20 }}>
          <CircleAlert size={18} />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="notice success" style={{ marginBottom: 20 }}>
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="wallet-layout">
        {/* Khối hiển thị số dư và nạp điểm */}
        <section className="balance-panel" aria-labelledby="balance-title">
          <div className="balance-top">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <WalletCards size={28} />
              <span>Điểm mô phỏng</span>
            </div>
            {user && (
              <button
                type="button"
                className="icon-button"
                onClick={fetchWallet}
                disabled={loading}
                title="Làm mới số dư"
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
              <p className="balance-caption">Đăng nhập tài khoản để nhận 1.000.000 điểm khởi tạo và quản lý ví.</p>
              <Link className="button primary" to="/tai-khoan">
                Đăng nhập ngay <ArrowRight size={18} />
              </Link>
            </>
          ) : (
            <>
              <p className="balance-value">
                {wallet ? `${wallet.balancePoints.toLocaleString('vi-VN')} điểm` : '1.000.000 điểm'}
              </p>
              <p className="balance-caption">
                Ví hoạt động bình thường. Bạn có thể thêm 100.000 điểm thử bất cứ lúc nào.
              </p>
              <button
                type="button"
                className="button primary"
                onClick={handleTopUp}
                disabled={isToppingUp}
              >
                {isToppingUp ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                Thêm 100.000 điểm thử
              </button>
            </>
          )}

          <p className="wallet-footnote">Điểm không có giá trị tiền và không thể quy đổi.</p>
        </section>

        {/* Khối quy tắc và giải thích */}
        <section className="wallet-explainer">
          <CircleHelp size={24} />
          <h2>Chỉ dùng điểm thử</h2>
          <p>Ví mô phỏng cách trả phí chuyến đi. Bạn không cần liên kết ngân hàng hay dùng tiền thật.</p>

          <div className="wallet-rule">
            <span>Thời điểm trả điểm</span>
            <strong>Sau khi bạn xuống xe (COMPLETED)</strong>
          </div>
          <div className="wallet-rule">
            <span>Cách tính điểm dự kiến</span>
            <strong>5.000 điểm / km</strong>
          </div>
          <div className="wallet-rule">
            <span>Phí hệ thống mô phỏng</span>
            <strong>10% làm tròn xuống</strong>
          </div>

          {!user && (
            <Link className="text-link" to="/tai-khoan">
              Đăng nhập <ArrowRight size={18} />
            </Link>
          )}
        </section>
      </div>

      {/* Form thanh toán chuyến đi khi khách xuống xe */}
      {user && (
        <section className="payment-box" style={{ marginTop: 36, padding: '24px 28px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <CreditCard size={22} color="var(--accent-text)" />
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Thanh toán chuyến đi bằng điểm</h2>
          </div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
            Hành khách nhập mã đặt chỗ (Booking ID) của chuyến đã hoàn thành để trừ điểm và trả cho tài xế.
          </p>

          <form onSubmit={handlePayBooking} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="form-input" style={{ flex: '1 1 260px', minHeight: 46 }}>
              <input
                type="text"
                placeholder="Nhập mã đặt chuyến (ví dụ: booking-123)"
                value={bookingIdInput}
                onChange={(e) => setBookingIdInput(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              className="button primary"
              disabled={isPaying || !bookingIdInput.trim()}
              style={{ minHeight: 46 }}
            >
              {isPaying ? <Loader2 size={18} className="animate-spin" /> : <CreditCard size={18} />}
              Thanh toán ngay
            </button>
          </form>

          {paymentError && (
            <div className="notice warning" style={{ marginTop: 14 }}>
              <CircleAlert size={16} />
              <span>{paymentError}</span>
            </div>
          )}

          {paymentMsg && (
            <div className="notice success" style={{ marginTop: 14 }}>
              <CheckCircle2 size={16} />
              <span>{paymentMsg}</span>
            </div>
          )}
        </section>
      )}

      {/* Lịch sử điểm (Ledger Entries) */}
      <section className="transactions" aria-labelledby="transactions-title">
        <h2 id="transactions-title">Lịch sử điểm</h2>

        {!user ? (
          <div className="transaction-empty">
            <ArrowUpDown size={25} />
            <div>
              <h3>Vui lòng đăng nhập để xem lịch sử</h3>
              <p>Lịch sử biến động điểm ví của bạn sẽ xuất hiện tại đây.</p>
            </div>
          </div>
        ) : ledgerEntries.length === 0 ? (
          <div className="transaction-empty">
            <ArrowUpDown size={25} />
            <div>
              <h3>Chưa có giao dịch nào</h3>
              <p>Khi bạn nhận điểm khởi tạo, nạp thử hoặc thanh toán chuyến đi, lịch sử sẽ xuất hiện tại đây.</p>
            </div>
          </div>
        ) : (
          <div className="transaction-list">
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
                        {new Date(entry.createdAtMs).toLocaleString('vi-VN')} &bull; Mã: {entry.referenceId}
                      </p>
                    </div>
                  </div>

                  <div className="transaction-amount">
                    <div className={`delta ${isPositive ? 'positive' : 'negative'}`}>
                      {isPositive ? `+${entry.deltaPoints.toLocaleString('vi-VN')}` : entry.deltaPoints.toLocaleString('vi-VN')} điểm
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
