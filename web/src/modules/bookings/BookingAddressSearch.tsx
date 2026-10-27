import { useEffect, useRef, useState } from 'react';
import { bookingError, getBookingPlace, searchBookingPlaces, type BookingPlace, type BookingSuggestion } from './booking-api';

export function BookingAddressSearch({ label, onChange }: { label: string; onChange: (place: BookingPlace | null) => void }) {
  const [text, setText] = useState('');
  const [selected, setSelected] = useState(false);
  const [items, setItems] = useState<BookingSuggestion[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const version = useRef(0);
  useEffect(() => () => { version.current++; }, []);
  useEffect(() => {
    let active = true;
    setItems([]); setError(''); setBusy(false);
    if (selected || text.trim().length < 2) return;
    const timer = setTimeout(() => {
      setBusy(true);
      searchBookingPlaces(text).then(result => { if (active) setItems(result.items); })
        .catch(err => { if (active) setError(bookingError(err)); })
        .finally(() => { if (active) setBusy(false); });
    }, 400);
    return () => { active = false; clearTimeout(timer); };
  }, [text, selected]);
  async function choose(item: BookingSuggestion) {
    const current = ++version.current;
    setBusy(true); setError('');
    try {
      const result = await getBookingPlace(item.refId);
      if (current !== version.current) return;
      setText(result.place.label); setSelected(true); setItems([]); onChange(result.place);
    } catch (err) { if (current === version.current) setError(bookingError(err)); }
    finally { if (current === version.current) setBusy(false); }
  }
  return <div className="booking-address">
    <label className="booking-field"><span>{label}</span><input value={text} maxLength={200}
      autoComplete="off" placeholder="Nhập địa chỉ rồi chọn kết quả" onChange={event => {
        version.current++; setText(event.target.value); setSelected(false); onChange(null);
      }} /></label>
    {busy && <p role="status">Đang tìm địa chỉ…</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {!selected && !busy && text.trim().length >= 2 && !error && items.length === 0
      && <p className="booking-muted">Chưa có gợi ý; bạn có thể chọn điểm dừng thủ công bên dưới.</p>}
    {items.length > 0 && <ul className="booking-suggestions" aria-label={'Gợi ý ' + label}>
      {items.map(item => <li key={item.refId}><button type="button" disabled={busy} onClick={() => void choose(item)}>{item.label}</button></li>)}
    </ul>}
    {selected && <p className="booking-muted">Đã chọn địa chỉ; đây chưa phải điểm hẹn đón/trả.</p>}
  </div>;
}
