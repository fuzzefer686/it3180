import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { TripDetails } from '../../../../shared/trips';
import type { RouteStop } from '../../../../shared/contracts';
import { useSession } from '../auth/SessionProvider';
import { BookingAddressSearch } from './BookingAddressSearch';
import { bookingError, requestRide, type Booking, type BookingPlace } from './booking-api';

const RouteMap = lazy(() => import('../trips/RouteMap').then(module => ({ default: module.RouteMap })));
// This is proximity by coordinates, not a walking route or walking duration.
function straightDistance(a: BookingPlace, b: RouteStop): number {
  const radians = Math.PI / 180;
  const lat = (b.latitude - a.latitude) * radians;
  const lon = (b.longitude - a.longitude) * radians;
  const h = Math.sin(lat / 2) ** 2 + Math.cos(a.latitude * radians) * Math.cos(b.latitude * radians) * Math.sin(lon / 2) ** 2;
  return Math.round(6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h))));
}
function meters(value: number) { return value.toLocaleString('vi-VN') + ' m'; }

export function BookingRequestForm({ trip, onCreated }: { trip: TripDetails; onCreated: (booking: Booking) => void }) {
  const { user, profile, profileLoading } = useSession();
  const [origin, setOrigin] = useState<BookingPlace | null>(null);
  const [destination, setDestination] = useState<BookingPlace | null>(null);
  const [pickup, setPickup] = useState(0);
  const [dropoff, setDropoff] = useState(trip.stops.length - 1);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [result, setResult] = useState<Booking | null>(null);
  const [now, setNow] = useState(Date.now());
  const pending = useRef(false);
  const alive = useRef(true);
  const request = useRef<{ payload: string; id: string } | null>(null);
  useEffect(() => { alive.current = true; const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => { alive.current = false; clearInterval(timer); }; }, []);
  function resetChoice() { setAgreed(false); setError(''); setSuggestion(''); }
  function suggestStops() {
    resetChoice();
    if (!origin || !destination) { setSuggestion('Chọn cả hai địa chỉ từ gợi ý, hoặc chọn điểm hẹn thủ công.'); return; }
    let best: { pickup: number; dropoff: number; score: number } | null = null;
    for (let i = 0; i < trip.stops.length - 1; i++) {
      for (let j = i + 1; j < trip.stops.length; j++) {
        const startDistance = straightDistance(origin, trip.stops[i]);
        const endDistance = straightDistance(destination, trip.stops[j]);
        // A UI suggestion radius only; not a promise that the road is walkable.
        if (startDistance > 2000 || endDistance > 2000) continue;
        if (!best || startDistance + endDistance < best.score) best = { pickup: i, dropoff: j, score: startDistance + endDistance };
      }
    }
    if (!best) { setSuggestion('Không có cặp điểm dừng đúng chiều trong bán kính gợi ý 2 km ở cả hai đầu. Hãy tìm chuyến khác hoặc tự chọn điểm hẹn bạn có thể tới.'); return; }
    setPickup(best.pickup); setDropoff(best.dropoff);
    setSuggestion('Đã đề xuất cặp điểm dừng gần địa chỉ và đúng chiều tuyến. Hãy kiểm tra vị trí và xác nhận điểm hẹn.');
  }
  const start = trip.stops[pickup]; const end = trip.stops[dropoff];
  const distance = end.distanceFromStartMeters - start.distanceFromStartMeters;
  const unavailableReason = profileLoading ? 'Đang tải lại trạng thái tài khoản…'
    : !profile?.eligibility.canBook ? 'Hồ sơ hiện chưa đủ điều kiện đặt chuyến. Kiểm tra hồ sơ ở thông báo tài khoản phía trên.'
      : user?.id === trip.driverId ? 'Bạn không thể gửi yêu cầu đi cùng chuyến do chính mình đăng.'
        : trip.status !== 'OPEN' ? 'Chuyến này không còn mở để nhận yêu cầu mới.'
          : trip.hasServedPassenger ? 'Tài xế đã phục vụ khách cho chuyến này.'
            : trip.confirmedBookingId ? 'Chuyến đã có khách được tài xế nhận.'
              : now >= trip.departureTimeMs - 1800000 ? 'Đã đến mốc ngừng nhận yêu cầu mới: trước giờ xuất phát 30 phút.' : '';
  const available = !unavailableReason;
  async function submit() {
    if (pending.current || !agreed || !available || result) return;
    const payload = { tripId: trip.id, pickupStopId: start.id, dropoffStopId: end.id };
    const fingerprint = JSON.stringify(payload);
    if (request.current?.payload !== fingerprint) request.current = { payload: fingerprint, id: crypto.randomUUID() };
    pending.current = true; setBusy(true); setError('');
    try {
      const value = await requestRide({ ...payload, requestId: request.current.id });
      if (!alive.current) return;
      setResult(value); onCreated(value);
    } catch (err) { if (alive.current) setError(bookingError(err)); }
    finally { pending.current = false; if (alive.current) setBusy(false); }
  }
  return <section className="booking-panel" aria-labelledby="booking-request-title">
    <h2 id="booking-request-title">Chọn điểm hẹn đi cùng</h2>
    <p>Nhập địa chỉ để tìm điểm dừng gần đó, hoặc tự chọn trong tuyến. Tài xế đón/trả tại điểm hẹn bạn xác nhận.</p>
    <Suspense fallback={<p role="status">Đang tải bản đồ tuyến…</p>}><RouteMap stops={trip.stops} route={trip.route} /></Suspense>
    <fieldset disabled={busy || Boolean(result) || !profile?.eligibility.canBook || profileLoading}>
      <legend>1. Địa chỉ của bạn (không bắt buộc)</legend>
      <div className="booking-grid">
        <BookingAddressSearch label="Địa chỉ đi" onChange={place => { setOrigin(place); resetChoice(); }} />
        <BookingAddressSearch label="Địa chỉ đến" onChange={place => { setDestination(place); resetChoice(); }} />
      </div>
      <button type="button" className="button secondary" onClick={suggestStops}>Gợi ý điểm hẹn gần địa chỉ</button>
      {suggestion && <p role="status" className="notice">{suggestion}</p>}
      <p className="booking-muted">Gợi ý dùng khoảng cách đường thẳng tối đa 2 km, không phải quãng đường đi bộ. Bạn cần tự kiểm tra đường tới điểm hẹn và nơi dừng xe an toàn.</p>
      <h3>2. Kiểm tra và chọn điểm hẹn thực tế</h3>
      <div className="booking-grid">
        <label className="booking-field"><span>Điểm đón trên tuyến</span><select value={pickup} onChange={event => {
          const next = Number(event.target.value); setPickup(next); if (dropoff <= next) setDropoff(next + 1); resetChoice();
        }}>{trip.stops.slice(0, -1).map((stop, index) => <option value={index} key={stop.id}>{String.fromCharCode(65 + stop.order)}. {stop.label}</option>)}</select></label>
        <label className="booking-field"><span>Điểm trả trên tuyến</span><select value={dropoff} onChange={event => { setDropoff(Number(event.target.value)); resetChoice(); }}>
          {trip.stops.map((stop, index) => index > pickup && <option value={index} key={stop.id}>{String.fromCharCode(65 + stop.order)}. {stop.label}</option>)}
        </select></label>
      </div>
      <p><strong>Đón:</strong> {start.label} ({start.latitude}, {start.longitude})
        {origin && <> — cách địa chỉ đi khoảng {meters(straightDistance(origin, start))} theo đường thẳng</>}</p>
      <p><strong>Trả:</strong> {end.label} ({end.latitude}, {end.longitude})
        {destination && <> — cách địa chỉ đến khoảng {meters(straightDistance(destination, end))} theo đường thẳng</>}</p>
      <p>Đoạn ngồi xe: <strong>{meters(distance)}</strong>. Giá dự kiến: <strong>{(distance * 5).toLocaleString('vi-VN')} điểm demo</strong>.</p>
      <p className="booking-muted">Backend kiểm tra lại điểm dừng và chốt giá khi tài xế nhận yêu cầu. Gửi yêu cầu chưa giữ chỗ.</p>
      <label className="booking-consent"><input type="checkbox" checked={agreed} onChange={event => setAgreed(event.target.checked)} />
        Tôi đồng ý tới điểm đón và xuống tại điểm trả đã chọn, không yêu cầu đón tận địa chỉ vừa nhập.</label>
      <button type="button" className="button primary" disabled={!agreed || !available || distance <= 0 || busy} onClick={() => void submit()}>
        {busy ? 'Đang gửi…' : 'Gửi yêu cầu đi cùng'}</button>
    </fieldset>
    {!available && !result && <p className="notice">{unavailableReason}</p>}
    {error && <p role="alert" className="form-error">{error} Nếu chưa rõ lần gửi đã thành công chưa, giữ nguyên điểm hẹn rồi thử lại hoặc tải danh sách của bạn.</p>}
    {result && <p role="status" className="notice">Đã nhận kết quả yêu cầu: {result.status}. Xem ở mục “Yêu cầu của tôi”; không tạo yêu cầu trùng.</p>}
  </section>;
}
