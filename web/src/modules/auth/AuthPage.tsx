import { useState, type FormEvent } from 'react';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { ArrowRight, Eye, EyeOff, LockKeyhole, LogOut, Mail, RefreshCw, ShieldCheck } from 'lucide-react';
import { auth } from '../../lib/firebase';
import { errorMessage } from '../../lib/callable';
import { useSession } from './SessionProvider';
const verificationLabels = { VERIFIED: 'Đã xác thực sinh viên', PENDING: 'Đang chờ xác thực', REJECTED: 'Chưa được xác thực' };
const roleLabels = { USER: 'Hành khách', DRIVER: 'Tài xế', ADMIN: 'Quản trị viên' };
export function AuthPage() {
  const { user, profile, loading, profileLoading, profileError, refreshProfile } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    try { await signInWithEmailAndPassword(auth, email.trim(), password); setPassword(''); }
    catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true); setError('');
    try { await signOut(auth); }
    catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }
  return <div className="inner-page account-page">
    <header className="page-heading"><h1>Tài khoản</h1><p>Một hồ sơ rõ ràng, thêm an tâm khi đi cùng.</p></header>
    <div className="account-layout">
      <section className="account-panel">
        {loading ? <div className="content-skeleton" role="status" aria-label="Đang tải tài khoản"><div/><div/><div/></div> : user ? <>
          <div className="profile-identity"><span className="profile-avatar" aria-hidden="true">{(profile?.displayName ?? user.email ?? 'V').slice(0, 1).toUpperCase()}</span><div><h2>{profile?.displayName ?? 'Tài khoản của bạn'}</h2><p>{user.email}</p></div></div>
          {profileLoading && <div className="content-skeleton compact" role="status" aria-label="Đang tải hồ sơ"><div/><div/></div>}
          {profile && <><p className="verification-badge"><ShieldCheck size={17}/>{verificationLabels[profile.studentVerificationStatus]}</p><dl className="profile-details"><div><dt>Vai trò</dt><dd>{profile.roles.map(role => roleLabels[role]).join(', ')}</dd></div><div><dt>Tài khoản</dt><dd>{profile.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã khóa'}</dd></div></dl></>}
          {profileError && <p className="form-error" role="alert">{profileError}</p>}
          <div className="profile-actions"><button className="button secondary" disabled={profileLoading || busy} onClick={refreshProfile}><RefreshCw size={17}/> Tải lại hồ sơ</button><button className="text-button" disabled={busy} onClick={logout}><LogOut size={17}/>{busy ? 'Đang đăng xuất...' : 'Đăng xuất'}</button></div>
          {error && <p className="form-error" role="alert">{error}</p>}
        </> : <>
          <h2>Chào bạn trở lại.</h2><p className="account-description">Đăng nhập để sẵn sàng cho chuyến đi cùng.</p>
          <form className="login-form" onSubmit={login}>
            <div className="form-field"><label htmlFor="email">Email</label><div className="form-input"><Mail size={19}/><input id="email" name="email" type="email" autoComplete="username" placeholder="Email của bạn" value={email} required disabled={busy} onChange={e => { setEmail(e.target.value); setError(''); }}/></div></div>
            <div className="form-field"><label htmlFor="password">Mật khẩu</label><div className="form-input"><LockKeyhole size={19}/><input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Nhập mật khẩu" value={password} required disabled={busy} onChange={e => { setPassword(e.target.value); setError(''); }}/><button className="icon-button" type="button" disabled={busy} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="button primary login-button" disabled={busy} type="submit">{busy ? 'Đang đăng nhập...' : 'Đăng nhập'}{!busy && <ArrowRight size={18}/>}</button>
          </form>
          <p className="signup-note">Chưa có tài khoản? Tính năng đăng ký chưa sẵn sàng.</p>
        </>}
      </section>
      <aside className="account-story"><img src="/images/ride-home.jpg" srcSet="/images/ride-home-small.jpg 720w, /images/ride-home-medium.jpg 960w, /images/ride-home.jpg 1400w" sizes="(min-width: 768px) 50vw, calc(100vw - 40px)" width="1400" height="933" loading="lazy" decoding="async" alt="Chuyến đi xe máy qua những cánh đồng xanh"/><div><ShieldCheck size={24}/><h2>Biết người đi cùng.<br/>An tâm trên đường.</h2><p>Hồ sơ sinh viên và xác nhận từ tài xế giúp bạn chuẩn bị cho chuyến đi.</p></div></aside>
    </div>
  </div>;
}
