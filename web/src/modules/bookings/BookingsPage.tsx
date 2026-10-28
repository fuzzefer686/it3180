import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Bike, CalendarDays, CheckCircle2, Clock3, ShieldAlert, Ticket } from 'lucide-react';
import { useSession } from '../auth/SessionProvider';
import { BookingList } from './BookingList';
import { DriverBookingList } from './DriverBookingList';
import type { BookingGroup } from './booking-api';

const filters = ['Đang chờ', 'Sắp đi', 'Lịch sử'] as const;
const bookingGroups: Record<typeof filters[number], BookingGroup> = { 'Đang chờ': 'WAITING', 'Sắp đi': 'UPCOMING', 'Lịch sử': 'HISTORY' };

export function BookingsPage() {
  const { user, loading } = useSession();
  const [driverView, setDriverView] = useState(false);
  const [filter, setFilter] = useState<typeof filters[number]>('Đang chờ');

  return <div className="inner-page">
    <header className="page-heading">
      <div>
        <h1>Chuyến của tôi</h1>
        <p>Hẹn đi cùng, theo dõi xác nhận từ tài xế và xem lại những hành trình đã đi.</p>
      </div>
      <span className="status-pill teal">{driverView ? 'Yêu cầu gửi tới chuyến của tôi' : 'Yêu cầu đi cùng'}</span>
    </header>

    <div className="journey-toolbar">
      <div className="segmented-control" aria-label="Vai trò đi xe">
        <button type="button" aria-pressed={!driverView} className={!driverView ? 'selected' : ''} onClick={() => setDriverView(false)}><Ticket size={17}/> Tôi đi cùng</button>
        <button type="button" aria-pressed={driverView} className={driverView ? 'selected' : ''} onClick={() => setDriverView(true)}><Bike size={17}/> Tôi cầm lái</button>
      </div>
    </div>

    <div className="journey-layout">
      <section className="journey-panel" aria-label={driverView ? 'Yêu cầu gửi tới chuyến của tôi' : 'Yêu cầu đi cùng'}>
        <div className="filter-bar" aria-label="Lọc trạng thái chuyến">
          {filters.map(value => (
            <button key={value} type="button" aria-pressed={filter === value}
              className={filter === value ? 'selected' : ''} onClick={() => setFilter(value)}>
              {value}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="content-skeleton" role="status" aria-label="Đang tải phiên đăng nhập"><div/><div/><div/></div>
        ) : user && driverView ? (
          <DriverBookingList key={user.id + ':' + filter} group={bookingGroups[filter]} />
        ) : user ? (
          <BookingList key={user.id + ':' + filter} group={bookingGroups[filter]} embedded />
        ) : (
          <div className="empty-state">
            <div className="empty-icon">
              {filter === 'Đang chờ' ? <Clock3 size={32}/> : <CalendarDays size={32}/>}
            </div>
            <h2>
              {!user ? 'Chuyến đi của bạn ở đây' : filter === 'Lịch sử' ? 'Xem lại những chuyến đã đi' : filter === 'Sắp đi' ? 'Theo dõi chuyến sắp tới' : 'Theo dõi yêu cầu đi cùng'}
            </h2>
            <p>
              {!user
                ? 'Đăng nhập để quản lý yêu cầu đi cùng và các chuyến xe bạn cầm lái.'
                : 'Chức năng quản lý chuyến chưa sẵn sàng. Hiện chưa thể tải hoặc cập nhật danh sách chuyến.'}
            </p>
            <div className="trip-actions">
              <Link className="button primary" to={user ? '/chuyen-di' : '/tai-khoan'}>
                {user ? 'Tìm chuyến' : 'Đăng nhập'}<ArrowRight size={17}/>
              </Link>
              {user && <Link className="button secondary" to="/chuyen-di/cua-toi">Xem chuyến tôi cầm lái</Link>}
            </div>
          </div>
        )}
      </section>

      <aside className="journey-aside">
        <div className="journey-help">
          <span className="help-icon"><Clock3 size={20}/></span>
          <h2>Chờ xác nhận rồi hãy đi</h2>
          <p>Gửi yêu cầu chưa có nghĩa là bạn đã có chỗ. Hãy kiểm tra xác nhận từ tài xế trước giờ khởi hành ít nhất 30 phút.</p>
          <div className="help-divider"/>
          <h3>Đổi kế hoạch đột xuất?</h3>
          <p>Bạn được rút yêu cầu đang chờ miễn phí. Nếu đã được nhận, hãy hủy sớm trước khi lên xe và ghi rõ lý do.</p>
        </div>

        <div className="journey-help">
          <span className="help-icon"><ShieldAlert size={20}/></span>
          <h3>Lưu ý an toàn khi đi cùng</h3>
          <ul className="etiquette-list">
            <li><CheckCircle2 size={15}/><span>Kiểm tra đúng biển số xe thử nghiệm và tên tài xế trên ứng dụng.</span></li>
            <li><CheckCircle2 size={15}/><span>Luôn đội mũ bảo hiểm đạt chuẩn suốt chặng đường.</span></li>
          </ul>
        </div>
      </aside>
    </div>
  </div>;
}
