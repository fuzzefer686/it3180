import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock3, MapPin, Route } from 'lucide-react';
import type { ListTripsInput, TripCursor, TripListItem } from '../../../../shared/trips';
import { callFunction } from '../../lib/callable';
import { useSession } from '../auth/SessionProvider';
import { distanceText, tripErrorText, tripStatusText, tripStatusTone, tripTime } from './format';

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
      <div role="alert" className="trip-actions">
        <p className="form-error">{error}</p>
        <button className="button secondary" type="button" onClick={() => setRefresh(refresh + 1)}>Thử lại</button>
      </div>
    )}
    {!busy && !error && items.length === 0 && (
      <p className="notice">
        Chưa có chuyến phù hợp trong trang này.{nextCursor ? ' Bạn có thể xem trang tiếp theo.' : ''}
      </p>
    )}
    <div className="trip-cards">
      {items.map(trip => {
        const midCount = Math.max(0, trip.stopLabels.length - 2);
        return <Link className="trip-card" key={trip.id} to={'/chuyen-di/' + trip.id}>
          <div className="trip-card-top">
            <span className={`status-pill ${tripStatusTone[trip.status]}`}>{tripStatusText[trip.status]}</span>
            <span className={`status-pill ${trip.hasPassenger ? 'amber' : 'teal'}`}>
              {trip.hasPassenger ? 'Đã có người đồng hành' : 'Chưa nhận khách'}
            </span>
          </div>
          <h3>{trip.stopLabels[0]} → {trip.stopLabels[trip.stopLabels.length - 1]}</h3>
          <p className="trip-card-stops">
            <MapPin size={14}/>
            {midCount > 0 ? `Qua ${midCount} điểm dừng trung gian (${trip.stopLabels.slice(1, -1).join(' · ')})` : 'Lộ trình trực tiếp 2 điểm A → B'}
          </p>
          <div className="trip-card-meta">
            <span><Clock3 size={15}/> {tripTime(trip.departureTimeMs)}</span>
            <span><Route size={15}/> {distanceText(trip.totalDistanceMeters)}</span>
          </div>
          <div className="trip-card-footer">
            <span className="trip-driver-chip">
              <span className="trip-driver-avatar" aria-hidden="true">{trip.driverName.slice(0, 1).toUpperCase()}</span>
              <span>{trip.driverName}</span>
            </span>
            <span className="trip-card-link">Xem chi tiết <ArrowRight size={15}/></span>
          </div>
        </Link>;
      })}
    </div>
    {(cursor || nextCursor) && (
      <div className="trip-actions">
        {cursor && <button className="button secondary" type="button" disabled={busy} onClick={() => setCursor(null)}>Về trang đầu</button>}
        {nextCursor && <button className="button secondary" type="button" disabled={busy} onClick={() => setCursor(nextCursor)}>Trang tiếp theo</button>}
      </div>
    )}
  </section>;
}
