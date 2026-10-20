import { useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, LockKeyhole, LogOut, Mail, RefreshCw, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { errorMessage } from '../../lib/callable';
import { useSession } from './SessionProvider';
import { ProfileForm } from './ProfileForm';
import { authReturnPath, loginInputSchema, signupInputSchema } from './auth-validation';

const verificationLabels = { VERIFIED: 'Đã duyệt', PENDING: 'Chờ duyệt', REJECTED: 'Bị từ chối' };
const roleLabels = { USER: 'Hành khách', DRIVER: 'Tài xế', ADMIN: 'Quản trị viên' };
export function AuthPage() {
  const { user, profile, loading, profileLoading, profileError, refreshProfile } = useSession();
  const location = useLocation();
  const returnTo = authReturnPath(location.state);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const pending = useRef(false);
  const signingUp = mode === 'signup';
  function clearMessages() { setError(''); setNotice(''); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    clearMessages();
    const parsed = signingUp ? signupInputSchema.safeParse({ email, password, confirmPassword }) : loginInputSchema.safeParse({ email, password });
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    const credentials = { email: parsed.data.email, password: parsed.data.password };
    pending.current = true; setBusy(true);
    try {
      if (signingUp) {
        const { data, error } = await supabase.auth.signUp({ ...credentials, options: { emailRedirectTo: `${window.location.origin}/tai-khoan` } });
        if (error) throw error;
        if (!data.user && !data.session) throw new Error('Missing signup result');
        if (!data.session) {
          setMode('login');
          setNotice('Kiểm tra hộp thư để xác nhận email nếu địa chỉ đủ điều kiện đăng ký, sau đó đăng nhập. Nếu đã có tài khoản, bạn có thể đăng nhập ngay.');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword(credentials);
        if (error) throw error;
      }
      setPassword(''); setConfirmPassword(''); setShowPassword(false);
    } catch (err) { setError(errorMessage(err)); }
    finally { pending.current = false; setBusy(false); }
  }
  async function logout() {
    if (pending.current) return;
    pending.current = true; setBusy(true); clearMessages();
    try { const { error } = await supabase.auth.signOut(); if (error) throw error; }
    catch (err) { setError(errorMessage(err)); }
    finally { pending.current = false; setBusy(false); }
  }
  if (!loading && user && returnTo) return <Navigate to={returnTo} replace/>;
  return <div className="inner-page account-page">
    <header className="page-heading"><h1>Tài khoản</h1><p>Một hồ sơ rõ ràng, thêm an tâm khi đi cùng.</p></header>
    <div className="account-layout">
      <section className="account-panel">
        {loading ? <div className="content-skeleton" role="status" aria-label="Đang tải tài khoản"><div/><div/><div/></div> : user ? <>
          <div className="profile-identity"><span className="profile-avatar" aria-hidden="true">{(profile?.displayName ?? user.email ?? 'V').slice(0, 1).toUpperCase()}</span><div><h2>{profile?.displayName ?? 'Tài khoản của bạn'}</h2><p>{user.email}</p></div></div>
          {profileLoading && <p className="account-description" role="status">Đang tải hồ sơ...</p>}
          {profile && <>
            <p className="verification-badge"><ShieldCheck size={17}/>Sinh viên: {verificationLabels[profile.studentVerificationStatus]}</p>
            <dl className="profile-details"><div><dt>Vai trò</dt><dd>{profile.roles.map(role => roleLabels[role]).join(', ')}</dd></div>
              <div><dt>Tài khoản</dt><dd>{profile.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã khóa'}</dd></div>
              <div><dt>Tài xế</dt><dd>{verificationLabels[profile.driverVerificationStatus]}</dd></div>
              <div><dt>Đặt chuyến</dt><dd>{profile.eligibility.canBook ? 'Đủ điều kiện' : 'Chưa đủ điều kiện'}</dd></div>
              <div><dt>Đăng chuyến</dt><dd>{profile.eligibility.canDrive ? 'Đủ điều kiện' : 'Chưa đủ điều kiện'}</dd></div></dl>
            {profile.studentReviewNote && <p className="account-description">Ghi chú sinh viên: {profile.studentReviewNote}</p>}
            {profile.driverReviewNote && <p className="account-description">Ghi chú tài xế: {profile.driverReviewNote}</p>}
            {profile.status === 'LOCKED' && <p className="form-error" role="alert">Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.</p>}
            {profile.status === 'ACTIVE' && profile.roles.includes('ADMIN') && <Link className="text-link" to="/quan-tri">Quản trị hồ sơ<ArrowRight size={17}/></Link>}
          </>}
          {profileError && <p className="form-error" role="alert">{profileError}</p>}
          <div className="profile-actions"><button className="button secondary" disabled={profileLoading || busy} onClick={refreshProfile}><RefreshCw size={17}/>Tải lại hồ sơ</button><button className="text-button" disabled={busy} onClick={logout}><LogOut size={17}/>{busy ? 'Đang đăng xuất...' : 'Đăng xuất'}</button></div>
          {error && <p className="form-error" role="alert">{error}</p>}
          {profile && <ProfileForm profile={profile} onSaved={refreshProfile}/>}
        </> : <>
          <h2>{signingUp ? 'Tạo tài khoản Về Cùng.' : 'Chào bạn trở lại.'}</h2>
          <p className="account-description">{signingUp ? 'Đăng ký email, sau đó hoàn thiện hồ sơ để được duyệt.' : returnTo ? 'Đăng nhập để tiếp tục đến trang bạn đã chọn.' : 'Đăng nhập để sẵn sàng cho chuyến đi cùng.'}</p>
          <form className="login-form" onSubmit={submit} noValidate aria-busy={busy}>
            <div className="form-field"><label htmlFor="email">Email</label><div className="form-input"><Mail size={19}/><input id="email" name="email" type="email" autoComplete="username" placeholder="Email của bạn" value={email} required disabled={busy} onChange={event => { setEmail(event.target.value); clearMessages(); }}/></div></div>
            <div className="form-field"><label htmlFor="password">Mật khẩu</label><div className="form-input"><LockKeyhole size={19}/><input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete={signingUp ? 'new-password' : 'current-password'} placeholder={signingUp ? 'Ít nhất 8 ký tự' : 'Nhập mật khẩu'} value={password} required minLength={signingUp ? 8 : undefined} disabled={busy} aria-describedby={signingUp ? 'password-hint' : undefined} onChange={event => { setPassword(event.target.value); clearMessages(); }}/><button className="icon-button" type="button" disabled={busy} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div>{signingUp && <p id="password-hint" className="field-hint">Tối thiểu 8 ký tự; server có thể yêu cầu mật khẩu mạnh hơn.</p>}</div>
            {signingUp && <div className="form-field"><label htmlFor="confirm-password">Nhập lại mật khẩu</label><div className="form-input"><LockKeyhole size={19}/><input id="confirm-password" name="confirmPassword" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword} required disabled={busy} onChange={event => { setConfirmPassword(event.target.value); clearMessages(); }}/></div></div>}
            {error && <p className="form-error" role="alert">{error}</p>}
            {notice && <p className="form-notice" role="status">{notice}</p>}
            <button className="button primary login-button" disabled={busy} type="submit">{busy ? signingUp ? 'Đang đăng ký...' : 'Đang đăng nhập...' : signingUp ? 'Đăng ký' : 'Đăng nhập'}{!busy && <ArrowRight size={18}/>}</button>
          </form>
          <p className="signup-note">{signingUp ? 'Đã có tài khoản? ' : 'Chưa có tài khoản? '}<button className="text-button" type="button" disabled={busy} onClick={() => { setMode(signingUp ? 'login' : 'signup'); setPassword(''); setConfirmPassword(''); setShowPassword(false); clearMessages(); }}>{signingUp ? 'Đăng nhập' : 'Đăng ký'}</button></p>
        </>}
      </section>
      <aside className="account-story"><img src="/images/ride-home.jpg" srcSet="/images/ride-home-small.jpg 720w, /images/ride-home-medium.jpg 960w, /images/ride-home.jpg 1400w" sizes="(min-width: 768px) 50vw, calc(100vw - 40px)" width="1400" height="933" loading="lazy" decoding="async" alt="Chuyến đi xe máy qua những cánh đồng xanh"/><div><ShieldCheck size={24}/><h2>Biết người đi cùng.<br/>An tâm trên đường.</h2><p>Hồ sơ sinh viên và xác nhận từ tài xế giúp bạn chuẩn bị cho chuyến đi.</p></div></aside>
    </div>
  </div>;
}
