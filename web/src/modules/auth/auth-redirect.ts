import type { Session } from '@supabase/supabase-js';

export const AUTH_SITE_ORIGIN = 'https://it3180.pages.dev';
// Website đã chốt cho link xác minh email; không gửi link xác minh về localhost.
// URL này phải được cho phép trong Supabase Authentication → URL Configuration.
export const AUTH_EMAIL_REDIRECT_URL = `${AUTH_SITE_ORIGIN}/tai-khoan`;
export const AUTH_SUCCESS_PATH = '/chuyen-di';
export const AUTH_SUCCESS_URL = `${AUTH_SITE_ORIGIN}${AUTH_SUCCESS_PATH}`;

export const authBrowser = {
  origin: () => window.location.origin,
  replace: (url: string) => window.location.replace(url),
};

// Khác origin thì localStorage không được chia sẻ. Dùng callback implicit của SDK
// trên đúng website tin cậy; token chỉ nằm sau #, không gửi tới server Pages.
// SDK đích xác minh user, lưu phiên và xóa fragment. Không nhận URL đích từ input.
export function authSessionRedirectUrl(session: Session): string {
  if (!session.access_token || !session.refresh_token || !Number.isFinite(session.expires_in) || session.expires_in <= 0) {
    throw { code: 'auth_session_missing' };
  }
  const fragment = new URLSearchParams({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: String(session.expires_in),
    token_type: session.token_type,
  });
  if (session.expires_at) fragment.set('expires_at', String(session.expires_at));
  return `${AUTH_SUCCESS_URL}#${fragment}`;
}

export function isAuthCallback(location: { search: string; hash: string }): boolean {
  const fragment = new URLSearchParams(location.hash.replace(/^#/, ''));
  if (fragment.get('type') === 'recovery') return false;
  return fragment.has('access_token') || new URLSearchParams(location.search).has('code');
}

// Chỉ đọc mã lỗi, không hiển thị token hay thông báo thô từ URL callback.
export function authCallbackError(location: { search: string; hash: string }): string | null {
  const fragment = new URLSearchParams(location.hash.replace(/^#/, ''));
  const query = new URLSearchParams(location.search);
  const code = fragment.get('error_code') || query.get('error_code');
  if (code === 'otp_expired' || code === 'flow_state_expired' || code === 'flow_state_not_found') return code;
  return code || fragment.has('error') || query.has('error') ? 'auth_callback_failed' : null;
}
