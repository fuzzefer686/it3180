import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { bookingError, bookingStatusLabels, changeBooking, listMyBookings, listTripBookings,
  type Booking, type BookingAction, type BookingCursor, type BookingGroup } from './booking-api';

const tones: Record<Booking['status'], string> = {
  WAITING: 'amber', CONFIRMED: 'teal', ONBOARD: 'teal', COMPLETED: 'emerald',
  REJECTED: 'danger', CANCELLED: 'neutral', EXPIRED: 'neutral',
};
const actionLabels: Record<BookingAction, string> = {
  confirmBooking: 'Nhận khách', rejectBooking: 'Từ chối', cancelBooking: 'Rút / hủy yêu cầu',
  markPickup: 'Đã đón khách', markDropoff: 'Đã trả khách',
};
const time = (ms: number) => new Date(ms).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

function BookingCard({ booking, driverView, onChanged }: { booking: Booking; driverView: boolean; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const pending = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function act(action: BookingAction) {
    if (pending.current) return;
    if (action === 'cancelBooking' && booking.status === 'CONFIRMED' && !reason.trim()) {
      setError('Nhập lý do hủy trước khi đón.'); return;
    }
    pending.current = true; setBusy(true); setError('');
    try { await changeBooking(action, booking.id, reason); if (alive.current) onChanged(); }
    catch (err) { if (alive.current) setError(bookingError(err)); }
    finally { pending.current = false; if (alive.current) setBusy(false); }
  }
  return <article className="trip-panel" aria-busy={busy}>
    <span className={'status-pill ' + tones[booking.status]}>{bookingStatusLabels[booking.status]}</span>
    <h3>{booking.pickupLabel} → {booking.dropoffLabel}</h3>
    <div className="trip-segment-box">
    <p>{driverView ? 'Khách: ' + booking.passengerName : 'Tài xế: ' + booking.driverName}</p>
    <p>Khởi hành: {time(booking.departureTimeMs)} · Gửi lúc: {time(booking.createdAtMs)}</p>
    <p>{booking.farePoints === null ? 'Chưa chốt giá.' : 'Giá chốt: ' + booking.farePoints.toLocaleString('vi-VN') + ' điểm demo.'}
      {booking.distanceMeters !== null && <> Đoạn đi: {booking.distanceMeters.toLocaleString('vi-VN')} m.</>}</p>
    {driverView && booking.driverPoints !== null && <p>Tài xế nhận: {booking.driverPoints.toLocaleString('vi-VN')} điểm; phí demo: {booking.feePoints?.toLocaleString('vi-VN')} điểm.</p>}
    {booking.contactPhone && <p>Liên hệ bên kia: <a href={'tel:' + booking.contactPhone}>{booking.contactPhone}</a></p>}
    {booking.cancellationReason && <p>Lý do hủy: {booking.cancellationReason}</p>}
    </div>
    <p><Link to={'/chuyen-di/' + booking.tripId}>Xem tuyến / quản lý trạng thái Trip</Link></p>
    {booking.status === 'CONFIRMED' && driverView && booking.tripStatus === 'OPEN'
      && <p className="trip-muted">Bắt đầu chuyến ở phần quản lý chuyến, sau đó đánh dấu đón khách.</p>}
    {booking.status === 'COMPLETED' && <p className="notice">{booking.paymentId
      ? 'Đã có giao dịch thanh toán.'
      : 'Chưa có thanh toán được ghi nhận. Module này không cộng/trừ ví; cần backend ví của người 5.'}</p>}
    {booking.actions.includes('cancelBooking') && <label className="trip-field"><span>Lý do rút / hủy (bắt buộc khi đã được nhận)</span>
      <textarea value={reason} maxLength={500} disabled={busy} onChange={event => setReason(event.target.value)} /></label>}
    <div className="trip-actions">{booking.actions.map(action => <button type="button" key={action}
      className="button secondary" disabled={busy} onClick={() => void act(action)}>{actionLabels[action]}</button>)}</div>
    {error && <p className="form-error" role="alert">{error} Tải lại để kiểm tra trạng thái mới nhất.</p>}
  </article>;
}

export function BookingList({ tripId, revision = 0, group: controlledGroup, embedded = false, onChanged }: {
  tripId?: string; revision?: number; group?: BookingGroup; embedded?: boolean; onChanged?: () => void;
}) {
  const [selectedGroup, setGroup] = useState<BookingGroup>('ALL');
  const group = controlledGroup ?? selectedGroup;
  const [cursor, setCursor] = useState<BookingCursor | undefined>();
  const [next, setNext] = useState<BookingCursor | null>(null);
  const [items, setItems] = useState<Booking[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    setBusy(true); setError(''); setItems([]); setNext(null);
    const input = { group, ...(cursor ? { cursor } : {}) };
    const result = tripId ? listTripBookings({ ...input, tripId }) : listMyBookings(input);
    result.then(value => { if (active) { setItems(value.items); setNext(value.nextCursor); } })
      .catch(err => { if (active) setError(bookingError(err)); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [tripId, group, cursor, refresh, revision]);
  function reload() { setCursor(undefined); setRefresh(value => value + 1); }
  return <section className={embedded ? 'journey-help' : 'trip-panel'} aria-label={tripId ? 'Hàng chờ và khách của chuyến' : 'Danh sách yêu cầu của tôi'} aria-busy={busy}>
    {!embedded && <h2>{tripId ? 'Hàng chờ và khách của chuyến' : 'Yêu cầu của tôi'}</h2>}
    <div className="trip-actions">
      {!controlledGroup && <label className="trip-field"><span>Lọc yêu cầu</span><select value={group} disabled={busy} onChange={event => {
        setGroup(event.target.value as BookingGroup); setCursor(undefined);
      }}><option value="ALL">Tất cả</option><option value="WAITING">Đang chờ / dự phòng</option>
        <option value="UPCOMING">Đã nhận / đang đi</option><option value="HISTORY">Lịch sử</option></select></label>}
      <button className="button secondary compact" type="button" disabled={busy} onClick={reload}>Tải lại danh sách</button>
    </div>
    {tripId && <p className="trip-muted">Tài xế tự chọn một khách. Những người còn lại tiếp tục dự phòng tới lúc bắt đầu chuyến hoặc tới giờ đi.</p>}
    {busy && <div className="content-skeleton compact" role="status"><p>Đang tải yêu cầu…</p><div/><div/></div>}
    {error && <p role="alert" className="form-error">{error}</p>}
    {!busy && !error && items.length === 0 && <div className="empty-state"><h2>Chưa có yêu cầu trong mục này</h2>
      <p>{tripId ? 'Các yêu cầu đi cùng sẽ xuất hiện tại đây để bạn chọn khách.' : 'Tìm chuyến, chọn điểm đón/trả rồi gửi yêu cầu đi cùng.'}</p>
      {!tripId && <Link className="button primary" to="/chuyen-di">Tìm chuyến</Link>}
    </div>}
    {items.map(item => <BookingCard key={item.id + ':' + refresh + ':' + revision} booking={item} driverView={Boolean(tripId)}
      onChanged={() => { reload(); onChanged?.(); }} />)}
    <div className="trip-actions">
      {cursor && <button type="button" className="button secondary" disabled={busy} onClick={() => setCursor(undefined)}>Về trang đầu</button>}
      {next && <button type="button" className="button secondary" disabled={busy} onClick={() => setCursor(next)}>Trang tiếp theo</button>}
    </div>
  </section>;
}
