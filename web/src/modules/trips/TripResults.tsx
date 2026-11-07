import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { ListTripsInput, TripCursor, TripListItem } from '../../../../shared/trips';
import { callFunction } from '../../lib/callable';
import { useSession } from '../auth/SessionProvider';
import { distanceText, toVietnamInput, tripErrorText, tripStatusText, tripStatusTone, tripStopParts } from './format';

function TripCard({ trip }: { trip: TripListItem }) {
  const originLabel = trip.stopLabels[0] || 'Điểm đi';
  const destinationLabel = trip.stopLabels.at(-1) || 'Điểm đến';
  const origin = tripStopParts(originLabel);
  const destination = tripStopParts(destinationLabel);
  const stops = trip.stopLabels.slice(1, -1);
  const [date, hour] = toVietnamInput(trip.departureTimeMs).split('T');
  const isToday = date === toVietnamInput(Date.now()).slice(0, 10);
  const availability = trip.hasPassenger ? 'Đã có người đồng hành' : 'Chưa nhận khách';
  const status = trip.status === 'OPEN' ? availability : tripStatusText[trip.status];
  const tone = trip.status === 'OPEN' && trip.hasPassenger ? 'amber' : tripStatusTone[trip.status];

  return <Link className="trip-card" to={'/chuyen-di/' + trip.id}>
    <div className="trip-card-top">
      <time className="trip-card-time" dateTime={new Date(trip.departureTimeMs).toISOString()}>
        <strong>{hour}</strong><span>{isToday && 'Hôm nay · '}{date.split('-').reverse().join('/')}</span>
      </time>
      <div className="trip-card-availability">
        <span className={`status-pill ${tone}`}><span className="trip-status-dot" aria-hidden="true"/>{status}</span>
        <span>{distanceText(trip.totalDistanceMeters)}</span>
      </div>
    </div>
    <div className="trip-timeline">
      <div className="trip-timeline-track" aria-hidden="true"><span/><span/><span/></div>
      <div className="trip-timeline-place" title={originLabel}>
        <strong>{origin.name}</strong><span>{origin.address || 'Điểm xuất phát'}</span>
      </div>
      {stops.length > 0 ? (
        <p className="trip-timeline-stops" title={stops.join(' · ')}>
          +{stops.length} điểm đón · {stops.map(label => tripStopParts(label).name).join(' · ')}
        </p>
      ) : <p className="trip-timeline-direct">Đi thẳng, không dừng giữa đường</p>}
      <div className="trip-timeline-place" title={destinationLabel}>
        <strong>{destination.name}</strong><span>{destination.address || 'Điểm đến'}</span>
      </div>
    </div>
    <div className="trip-card-footer">
      <span className="trip-driver-chip" title={trip.driverName}>
        <span className="trip-driver-avatar" aria-hidden="true">{trip.driverName.slice(0, 1).toUpperCase()}</span>
        <span>{trip.driverName}</span>
      </span>
      <span className="trip-card-link">Xem chi tiết <ArrowRight size={15}/></span>
    </div>
  </Link>;
}

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
      {items.map(trip => <TripCard key={trip.id} trip={trip}/>)}
    </div>
    {(cursor || nextCursor) && (
      <div className="trip-actions">
        {cursor && <button className="button secondary" type="button" disabled={busy} onClick={() => setCursor(null)}>Về trang đầu</button>}
        {nextCursor && <button className="button secondary" type="button" disabled={busy} onClick={() => setCursor(nextCursor)}>Trang tiếp theo</button>}
      </div>
    )}
  </section>;
}
