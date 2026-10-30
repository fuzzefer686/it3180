import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownUp, CalendarDays, ChevronDown, MapPin, Plus, Search } from 'lucide-react';
import type { ListTripsInput } from '../../../../shared/trips';
import { TripResults } from './TripResults';
import { useSession } from '../auth/SessionProvider';
import { isValidVietnamDate, toVietnamInput } from './format';

function today() {
  return toVietnamInput(Date.now()).slice(0, 10);
}
const destinations = ['Ninh Bình', 'Nam Định', 'Thanh Hóa', 'Hải Phòng'];

export function TripsPage() {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState('');
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [filters, setFilters] = useState<ListTripsInput>({});
  const { user, profile } = useSession();
  const originInput = useRef<HTMLInputElement>(null);
  const dateInput = useRef<HTMLInputElement>(null);
  const result = useRef<HTMLDivElement>(null);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearched(false);
    setError('');
    if (origin.trim() && destination.trim() && origin.trim().toLocaleLowerCase('vi') === destination.trim().toLocaleLowerCase('vi')) {
      setError('Điểm đi và điểm đến cần khác nhau.');
      return;
    }
    if (dateInput.current?.validity.badInput || (date && (!isValidVietnamDate(date) || date < today()))) {
      setError('Vui lòng chọn ngày hôm nay hoặc một ngày sắp tới.');
      return;
    }
    const next: ListTripsInput = { origin: origin.trim(), destination: destination.trim() };
    if (date) next.date = date;
    setFilters(next);
    setSearched(true);
    requestAnimationFrame(() => result.current?.focus());
  }

  return <>
    <section className="search-head" aria-labelledby="search-title">
      <h1 id="search-title">Tìm chuyến xe máy</h1>
      <p>Đi cùng sinh viên chung tuyến. Bạn chọn điểm đón, điểm trả dọc đường và chờ tài xế xác nhận.</p>
    </section>

    <section className="search-section" aria-label="Tìm chuyến theo tuyến và ngày">
      <form id="trip-search" className="search-form" noValidate onSubmit={search}>
        <div className="search-field">
          <label htmlFor="origin">Đi từ</label>
          <div className="input-with-icon">
            <MapPin size={19}/>
            <input ref={originInput} id="origin" name="origin" autoComplete="off" placeholder="Trường học / quận / tỉnh" value={origin} maxLength={120}
              onChange={e => { setOrigin(e.target.value); setSearched(false); setError(''); }}/>
          </div>
        </div>
        <button className="icon-button swap-button" type="button" aria-label="Đổi điểm đi và điểm đến"
          onClick={() => { setOrigin(destination); setDestination(origin); setSearched(false); setError(''); }}>
          <ArrowDownUp size={17}/>
        </button>
        <div className="search-field">
          <label htmlFor="destination">Đến</label>
          <div className="input-with-icon">
            <MapPin size={19}/>
            <input id="destination" name="destination" autoComplete="off" placeholder="Bạn muốn về đâu?" value={destination} maxLength={120}
              onChange={e => { setDestination(e.target.value); setSearched(false); setError(''); }}/>
          </div>
        </div>
        <div className="search-field date-field">
          <label htmlFor="departure-date">Ngày đi</label>
          <div className="input-with-icon">
            <CalendarDays size={19}/>
            <input ref={dateInput} id="departure-date" name="departureDate" aria-label="Ngày đi" type="date" value={date} min={today()}
              onChange={e => { setDate(e.target.value); setSearched(false); setError(''); }}/>
          </div>
        </div>
        <button className="button primary search-button" type="submit"><Search size={18}/> Tìm chuyến</button>
      </form>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="quick-destinations">
        <span>Chọn nhanh điểm đến</span>
        <div>
          {destinations.map(place => (
            <button key={place} type="button" className={`destination-chip${destination === place ? ' selected' : ''}`}
              aria-pressed={destination === place}
              onClick={() => { setDestination(place); setSearched(false); setError(''); originInput.current?.focus(); }}>
              {place}
            </button>
          ))}
        </div>
      </div>
    </section>

    <div className="trip-toolbar">
      <div className="trip-toolbar-title">
        <h2>{searched ? 'Kết quả lọc theo lộ trình' : 'Chuyến xe sắp khởi hành'}</h2>
        <p className="trip-muted">Xem lộ trình chi tiết trên bản đồ VietMap và chọn đoạn đón trả phù hợp.</p>
      </div>
      <div className="trip-toolbar-actions">
        {searched && (
          <button className="text-button" type="button" onClick={() => {
            setOrigin(''); setDestination(''); setDate(''); setError(''); setFilters({}); setSearched(false);
          }}>Xem tất cả chuyến sắp tới</button>
        )}
        {user && <Link className="button secondary" to="/chuyen-di/cua-toi">Chuyến tôi đăng</Link>}
        {profile?.eligibility.canDrive && (
          <Link className="button primary" to="/chuyen-di/dang"><Plus size={17}/> Đăng chuyến</Link>
        )}
      </div>
    </div>

    <div ref={result} tabIndex={-1}>
      <TripResults key={user?.id + JSON.stringify(filters)} filters={filters} />
    </div>

    <section className="ride-guide" aria-labelledby="guide-title">
      <div className="guide-intro">
        <h2 id="guide-title">Đi cùng hoạt động thế nào</h2>
        <p>Mỗi chuyến chở một người đi cùng. Chọn tuyến phù hợp, kiểm tra khoảng cách từng chặng và đợi tài xế xác nhận trước khi lên đường.</p>
      </div>
      <div className="guide-details">
        <details open><summary>Không cần đi hết cả tuyến <ChevronDown size={18}/></summary><p>Bạn có thể chọn điểm đón và xuống tại bất kỳ điểm dừng nào dọc tuyến xe máy tài xế đã đăng.</p></details>
        <details><summary>Gửi yêu cầu có giữ chỗ không? <ChevronDown size={18}/></summary><p>Yêu cầu vào hàng chờ, chưa giữ chỗ. Tài xế chọn một người đi cùng phù hợp và gửi xác nhận.</p></details>
        <details><summary>Khi nào hàng chờ đóng? <ChevronDown size={18}/></summary><p>Chuyến ngừng nhận yêu cầu mới trước giờ đi 30 phút. Bạn có thể rút yêu cầu đang chờ mà không mất điểm.</p></details>
      </div>
    </section>
  </>;
}
