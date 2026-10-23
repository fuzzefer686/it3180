// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://feat-auth.it3180.pages.dev/tai-khoan"}
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';
import { AuthPage } from '../../web/src/modules/auth/AuthPage';
import { AdminPage } from '../../web/src/modules/auth/AdminPage';
import { ProfileForm } from '../../web/src/modules/auth/ProfileForm';
import { RequireSession } from '../../web/src/modules/auth/RequireSession';
import { profileFixture, profileInputFixture } from '../fixtures/auth';
import { useSession } from '../../web/src/modules/auth/SessionProvider';
import { callFunction } from '../../web/src/lib/callable';
import { supabase } from '../../web/src/lib/supabase';

vi.mock('../../web/src/lib/supabase', () => ({ supabase: { auth: { signInWithPassword: vi.fn(), signUp: vi.fn(), signOut: vi.fn(), resend: vi.fn() } } }));
vi.mock('../../web/src/modules/auth/SessionProvider', () => ({ useSession: vi.fn() }));
vi.mock('../../web/src/lib/callable', async () => ({ callFunction: vi.fn(), ...await import('../../web/src/lib/errors') }));
const authUser = { id: profileFixture.uid, email: 'demo@example.com', user_metadata: { roles: ['ADMIN'] } } as unknown as User;
function session(overrides: Partial<ReturnType<typeof useSession>> = {}) {
  vi.mocked(useSession).mockReturnValue({ user: null, profile: null, loading: false, profileLoading: false,
    profileError: '', refreshProfile: vi.fn(), ...overrides });
}
function account() { return render(<MemoryRouter><AuthPage/></MemoryRouter>); }
async function fillLogin() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Email'), 'demo@example.com');
  await user.type(screen.getByLabelText('Mật khẩu'), 'Password!2026');
  return user;
}
beforeEach(() => { vi.resetAllMocks(); session(); });
afterEach(cleanup);
describe('Giao diện Auth', () => {
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
  it('đăng ký qua SDK không gửi quyền; không có phiên thì yêu cầu xác nhận email', async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({ data: { user: authUser, session: null }, error: null });
    account(); const user = userEvent.setup(); await user.click(screen.getByRole('button', { name: 'Đăng ký' }));
    await fillLogin(); await user.type(screen.getByLabelText('Nhập lại mật khẩu'), 'Password!2026');
    await user.click(screen.getByRole('button', { name: 'Đăng ký' }));
    expect((await screen.findByRole('status')).textContent).toContain('xác nhận email');
    expect(supabase.auth.signUp).toHaveBeenCalledWith({ email: 'demo@example.com', password: 'Password!2026', options: { emailRedirectTo: `${window.location.origin}/tai-khoan` } });
    expect((screen.getByLabelText('Mật khẩu') as HTMLInputElement).value).toBe('');
    expect(screen.getByRole('heading', { name: 'Kiểm tra email để xác minh tài khoản' })).toBeTruthy();
    expect(supabase.auth.signUp).toHaveBeenCalledWith(expect.objectContaining({
      options: { emailRedirectTo: 'https://feat-auth.it3180.pages.dev/tai-khoan' },
    }));
    await user.type(screen.getByLabelText('Mật khẩu'), 'TypingAgain');
    expect(screen.getByRole('heading', { name: 'Kiểm tra email để xác minh tài khoản' })).toBeTruthy();
  });
  it('đăng ký có phiên không báo đang chờ xác nhận', async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({ data: { user: authUser, session: { user: authUser } }, error: null } as never);
    account(); const user = userEvent.setup(); await user.click(screen.getByRole('button', { name: 'Đăng ký' }));
    await fillLogin(); await user.type(screen.getByLabelText('Nhập lại mật khẩu'), 'Password!2026');
    await user.click(screen.getByRole('button', { name: 'Đăng ký' }));
    await waitFor(() => expect((screen.getByLabelText('Mật khẩu') as HTMLInputElement).value).toBe(''));
    expect(screen.getByRole('heading', { name: 'Tài khoản đã sẵn sàng' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Gửi lại email xác minh' })).toBeNull();
  });
  it('thông báo đăng ký vẫn hiện khi SDK chuyển sang giao diện tài khoản', async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({ data: { user: authUser, session: { user: authUser } }, error: null } as never);
    const view = account(); const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Đăng ký' })); await fillLogin();
    await user.type(screen.getByLabelText('Nhập lại mật khẩu'), 'Password!2026');
    await user.click(screen.getByRole('button', { name: 'Đăng ký' }));
    session({ user: authUser, profile: profileFixture });
    view.rerender(<MemoryRouter><AuthPage/></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Tài khoản đã sẵn sàng' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Đăng xuất' })).toBeTruthy();
  });
  it('gửi lại email dùng địa chỉ đã đăng ký và redirect đúng website đang mở', async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({ data: { user: authUser, session: null }, error: null });
    vi.mocked(supabase.auth.resend).mockResolvedValue({ data: { user: null, session: null }, error: null });
    account(); const user = userEvent.setup(); await user.click(screen.getByRole('button', { name: 'Đăng ký' }));
    await fillLogin(); await user.type(screen.getByLabelText('Nhập lại mật khẩu'), 'Password!2026');
    await user.click(screen.getByRole('button', { name: 'Đăng ký' }));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'other@example.com' } });
    await user.click(screen.getByRole('button', { name: 'Gửi lại email xác minh' }));
    expect(supabase.auth.resend).toHaveBeenCalledWith({ type: 'signup', email: 'demo@example.com',
      options: { emailRedirectTo: 'https://feat-auth.it3180.pages.dev/tai-khoan' } });
    expect(await screen.findByText('Vui lòng kiểm tra hộp thư và thư rác để tìm email xác minh.')).toBeTruthy();
  });
  it('khi phiên được xác nhận thì không tiếp tục yêu cầu xác minh hoặc gửi lại email', async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({ data: { user: authUser, session: null }, error: null });
    const view = account(); const user = userEvent.setup(); await user.click(screen.getByRole('button', { name: 'Đăng ký' }));
    await fillLogin(); await user.type(screen.getByLabelText('Nhập lại mật khẩu'), 'Password!2026');
    await user.click(screen.getByRole('button', { name: 'Đăng ký' }));
    expect(screen.getByRole('heading', { name: 'Kiểm tra email để xác minh tài khoản' })).toBeTruthy();
    session({ user: authUser, profile: profileFixture });
    view.rerender(<MemoryRouter><AuthPage/></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Email đã được xác nhận' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Gửi lại email xác minh' })).toBeNull();
  });
  it('gửi lại email bị giới hạn thì hiển thị lỗi, không báo đã gửi thành công', async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({ data: { user: authUser, session: null }, error: null });
    vi.mocked(supabase.auth.resend).mockResolvedValue({ data: { user: null, session: null }, error: { code: 'over_email_send_rate_limit' } } as never);
    account(); const user = userEvent.setup(); await user.click(screen.getByRole('button', { name: 'Đăng ký' }));
    await fillLogin(); await user.type(screen.getByLabelText('Nhập lại mật khẩu'), 'Password!2026');
    await user.click(screen.getByRole('button', { name: 'Đăng ký' }));
    await user.click(screen.getByRole('button', { name: 'Gửi lại email xác minh' }));
    expect((await screen.findByRole('alert')).textContent).toContain('thử quá nhiều lần');
    expect(screen.queryByText('Vui lòng kiểm tra hộp thư và thư rác để tìm email xác minh.')).toBeNull();
  });
  it('không chuyển trang quá sớm khi SDK tạo session trước khi signUp trả về', async () => {
    let resolve!: (value: never) => void;
    vi.mocked(supabase.auth.signUp).mockReturnValue(new Promise(done => { resolve = done; }));
    const routes = <MemoryRouter initialEntries={[{ pathname: '/tai-khoan', state: { from: '/vi-diem' } }]}><Routes>
      <Route path="/tai-khoan" element={<AuthPage/>}/><Route path="/vi-diem" element={<p>Ví sau đăng ký</p>}/>
    </Routes></MemoryRouter>;
    const view = render(routes); const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Đăng ký' })); await fillLogin();
    await user.type(screen.getByLabelText('Nhập lại mật khẩu'), 'Password!2026');
    await user.click(screen.getByRole('button', { name: 'Đăng ký' }));
    session({ user: authUser, profile: profileFixture });
    view.rerender(<MemoryRouter initialEntries={[{ pathname: '/tai-khoan', state: { from: '/vi-diem' } }]}><Routes>
      <Route path="/tai-khoan" element={<AuthPage/>}/><Route path="/vi-diem" element={<p>Ví sau đăng ký</p>}/>
    </Routes></MemoryRouter>);
    expect(screen.queryByText('Ví sau đăng ký')).toBeNull();
    await act(async () => resolve({ data: { user: authUser, session: { user: authUser } }, error: null } as never));
    expect(screen.getByRole('heading', { name: 'Tài khoản đã sẵn sàng' })).toBeTruthy();
    await user.click(screen.getByRole('link', { name: 'Tiếp tục đến trang đã chọn' }));
    expect(screen.getByText('Ví sau đăng ký')).toBeTruthy();
  });
  it('hiện/ẩn mật khẩu, đổi chế độ xóa mật khẩu cũ', async () => {
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
  it('sau login quay về trang riêng tư đã chọn', () => {
    session({ user: authUser, profile: profileFixture });
    render(<MemoryRouter initialEntries={[{ pathname: '/tai-khoan', state: { from: '/vi-diem' } }]}><Routes><Route path="/tai-khoan" element={<AuthPage/>}/><Route path="/vi-diem" element={<p>Ví của tôi</p>}/></Routes></MemoryRouter>);
    expect(screen.getByText('Ví của tôi')).toBeTruthy();
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
