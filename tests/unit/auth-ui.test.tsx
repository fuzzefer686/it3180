// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://it3180.pages.dev/tai-khoan"}
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session, User } from '@supabase/supabase-js';
import { AuthPage } from '../../web/src/modules/auth/AuthPage';
import { AdminPage } from '../../web/src/modules/auth/AdminPage';
import { ProfileForm } from '../../web/src/modules/auth/ProfileForm';
import { RequireSession } from '../../web/src/modules/auth/RequireSession';
import { profileFixture, profileInputFixture } from '../fixtures/auth';
import { useSession } from '../../web/src/modules/auth/SessionProvider';
import { callFunction } from '../../web/src/lib/callable';
import { supabase } from '../../web/src/lib/supabase';
import { authBrowser } from '../../web/src/modules/auth/auth-redirect';

vi.mock('../../web/src/lib/supabase', () => ({ supabase: { auth: { signInWithPassword: vi.fn(), signUp: vi.fn(), signOut: vi.fn(), resend: vi.fn(), getSession: vi.fn() } } }));
vi.mock('../../web/src/modules/auth/SessionProvider', () => ({ useSession: vi.fn() }));
vi.mock('../../web/src/lib/callable', async () => ({ callFunction: vi.fn(), ...await import('../../web/src/lib/errors') }));
const authUser = { id: profileFixture.uid, email: 'demo@example.com', user_metadata: { roles: ['ADMIN'] } } as unknown as User;
const authSession: Session = { user: authUser, access_token: 'fake-access-token', refresh_token: 'fake-refresh-token',
  expires_in: 3600, token_type: 'bearer' };
function session(overrides: Partial<ReturnType<typeof useSession>> = {}) {
  vi.mocked(useSession).mockReturnValue({ user: null, profile: null, loading: false, profileLoading: false,
    profileError: '', refreshProfile: vi.fn(), ...overrides });
}
function accountRoutes(entry = '/tai-khoan') {
  return <MemoryRouter initialEntries={[entry]}><Routes>
    <Route path="/tai-khoan" element={<AuthPage/>}/><Route path="/chuyen-di" element={<p>Trang chủ chuyến đi</p>}/>
  </Routes></MemoryRouter>;
}
function account() { return render(accountRoutes()); }
async function fillLogin() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Email'), 'demo@example.com');
  await user.type(screen.getByLabelText('Mật khẩu'), 'Password!2026');
  return user;
}
beforeEach(() => { vi.resetAllMocks(); session(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe('Giao diện Auth', () => {
  it.each([
    ['đăng nhập', 'http://localhost:5173'], ['đăng ký', 'http://localhost:5173'],
    ['đăng nhập', 'https://feat-4-booking.it3180.pages.dev'], ['đăng ký', 'https://feat-4-booking.it3180.pages.dev'],
    ['đăng nhập', 'https://it3180.pages.dev'],
  ])('%s từ %s giữ nguyên website và chuyển nội bộ tới chuyến đi', async (action, origin) => {
    vi.spyOn(authBrowser, 'origin').mockReturnValue(origin);
    const result = { data: { user: authUser, session: authSession }, error: null };
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue(result);
    vi.mocked(supabase.auth.signUp).mockResolvedValue(result);
    const view = account(); const user = userEvent.setup();
    if (action === 'đăng ký') await user.click(screen.getByRole('button', { name: 'Đăng ký' }));
    await fillLogin();
    if (action === 'đăng ký') await user.type(screen.getByLabelText('Nhập lại mật khẩu'), 'Password!2026');
    await user.click(screen.getByRole('button', { name: action === 'đăng ký' ? 'Đăng ký' : 'Đăng nhập' }));
    expect(screen.queryByText('Trang chủ chuyến đi')).toBeNull();
    session({ user: authUser, profile: profileFixture }); view.rerender(accountRoutes());
    expect(await screen.findByText('Trang chủ chuyến đi')).toBeTruthy();
    if (action === 'đăng ký') expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: 'demo@example.com', password: 'Password!2026', options: { emailRedirectTo: `${origin}/tai-khoan` },
    });
    expect(supabase.auth.getSession).not.toHaveBeenCalled();
  });
  it('callback trên preview chỉ chuyển nội bộ sau khi SDK nhận phiên', async () => {
    vi.spyOn(authBrowser, 'origin').mockReturnValue('https://feat-4-booking.it3180.pages.dev');
    const callback = '/tai-khoan#access_token=callback-token&type=signup';
    const view = render(accountRoutes(callback));
    expect(screen.queryByText('Trang chủ chuyến đi')).toBeNull();
    session({ user: authUser, profile: profileFixture }); view.rerender(accountRoutes(callback));
    expect(await screen.findByText('Trang chủ chuyến đi')).toBeTruthy();
    expect(supabase.auth.getSession).not.toHaveBeenCalled();
  });
  it('chặn email sai trước khi gọi SDK', async () => {
    account(); fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'sai-email' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: '12345678' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Đăng nhập' }).closest('form')!);
    expect(screen.getByRole('alert').textContent).toContain('email hợp lệ');
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
  });
  it('hiện lỗi sai mật khẩu bằng tiếng Việt', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({ data: { user: null, session: null }, error: { code: 'invalid_credentials' } } as never);
    account(); const user = await fillLogin(); await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Email hoặc mật khẩu chưa đúng');
  });
  it('một lần gửi đang chờ không bị gửi lặp; thành công xóa mật khẩu', async () => {
    let resolve!: (value: never) => void;
    vi.mocked(supabase.auth.signInWithPassword).mockReturnValue(new Promise(done => { resolve = done; }));
    account(); await fillLogin();
    const form = screen.getByRole('button', { name: 'Đăng nhập' }).closest('form')!;
    fireEvent.submit(form); fireEvent.submit(form);
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledTimes(1);
    expect((screen.getByLabelText('Email') as HTMLInputElement).disabled).toBe(true);
    resolve({ data: { user: authUser, session: {} }, error: null } as never);
    await waitFor(() => expect((screen.getByLabelText('Mật khẩu') as HTMLInputElement).value).toBe(''));
  });
  it('đăng ký chặn mật khẩu yếu và mật khẩu nhập lại khác nhau', async () => {
    account(); const user = userEvent.setup(); await user.click(screen.getByRole('button', { name: 'Đăng ký' }));
    await user.type(screen.getByLabelText('Email'), 'demo@example.com');
    await user.type(screen.getByLabelText('Mật khẩu'), 'short');
    await user.click(screen.getByRole('button', { name: 'Đăng ký' }));
    expect(screen.getByRole('alert').textContent).toContain('8 ký tự');
    await user.type(screen.getByLabelText('Mật khẩu'), 'long-enough');
    await user.type(screen.getByLabelText('Nhập lại mật khẩu'), 'another-password');
    await user.click(screen.getByRole('button', { name: 'Đăng ký' }));
    expect(screen.getByRole('alert').textContent).toContain('chưa khớp');
    expect(supabase.auth.signUp).not.toHaveBeenCalled();
  });
  it('đăng ký có phiên gửi redirect về website, chỉ chuyển trang khi SDK đã cung cấp user', async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({ data: { user: authUser, session: { user: authUser } }, error: null } as never);
    const view = account(); const user = userEvent.setup(); await user.click(screen.getByRole('button', { name: 'Đăng ký' }));
    await fillLogin(); await user.type(screen.getByLabelText('Nhập lại mật khẩu'), 'Password!2026');
    await user.click(screen.getByRole('button', { name: 'Đăng ký' }));
    expect(supabase.auth.signUp).toHaveBeenCalledWith({ email: 'demo@example.com', password: 'Password!2026',
      options: { emailRedirectTo: 'https://it3180.pages.dev/tai-khoan' } });
    expect((screen.getByLabelText('Mật khẩu') as HTMLInputElement).value).toBe('');
    expect(screen.queryByText('Trang chủ chuyến đi')).toBeNull();
    session({ user: authUser, profile: profileFixture });
    view.rerender(accountRoutes());
    expect(await screen.findByText('Trang chủ chuyến đi')).toBeTruthy();
  });
  it('Confirm email bật vẫn cho signup; session null là chờ xác minh, không phải lỗi đăng ký', async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({ data: { user: authUser, session: null }, error: null });
    account(); const user = userEvent.setup(); await user.click(screen.getByRole('button', { name: 'Đăng ký' }));
    await fillLogin(); await user.type(screen.getByLabelText('Nhập lại mật khẩu'), 'Password!2026');
    await user.click(screen.getByRole('button', { name: 'Đăng ký' }));
    expect(screen.getByRole('heading', { name: 'Kiểm tra email để hoàn tất đăng ký' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText('Trang chủ chuyến đi')).toBeNull();
    expect(screen.getByRole('button', { name: 'Gửi lại email xác minh' })).toBeTruthy();
    expect((screen.getByLabelText('Mật khẩu') as HTMLInputElement).value).toBe('');
  });
  it('gửi lại email dùng email đã đăng ký và cùng callback website, không lấy email vừa sửa trên form', async () => {
    vi.spyOn(authBrowser, 'origin').mockReturnValue('https://feat-4-booking.it3180.pages.dev');
    vi.mocked(supabase.auth.signUp).mockResolvedValue({ data: { user: authUser, session: null }, error: null });
    vi.mocked(supabase.auth.resend).mockResolvedValue({ data: { user: null, session: null }, error: null });
    account(); const user = userEvent.setup(); await user.click(screen.getByRole('button', { name: 'Đăng ký' }));
    await fillLogin(); await user.type(screen.getByLabelText('Nhập lại mật khẩu'), 'Password!2026');
    await user.click(screen.getByRole('button', { name: 'Đăng ký' }));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'other@example.com' } });
    await user.click(screen.getByRole('button', { name: 'Gửi lại email xác minh' }));
    expect(supabase.auth.resend).toHaveBeenCalledWith({ type: 'signup', email: 'demo@example.com',
      options: { emailRedirectTo: 'https://feat-4-booking.it3180.pages.dev/tai-khoan' } });
    expect(await screen.findByText('Vui lòng kiểm tra hộp thư và thư rác để tìm email xác minh mới nhất.')).toBeTruthy();
  });
  it('xác minh ở tab khác xong nhận phiên thì tự mở trang chủ', async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({ data: { user: authUser, session: null }, error: null });
    const view = account(); const user = userEvent.setup(); await user.click(screen.getByRole('button', { name: 'Đăng ký' }));
    await fillLogin(); await user.type(screen.getByLabelText('Nhập lại mật khẩu'), 'Password!2026');
    await user.click(screen.getByRole('button', { name: 'Đăng ký' }));
    session({ user: authUser, profile: profileFixture });
    view.rerender(accountRoutes());
    expect(await screen.findByText('Trang chủ chuyến đi')).toBeTruthy();
  });
  it('kết quả đăng ký thiếu cả user và phiên không được coi là thành công', async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({ data: { user: null, session: null }, error: null });
    account(); const user = userEvent.setup(); await user.click(screen.getByRole('button', { name: 'Đăng ký' }));
    await fillLogin(); await user.type(screen.getByLabelText('Nhập lại mật khẩu'), 'Password!2026');
    await user.click(screen.getByRole('button', { name: 'Đăng ký' }));
    expect((await screen.findByRole('alert')).textContent).toContain('kết quả đăng ký hợp lệ');
    expect(screen.queryByText('Trang chủ chuyến đi')).toBeNull();
  });
  it('lỗi ghi database từ signup không báo thành công hoặc làm lộ lỗi SQL', async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({ data: { user: null, session: null },
      error: { code: 'unexpected_failure', message: 'Database error saving new user' } } as never);
    account(); const user = userEvent.setup(); await user.click(screen.getByRole('button', { name: 'Đăng ký' }));
    await fillLogin(); await user.type(screen.getByLabelText('Nhập lại mật khẩu'), 'Password!2026');
    await user.click(screen.getByRole('button', { name: 'Đăng ký' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Có lỗi xảy ra');
    expect(screen.queryByText(/Database error/)).toBeNull();
    expect(screen.queryByText('Trang chủ chuyến đi')).toBeNull();
  });
  it('email đã tồn tại báo đăng nhập thay vì tạo thành công giả', async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({ data: { user: null, session: null },
      error: { code: 'user_already_exists' } } as never);
    account(); const user = userEvent.setup(); await user.click(screen.getByRole('button', { name: 'Đăng ký' }));
    await fillLogin(); await user.type(screen.getByLabelText('Nhập lại mật khẩu'), 'Password!2026');
    await user.click(screen.getByRole('button', { name: 'Đăng ký' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Nếu đã có tài khoản, hãy đăng nhập');
    expect(screen.queryByText('Trang chủ chuyến đi')).toBeNull();
  });
  it('login thiếu phiên không được báo thành công hoặc chuyển trang', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({ data: { user: authUser, session: null }, error: null } as never);
    account(); const user = await fillLogin(); await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Chưa nhận được phiên đăng nhập');
    expect(screen.queryByText('Trang chủ chuyến đi')).toBeNull();
  });
  it('login tài khoản chưa xác minh cho gửi lại email thay vì yêu cầu liên hệ admin', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({ data: { user: null, session: null }, error: { code: 'email_not_confirmed' } } as never);
    account(); const user = await fillLogin(); await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Vui lòng xác minh email');
    expect(screen.getByRole('button', { name: 'Gửi lại email xác minh' })).toBeTruthy();
    expect(screen.queryByText('Trang chủ chuyến đi')).toBeNull();
  });
  it('callback xác minh chỉ mở trang chủ sau khi SDK nhận user', async () => {
    const callback = '/tai-khoan#access_token=demo-token&type=signup';
    const view = render(accountRoutes(callback));
    expect(screen.queryByText('Trang chủ chuyến đi')).toBeNull();
    session({ user: authUser, profile: profileFixture });
    view.rerender(accountRoutes(callback));
    expect(await screen.findByText('Trang chủ chuyến đi')).toBeTruthy();
  });
  it('callback hết hạn báo lỗi; không chuyển trang hoặc hiển thị nội dung lỗi thô', () => {
    render(accountRoutes('/tai-khoan#error=access_denied&error_code=otp_expired&error_description=secret-internal-detail'));
    expect(screen.getByRole('alert').textContent).toContain('Liên kết xác minh đã hết hạn');
    expect(screen.queryByText(/secret-internal-detail/)).toBeNull();
    expect(screen.queryByText('Trang chủ chuyến đi')).toBeNull();
  });
  it('gửi lại bị giới hạn không được báo email đã gửi thành công', async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({ data: { user: authUser, session: null }, error: null });
    vi.mocked(supabase.auth.resend).mockResolvedValue({ data: { user: null, session: null }, error: { code: 'over_email_send_rate_limit' } } as never);
    account(); const user = userEvent.setup(); await user.click(screen.getByRole('button', { name: 'Đăng ký' }));
    await fillLogin(); await user.type(screen.getByLabelText('Nhập lại mật khẩu'), 'Password!2026');
    await user.click(screen.getByRole('button', { name: 'Đăng ký' }));
    await user.click(screen.getByRole('button', { name: 'Gửi lại email xác minh' }));
    expect((await screen.findByRole('alert')).textContent).toContain('thử quá nhiều lần');
    expect(screen.queryByText('Vui lòng kiểm tra hộp thư và thư rác để tìm email xác minh mới nhất.')).toBeNull();
  });
  it('server không cho gửi email tới địa chỉ ngoài nhóm thì báo rõ lỗi gửi email', async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({ data: { user: null, session: null },
      error: { code: 'email_address_not_authorized' } } as never);
    account(); const user = userEvent.setup(); await user.click(screen.getByRole('button', { name: 'Đăng ký' }));
    await fillLogin(); await user.type(screen.getByLabelText('Nhập lại mật khẩu'), 'Password!2026');
    await user.click(screen.getByRole('button', { name: 'Đăng ký' }));
    expect((await screen.findByRole('alert')).textContent).toContain('cấu hình dịch vụ gửi email');
    expect(screen.queryByText('Trang chủ chuyến đi')).toBeNull();
  });
  it('không chuyển trang khi SDK có user trước khi signUp trả về, sau đó tự chuyển trang chủ', async () => {
    let resolve!: (value: never) => void;
    vi.mocked(supabase.auth.signUp).mockReturnValue(new Promise(done => { resolve = done; }));
    const view = account(); const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Đăng ký' })); await fillLogin();
    await user.type(screen.getByLabelText('Nhập lại mật khẩu'), 'Password!2026');
    await user.click(screen.getByRole('button', { name: 'Đăng ký' }));
    session({ user: authUser, profile: profileFixture });
    view.rerender(accountRoutes());
    expect(screen.queryByText('Trang chủ chuyến đi')).toBeNull();
    await act(async () => resolve({ data: { user: authUser, session: { user: authUser } }, error: null } as never));
    expect(await screen.findByText('Trang chủ chuyến đi')).toBeTruthy();
  });  it('hiện/ẩn mật khẩu, đổi chế độ xóa mật khẩu cũ', async () => {
    account(); const user = await fillLogin(); await user.click(screen.getByRole('button', { name: 'Hiện mật khẩu' }));
    expect((screen.getByLabelText('Mật khẩu') as HTMLInputElement).type).toBe('text');
    await user.click(screen.getByRole('button', { name: 'Đăng ký' }));
    expect((screen.getByLabelText('Mật khẩu') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Mật khẩu') as HTMLInputElement).type).toBe('password');
  });
  it('hồ sơ thiếu API báo rõ và không tự lấy ADMIN từ metadata', () => {
    session({ user: authUser, profileError: 'Chức năng này chưa được triển khai.' }); account();
    expect(screen.getByRole('alert').textContent).toContain('chưa được triển khai');
    expect(screen.queryByText('Quản trị hồ sơ')).toBeNull();
  });
  it('đăng xuất gọi SDK và hiện lỗi nếu thất bại', async () => {
    session({ user: authUser }); vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: { code: 'PT401' } } as never);
    account(); await userEvent.setup().click(screen.getByRole('button', { name: 'Đăng xuất' }));
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
    expect((await screen.findByRole('alert')).textContent).toContain('đăng nhập lại');
  });
});
describe('Trang được bảo vệ', () => {
  it('chờ phiên ban đầu rồi mới quyết định điều hướng', () => {
    session({ loading: true }); render(<MemoryRouter><RequireSession><p>Nội dung riêng tư</p></RequireSession></MemoryRouter>);
    expect(screen.queryByText('Nội dung riêng tư')).toBeNull(); expect(screen.getByRole('status')).toBeTruthy();
  });
  it('chưa login được chuyển tới đăng nhập', () => {
    render(<MemoryRouter initialEntries={['/vi-diem']}><Routes><Route path="/vi-diem" element={<RequireSession><p>Ví riêng tư</p></RequireSession>}/><Route path="/tai-khoan" element={<p>Đăng nhập trước</p>}/></Routes></MemoryRouter>);
    expect(screen.getByText('Đăng nhập trước')).toBeTruthy(); expect(screen.queryByText('Ví riêng tư')).toBeNull();
  });
  it('USER có metadata ADMIN vẫn không vào được trang quản trị', () => {
    session({ user: authUser, profile: profileFixture });
    render(<MemoryRouter><RequireSession admin><p>Dữ liệu admin</p></RequireSession></MemoryRouter>);
    expect(screen.getByText('Không có quyền truy cập')).toBeTruthy(); expect(screen.queryByText('Dữ liệu admin')).toBeNull();
  });
  it('đăng nhập thành công tự mở trang chủ chuyến đi, không cần bấm tiếp tục', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({ data: { user: authUser, session: { user: authUser } }, error: null } as never);
    const routes = () => <MemoryRouter initialEntries={[{ pathname: '/tai-khoan', state: { from: '/vi-diem' } }]}><Routes>
      <Route path="/tai-khoan" element={<AuthPage/>}/><Route path="/vi-diem" element={<p>Ví của tôi</p>}/>
      <Route path="/chuyen-di" element={<p>Trang chủ chuyến đi</p>}/>
    </Routes></MemoryRouter>;
    const view = render(routes());
    const user = await fillLogin();
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'demo@example.com', password: 'Password!2026' });
    session({ user: authUser, profile: profileFixture });
    view.rerender(routes());
    expect(await screen.findByText('Trang chủ chuyến đi')).toBeTruthy();
    expect(screen.queryByText('Ví của tôi')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Đăng nhập' })).toBeNull();
  });
  it('LOCKED không hiển thị nội dung riêng tư', () => {
    session({ user: authUser, profile: { ...profileFixture, status: 'LOCKED' } });
    render(<MemoryRouter><RequireSession><p>Nội dung riêng tư</p></RequireSession></MemoryRouter>);
    expect(screen.getByText(/Tài khoản đã bị khóa/)).toBeTruthy(); expect(screen.queryByText('Nội dung riêng tư')).toBeNull();
  });
  it('hồ sơ chưa tải xong hoặc thiếu API không mở trang riêng tư', () => {
    session({ user: authUser, profileLoading: true });
    const view = render(<MemoryRouter><RequireSession><p>Nội dung riêng tư</p></RequireSession></MemoryRouter>);
    expect(screen.getByRole('status')).toBeTruthy(); expect(screen.queryByText('Nội dung riêng tư')).toBeNull();
    session({ user: authUser, profileError: 'Chức năng này chưa được triển khai.' });
    view.rerender(<MemoryRouter><RequireSession><p>Nội dung riêng tư</p></RequireSession></MemoryRouter>);
    expect(screen.getByRole('alert').textContent).toContain('chưa được triển khai'); expect(screen.queryByText('Nội dung riêng tư')).toBeNull();
  });
});
describe('Hồ sơ và admin', () => {
  it('lưu hồ sơ qua API, không gửi uid/role và thông báo sau server thành công', async () => {
    vi.mocked(callFunction).mockResolvedValue(profileFixture); const onSaved = vi.fn();
    render(<ProfileForm profile={profileFixture} onSaved={onSaved}/>);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Lưu hồ sơ' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(callFunction).toHaveBeenCalledWith('updateMyProfile', { ...profileInputFixture, vehicleModel: null, vehiclePlate: null });
    expect(screen.getByRole('status').textContent).toContain('Đã lưu hồ sơ');
  });
  it('admin phải nhập lý do trước khi gửi từ chối và nhận lỗi quyền từ server', async () => {
    session({ user: authUser, profile: { ...profileFixture, roles: ['USER', 'ADMIN'] } });
    vi.mocked(callFunction).mockResolvedValueOnce({ users: [profileFixture], total: 1 });
    render(<AdminPage/>); await userEvent.setup().click(await screen.findByRole('button', { name: /Sinh viên Demo/ }));
    await userEvent.setup().click(screen.getByRole('button', { name: 'Từ chối sinh viên' }));
    expect(screen.getByRole('alert').textContent).toContain('lý do'); expect(callFunction).toHaveBeenCalledTimes(1);
    vi.mocked(callFunction).mockRejectedValueOnce({ code: 'PT403' });
    await userEvent.setup().type(screen.getByLabelText('Ghi chú duyệt / lý do từ chối'), 'Minh chứng demo thiếu');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Từ chối sinh viên' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('không được phép'));
    expect(callFunction).toHaveBeenLastCalledWith('adminReviewUser', { uid: profileFixture.uid, kind: 'STUDENT', decision: 'REJECTED', reason: 'Minh chứng demo thiếu' });
  });
});
