import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../auth/SessionProvider';
import { bookingError, bookingNotice, bookingStatusLabels, changeBooking, getBookingTripState, hasOtherPassenger, listMyBookings, listTripBookings,
  type Booking, type BookingAction, type BookingCursor, type BookingGroup, type BookingTripState } from './booking-api';
import { useBookingRefresh } from './useBookingRefresh';

const tones: Record<Booking['status'], string> = {
  WAITING: 'amber', CONFIRMED: 'teal', ONBOARD: 'teal', COMPLETED: 'emerald',
  REJECTED: 'danger', CANCELLED: 'neutral', EXPIRED: 'neutral',
};
const actionLabels: Record<BookingAction, string> = {
  confirmBooking: 'Nhận khách', rejectBooking: 'Từ chối', cancelBooking: 'Rút / hủy yêu cầu',
  markPickup: 'Đã đón khách', markDropoff: 'Đã trả khách',
};
const time = (ms: number) => new Date(ms).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

function BookingCard({ booking, driverView, trip, tripError, onChanged, onPendingChange }: {
  booking: Booking; driverView: boolean; trip?: BookingTripState; tripError?: string;
  onChanged: (action: BookingAction) => void; onPendingChange: (pending: boolean) => void;
}) {
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
    pending.current = true; setBusy(true); setError(''); onPendingChange(true);
    try { await changeBooking(action, booking.id, reason); if (alive.current) onChanged(action); }
    catch (err) { if (alive.current) setError(bookingError(err)); }
    finally { pending.current = false; onPendingChange(false); if (alive.current) setBusy(false); }
  }
  const notice = bookingNotice(booking, driverView, trip);
  return <article className="trip-panel" aria-busy={busy}>
    <span className={'status-pill ' + tones[booking.status]}>{hasOtherPassenger(booking, trip) ? 'Đang dự phòng' : bookingStatusLabels[booking.status]}</span>
    {notice && <p className="notice" role="status">{notice}</p>}
    {tripError && <p className="form-error" role="alert">Chưa kiểm tra được tình trạng nhận khách: {tripError}</p>}
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
  tripId?: string; revision?: number; group?: BookingGroup; embedded?: boolean; onChanged?: (action?: BookingAction) => void;
}) {
  const { user } = useSession();
  const [selectedGroup, setGroup] = useState<BookingGroup>('ALL');
  const group = controlledGroup ?? selectedGroup;
  const [cursor, setCursor] = useState<BookingCursor | undefined>();
  const [next, setNext] = useState<BookingCursor | null>(null);
  const [items, setItems] = useState<Booking[]>([]);
  const [trips, setTrips] = useState<Record<string, BookingTripState>>({});
  const [tripErrors, setTripErrors] = useState<Record<string, string>>({});
  const [loadedKey, setLoadedKey] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const pendingActions = useRef(0);
  const queryKey = JSON.stringify({ uid: user?.id, tripId, group, cursor });
  const autoRefresh = useCallback(() => { if (pendingActions.current === 0) setRefresh(value => value + 1); }, []);
  const pendingChanged = useCallback((pending: boolean) => { pendingActions.current += pending ? 1 : -1; }, []);
  useBookingRefresh(autoRefresh);
  useEffect(() => {
    let active = true;
    if (!user) return;
    setBusy(true); setError('');
    const input = { group, ...(cursor ? { cursor } : {}) };
    const result = tripId ? listTripBookings({ ...input, tripId }) : listMyBookings(input);
    result.then(async value => {
      const ids = [...new Set(value.items.filter(item => item.status === 'WAITING').map(item => item.tripId))];
      const states: Record<string, BookingTripState> = {};
      const errors: Record<string, string> = {};
      await Promise.all(ids.map(async id => {
        try { states[id] = await getBookingTripState(id); }
        catch (err) { errors[id] = bookingError(err); }
      }));
      if (active) {
        setItems(value.items); setNext(value.nextCursor); setTrips(states); setTripErrors(errors); setLoadedKey(queryKey);
      }
    })
      .catch(err => { if (active) setError(bookingError(err)); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [tripId, group, cursor, refresh, revision, user?.id, queryKey]);
  function reload() { setCursor(undefined); setRefresh(value => value + 1); }
  const visibleItems = loadedKey === queryKey ? items : [];
  const visibleNext = loadedKey === queryKey ? next : null;
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
    <p className="trip-muted">Trạng thái tự cập nhật mỗi 30 giây khi trang đang hiển thị.</p>
    {busy && visibleItems.length === 0 && <div className="content-skeleton compact" role="status"><p>Đang tải yêu cầu…</p><div/><div/></div>}
    {error && <p role="alert" className="form-error">{error}</p>}
    {!busy && !error && visibleItems.length === 0 && <div className="empty-state"><h2>Chưa có yêu cầu trong mục này</h2>
      <p>{tripId ? 'Các yêu cầu đi cùng sẽ xuất hiện tại đây để bạn chọn khách.' : 'Tìm chuyến, chọn điểm đón/trả rồi gửi yêu cầu đi cùng.'}</p>
      {!tripId && <Link className="button primary" to="/chuyen-di">Tìm chuyến</Link>}
    </div>}
    {visibleItems.map(item => <BookingCard key={item.id + ':' + item.status} booking={item} driverView={Boolean(tripId)}
      trip={trips[item.tripId]} tripError={tripErrors[item.tripId]} onPendingChange={pendingChanged}
      onChanged={action => { reload(); onChanged?.(action); }} />)}
    <div className="trip-actions">
      {cursor && <button type="button" className="button secondary" disabled={busy} onClick={() => setCursor(undefined)}>Về trang đầu</button>}
      {visibleNext && <button type="button" className="button secondary" disabled={busy} onClick={() => setCursor(visibleNext)}>Trang tiếp theo</button>}
    </div>
  </section>;
}
