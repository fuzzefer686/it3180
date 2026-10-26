import { Link, Route, Routes } from 'react-router-dom';
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
    <Route path="cua-toi" element={<RequireSession><section className="trip-page">
      <Link to="/chuyen-di">← Tìm chuyến</Link><h1>Chuyến tôi đăng</h1>
      <Link className="button primary" to="/chuyen-di/dang">Đăng chuyến</Link>
      <TripResults key={user?.id} filters={myTripsFilter} />
    </section></RequireSession>} />
    <Route path=":tripId/sua" element={<RequireSession><TripFormPage key={user?.id} /></RequireSession>} />
    <Route path=":tripId" element={<RequireSession><TripDetailPage key={user?.id} /></RequireSession>} />
    <Route path="*" element={<p>Không tìm thấy trang chuyến đi. <Link to="/chuyen-di">Về tìm chuyến</Link></p>} />
  </Routes>;
}
