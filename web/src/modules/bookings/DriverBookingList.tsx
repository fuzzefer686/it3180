import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { TripCursor, TripListItem } from '../../../../shared/trips';
import { callFunction } from '../../lib/callable';
import { useSession } from '../auth/SessionProvider';
import { BookingList } from './BookingList';
import { bookingError, listTripBookings, type BookingAction, type BookingGroup } from './booking-api';
import { useBookingRefresh } from './useBookingRefresh';

type Row = { trip: TripListItem; hasRequests: boolean; error: string };
export function DriverBookingList({ group }: { group: BookingGroup }) {
  const { user } = useSession();
  const [rows, setRows] = useState<Row[]>([]);
  const [cursor, setCursor] = useState<TripCursor | null>(null);
  const [next, setNext] = useState<TripCursor | null>(null);
  const [openTrip, setOpenTrip] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refresh, setRefresh] = useState(0);
  const reload = useCallback(() => setRefresh(value => value + 1), []);
  useBookingRefresh(reload);
  useEffect(() => {
    let active = true;
    if (!user) return;
    setBusy(true); setError('');
    async function load() {
      try {
        const result = await callFunction('listTrips', { mine: true, ...(cursor ? { cursor } : {}) });
        // One bounded page of owned Trips; existing Booking RPC checks ownership again.
        const entries = await Promise.all(result.items.map(async trip => {
          try {
            const bookings = await listTripBookings({ tripId: trip.id, group });
            return { trip, hasRequests: bookings.items.length > 0, error: '' };
          } catch (err) { return { trip, hasRequests: false, error: bookingError(err) }; }
        }));
        if (active) { setRows(entries); setNext(result.nextCursor); }
      } catch (err) { if (active) setError(bookingError(err)); }
      finally { if (active) setBusy(false); }
    }
    void load();
    return () => { active = false; };
  }, [group, cursor, user?.id, refresh]);
  const visibleRows = rows.filter(row => row.hasRequests || row.error);
  function changed(action?: BookingAction) {
    if (action === 'confirmBooking') setNotice('Đã nhận khách. Các yêu cầu còn lại tiếp tục dự phòng.');
    else setNotice('Đã cập nhật yêu cầu.');
    reload();
  }
  return <section className="journey-help" aria-label="Chuyến có yêu cầu đi cùng" aria-busy={busy}>
    <div className="trip-actions">
      <Link className="button primary compact" to="/chuyen-di/dang">Đăng chuyến</Link>
      <button className="button secondary compact" type="button" disabled={busy} onClick={reload}>Tải lại danh sách</button>
      <Link className="button secondary compact" to="/chuyen-di/cua-toi">Xem tất cả chuyến tôi đăng</Link>
    </div>
    <p className="trip-muted">Tự cập nhật mỗi 30 giây khi trang đang hiển thị. Chỉ hiện chuyến có yêu cầu trong mục đang chọn.</p>
    {notice && <p className="form-notice" role="status">{notice}</p>}
    {busy && <p role="status">Đang kiểm tra yêu cầu của các chuyến…</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {!busy && !error && visibleRows.length === 0 && <p className="notice">Chưa có chuyến có yêu cầu trong mục này ở trang hiện tại.{next ? ' Hãy xem trang tiếp theo.' : ''}</p>}
    {visibleRows.map(({ trip, error: rowError, hasRequests }) => <article className="trip-panel" key={trip.id}>
      <h3>{trip.stopLabels[0]} → {trip.stopLabels[trip.stopLabels.length - 1]}</h3>
      <p>Khởi hành: {new Date(trip.departureTimeMs).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</p>
      <div className="trip-actions">
        {hasRequests && <span className={'status-pill ' + (group === 'WAITING' ? 'amber' : 'teal')}>
          {group === 'WAITING' ? 'Có yêu cầu chờ' : group === 'UPCOMING' ? 'Đã nhận khách' : 'Có yêu cầu trong lịch sử'}
        </span>}
        {hasRequests && group === 'WAITING' && trip.hasPassenger && <span className="status-pill teal">Đã nhận khách · còn yêu cầu dự phòng</span>}
        {hasRequests && <button type="button" className="button secondary compact" aria-expanded={openTrip === trip.id}
          onClick={() => setOpenTrip(openTrip === trip.id ? null : trip.id)}>{openTrip === trip.id ? 'Ẩn yêu cầu' : 'Xem yêu cầu'}</button>}
        <Link to={'/chuyen-di/' + trip.id}>Xem tuyến / quản lý chuyến</Link>
      </div>
      {rowError && <p className="form-error" role="alert">Chưa kiểm tra được yêu cầu: {rowError}</p>}
      {openTrip === trip.id && hasRequests && <BookingList tripId={trip.id} group={group} embedded onChanged={changed} />}
    </article>)}
    <div className="trip-actions">
      {cursor && <button className="button secondary" type="button" disabled={busy} onClick={() => { setCursor(null); setRows([]); setOpenTrip(null); }}>Về trang đầu</button>}
      {next && <button className="button secondary" type="button" disabled={busy} onClick={() => { setCursor(next); setRows([]); setOpenTrip(null); }}>Trang tiếp theo</button>}
    </div>
  </section>;
}
