import { useEffect, useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { PlaceSuggestion, TripStopInput } from '../../../../shared/trips';
import { callFunction } from '../../lib/callable';
import { tripErrorText } from './format';

interface Props {
  label: string;
  value: TripStopInput | null;
  onChange: (place: TripStopInput | null) => void;
}

export function PlaceSearch({ label, value, onChange }: Props) {
  const [text, setText] = useState(value ? value.label : '');
  const [items, setItems] = useState<PlaceSuggestion[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const selectionVersion = useRef(0);

  useEffect(() => {
    return () => { selectionVersion.current++; };
  }, []);

  useEffect(() => {
    if (value) setText(value.label);
  }, [value]);

  useEffect(() => {
    let active = true;
    setItems([]);
    setError('');
    setBusy(false);
    if (value || text.trim().length < 2) return;
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const result = await callFunction('searchTripPlaces', { text: text.trim() });
        if (active) setItems(result.items);
      } catch (err) {
        if (active) setError(tripErrorText(err));
      } finally {
        if (active) setBusy(false);
      }
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [text, value]);

  async function selectPlace(item: PlaceSuggestion) {
    selectionVersion.current++;
    const version = selectionVersion.current;
    setBusy(true);
    setError('');
    try {
      const result = await callFunction('getTripPlace', { refId: item.refId });
      if (version !== selectionVersion.current) return;
      onChange(result.place);
      setText(result.place.label);
      setItems([]);
    } catch (err) {
      if (version === selectionVersion.current) setError(tripErrorText(err));
    } finally {
      if (version === selectionVersion.current) setBusy(false);
    }
  }

  return <div className="trip-place">
    <label className="trip-field">
      <span>{label}</span>
      <input
        value={text}
        maxLength={200}
        autoComplete="off"
        placeholder="Nhập tên trường, bến xe, xã/phường rồi chọn gợi ý…"
        onChange={event => {
          selectionVersion.current++;
          setText(event.target.value);
          onChange(null);
        }}
      />
    </label>
    {busy && <p className="trip-muted" role="status">Đang tìm địa điểm…</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {items.length > 0 && (
      <ul className="trip-suggestions" aria-label={'Gợi ý ' + label}>
        {items.map(item => (
          <li key={item.refId}>
            <button type="button" disabled={busy} onClick={() => selectPlace(item)}>{item.label}</button>
          </li>
        ))}
      </ul>
    )}
    {value && <p className="trip-place-selected"><CheckCircle2 size={14} aria-hidden="true"/>Đã chọn địa điểm.</p>}
  </div>;
}
