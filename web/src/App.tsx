import { useEffect } from 'react';
import { Bike, CalendarDays, Compass, CircleUserRound, WalletCards } from 'lucide-react';
import { Link, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { ThemeToggle } from './components/ThemeToggle';
import { AuthPage } from './modules/auth/AuthPage';
import { TripsPage } from './modules/trips/TripsPage';
import { BookingsPage } from './modules/bookings/BookingsPage';
import { WalletsPage } from './modules/wallets/WalletsPage';
const links = [
  {to:'/chuyen-di', label:'Tìm chuyến', icon:Compass},
  {to:'/dat-chuyen', label:'Chuyến của tôi', icon:CalendarDays},
  {to:'/vi-diem', label:'Ví điểm', icon:WalletCards},
  {to:'/tai-khoan', label:'Tài khoản', icon:CircleUserRound},
];
export function App() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = `${links.find(link => link.to === pathname)?.label ?? 'Về Cùng'} | Về Cùng`;
    window.scrollTo(0, 0);
  }, [pathname]);
  return <div className="app-shell">
  <a className="skip-link" href="#main-content">Đến nội dung chính</a>
  <header className="site-header"><div className="header-inner">
    <Link className="brand" to="/chuyen-di" aria-label="Về Cùng, tìm chuyến"><span className="brand-mark"><Bike size={25}/></span>về cùng<span className="brand-period">.</span></Link>
    <nav className="main-nav" aria-label="Điều hướng chính">{links.map(({to,label,icon:Icon}) => <NavLink key={to} to={to} className={({isActive})=>`nav-link${isActive?' active':''}`}><Icon size={19}/><span>{label}</span></NavLink>)}</nav>
    <ThemeToggle/>
  </div></header>
  <main id="main-content" className="page-container" tabIndex={-1}><Routes>
    <Route path="/" element={<Navigate to="/chuyen-di" replace/>}/>
    <Route path="/chuyen-di" element={<TripsPage/>}/>
    <Route path="/dat-chuyen" element={<BookingsPage/>}/>
    <Route path="/vi-diem" element={<WalletsPage/>}/>
    <Route path="/tai-khoan" element={<AuthPage/>}/>
    <Route path="*" element={<section className="empty-state"><h1>Không tìm thấy trang</h1><p>Đường dẫn này không còn khả dụng.</p><Link to="/chuyen-di" className="button primary">Tìm chuyến</Link></section>}/>
  </Routes></main>
  <footer className="site-footer"><span className="footer-brand">về cùng.</span><span>Một người bạn đồng hành, một chuyến về vui hơn.</span><span>Ghép xe sinh viên</span></footer>
</div>; }
