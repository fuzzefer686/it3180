import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { RouteStop } from '../../../../shared/contracts';
import type { RouteSnapshot, SaveTripInput, TripStopInput } from '../../../../shared/trips';
import { callFunction } from '../../lib/callable';
import { useSession } from '../auth/SessionProvider';
import { PlaceSearch } from './PlaceSearch';
import { RouteSummary } from './RouteSummary';
import { fromVietnamInput, toVietnamInput, tripErrorText } from './format';

// SDK bản đồ rất nặng: tách khỏi bundle chính để mở form nhanh, chỉ tải khi xem tuyến.
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
    async function load() {
      setInitialLoading(true);
      setLoaded(false);
      try {
        const result = await callFunction('getTrip', { tripId: id });
        if (!active) return;
        const trip = result.trip;
        if (!result.isOwner || trip.status !== 'OPEN' || trip.confirmedBookingId || trip.hasServedPassenger) {
          setError('Bạn chỉ được sửa chuyến của mình khi đang mở và chưa nhận khách.');
          return;
        }
        const rows: DraftStop[] = [];
        for (const stop of trip.stops) {
          rows.push({ key: crypto.randomUUID(), place: {
            label: stop.label, latitude: stop.latitude, longitude: stop.longitude,
          } });
        }
        setStops(rows);
        setDeparture(toVietnamInput(trip.departureTimeMs));
        setArrival(trip.arrivalTimeMs === null ? '' : toVietnamInput(trip.arrivalTimeMs));
        setNote(trip.note);
        setRouteVersion(trip.routeVersion);
        setPreview({ stops: trip.stops, route: trip.route });
        setLoaded(true);
      } catch (error) {
        if (active) setError(tripErrorText(error));
      } finally {
        if (active) setInitialLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [tripId, user?.id]);

  function selectedStops(): TripStopInput[] {
    const selected: TripStopInput[] = [];
    for (const stop of stops) {
      if (!stop.place) throw new Error('Hãy chọn tất cả điểm dừng từ gợi ý địa chỉ.');
      selected.push(stop.place);
    }
    return selected;
  }
  function changeStops(next: DraftStop[]) {
    setStops(next);
    setPreview(null);
    setError('');
  }
  async function previewRoute() {
    setError('');
    let selected: TripStopInput[];
    try { selected = selectedStops(); }
    catch { setError('Hãy chọn tất cả điểm dừng từ gợi ý địa chỉ.'); return; }
    setBusy(true);
    try {
      // Tải trước SDK bản đồ trong lúc chờ VietMap trả tuyến để không phải chờ thêm lần nữa.
      const [result] = await Promise.all([
        callFunction('previewTripRoute', { stops: selected }),
        preloadRouteMap().catch(() => null),
      ]);
      setPreview(result);
    } catch (error) { setError(tripErrorText(error)); }
    finally { setBusy(false); }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    let selected: TripStopInput[];
    try { selected = selectedStops(); }
    catch { setError('Hãy chọn tất cả điểm dừng từ gợi ý địa chỉ.'); return; }
    const input: SaveTripInput = {
      stops: selected, departureTimeMs: fromVietnamInput(departure),
      arrivalTimeMs: fromVietnamInput(arrival), note: note.trim(),
    };
    if (!Number.isFinite(input.departureTimeMs) || !Number.isFinite(input.arrivalTimeMs)
      || input.departureTimeMs <= Date.now() || input.arrivalTimeMs <= input.departureTimeMs) {
      setError('Chọn giờ đi trong tương lai và giờ đến sau giờ đi.');
      return;
    }
    setBusy(true);
    try {
      let result;
      if (tripId) result = await callFunction('updateTrip', { ...input, tripId, routeVersion });
      else result = await callFunction('createTrip', input);
      navigate('/chuyen-di/' + result.trip.id);
    } catch (error) { setError(tripErrorText(error)); }
    finally { setBusy(false); }
  }

  if (loading || profileLoading) return <p role="status">Đang tải tài khoản…</p>;
  if (!user) return <p className="notice"><Link to="/tai-khoan">Đăng nhập để đăng chuyến.</Link></p>;
  if (!profile?.eligibility.canDrive) return <p className="notice">Bạn cần xác minh sinh viên, hồ sơ tài xế được duyệt và thông tin xe để đăng chuyến. <Link to="/tai-khoan">Hoàn thiện hồ sơ</Link></p>;
  return <section className="trip-page">
    <Link to="/chuyen-di">← Tìm chuyến</Link>
    <h1>{tripId ? 'Sửa chuyến đi' : 'Đăng chuyến đi'}</h1>
    <p className="trip-muted">Chọn tuyến xe máy và các điểm bạn có thể đón, trả người đi cùng.</p>
    {error && <p role="alert" className="form-error">{error}</p>}
    {initialLoading && <p role="status">Đang tải chuyến…</p>}
    {loaded && <form onSubmit={save} className="trip-panel">
      <fieldset disabled={busy}>
        <legend>Các điểm dừng theo thứ tự</legend>
        {stops.map((stop, index) => <div className="trip-stop-editor" key={stop.key}>
          <PlaceSearch label={String.fromCharCode(65 + index) + '. Điểm dừng'} value={stop.place}
            onChange={place => {
              // Dùng key ổn định vì người dùng có thể đổi thứ tự khi đang tìm địa chỉ.
              setStops(current => {
                const rows: DraftStop[] = [];
                for (const row of current) {
                  if (row.key === stop.key) rows.push({ key: row.key, place });
                  else rows.push(row);
                }
                return rows;
              });
              setPreview(null);
              setError('');
            }} />
          <div className="trip-actions">
            <button type="button" className="text-button" disabled={index === 0} onClick={() => {
              const next = [...stops];
              next[index] = stops[index - 1];
              next[index - 1] = stop;
              changeStops(next);
            }}>Lên</button>
            <button type="button" className="text-button" disabled={index === stops.length - 1} onClick={() => {
              const next = [...stops];
              next[index] = stops[index + 1];
              next[index + 1] = stop;
              changeStops(next);
            }}>Xuống</button>
            <button type="button" className="text-button" disabled={stops.length <= 2}
              onClick={() => changeStops(stops.filter(row => row.key !== stop.key))}>Xóa</button>
          </div>
        </div>)}
        <button className="button secondary" type="button" disabled={stops.length >= 8} onClick={() => {
          const next = [...stops];
          next.splice(next.length - 1, 0, emptyStop());
          changeStops(next);
        }}>Thêm điểm dừng</button>
        <p className="trip-muted">Từ 2 đến 8 điểm. Điểm đầu là nơi xuất phát, điểm cuối là nơi kết thúc.</p>
        <div className="trip-form-grid">
          <label className="trip-field"><span>Giờ đi (giờ Việt Nam)</span>
            <input type="datetime-local" required value={departure} onChange={event => setDeparture(event.target.value)} /></label>
          <label className="trip-field"><span>Giờ đến dự kiến (giờ Việt Nam)</span>
            <input type="datetime-local" required value={arrival} onChange={event => setArrival(event.target.value)} /></label>
        </div>
        <label className="trip-field"><span>Ghi chú</span>
          <textarea rows={3} maxLength={1000} value={note} onChange={event => setNote(event.target.value)} /></label>
        <div className="trip-actions">
          <button className="button secondary" type="button" onClick={previewRoute}>Xem trước tuyến</button>
          <button className="button primary" type="submit">{busy ? 'Đang xử lý…' : 'Lưu chuyến'}</button>
        </div>
      </fieldset>
    </form>}
    {preview && <div className="trip-panel">
      <Suspense fallback={<p role="status">Đang tải bản đồ…</p>}>
        <RouteMap stops={preview.stops} route={preview.route} />
      </Suspense>
      <RouteSummary stops={preview.stops} route={preview.route} /></div>}
  </section>;
}
