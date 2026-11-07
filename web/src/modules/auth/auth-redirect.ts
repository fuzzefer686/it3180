export const AUTH_SUCCESS_PATH = '/chuyen-di';

export const authBrowser = {
  origin: () => window.location.origin,
};

// Mỗi preview/local nhận email xác minh về chính website đang mở.
// URL này cần được cho phép trong Supabase Authentication → URL Configuration.
// Không lấy domain đích từ query, router state hoặc dữ liệu người dùng nhập.
export function authEmailRedirectUrl(): string {
  return new URL('/tai-khoan', authBrowser.origin()).href;
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
