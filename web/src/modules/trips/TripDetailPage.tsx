import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { TripDetails } from '../../../../shared/trips';
import { callFunction } from '../../lib/callable';
import { useSession } from '../auth/SessionProvider';
import { RouteSummary } from './RouteSummary';
import { distanceText, tripErrorText, tripStatusText, tripTime } from './format';

// SDK bản đồ nặng nên tách khỏi bundle chính; trang chi tiết vẫn xem được thông tin khi chưa tải xong.
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
  const [showCancel, setShowCancel] = useState(false);
  const [reason, setReason] = useState('');
  const [pickup, setPickup] = useState(0);
  const [dropoff, setDropoff] = useState(1);
  const [distance, setDistance] = useState<number | null>(null);
  const [distanceError, setDistanceError] = useState('');
  useEffect(() => {
    let active = true;
    if (!tripId || !user) return;
    setLoading(true);
    setError('');
    setTrip(null);
    // Tải trước SDK bản đồ song song với lúc lấy dữ liệu chuyến.
    void preloadRouteMap().catch(() => null);
    callFunction('getTrip', { tripId }).then(result => {
      if (!active) return;
      setTrip(result.trip);
      setIsOwner(result.isOwner);
      setPickup(0);
      setDropoff(result.trip.stops.length - 1);
    }).catch(error => {
      if (active) setError(tripErrorText(error));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [tripId, user?.id, refresh]);
  useEffect(() => {
    let active = true;
    setDistance(null);
    setDistanceError('');
    if (!trip || !user || dropoff <= pickup) return;
    callFunction('getTripSegmentDistance', {
      tripId: trip.id, pickupStopId: trip.stops[pickup].id, dropoffStopId: trip.stops[dropoff].id,
    }).then(result => {
      if (active) setDistance(result.distanceMeters);
    }).catch(error => {
      if (active) setDistanceError(tripErrorText(error));
    });
    return () => { active = false; };
  }, [trip, pickup, dropoff, user?.id]);
  async function changeStatus(action: 'start' | 'complete' | 'cancel') {
    if (!trip) return;
    if (action === 'cancel' && !reason.trim()) {
      setError('Vui lòng nhập lý do hủy chuyến.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      let result;
      if (action === 'start') result = await callFunction('startTrip', { tripId: trip.id });
      else if (action === 'complete') result = await callFunction('completeTrip', { tripId: trip.id });
      else result = await callFunction('cancelTrip', { tripId: trip.id, reason: reason.trim() });
      setTrip(result.trip);
      setShowCancel(false);
    } catch (error) { setError(tripErrorText(error)); }
    finally { setBusy(false); }
  }
  if (sessionLoading) return <p role="status">Đang tải tài khoản…</p>;
  if (!user) return <p className="notice"><Link to="/tai-khoan">Đăng nhập để xem chuyến đi.</Link></p>;
  return <section className="trip-page">
    <Link to="/chuyen-di">← Tìm chuyến</Link>
    {loading && <p role="status">Đang tải chuyến…</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="text-button" disabled={busy || loading} onClick={() => setRefresh(refresh + 1)}>Tải lại chuyến</button>
    {trip && <>
      <header className="trip-heading">
        <span className="trip-badge">{tripStatusText[trip.status]}</span>
        <h1>{trip.stops[0].label} → {trip.stops[trip.stops.length - 1].label}</h1>
        <p>Tài xế: {trip.driverName}</p>
        <p>Khởi hành: {tripTime(trip.departureTimeMs)}</p>
        <p>Đến dự kiến: {trip.arrivalTimeMs === null ? 'Chưa có thông tin' : tripTime(trip.arrivalTimeMs)}</p>
      </header>
      {trip.note && <p className="trip-note">{trip.note}</p>}
      {trip.cancellationReason && <p className="notice">Lý do hủy: {trip.cancellationReason}</p>}
      {isOwner && (trip.status === 'OPEN' || trip.status === 'IN_PROGRESS') && <div className="trip-panel">
        <h2>Quản lý chuyến</h2>
        <div className="trip-actions">
          {trip.status === 'OPEN' && <>
            <button className="button primary" disabled={busy || !profile?.eligibility.canDrive} onClick={() => changeStatus('start')}>Bắt đầu chuyến</button>
            {profile?.eligibility.canDrive && !trip.confirmedBookingId && !trip.hasServedPassenger && !busy
              && <Link className="button secondary" to={'/chuyen-di/' + trip.id + '/sua'}>Sửa chuyến</Link>}
            <button className="button secondary" disabled={busy} onClick={() => setShowCancel(true)}>Hủy chuyến</button>
          </>}
          {trip.status === 'IN_PROGRESS'
            && <button className="button primary" disabled={busy} onClick={() => changeStatus('complete')}>Kết thúc chuyến</button>}
        </div>
        {trip.status === 'OPEN' && !profile?.eligibility.canDrive && <p className="notice">
          Hồ sơ hiện chưa đủ điều kiện để sửa hoặc bắt đầu chuyến. <Link to="/tai-khoan">Xem hồ sơ</Link>
        </p>}
        {showCancel && <form onSubmit={event => { event.preventDefault(); void changeStatus('cancel'); }}>
          <label className="trip-field"><span>Lý do hủy</span>
            <textarea required maxLength={500} value={reason} disabled={busy} onChange={event => setReason(event.target.value)} /></label>
          <div className="trip-actions">
            <button className="button primary" disabled={busy}>Xác nhận hủy</button>
            <button type="button" className="button secondary" disabled={busy} onClick={() => setShowCancel(false)}>Giữ chuyến</button>
          </div>
        </form>}
      </div>}
      <div className="trip-panel">
        <Suspense fallback={<p role="status">Đang tải bản đồ…</p>}>
          <RouteMap stops={trip.stops} route={trip.route} />
        </Suspense>
        <RouteSummary stops={trip.stops} route={trip.route} /></div>
      <div className="trip-panel">
        <h2>Quãng đường bạn muốn đi</h2>
        <div className="trip-form-grid">
          <label className="trip-field"><span>Điểm đón</span>
            <select aria-label="Điểm đón" value={pickup} onChange={event => {
              const next = Number(event.target.value);
              setPickup(next);
              if (dropoff <= next) setDropoff(next + 1);
            }}>
              {trip.stops.slice(0, -1).map(stop => <option key={stop.id} value={stop.order}>{stop.label}</option>)}
            </select></label>
          <label className="trip-field"><span>Điểm trả</span>
            <select aria-label="Điểm trả" value={dropoff} onChange={event => setDropoff(Number(event.target.value))}>
              {trip.stops.slice(pickup + 1).map(stop => <option key={stop.id} value={stop.order}>{stop.label}</option>)}
            </select></label>
        </div>
        {distance !== null && <p>Khoảng cách theo tuyến: <strong>{distanceText(distance)}</strong></p>}
        {distance === null && !distanceError && <p role="status">Đang lấy khoảng cách…</p>}
        {distanceError && <p role="alert" className="form-error">{distanceError}</p>}
        <p className="trip-muted">Chức năng gửi yêu cầu đi cùng chưa sẵn sàng.</p>
      </div>
    </>}
  </section>;
}
