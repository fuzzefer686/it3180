import { useEffect } from 'react';
import { Bike, CalendarDays, Compass, CircleUserRound, ShieldCheck, WalletCards } from 'lucide-react';
import { Link, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { ThemeToggle } from './components/ThemeToggle';
import { AuthPage } from './modules/auth/AuthPage';
import { AdminPage } from './modules/auth/AdminPage';
import { RequireSession } from './modules/auth/RequireSession';
import { useSession } from './modules/auth/SessionProvider';
import { TripsModule } from './modules/trips/TripsModule';
import { BookingsPage } from './modules/bookings/BookingsPage';
import { WalletsPage } from './modules/wallets/WalletsPage';

const links = [
  { to: '/chuyen-di', label: 'Tìm chuyến', icon: Compass },
  { to: '/dat-chuyen', label: 'Chuyến của tôi', icon: CalendarDays },
  { to: '/vi-diem', label: 'Ví điểm', icon: WalletCards },
  { to: '/tai-khoan', label: 'Tài khoản', icon: CircleUserRound },
];

export function App() {
  const { pathname } = useLocation();
  const { profile } = useSession();
  const isAdmin = profile?.status === 'ACTIVE' && profile.roles.includes('ADMIN');

  useEffect(() => {
    const matched = links.find(link => pathname === link.to || pathname.startsWith(link.to + '/'));
    document.title = `${pathname === '/quan-tri' ? 'Quản trị hồ sơ' : matched?.label ?? 'Về Cùng'} | Về Cùng`;
    window.scrollTo(0, 0);
  }, [pathname]);

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Đến nội dung chính</a>
    <header className="site-header">
      <div className="header-inner">
        <Link className="brand" to="/chuyen-di" aria-label="Về Cùng, tìm chuyến">
          <span className="brand-mark"><Bike size={22}/></span>
          về cùng<span className="brand-period">.</span>
        </Link>
        <nav className="main-nav" aria-label="Điều hướng chính">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <Icon size={18}/><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="header-actions">
          {isAdmin && (
            <Link className="admin-chip" to="/quan-tri">
              <ShieldCheck size={15}/><span>Quản trị</span>
            </Link>
          )}
          <ThemeToggle/>
        </div>
      </div>
    </header>
    <main id="main-content" className="page-container" tabIndex={-1}>
      <Routes>
        <Route path="/" element={<Navigate to="/chuyen-di" replace/>}/>
        <Route path="/chuyen-di/*" element={<TripsModule/>}/>
        <Route path="/dat-chuyen" element={<RequireSession><BookingsPage/></RequireSession>}/>
        <Route path="/vi-diem" element={<RequireSession><WalletsPage/></RequireSession>}/>
        <Route path="/quan-tri" element={<RequireSession admin><AdminPage/></RequireSession>}/>
        <Route path="/tai-khoan" element={<AuthPage/>}/>
        <Route path="*" element={
          <section className="empty-state">
            <h1>Không tìm thấy trang</h1>
            <p>Đường dẫn này không còn khả dụng.</p>
            <Link to="/chuyen-di" className="button primary">Tìm chuyến</Link>
          </section>
        }/>
      </Routes>
    </main>
    <footer className="site-footer">
      <span className="footer-brand">về cùng<span className="footer-dot">.</span></span>
      <span>Một người bạn đồng hành, một chuyến về quê an tâm hơn.</span>
      <span className="status-pill neutral">Ghép xe máy sinh viên</span>
    </footer>
  </div>;
}
