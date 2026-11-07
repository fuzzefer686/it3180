// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';
import { SessionProvider, useSession } from '../../web/src/modules/auth/SessionProvider';
import { profileFixture } from '../fixtures/auth';
import { supabase } from '../../web/src/lib/supabase';
import { callFunction } from '../../web/src/lib/callable';

vi.mock('../../web/src/lib/supabase', () => ({ supabase: { auth: { onAuthStateChange: vi.fn() } } }));
vi.mock('../../web/src/lib/callable', async () => ({ callFunction: vi.fn(), ...await import('../../web/src/lib/errors') }));
let listener: (event: string, session: { user: User } | null) => void;
const unsubscribe = vi.fn();
const userA = { id: profileFixture.uid, email: 'a@example.com' } as User;
const userB = { id: '22222222-2222-4222-8222-222222222222', email: 'b@example.com' } as User;
function Probe() {
  const state = useSession();
  return <><p>{state.loading ? 'Đang chờ phiên' : state.user?.id ?? 'Chưa đăng nhập'}</p>
    <p data-testid="profile">{state.profile?.uid ?? 'Không có hồ sơ'}</p><p role="alert">{state.profileError}</p>
    <button onClick={state.refreshProfile}>Tải lại</button></>;
}
function mount() { return render(<SessionProvider><Probe/></SessionProvider>); }
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(supabase.auth.onAuthStateChange).mockImplementation(callback => {
    listener = callback as unknown as typeof listener;
    return { data: { subscription: { unsubscribe } } } as never;
  });
});
afterEach(cleanup);
describe('Quản lý phiên và hồ sơ', () => {
  it('khôi phục phiên INITIAL_SESSION và lấy hồ sơ đúng uid', async () => {
    vi.mocked(callFunction).mockResolvedValue(profileFixture); mount();
    expect(screen.getByText('Đang chờ phiên')).toBeTruthy();
    act(() => listener('INITIAL_SESSION', { user: userA }));
    await waitFor(() => expect(screen.getByTestId('profile').textContent).toBe(userA.id));
    expect(callFunction).toHaveBeenCalledWith('getMyProfile', {});
  });
  it('TOKEN_REFRESHED cùng uid giữ hồ sơ và không gọi bootstrap lại', async () => {
    vi.mocked(callFunction).mockResolvedValue(profileFixture); mount();
    act(() => listener('INITIAL_SESSION', { user: userA }));
    await waitFor(() => expect(screen.getByTestId('profile').textContent).toBe(userA.id));
    act(() => listener('TOKEN_REFRESHED', { user: { ...userA } }));
    expect(screen.getByTestId('profile').textContent).toBe(userA.id); expect(callFunction).toHaveBeenCalledTimes(1);
  });
  it('kết quả hồ sơ cũ không được gắn vào user mới', async () => {
    let resolveA!: (value: typeof profileFixture) => void;
    vi.mocked(callFunction).mockReturnValueOnce(new Promise(done => { resolveA = done; })).mockResolvedValueOnce({ ...profileFixture, uid: userB.id });
    mount(); act(() => listener('SIGNED_IN', { user: userA }));
    act(() => listener('SIGNED_IN', { user: userB }));
    await waitFor(() => expect(screen.getByTestId('profile').textContent).toBe(userB.id));
    await act(async () => resolveA(profileFixture));
    expect(screen.getByTestId('profile').textContent).toBe(userB.id);
  });
  it('đăng xuất xóa hồ sơ ngay cả khi RPC cũ chưa kết thúc', async () => {
    let resolve!: (value: typeof profileFixture) => void;
    vi.mocked(callFunction).mockReturnValue(new Promise(done => { resolve = done; }));
    mount(); act(() => listener('SIGNED_IN', { user: userA })); act(() => listener('SIGNED_OUT', null));
    await act(async () => resolve(profileFixture));
    expect(screen.getByText('Chưa đăng nhập')).toBeTruthy(); expect(screen.getByTestId('profile').textContent).toBe('Không có hồ sơ');
  });
  it('từ chối hồ sơ trả về sai uid bằng lỗi rõ ràng', async () => {
    vi.mocked(callFunction).mockResolvedValue({ ...profileFixture, uid: userB.id });
    mount(); act(() => listener('SIGNED_IN', { user: userA }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Có lỗi xảy ra'));
    expect(screen.getByTestId('profile').textContent).toBe('Không có hồ sơ');
  });
  it('RPC chưa triển khai báo lỗi và người dùng có thể tải lại', async () => {
    vi.mocked(callFunction).mockRejectedValueOnce({ code: 'PGRST202' }).mockResolvedValueOnce(profileFixture);
    mount(); act(() => listener('SIGNED_IN', { user: userA }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('chưa được triển khai'));
    act(() => screen.getByText('Tải lại').click());
    await waitFor(() => expect(screen.getByTestId('profile').textContent).toBe(userA.id));
  });
  it('unmount hủy subscription của SDK', () => { const view = mount(); view.unmount(); expect(unsubscribe).toHaveBeenCalledTimes(1); });
});
