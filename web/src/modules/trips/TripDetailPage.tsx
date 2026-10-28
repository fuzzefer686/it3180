import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import type { TripDetails } from '../../../../shared/trips';
import { callFunction } from '../../lib/callable';
import { useSession } from '../auth/SessionProvider';
import { RouteSummary } from './RouteSummary';
import { TripOwnerActions } from './TripOwnerActions';
import { distanceText, estimatedPointsText, tripErrorText, tripStatusText, tripStatusTone, tripTime } from './format';

const preloadRouteMap = () => import('./RouteMap');
const RouteMap = lazy(() => preloadRouteMap().then(module => ({ default: module.RouteMap })));

export function TripDetailPage() {
  const { tripId } = useParams();
  const { user, profile, loading: sessionLoading } = useSession();
  const [trip, setTrip] = useState<TripDetails | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [pickup, setPickup] = useState(0);
  const [dropoff, setDropoff] = useState(1);
  const [distance, setDistance] = useState<number | null>(null);
  const [distanceError, setDistanceError] = useState('');

  useEffect(() => {
    let active = true;
    if (!tripId || !user) return;
    setLoading(true); setError(''); setTrip(null);
    void preloadRouteMap().catch(() => null);
    callFunction('getTrip', { tripId }).then(result => {
      if (!active) return;
      setTrip(result.trip);
      setIsOwner(result.isOwner);
      setPickup(0);
      setDropoff(result.trip.stops.length - 1);
    }).catch(err => {
      if (active) setError(tripErrorText(err));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [tripId, user?.id, refresh]);

  useEffect(() => {
    let active = true;
    setDistance(null); setDistanceError('');
    if (!trip || !user || dropoff <= pickup) return;
    callFunction('getTripSegmentDistance', {
      tripId: trip.id, pickupStopId: trip.stops[pickup].id, dropoffStopId: trip.stops[dropoff].id,
    }).then(result => {
      if (active) setDistance(result.distanceMeters);
    }).catch(err => {
      if (active) setDistanceError(tripErrorText(err));
    });
    return () => { active = false; };
  }, [trip, pickup, dropoff, user?.id]);

  async function changeStatus(action: 'start' | 'complete' | 'cancel', reason = '') {
    if (!trip) return;
    if (action === 'cancel' && !reason.trim()) {
      setError('Vui lòng nhập lý do hủy chuyến.');
      return;
    }
    setBusy(true); setError('');
    try {
      const result = action === 'start'
        ? await callFunction('startTrip', { tripId: trip.id })
        : action === 'complete'
          ? await callFunction('completeTrip', { tripId: trip.id })
          : await callFunction('cancelTrip', { tripId: trip.id, reason: reason.trim() });
      setTrip(result.trip);
    } catch (err) { setError(tripErrorText(err)); }
    finally { setBusy(false); }
  }

  if (sessionLoading) return <p role="status">Đang tải tài khoản…</p>;
  if (!user) return <p className="notice"><Link to="/tai-khoan">Đăng nhập để xem chuyến đi.</Link></p>;

  return <section className="trip-page">
    <div className="trip-top-bar">
      <Link className="trip-back-link" to="/chuyen-di"><ArrowLeft size={16}/> Tìm chuyến</Link>
      <button className="button secondary compact" type="button" disabled={busy || loading} onClick={() => setRefresh(refresh + 1)}>
        <RefreshCw size={14}/> Tải lại chuyến
      </button>
    </div>

    {loading && <div className="content-skeleton compact" role="status"><p className="trip-muted">Đang tải chuyến…</p><div/><div/></div>}
    {error && <p className="form-error" role="alert">{error}</p>}

    {trip && <>
      <header className="trip-heading-card">
        <div className="trip-heading-badges">
          <span className={`status-pill ${tripStatusTone[trip.status]}`}>{tripStatusText[trip.status]}</span>
          <span className={`status-pill ${trip.confirmedBookingId || trip.hasServedPassenger ? 'amber' : 'teal'}`}>
            {trip.confirmedBookingId || trip.hasServedPassenger ? 'Đã có người đồng hành' : 'Chưa nhận khách'}
          </span>
        </div>
        <h1>{trip.stops[0].label} → {trip.stops[trip.stops.length - 1].label}</h1>
        <dl className="trip-meta-grid">
          <div className="trip-meta-item"><dt>Tài xế</dt><dd>{trip.driverName}</dd></div>
          <div className="trip-meta-item"><dt>Khởi hành</dt><dd>{tripTime(trip.departureTimeMs)}</dd></div>
          <div className="trip-meta-item"><dt>Đến dự kiến</dt><dd>{trip.arrivalTimeMs === null ? 'Chưa có thông tin' : tripTime(trip.arrivalTimeMs)}</dd></div>
          <div className="trip-meta-item"><dt>Tổng quãng đường</dt><dd>{distanceText(trip.route.totalDistanceMeters)}</dd></div>
        </dl>
        {trip.note && <div className="trip-note-card"><strong>Ghi chú từ tài xế</strong><p className="trip-note">{trip.note}</p></div>}
        {trip.cancellationReason && <p className="notice danger">Lý do hủy: {trip.cancellationReason}</p>}
      </header>

      <div className="trip-detail-layout">
        <div className="trip-panel">
          <h2>Bản đồ & lộ trình chi tiết</h2>
          <Suspense fallback={<p role="status">Đang tải bản đồ…</p>}>
            <RouteMap stops={trip.stops} route={trip.route} highlightOrders={[pickup, dropoff]} />
          </Suspense>
          <RouteSummary stops={trip.stops} route={trip.route} />
        </div>

        <aside className="trip-detail-side">
          {isOwner && <TripOwnerActions trip={trip} canDrive={Boolean(profile?.eligibility.canDrive)} busy={busy} onStatusChange={changeStatus} />}
          <div className="trip-panel">
            <h2>Quãng đường bạn muốn đi</h2>
            <p className="trip-muted">Chọn điểm đón và điểm trả dọc lộ trình để tra cứu khoảng cách thực tế trên tuyến.</p>
            <div className="trip-field">
              <label className="trip-field"><span>Điểm đón</span>
                <select aria-label="Điểm đón" value={pickup} onChange={event => {
                  const next = Number(event.target.value); setPickup(next); if (dropoff <= next) setDropoff(next + 1);
                }}>
                  {trip.stops.slice(0, -1).map(stop => <option key={stop.id} value={stop.order}>{String.fromCharCode(65 + stop.order)}. {stop.label}</option>)}
                </select>
              </label>
              <label className="trip-field"><span>Điểm trả</span>
                <select aria-label="Điểm trả" value={dropoff} onChange={event => setDropoff(Number(event.target.value))}>
                  {trip.stops.slice(pickup + 1).map(stop => <option key={stop.id} value={stop.order}>{String.fromCharCode(65 + stop.order)}. {stop.label}</option>)}
                </select>
              </label>
            </div>
            <div className="trip-segment-box">
              {distance !== null && <>
                <div className="trip-segment-row"><span>Khoảng cách theo tuyến</span><strong>{distanceText(distance)}</strong></div>
                <div className="trip-segment-row"><span className="trip-muted">Điểm mô phỏng dự kiến (5.000 điểm/km)</span><strong>{estimatedPointsText(distance)}</strong></div>
              </>}
              {distance === null && !distanceError && <p role="status" className="trip-muted">Đang lấy khoảng cách…</p>}
              {distanceError && <p role="alert" className="form-error">{distanceError}</p>}
            </div>
            <button className="button primary" type="button" disabled>Gửi yêu cầu đi cùng (Chưa mở)</button>
            <p className="trip-muted">Chức năng gửi yêu cầu đi cùng chưa sẵn sàng.</p>
          </div>
        </aside>
      </div>
    </>}
  </section>;
}
