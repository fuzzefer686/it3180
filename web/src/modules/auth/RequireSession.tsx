import type { ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { useSession } from './SessionProvider';

export function RequireSession({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user, profile, loading, profileLoading, profileError, refreshProfile } = useSession();
  const location = useLocation();

  if (loading || (user && profileLoading)) {
    return <div className="content-skeleton" role="status" aria-label="Đang kiểm tra tài khoản"><div/><div/></div>;
  }
  if (!user) {
    return <Navigate to="/tai-khoan" replace state={{ from: location.pathname + location.search + location.hash }}/>;
  }
  if (profileError || !profile) {
    return <section className="empty-state">
      <div className="empty-icon"><AlertTriangle size={30}/></div>
      <h1>Chưa tải được quyền truy cập</h1>
      <p role="alert">{profileError || 'Cần tải hồ sơ để kiểm tra trạng thái tài khoản.'}</p>
      <button className="button secondary" type="button" onClick={refreshProfile}>Thử lại</button>
    </section>;
  }
  if ((profile && profile.status !== 'ACTIVE') || (admin && !profile?.roles.includes('ADMIN'))) {
    return <section className="empty-state">
      <div className="empty-icon"><ShieldAlert size={30}/></div>
      <h1>Không có quyền truy cập</h1>
      <p>{profile?.status === 'LOCKED' ? 'Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.' : 'Trang này chỉ dành cho quản trị viên.'}</p>
      <Link className="button secondary" to="/chuyen-di">Về trang tìm chuyến</Link>
    </section>;
  }
  // Chỉ là điều hướng UI; mọi RPC vẫn phải xác minh quyền ở database.
  return children;
}
