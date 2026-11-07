import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { TripDetails } from '../../../../shared/trips';
import { useSession } from '../auth/SessionProvider';
import { bookingError, bookingNotice, bookingStatusLabels, getBooking, getBookingTripState, requestRide, type Booking, type BookingTripState } from './booking-api';
import { useBookingRefresh } from './useBookingRefresh';

export function BookingSubmit({ trip, pickupStopId, dropoffStopId, distanceMeters, onPendingChange }: {
  trip: TripDetails; pickupStopId: string; dropoffStopId: string; distanceMeters: number | null;
  onPendingChange?: (pending: boolean) => void;
}) {
  const { user, profile, profileLoading } = useSession();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Booking | null>(null);
  const [resultTrip, setResultTrip] = useState<BookingTripState>();
  const [updateError, setUpdateError] = useState('');
  const [now, setNow] = useState(Date.now());
  const pending = useRef(false);
  const alive = useRef(true);
  const request = useRef<{ fingerprint: string; id: string } | null>(null);
  useEffect(() => {
    alive.current = true;
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => { alive.current = false; clearInterval(timer); };
  }, []);
  useEffect(() => { setAgreed(false); setError(''); }, [pickupStopId, dropoffStopId]);
  const resultId = result?.id;
  const updateRevision = useRef(0);
  const refreshResult = useCallback(() => {
    if (!resultId || pending.current) return;
    const revision = ++updateRevision.current;
    void getBooking(resultId).then(async booking => {
      const state = booking.status === 'WAITING' ? await getBookingTripState(booking.tripId) : undefined;
      if (alive.current && updateRevision.current === revision) {
        setResult(booking); setResultTrip(state); setUpdateError('');
      }
    }).catch(err => { if (alive.current && updateRevision.current === revision) setUpdateError(bookingError(err)); });
  }, [resultId]);
  useBookingRefresh(refreshResult);
  useEffect(() => { refreshResult(); return () => { updateRevision.current++; }; }, [refreshResult]);
  const unavailable = !user ? 'Đăng nhập để gửi yêu cầu đi cùng.'
    : profileLoading ? 'Đang kiểm tra điều kiện tài khoản…'
      : profile?.status !== 'ACTIVE' || !profile.eligibility.canBook ? 'Hồ sơ hiện chưa đủ điều kiện đặt chuyến. Hãy kiểm tra tại trang Tài khoản.'
        : user.id === trip.driverId ? 'Bạn không thể đặt chuyến do chính mình đăng.'
          : trip.status !== 'OPEN' ? 'Chuyến không còn mở để nhận yêu cầu mới.'
            : trip.hasServedPassenger ? 'Chuyến này đã phục vụ khách.'
              : trip.confirmedBookingId ? 'Chuyến đã có khách được tài xế nhận.'
                : now >= trip.departureTimeMs - 1800000 ? 'Đã đến mốc ngừng nhận yêu cầu: trước giờ đi 30 phút.'
                  : distanceMeters === null || distanceMeters <= 0 ? 'Chọn điểm đón và điểm trả để kiểm tra quãng đường.' : '';
  async function submit() {
    if (pending.current || unavailable || !agreed || result) return;
    const input = { tripId: trip.id, pickupStopId, dropoffStopId };
    const fingerprint = JSON.stringify({ uid: user?.id, ...input });
    if (request.current?.fingerprint !== fingerprint) request.current = { fingerprint, id: crypto.randomUUID() };
    pending.current = true; setBusy(true); setError(''); onPendingChange?.(true);
    try {
      const booking = await requestRide({ ...input, requestId: request.current.id });
      if (alive.current) setResult(booking);
    } catch (err) { if (alive.current) setError(bookingError(err)); }
    finally {
      pending.current = false;
      if (alive.current) { setBusy(false); onPendingChange?.(false); }
    }
  }
  return <>
    {!result && <label className="checkbox-field">
      <input type="checkbox" checked={agreed} disabled={busy || Boolean(unavailable)} onChange={event => setAgreed(event.target.checked)} />
      Tôi đồng ý tới điểm đón và xuống tại điểm trả đã chọn trên tuyến.
    </label>}
    <button className="button primary" type="button" disabled={busy || Boolean(unavailable) || !agreed || Boolean(result)} onClick={() => void submit()}>
      {busy ? 'Đang gửi yêu cầu…' : result ? 'Đã có kết quả yêu cầu' : 'Gửi yêu cầu đi cùng'}
    </button>
    {!result && unavailable && <p className="trip-muted">{unavailable} <Link to="/tai-khoan">Xem tài khoản</Link></p>}
    {!result && !unavailable && <p className="trip-muted">Gửi yêu cầu chưa giữ chỗ. Giá được server chốt khi tài xế nhận khách.</p>}
    {error && <p className="form-error" role="alert">{error} Giữ nguyên điểm hẹn để thử lại, hoặc xem “Chuyến của tôi” trước khi gửi mới.</p>}
    {result && <p className="form-notice" role="status">{bookingStatusLabels[result.status]}: {result.pickupLabel} → {result.dropoffLabel}. <Link to="/dat-chuyen">Xem yêu cầu của tôi</Link></p>}
    {result && bookingNotice(result, false, resultTrip) && <p className="notice" role="status">{bookingNotice(result, false, resultTrip)}</p>}
    {result && <p className="trip-muted">Trạng thái tự cập nhật mỗi 30 giây khi trang đang hiển thị.</p>}
    {result && updateError && <p className="form-error" role="alert">Chưa cập nhật được trạng thái: {updateError}</p>}
  </>;
}
