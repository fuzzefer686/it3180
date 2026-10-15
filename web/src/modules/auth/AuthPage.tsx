import { useState, type FormEvent } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, LogOut, Mail, RefreshCw, ShieldCheck, UserCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { errorMessage } from '../../lib/callable';
import { useSession } from './SessionProvider';

const verificationLabels = {
  VERIFIED: 'Đã xác thực sinh viên',
  PENDING: 'Đang chờ xác thực',
  REJECTED: 'Chưa được xác thực',
};

const roleLabels = {
  USER: 'Hành khách',
  DRIVER: 'Tài xế',
  ADMIN: 'Quản trị viên',
};

export function AuthPage() {
  const { user, profile, loading, profileLoading, profileError, refreshProfile, loginAsMockAdmin, logoutSession } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setSuccessMsg('');

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        if (data.user && !data.session) {
          setSuccessMsg('Đăng ký thành công! Vui lòng kiểm tra email để xác nhận hoặc đăng nhập.');
        } else {
          setSuccessMsg('Đăng ký và đăng nhập thành công!');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }
      setPassword('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inner-page account-page">
      <header className="page-heading">
        <h1>Tài khoản</h1>
        <p>Một hồ sơ rõ ràng, thêm an tâm khi đi cùng.</p>
      </header>

      <div className="account-layout">
        <section className="account-panel">
          {loading ? (
            <div className="content-skeleton" role="status" aria-label="Đang tải tài khoản">
              <div />
              <div />
              <div />
            </div>
          ) : user ? (
            <>
              <div className="profile-identity">
                <span className="profile-avatar" aria-hidden="true">
                  {(profile?.displayName ?? user.email ?? 'V').slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <h2>{profile?.displayName ?? 'Tài khoản của bạn'}</h2>
                  <p>{user.email}</p>
                </div>
              </div>

              {profileLoading && (
                <div className="content-skeleton compact" role="status" aria-label="Đang tải hồ sơ">
                  <div />
                  <div />
                </div>
              )}

              {profile && (
                <>
                  <p className="verification-badge">
                    <ShieldCheck size={17} />
                    {verificationLabels[profile.studentVerificationStatus]}
                  </p>
                  <dl className="profile-details">
                    <div>
                      <dt>Vai trò</dt>
                      <dd>{profile.roles.map((role) => roleLabels[role]).join(', ')}</dd>
                    </div>
                    <div>
                      <dt>Tài khoản</dt>
                      <dd>{profile.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã khóa'}</dd>
                    </div>
                  </dl>
                </>
              )}

              {profileError && (
                <p className="form-error" role="alert">
                  {profileError}
                </p>
              )}

              <div className="profile-actions">
                <button className="button secondary" disabled={profileLoading || busy} onClick={refreshProfile}>
                  <RefreshCw size={17} /> Tải lại hồ sơ
                </button>
                <button className="text-button" disabled={busy} onClick={logoutSession}>
                  <LogOut size={17} />
                  {busy ? 'Đang đăng xuất...' : 'Đăng xuất'}
                </button>
              </div>

              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
            </>
          ) : (
            <>
              <h2>{isSignUp ? 'Tạo tài khoản mới' : 'Chào bạn trở lại.'}</h2>
              <p className="account-description">
                {isSignUp ? 'Đăng ký nhanh tài khoản để trải nghiệm hệ thống ghép xe.' : 'Đăng nhập để sẵn sàng cho chuyến đi cùng.'}
              </p>

              {/* Nút kiểm thử Admin nhanh cho bạn */}
              <div style={{ marginBottom: 20, padding: '14px 18px', background: 'var(--tint)', borderRadius: 14, border: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--accent-text)' }}>Dành cho kiểm thử giao diện & ví:</span>
                  <button
                    type="button"
                    className="button primary"
                    style={{ minHeight: 38, padding: '8px 16px', fontSize: 12 }}
                    onClick={loginAsMockAdmin}
                  >
                    <UserCheck size={16} /> Đăng nhập nhanh Admin (Demo)
                  </button>
                </div>
              </div>

              <form className="login-form" onSubmit={handleAuth}>
                <div className="form-field">
                  <label htmlFor="email">Email</label>
                  <div className="form-input">
                    <Mail size={19} />
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="username"
                      placeholder="Email của bạn"
                      value={email}
                      required
                      disabled={busy}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError('');
                        setSuccessMsg('');
                      }}
                    />
                  </div>
                </div>

                <div className="form-field">
                  <label htmlFor="password">Mật khẩu</label>
                  <div className="form-input">
                    <LockKeyhole size={19} />
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={isSignUp ? 'new-password' : 'current-password'}
                      placeholder="Nhập mật khẩu"
                      value={password}
                      required
                      disabled={busy}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError('');
                        setSuccessMsg('');
                      }}
                    />
                    <button
                      className="icon-button"
                      type="button"
                      disabled={busy}
                      aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}

                {successMsg && (
                  <p style={{ color: '#16a34a', fontSize: 13, margin: '6px 0' }} role="status">
                    {successMsg}
                  </p>
                )}

                <button className="button primary login-button" disabled={busy} type="submit">
                  {busy ? 'Đang xử lý...' : isSignUp ? 'Đăng ký tài khoản' : 'Đăng nhập'}
                  {!busy && <ArrowRight size={18} />}
                </button>
              </form>

              <p className="signup-note" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <span>{isSignUp ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}</span>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setError('');
                    setSuccessMsg('');
                  }}
                >
                  {isSignUp ? 'Chuyển sang Đăng nhập' : 'Đăng ký tài khoản mới'}
                </button>
              </p>
            </>
          )}
        </section>

        <aside className="account-story">
          <img
            src="/images/ride-home.jpg"
            srcSet="/images/ride-home-small.jpg 720w, /images/ride-home-medium.jpg 960w, /images/ride-home.jpg 1400w"
            sizes="(min-width: 768px) 50vw, calc(100vw - 40px)"
            width="1400"
            height="933"
            loading="lazy"
            decoding="async"
            alt="Chuyến đi xe máy qua những cánh đồng xanh"
          />
          <div>
            <ShieldCheck size={24} />
            <h2>
              Biết người đi cùng.
              <br />
              An tâm trên đường.
            </h2>
            <p>Hồ sơ sinh viên và xác nhận từ tài xế giúp bạn chuẩn bị cho chuyến đi.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
