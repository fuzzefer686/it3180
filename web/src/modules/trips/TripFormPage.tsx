import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Compass, Plus } from 'lucide-react';
import type { RouteStop } from '../../../../shared/contracts';
import type { RouteSnapshot, SaveTripInput, TripStopInput } from '../../../../shared/trips';
import { callFunction } from '../../lib/callable';
import { useSession } from '../auth/SessionProvider';
import { PlaceSearch } from './PlaceSearch';
import { RouteSummary } from './RouteSummary';
import { fromVietnamInput, toVietnamInput, tripErrorText } from './format';

const preloadRouteMap = () => import('./RouteMap');
const RouteMap = lazy(() => preloadRouteMap().then(module => ({ default: module.RouteMap })));

interface DraftStop { key: string; place: TripStopInput | null }
interface Preview { stops: RouteStop[]; route: RouteSnapshot }
function emptyStop(): DraftStop { return { key: crypto.randomUUID(), place: null }; }

export function TripFormPage() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const { user, profile, loading, profileLoading } = useSession();
  const [stops, setStops] = useState<DraftStop[]>(() => [emptyStop(), emptyStop()]);
  const [departure, setDeparture] = useState('');
  const [arrival, setArrival] = useState('');
  const [note, setNote] = useState('');
  const [routeVersion, setRouteVersion] = useState(1);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [initialLoading, setInitialLoading] = useState(Boolean(tripId));
  const [loaded, setLoaded] = useState(!tripId);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    if (!tripId || !user) return;
    const id = tripId;
    setInitialLoading(true); setLoaded(false);
    void preloadRouteMap().catch(() => null);
    callFunction('getTrip', { tripId: id }).then(result => {
      if (!active) return;
      const trip = result.trip;
      if (!result.isOwner || trip.status !== 'OPEN' || trip.confirmedBookingId || trip.hasServedPassenger) {
        setError('Bạn chỉ được sửa chuyến của mình khi đang mở và chưa nhận khách.');
        return;
      }
      setStops(trip.stops.map(stop => ({ key: crypto.randomUUID(), place: { label: stop.label, latitude: stop.latitude, longitude: stop.longitude } })));
      setDeparture(toVietnamInput(trip.departureTimeMs));
      setArrival(trip.arrivalTimeMs === null ? '' : toVietnamInput(trip.arrivalTimeMs));
      setNote(trip.note); setRouteVersion(trip.routeVersion);
      setPreview({ stops: trip.stops, route: trip.route }); setLoaded(true);
    }).catch(err => { if (active) setError(tripErrorText(err)); }).finally(() => { if (active) setInitialLoading(false); });
    return () => { active = false; };
  }, [tripId, user?.id]);

  function selectedStops(): TripStopInput[] {
    return stops.map(stop => {
      if (!stop.place) throw new Error('Hãy chọn tất cả điểm dừng từ gợi ý địa chỉ.');
      return stop.place;
    });
  }
  function changeStops(next: DraftStop[]) { setStops(next); setPreview(null); setError(''); }

  async function previewRoute() {
    setError('');
    let selected: TripStopInput[];
    try { selected = selectedStops(); } catch { setError('Hãy chọn tất cả điểm dừng từ gợi ý địa chỉ.'); return; }
    setBusy(true);
    try {
      const [result] = await Promise.all([
        callFunction('previewTripRoute', { stops: selected }),
        preloadRouteMap().catch(() => null),
      ]);
      setPreview(result);
    } catch (err) { setError(tripErrorText(err)); }
    finally { setBusy(false); }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    let selected: TripStopInput[];
    try { selected = selectedStops(); } catch { setError('Hãy chọn tất cả điểm dừng từ gợi ý địa chỉ.'); return; }
    const input: SaveTripInput = { stops: selected, departureTimeMs: fromVietnamInput(departure), arrivalTimeMs: fromVietnamInput(arrival), note: note.trim() };
    if (!Number.isFinite(input.departureTimeMs) || !Number.isFinite(input.arrivalTimeMs)
      || input.departureTimeMs <= Date.now() || input.arrivalTimeMs <= input.departureTimeMs) {
      setError('Chọn giờ đi trong tương lai và giờ đến sau giờ đi.'); return;
    }
    setBusy(true);
    try {
      const result = tripId ? await callFunction('updateTrip', { ...input, tripId, routeVersion }) : await callFunction('createTrip', input);
      navigate('/chuyen-di/' + result.trip.id);
    } catch (err) { setError(tripErrorText(err)); }
    finally { setBusy(false); }
  }

  if (loading || profileLoading) return <p role="status">Đang tải tài khoản…</p>;
  if (!user) return <p className="notice"><Link to="/tai-khoan">Đăng nhập để đăng chuyến.</Link></p>;
  if (!profile?.eligibility.canDrive) {
    return <p className="notice">Bạn cần nhập loại xe và biển số trong hồ sơ để đăng chuyến. <Link to="/tai-khoan">Hoàn thiện hồ sơ</Link></p>;
  }
  const minNow = toVietnamInput(Date.now() + 60_000);

  return <section className="trip-page">
    <div className="trip-top-bar">
      <Link className="trip-back-link" to="/chuyen-di"><ArrowLeft size={16}/> Tìm chuyến</Link>
      <span className="status-pill teal">Từ 2 đến 8 điểm dừng xe máy</span>
    </div>
    <div className="trip-page-header">
      <div><h1>{tripId ? 'Sửa chuyến đi' : 'Đăng chuyến đi'}</h1><p className="trip-muted">Chọn lộ trình xe máy và các điểm bạn có thể đón, trả người đi cùng dọc đường.</p></div>
    </div>
    {error && <p role="alert" className="form-error">{error}</p>}
    {initialLoading && <p role="status">Đang tải chuyến…</p>}
    {loaded && (
      <div className="trip-builder-layout">
        <form noValidate onSubmit={save} className="trip-panel">
          <fieldset disabled={busy}>
            <legend>Các điểm dừng theo thứ tự</legend>
            <div className="trip-stops-builder">
              {stops.map((stop, index) => {
                const code = String.fromCharCode(65 + index);
                return <div className="trip-stop-editor" key={stop.key}>
                  <span className={`trip-stop-pin${index === stops.length - 1 ? ' end' : ''}`} aria-hidden="true">{code}</span>
                  <PlaceSearch label={code + '. Điểm dừng'} value={stop.place} onChange={place => {
                    setStops(current => current.map(row => row.key === stop.key ? { key: row.key, place } : row));
                    setPreview(null); setError('');
                  }} />
                  <div className="trip-stop-controls">
                    <button type="button" className="trip-mini-btn" disabled={index === 0} onClick={() => {
                      const next = [...stops]; next[index] = stops[index - 1]; next[index - 1] = stop; changeStops(next);
                    }}>Lên</button>
                    <button type="button" className="trip-mini-btn" disabled={index === stops.length - 1} onClick={() => {
                      const next = [...stops]; next[index] = stops[index + 1]; next[index + 1] = stop; changeStops(next);
                    }}>Xuống</button>
                    <button type="button" className="trip-mini-btn danger" disabled={stops.length <= 2}
                      onClick={() => changeStops(stops.filter(row => row.key !== stop.key))}>Xóa</button>
                  </div>
                </div>;
              })}
            </div>
            <div className="trip-actions">
              <button className="button secondary compact" type="button" disabled={stops.length >= 8} onClick={() => {
                const next = [...stops]; next.splice(next.length - 1, 0, emptyStop()); changeStops(next);
              }}><Plus size={15}/> Thêm điểm dừng</button>
              <span className="trip-muted">Điểm A là nơi xuất phát, điểm cuối là nơi kết thúc.</span>
            </div>
            <div className="trip-form-grid">
              <label className="trip-field"><span>Giờ đi (giờ Việt Nam)</span><input type="datetime-local" required min={minNow} value={departure} onChange={event => { setDeparture(event.target.value); setError(''); }} /></label>
              <label className="trip-field"><span>Giờ đến dự kiến (giờ Việt Nam)</span><input type="datetime-local" required min={departure || minNow} value={arrival} onChange={event => { setArrival(event.target.value); setError(''); }} /></label>
            </div>
            <label className="trip-field"><span>Ghi chú</span><textarea rows={3} maxLength={1000} placeholder="Ví dụ: Có sẵn 1 mũ bảo hiểm phụ, nhận balo gọn nhẹ…" value={note} onChange={event => setNote(event.target.value)} /></label>
            <div className="trip-actions">
              <button className="button secondary" type="button" onClick={previewRoute}>Xem trước tuyến</button>
              <button className="button primary" type="submit">{busy ? 'Đang xử lý…' : 'Lưu chuyến'}</button>
            </div>
          </fieldset>
        </form>
        <aside className="trip-preview-sticky" aria-label="Bản đồ xem trước lộ trình">
          {preview ? (
            <div className="trip-panel">
              <h2>Bản đồ & khoảng cách dự kiến</h2>
              <Suspense fallback={<p role="status">Đang tải bản đồ…</p>}>
                <RouteMap stops={preview.stops} route={preview.route} />
              </Suspense>
              <RouteSummary stops={preview.stops} route={preview.route} />
            </div>
          ) : (
            <div className="trip-preview-placeholder">
              <span className="trip-preview-icon"><Compass size={26}/></span>
              <h2>Xem trước tuyến VietMap</h2>
              <p className="trip-muted">Sau khi chọn đủ điểm dừng từ gợi ý địa chỉ, bấm “Xem trước tuyến” để kiểm tra đường đi xe máy và khoảng cách từng chặng trước khi lưu.</p>
            </div>
          )}
        </aside>
      </div>
    )}
  </section>;
}
