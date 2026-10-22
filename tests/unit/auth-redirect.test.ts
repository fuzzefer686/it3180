// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://feat-auth.it3180.pages.dev/tai-khoan"}
import { createClient, type Session, type User } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AUTH_SUCCESS_URL, authSessionRedirectUrl } from '../../web/src/modules/auth/auth-redirect';

afterEach(() => {
  window.history.replaceState(null, '', '/tai-khoan');
  window.localStorage.clear();
});

describe('Nhận phiên trên domain Pages', () => {
  it('SDK thật xác minh user, lưu phiên ở domain đích và xóa token khỏi URL', async () => {
    const user = { id: '11111111-1111-4111-8111-111111111111', email: 'demo@example.com' } as User;
    const session: Session = { user, access_token: 'fake-access-token', refresh_token: 'fake-refresh-token',
      expires_in: 3600, expires_at: Math.round(Date.now() / 1000) + 3600, token_type: 'bearer' };
    window.history.replaceState(null, '', authSessionRedirectUrl(session));
    const fetchUser = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('https://auth.example.invalid/auth/v1/user');
      expect(new Headers(init?.headers).get('Authorization')).toBe(`Bearer ${session.access_token}`);
      return new Response(JSON.stringify(user), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    const client = createClient('https://auth.example.invalid', 'sb_publishable_test', {
      auth: { autoRefreshToken: false, detectSessionInUrl: true }, global: { fetch: fetchUser },
    });
    try {
      const { data, error } = await client.auth.getSession();
      expect(error).toBeNull();
      expect(data.session?.user.id).toBe(user.id);
      expect(data.session?.refresh_token).toBe(session.refresh_token);
      expect(fetchUser).toHaveBeenCalledTimes(1);
      expect(`${window.location.origin}${window.location.pathname}`).toBe(AUTH_SUCCESS_URL);
      expect(window.location.hash).toBe('');
      const stored = JSON.parse(window.localStorage.getItem('sb-auth-auth-token')!);
      expect(stored.user.id).toBe(user.id);
      expect(stored.refresh_token).toBe(session.refresh_token);
    } finally {
      await client.auth.stopAutoRefresh();
    }
  });
});
