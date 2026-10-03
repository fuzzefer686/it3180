import { useRef, useState, type FormEvent } from 'react';
import { ArrowDownUp, ArrowRight, Bike, CalendarDays, ChevronDown, MapPin, Search, ShieldCheck } from 'lucide-react';

function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
const destinations = ['Ninh Bình', 'Nam Định', 'Thanh Hóa', 'Hải Phòng'];

export function TripsPage() {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState('');
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const originInput = useRef<HTMLInputElement>(null);
  const result = useRef<HTMLDivElement>(null);
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSearched(false); setError('');
    if (!origin.trim() || !destination.trim() || !date) { setError('Vui lòng chọn điểm đi, điểm đến và ngày đi.'); return; }
    if (origin.trim().toLocaleLowerCase('vi') === destination.trim().toLocaleLowerCase('vi')) { setError('Điểm đi và điểm đến cần khác nhau.'); return; }
    if (date < today()) { setError('Vui lòng chọn ngày hôm nay hoặc một ngày sắp tới.'); return; }
    // Chưa có callable tìm chuyến. Không dựng danh sách hoặc trạng thái đặt giả.
    setSearched(true);
    requestAnimationFrame(() => result.current?.focus());
  }
  return <>
    <section className="search-hero" aria-labelledby="search-title">
      <div className="hero-copy">
        <span className="eyebrow"><Bike size={18}/> Ghép xe máy cho sinh viên</span>
        <h1 id="search-title">Cùng đường.<br/><span>Cùng về.</span></h1>
        <p>Tìm một người bạn đồng hành cho chuyến về quê sắp tới.</p>
        <a className="hero-link" href="#trip-search">Bạn muốn về đâu? <ArrowRight size={20}/></a>
      </div>
      <div className="hero-photo"><img src="/images/ride-home.jpg" srcSet="/images/ride-home-small.jpg 720w, /images/ride-home-medium.jpg 960w, /images/ride-home.jpg 1400w" sizes="(min-width: 1280px) 620px, (min-width: 768px) 50vw, calc(100vw - 40px)" width="1400" height="933" alt="Hai bạn sinh viên đội mũ bảo hiểm đi cùng xe máy trên đường quê" fetchPriority="high"/></div>
    </section>
    <section className="search-section" aria-label="Tìm chuyến theo tuyến và ngày">
      <form id="trip-search" className="search-form" onSubmit={search}>
        <div className="search-field"><label htmlFor="origin">Đi từ</label><div className="input-with-icon"><MapPin size={20}/><input ref={originInput} id="origin" name="origin" autoComplete="off" placeholder="Tỉnh / thành phố" value={origin} maxLength={120} required onChange={e => { setOrigin(e.target.value); setSearched(false); setError(''); }}/></div></div>
        <button className="icon-button swap-button" type="button" aria-label="Đổi điểm đi và điểm đến" onClick={() => { setOrigin(destination); setDestination(origin); setSearched(false); setError(''); }}><ArrowDownUp size={18}/></button>
        <div className="search-field"><label htmlFor="destination">Đến</label><div className="input-with-icon"><MapPin size={20}/><input id="destination" name="destination" autoComplete="off" placeholder="Bạn muốn về đâu?" value={destination} maxLength={120} required onChange={e => { setDestination(e.target.value); setSearched(false); setError(''); }}/></div></div>
        <div className="search-field date-field"><label htmlFor="departure-date">Ngày đi</label><div className="input-with-icon"><CalendarDays size={20}/><input id="departure-date" name="departureDate" aria-label="Ngày đi" type="date" value={date} min={today()} required onChange={e => { setDate(e.target.value); setSearched(false); setError(''); }}/></div></div>
        <button className="button primary search-button" type="submit"><Search size={19}/> Tìm chuyến</button>
      </form>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="quick-destinations"><span>Chọn nhanh điểm đến</span><div>{destinations.map(place => <button key={place} type="button" className={`destination-chip${destination === place ? ' selected' : ''}`} aria-pressed={destination === place} onClick={() => { setDestination(place); setSearched(false); setError(''); originInput.current?.focus(); }}>{place}<ArrowRight size={14}/></button>)}</div></div>
    </section>
    {searched && <div className="search-result notice" ref={result} tabIndex={-1} role="status"><Search size={22}/><div><h2>Tìm chuyến chưa sẵn sàng</h2><p>Hiện chưa thể tra cứu chuyến hoặc gửi yêu cầu đi cùng. Vui lòng quay lại sau.</p></div><button className="text-button" onClick={() => { setSearched(false); originInput.current?.focus(); }}>Sửa tìm kiếm</button></div>}
    <section className="ride-guide" aria-labelledby="guide-title">
      <div className="guide-intro"><div className="guide-icon"><ShieldCheck size={28}/></div><h2 id="guide-title">Một chuyến đi.<br/>Một người đồng hành.</h2><p>Chọn tuyến phù hợp, gửi yêu cầu và đợi tài xế xác nhận trước khi lên đường.</p></div>
      <div className="guide-details">
        <details open><summary>Không cần đi hết cả tuyến <ChevronDown size={18}/></summary><p>Bạn có thể chọn điểm đón và xuống tại một điểm dừng dọc tuyến tài xế đã đăng.</p></details>
        <details><summary>Gửi yêu cầu có giữ chỗ không? <ChevronDown size={18}/></summary><p>Yêu cầu vào hàng chờ, chưa giữ chỗ. Tài xế chọn một người đi cùng và gửi xác nhận.</p></details>
        <details><summary>Khi nào hàng chờ đóng? <ChevronDown size={18}/></summary><p>Chuyến ngừng nhận yêu cầu mới trước giờ đi 30 phút. Bạn có thể rút yêu cầu đang chờ mà không mất điểm.</p></details>
      </div>
    </section>
  </>;
}
