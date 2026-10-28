import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { ListTripsInput, TripCursor, TripListItem } from '../../../../shared/trips';
import { callFunction } from '../../lib/callable';
import { useSession } from '../auth/SessionProvider';
import { distanceText, tripClock, tripDay, tripErrorText, tripStatusText, tripStatusTone, tripTime } from './format';

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
      } catch (err) {
        if (active) setError(tripErrorText(err));
      } finally {
        if (active) setBusy(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [filters, cursor, user?.id, refresh]);

  if (sessionLoading) return <div className="content-skeleton compact" role="status"><p className="trip-muted">Đang tải tài khoản…</p><div/><div/></div>;
  if (!user) return <p className="notice"><Link to="/tai-khoan">Đăng nhập để xem các chuyến đi.</Link></p>;

  return <section className="trip-results" aria-label="Kết quả tìm chuyến" aria-busy={busy}>
    {busy && <div className="content-skeleton compact" role="status"><p className="trip-muted">Đang tìm chuyến…</p><div/><div/></div>}
    {error && (
      <div role="alert" className="notice danger">
        <span>{error}</span>
        <button className="button secondary compact notice-action" type="button" onClick={() => setRefresh(refresh + 1)}>Thử lại</button>
      </div>
    )}
    {!busy && !error && items.length === 0 && (
      <p className="notice">
        {filters.mine && !cursor
          ? 'Bạn chưa đăng chuyến nào. Bấm “Đăng chuyến” để mở chuyến đầu tiên.'
          : `Chưa có chuyến phù hợp trong trang này.${nextCursor ? ' Bạn có thể xem trang tiếp theo.' : ''}`}
      </p>
    )}
    {items.length > 0 && (
      <ol className="trip-list">
        {items.map(trip => {
          const via = trip.stopLabels.slice(1, -1);
          return <li key={trip.id}>
            <Link className="trip-row" to={'/chuyen-di/' + trip.id} aria-label={`Xem chi tiết chuyến ${trip.stopLabels[0]} đến ${trip.stopLabels[trip.stopLabels.length - 1]}, ${tripTime(trip.departureTimeMs)}`}>
              <span className="trip-row-time">
                <strong>{tripClock(trip.departureTimeMs)}</strong>
                <span>{tripDay(trip.departureTimeMs)}</span>
              </span>
              <span className="trip-row-route">
                <strong>{trip.stopLabels[0]} <span aria-hidden="true">→</span> {trip.stopLabels[trip.stopLabels.length - 1]}</strong>
                <span>{via.length > 0 ? `Qua ${via.join(' · ')}` : 'Không dừng giữa đường'}</span>
              </span>
              <span className="trip-row-meta">
                <strong>{distanceText(trip.totalDistanceMeters)}</strong>
                <span>{trip.driverName}</span>
              </span>
              <span className="trip-row-status">
                <span className={`status-pill ${tripStatusTone[trip.status]}`}>{tripStatusText[trip.status]}</span>
                <span>{trip.hasPassenger ? 'Đã có người đồng hành' : 'Chưa nhận khách'}</span>
              </span>
              <ChevronRight className="trip-row-chevron" size={18} aria-hidden="true"/>
            </Link>
          </li>;
        })}
      </ol>
    )}
    {(cursor || nextCursor) && (
      <div className="trip-actions">
        {cursor && <button className="button secondary" type="button" disabled={busy} onClick={() => setCursor(null)}>Về trang đầu</button>}
        {nextCursor && <button className="button secondary" type="button" disabled={busy} onClick={() => setCursor(nextCursor)}>Trang tiếp theo</button>}
      </div>
    )}
  </section>;
}
