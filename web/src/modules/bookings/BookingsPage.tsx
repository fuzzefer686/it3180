import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Bike, CalendarDays, Clock3, Route, Ticket } from 'lucide-react';
import { useSession } from '../auth/SessionProvider';
const filters = ['Đang chờ', 'Sắp đi', 'Lịch sử'] as const;
export function BookingsPage() {
  const { user, loading } = useSession();
  const [mode, setMode] = useState<'passenger' | 'driver'>('passenger');
  const [filter, setFilter] = useState<typeof filters[number]>('Đang chờ');
  return <div className="inner-page">
    <header className="page-heading"><h1>Chuyến của tôi</h1><p>Hẹn đi cùng, theo dõi xác nhận và xem lại những chuyến đã đi.</p></header>
    <div className="journey-toolbar"><div className="segmented-control" aria-label="Vai trò đi xe"><button aria-pressed={mode === 'passenger'} className={mode === 'passenger' ? 'selected' : ''} onClick={() => setMode('passenger')}><Ticket size={18}/> Tôi đi cùng</button><button aria-pressed={mode === 'driver'} className={mode === 'driver' ? 'selected' : ''} onClick={() => setMode('driver')}><Bike size={18}/> Tôi cầm lái</button></div>{mode === 'driver' && <div className="unavailable-action"><button className="button primary" disabled>Đăng chuyến</button><span>Chức năng chưa sẵn sàng</span></div>}</div>
    <div className="journey-layout">
      <section className="journey-panel" aria-label={mode === 'passenger' ? 'Yêu cầu đi cùng' : 'Chuyến đã đăng'}>
        <div className="filter-bar" aria-label="Lọc trạng thái chuyến">{filters.map(value => <button key={value} aria-pressed={filter === value} className={filter === value ? 'selected' : ''} onClick={() => setFilter(value)}>{value}</button>)}</div>
        {loading ? <div className="content-skeleton" role="status" aria-label="Đang tải phiên đăng nhập"><div/><div/><div/></div> : <div className="empty-state">
          <div className="empty-icon">{mode === 'driver' ? <Route size={34}/> : filter === 'Đang chờ' ? <Clock3 size={34}/> : <CalendarDays size={34}/>}</div>
          <h2>{!user ? 'Chuyến đi của bạn ở đây' : mode === 'driver' ? 'Chuyến bạn đăng sẽ ở đây' : filter === 'Lịch sử' ? 'Xem lại những chuyến đã đi' : filter === 'Sắp đi' ? 'Theo dõi chuyến sắp tới' : 'Theo dõi yêu cầu đi cùng'}</h2>
          <p>{!user ? 'Đăng nhập để quản lý yêu cầu đi cùng và chuyến của bạn.' : 'Chức năng quản lý chuyến chưa sẵn sàng. Hiện chưa thể tải hoặc cập nhật danh sách chuyến.'}</p>
          <Link className="button primary" to={user ? '/chuyen-di' : '/tai-khoan'}>{user ? 'Tìm chuyến' : 'Đăng nhập'}<ArrowRight size={18}/></Link>
        </div>}
      </section>
      <aside className="journey-help"><span className="help-icon"><Clock3 size={22}/></span><h2>Chờ xác nhận rồi hãy đi</h2><p>Gửi yêu cầu chưa có nghĩa là bạn đã có chỗ. Hãy kiểm tra xác nhận từ tài xế trước giờ khởi hành.</p><div className="help-divider"/><h3>Đổi kế hoạch?</h3><p>Bạn được rút yêu cầu đang chờ. Nếu đã được nhận, hãy hủy trước khi lên xe và ghi rõ lý do.</p></aside>
    </div>
  </div>;
}
