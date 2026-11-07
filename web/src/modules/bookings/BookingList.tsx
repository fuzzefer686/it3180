import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { useSession } from '../auth/SessionProvider';
import { bookingError, bookingNotice, bookingStatusLabels, changeBooking, getBookingTripState, hasOtherPassenger, listMyBookings, listTripBookings,
  type Booking, type BookingAction, type BookingCursor, type BookingGroup, type BookingTripState } from './booking-api';
import { MyTripCard } from './MyTripCard';
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

function BookingCard({ booking, driverView, layout, trip, tripError, onChanged, onPendingChange }: {
  booking: Booking; driverView: boolean; layout: 'queue' | 'my-rides' | 'default'; trip?: BookingTripState; tripError?: string;
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
  const queueView = layout === 'queue';
  const myRides = layout === 'my-rides';
  const notice = bookingNotice(booking, driverView, trip);
  const status = <span className={'status-pill ' + tones[booking.status]}>
    {myRides && booking.status === 'COMPLETED' && <Check size={14} aria-hidden="true"/>}
    {hasOtherPassenger(booking, trip) ? 'Đang dự phòng' : bookingStatusLabels[booking.status]}
  </span>;
  const price = booking.farePoints === null ? 'Chưa chốt giá' : booking.farePoints.toLocaleString('vi-VN') + ' điểm demo';
  const address = booking.pickupLabel + ' → ' + booking.dropoffLabel;
  const paymentNotice = booking.paymentId ? 'Đã có giao dịch thanh toán.'
    : 'Chưa có thanh toán được ghi nhận. Hành khách có thể thanh toán tại mục Ví điểm.';
  const tripLink = <Link className={myRides ? 'button secondary' : undefined} to={'/chuyen-di/' + booking.tripId}>
    Xem tuyến / quản lý trạng thái Trip
  </Link>;
  const payLink = !driverView && booking.status === 'COMPLETED' && !booking.paymentId ? (
    <Link className="button primary" to={'/vi-diem?payBookingId=' + booking.id}>
      Thanh toán điểm chuyến đi
    </Link>
  ) : null;
  const actions: BookingAction[] = queueView && booking.actions.includes('confirmBooking')
    ? [...booking.actions.filter(action => action !== 'confirmBooking'), 'confirmBooking'] : booking.actions;
  const actionButtons = actions.map(action => <button type="button" key={action}
    className={'button ' + (queueView && action === 'confirmBooking' ? 'primary' : 'secondary')}
    disabled={busy} onClick={() => void act(action)}>{actionLabels[action]}</button>);
  const tripWarning = tripError && <p className="form-error" role="alert">Chưa kiểm tra được tình trạng nhận khách: {tripError}</p>;
  const driverHint = booking.status === 'CONFIRMED' && driverView && booking.tripStatus === 'OPEN'
    && <p className="trip-muted">Bắt đầu chuyến ở phần quản lý chuyến, sau đó đánh dấu đón khách.</p>;
  const cancelReasonField = booking.actions.includes('cancelBooking') && (
    <label className="trip-field"><span>Lý do rút / hủy (bắt buộc khi đã được nhận)</span>
      <textarea value={reason} maxLength={500} disabled={busy} onChange={event => setReason(event.target.value)} />
    </label>
  );
  const actionError = error && <p className="form-error" role="alert">{error} Tải lại để kiểm tra trạng thái mới nhất.</p>;

  if (myRides) {
    return <MyTripCard from={booking.pickupLabel} to={booking.dropoffLabel} status={status} busy={busy}
      actions={<>{tripLink}{payLink}{actionButtons}</>} footerNote={booking.status === 'COMPLETED' ? paymentNotice : undefined}
      facts={<>
        <div><dt>{driverView ? 'Khách' : 'Tài xế'}</dt><dd>{driverView ? booking.passengerName : booking.driverName}</dd></div>
        <div><dt>Khởi hành</dt><dd>{time(booking.departureTimeMs)}</dd></div>
        <div><dt>Gửi lúc</dt><dd>{time(booking.createdAtMs)}</dd></div>
        <div><dt>{booking.farePoints === null ? 'Giá' : 'Giá chốt'}</dt><dd>{price}</dd></div>
        {booking.distanceMeters !== null && <div><dt>Đoạn đi</dt><dd>{booking.distanceMeters.toLocaleString('vi-VN')} m</dd></div>}
        {driverView && booking.driverPoints !== null && <div><dt>Tài xế nhận</dt><dd>{booking.driverPoints.toLocaleString('vi-VN')} điểm</dd></div>}
        {driverView && booking.feePoints !== null && <div><dt>Phí demo</dt><dd>{booking.feePoints.toLocaleString('vi-VN')} điểm</dd></div>}
        {booking.contactPhone && <div><dt>Liên hệ</dt><dd><a href={'tel:' + booking.contactPhone}>{booking.contactPhone}</a></dd></div>}
        {booking.cancellationReason && <div><dt>Lý do hủy</dt><dd>{booking.cancellationReason}</dd></div>}
      </>}>
      {notice && <p className="trip-muted" role="status">{notice}</p>}
      {tripWarning}
      {driverHint}
      {cancelReasonField}
      {actionError}
    </MyTripCard>;
  }

  return <article className={queueView ? 'trip-queue-entry' : 'trip-panel'} aria-busy={busy}>
    {queueView ? <div className="trip-queue-status">{status}{notice && <p className="trip-muted" role="status">{notice}</p>}</div>
      : <>{status}{notice && <p className="notice" role="status">{notice}</p>}</>}
    {tripWarning}
    <h3>{address}</h3>
    {queueView ? (
      <dl className="trip-queue-facts">
        <dt>Khách</dt><dd>{booking.passengerName}</dd>
        <dt>Khởi hành</dt><dd>{time(booking.departureTimeMs)}</dd>
        <dt>Gửi lúc</dt><dd>{time(booking.createdAtMs)}</dd>
        <dt>Giá</dt><dd>{price}</dd>
        {booking.distanceMeters !== null && <><dt>Đoạn đi</dt><dd>{booking.distanceMeters.toLocaleString('vi-VN')} m</dd></>}
        {booking.driverPoints !== null && <><dt>Tài xế nhận</dt><dd>{booking.driverPoints.toLocaleString('vi-VN')} điểm</dd></>}
        {booking.feePoints !== null && <><dt>Phí demo</dt><dd>{booking.feePoints.toLocaleString('vi-VN')} điểm</dd></>}
        {booking.contactPhone && <><dt>Liên hệ</dt><dd><a href={'tel:' + booking.contactPhone}>{booking.contactPhone}</a></dd></>}
        {booking.cancellationReason && <><dt>Lý do hủy</dt><dd>{booking.cancellationReason}</dd></>}
      </dl>
    ) : (
      <div className="trip-segment-box">
        <p>{driverView ? 'Khách: ' + booking.passengerName : 'Tài xế: ' + booking.driverName}</p>
        <p>Khởi hành: {time(booking.departureTimeMs)} · Gửi lúc: {time(booking.createdAtMs)}</p>
        <p>{booking.farePoints === null ? price + '.' : 'Giá chốt: ' + price + '.'}
          {booking.distanceMeters !== null && <> Đoạn đi: {booking.distanceMeters.toLocaleString('vi-VN')} m.</>}</p>
        {driverView && booking.driverPoints !== null && <p>Tài xế nhận: {booking.driverPoints.toLocaleString('vi-VN')} điểm; phí demo: {booking.feePoints?.toLocaleString('vi-VN')} điểm.</p>}
        {booking.contactPhone && <p>Liên hệ bên kia: <a href={'tel:' + booking.contactPhone}>{booking.contactPhone}</a></p>}
        {booking.cancellationReason && <p>Lý do hủy: {booking.cancellationReason}</p>}
      </div>
    )}
    <p className={queueView ? 'trip-queue-link' : undefined}>{tripLink}</p>
    {driverHint}
    {booking.status === 'COMPLETED' && <p className="notice">{paymentNotice}</p>}
    {cancelReasonField}
    {(!queueView || actions.length > 0) && <div className="trip-actions">{actionButtons}</div>}
    {actionError}
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
  const queueView = Boolean(tripId) && !embedded;
  const listClass = embedded ? 'my-booking-list' : queueView ? 'trip-panel trip-booking-queue' : 'trip-panel';
  const refreshHint = <p className="trip-muted">Trạng thái tự cập nhật mỗi 30 giây khi trang đang hiển thị.</p>;
  return <section className={listClass} aria-label={tripId ? 'Hàng chờ và khách của chuyến' : 'Danh sách yêu cầu của tôi'} aria-busy={busy}>
    {!embedded && <h2>{tripId ? 'Hàng chờ và khách của chuyến' : 'Yêu cầu của tôi'}</h2>}
    <div className={queueView ? 'trip-booking-filters' : 'trip-actions'}>
      {!controlledGroup && <label className="trip-field"><span>Lọc yêu cầu</span><select value={group} disabled={busy} onChange={event => {
        setGroup(event.target.value as BookingGroup); setCursor(undefined);
      }}><option value="ALL">Tất cả</option><option value="WAITING">Đang chờ / dự phòng</option>
        <option value="UPCOMING">Đã nhận / đang đi</option><option value="HISTORY">Lịch sử</option></select></label>}
      <button className="button secondary compact" type="button" disabled={busy} onClick={reload}>Tải lại danh sách</button>
      {embedded && refreshHint}
    </div>
    {tripId && <p className="trip-muted">Tài xế tự chọn một khách. Những người còn lại tiếp tục dự phòng tới lúc bắt đầu chuyến hoặc tới giờ đi.</p>}
    {!embedded && refreshHint}
    {busy && visibleItems.length === 0 && <div className="content-skeleton compact" role="status"><p>Đang tải yêu cầu…</p><div/><div/></div>}
    {error && <p role="alert" className="form-error">{error}</p>}
    {!busy && !error && visibleItems.length === 0 && <div className="empty-state"><h2>Chưa có yêu cầu trong mục này</h2>
      <p>{tripId ? 'Các yêu cầu đi cùng sẽ xuất hiện tại đây để bạn chọn khách.' : 'Tìm chuyến, chọn điểm đón/trả rồi gửi yêu cầu đi cùng.'}</p>
      {!tripId && <Link className="button primary" to="/chuyen-di">Tìm chuyến</Link>}
    </div>}
    {visibleItems.map(item => <BookingCard key={item.id + ':' + item.status} booking={item} driverView={Boolean(tripId)}
      layout={embedded ? 'my-rides' : queueView ? 'queue' : 'default'}
      trip={trips[item.tripId]} tripError={tripErrors[item.tripId]} onPendingChange={pendingChanged}
      onChanged={action => { reload(); onChanged?.(action); }} />)}
    {((!queueView && !embedded) || cursor || visibleNext) && <div className="trip-actions">
      {cursor && <button type="button" className="button secondary" disabled={busy} onClick={() => setCursor(undefined)}>Về trang đầu</button>}
      {visibleNext && <button type="button" className="button secondary" disabled={busy} onClick={() => setCursor(visibleNext)}>Trang tiếp theo</button>}
    </div>}
  </section>;
}
