import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ListTripsInput, TripCursor, TripListItem } from '../../../../shared/trips';
import { callFunction } from '../../lib/callable';
import { useSession } from '../auth/SessionProvider';
import { distanceText, tripErrorText, tripStatusText, tripTime } from './format';

export function TripResults({ filters }: { filters: ListTripsInput }) {
  const { user, loading: sessionLoading } = useSession();
  const [items, setItems] = useState<TripListItem[]>([]);
  const [cursor, setCursor] = useState<TripCursor | null>(null);
  const [nextCursor, setNextCursor] = useState<TripCursor | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    setItems([]);
    setNextCursor(null);
    if (!user) return;
    async function load() {
      setBusy(true);
      setError('');
      try {
        const input: ListTripsInput = { ...filters };
        if (cursor) input.cursor = cursor;
        const result = await callFunction('listTrips', input);
        if (active) {
          setItems(result.items);
          setNextCursor(result.nextCursor);
        }
      } catch (error) {
        if (active) setError(tripErrorText(error));
      } finally {
        if (active) setBusy(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [filters, cursor, user?.id, refresh]);
  if (sessionLoading) return <p role="status">Đang tải tài khoản…</p>;
  if (!user) return <p className="notice"><Link to="/tai-khoan">Đăng nhập để xem các chuyến đi.</Link></p>;
  return <section className="trip-results" aria-label="Kết quả tìm chuyến" aria-busy={busy}>
    {busy && <p role="status">Đang tìm chuyến…</p>}
    {error && <div role="alert"><p className="form-error">{error}</p>
      <button className="button secondary" onClick={() => setRefresh(refresh + 1)}>Thử lại</button></div>}
    {!busy && !error && items.length === 0 && <p className="notice">
      Chưa có chuyến phù hợp trong trang này.{nextCursor ? ' Bạn có thể xem trang tiếp theo.' : ''}
    </p>}
    <div className="trip-cards">{items.map(trip => <Link className="trip-card" key={trip.id} to={'/chuyen-di/' + trip.id}>
      <span className="trip-badge">{tripStatusText[trip.status]}</span>
      <h3>{trip.stopLabels[0]} → {trip.stopLabels[trip.stopLabels.length - 1]}</h3>
      <p>{tripTime(trip.departureTimeMs)} · {distanceText(trip.totalDistanceMeters)}</p>
      <p className="trip-muted">{trip.driverName} · {trip.hasPassenger ? 'Đã có người đồng hành' : 'Chưa nhận khách'}</p>
      <span className="trip-card-link">Xem chi tiết →</span>
    </Link>)}</div>
    <div className="trip-actions">
      {cursor && <button className="button secondary" disabled={busy} onClick={() => setCursor(null)}>Về trang đầu</button>}
      {nextCursor && <button className="button secondary" disabled={busy} onClick={() => setCursor(nextCursor)}>Trang tiếp theo</button>}
    </div>
  </section>;
}
