import { Link, Route, Routes } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import { TripsPage } from './TripsPage';
import { TripFormPage } from './TripFormPage';
import { TripDetailPage } from './TripDetailPage';
import { TripResults } from './TripResults';
import { RequireSession } from '../auth/RequireSession';
import { useSession } from '../auth/SessionProvider';
import './trips.css';

const myTripsFilter = { mine: true };

export function TripsModule() {
  const { user } = useSession();
  return <Routes>
    <Route index element={<TripsPage />} />
    <Route path="dang" element={<RequireSession><TripFormPage key={user?.id} /></RequireSession>} />
    <Route path="cua-toi" element={
      <RequireSession>
        <section className="trip-page">
          <div className="trip-top-bar">
            <Link className="trip-back-link" to="/chuyen-di"><ArrowLeft size={16}/> Tìm chuyến</Link>
          </div>
          <div className="trip-page-header">
            <div>
              <h1>Chuyến tôi đăng</h1>
              <p className="trip-muted">Theo dõi các chuyến bạn cầm lái, cập nhật trạng thái hoặc đăng chuyến mới.</p>
            </div>
            <Link className="button primary" to="/chuyen-di/dang"><Plus size={17}/> Đăng chuyến</Link>
          </div>
          <TripResults key={user?.id} filters={myTripsFilter} />
        </section>
      </RequireSession>
    } />
    <Route path=":tripId/sua" element={<RequireSession><TripFormPage key={user?.id} /></RequireSession>} />
    <Route path=":tripId" element={<RequireSession><TripDetailPage key={user?.id} /></RequireSession>} />
    <Route path="*" element={<p className="notice">Không tìm thấy trang chuyến đi. <Link to="/chuyen-di">Về tìm chuyến</Link></p>} />
  </Routes>;
}
