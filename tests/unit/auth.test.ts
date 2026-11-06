import { describe, expect, it } from 'vitest';
import { emptyInputSchema, responseSchemas } from '../../shared/api';
import { adminReviewInputSchema, profileInputSchema, userProfileSchema } from '../../shared/contracts';
import { authReturnPath, loginInputSchema, signupInputSchema } from '../../web/src/modules/auth/auth-validation';
import { profileFixture, profileInputFixture } from '../fixtures/auth';
import { errorMessage } from '../../web/src/lib/errors';
import { readSupabaseConfig } from '../../web/src/lib/supabase-config';
import { AUTH_SUCCESS_PATH, authCallbackError, isAuthCallback } from '../../web/src/modules/auth/auth-redirect';

describe('Contract và cấu hình Supabase', () => {
  it('không nhận quyền lạ hoặc field giả quyền trong API nền', () => {
    expect(userProfileSchema.safeParse(profileFixture).success).toBe(true);
    expect(userProfileSchema.safeParse({ ...profileFixture, roles: ['SUPERUSER'] }).success).toBe(false);
    expect(emptyInputSchema.safeParse({ uid: 'other', roles: ['ADMIN'] }).success).toBe(false);
    expect(emptyInputSchema.safeParse({}).success).toBe(true);
  });
  it('health response dùng local/cloud và từ chối payload cũ', () => {
    const response = { status: 'ok', database: 'connected', sampleMessage: null, environment: 'local' };
    expect(responseSchemas.healthCheck.safeParse(response).success).toBe(true);
    expect(responseSchemas.healthCheck.safeParse({ ...response, environment: 'emulator' }).success).toBe(false);
  });
  it('không hiển thị lỗi SQL/SDK thô và dịch lỗi Auth/quyền', () => {
    expect(errorMessage({ code: 'invalid_credentials' })).toContain('mật khẩu');
    expect(errorMessage({ code: 'PT403' })).toContain('không được phép');
    expect(errorMessage({ code: 'PGRST202' })).toContain('chưa được triển khai');
    expect(errorMessage({ code: 'XX000', message: 'secret SQL internals' })).not.toContain('secret');
  });
  it('chặn config thiếu, cloud HTTP và secret/service-role key ở frontend', () => {
    const env = { VITE_SUPABASE_URL: 'http://127.0.0.1:54321', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' };
    expect(readSupabaseConfig(env).url).toBe(env.VITE_SUPABASE_URL);
    expect(() => readSupabaseConfig({})).toThrow();
    expect(() => readSupabaseConfig({ ...env, VITE_SUPABASE_URL: 'http://example.supabase.co' })).toThrow();
    expect(() => readSupabaseConfig({ ...env, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_test' })).toThrow();
    const jwt = `header.${btoa(JSON.stringify({ role: 'service_role' }))}.signature`;
    expect(() => readSupabaseConfig({ ...env, VITE_SUPABASE_PUBLISHABLE_KEY: jwt })).toThrow();
    const anon = `header.${btoa(JSON.stringify({ role: 'anon' }))}.signature`;
    expect(readSupabaseConfig({ ...env, VITE_SUPABASE_PUBLISHABLE_KEY: anon }).key).toBe(anon);
  });
  it('bản phát hành chặn localhost và loopback, chấp nhận Supabase online', () => {
    const key = { VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' };
    for (const url of ['http://localhost:54321', 'https://localhost:54321', 'http://localhost.:54321',
      'http://dev.localhost:54321', 'http://127.0.0.1:54321', 'http://127.0.0.2:54321',
      'http://0.0.0.0:54321', 'http://[::1]:54321', 'http://[::]:54321']) {
      expect(() => readSupabaseConfig({ ...key, VITE_SUPABASE_URL: url }, { allowLocal: false })).toThrow('không được trỏ tới localhost');
    }
    const online = { ...key, VITE_SUPABASE_URL: 'https://example.supabase.co' };
    expect(readSupabaseConfig(online, { allowLocal: false }).url).toBe(online.VITE_SUPABASE_URL);
  });
  it('chuẩn hóa email nhưng giữ nguyên mật khẩu; login không áp chính sách mật khẩu mới', () => {
    expect(loginInputSchema.parse({ email: ' demo@example.com ', password: ' pass ' })).toEqual({ email: 'demo@example.com', password: ' pass ' });
    expect(signupInputSchema.safeParse({ email: 'demo@example.com', password: '1234567', confirmPassword: '1234567' }).success).toBe(false);
  });
  it('không nhận field quyền trong hồ sơ và yêu cầu lý do khi từ chối', () => {
    expect(profileInputSchema.safeParse(profileInputFixture).success).toBe(true);
    expect(profileInputSchema.safeParse({ ...profileInputFixture, roles: ['ADMIN'] }).success).toBe(false);
    expect(profileInputSchema.safeParse({ ...profileInputFixture, vehiclePlate: null }).success).toBe(false);
    expect(adminReviewInputSchema.safeParse({ uid: '11111111-1111-4111-8111-111111111111', kind: 'STUDENT', decision: 'REJECTED', reason: ' ' }).success).toBe(false);
  });
  it('chỉ quay về đường dẫn nội bộ đã cho phép, chặn URL ngoài và trang không hợp lệ', () => {
    expect(authReturnPath({ from: '/dat-chuyen?mode=driver' })).toBe('/dat-chuyen?mode=driver');
    for (const from of ['https://example.com', '//example.com', '/\\example.com', '/tai-khoan', '/quan-tri/khac']) {
      expect(authReturnPath({ from })).toBeNull();
    }
    expect(authReturnPath(null)).toBeNull();
  });
  it('quay lại form/danh sách/chi tiết Trip sau đăng nhập, không nhận đường dẫn ngoài', () => {
    for (const from of ['/chuyen-di/dang', '/chuyen-di/cua-toi',
      '/chuyen-di/11111111-1111-4111-8111-111111111111', '/chuyen-di/11111111-1111-4111-8111-111111111111/sua?tab=route']) {
      expect(authReturnPath({ from })).toBe(from);
    }
    for (const from of ['/chuyen-di/../../example.com', '/chuyen-di//example.com', '/chuyen-di/%2f%2fevil.com']) {
      expect(authReturnPath({ from })).toBeNull();
    }
  });
  it('dịch lỗi email chưa xác nhận, đăng ký bị tắt và mật khẩu yếu mà không lộ lỗi thô', () => {
    expect(errorMessage({ code: 'email_not_confirmed' })).toContain('Vui lòng xác minh email');
    expect(errorMessage({ code: 'auth_session_missing' })).toContain('Chưa nhận được phiên đăng nhập');
    expect(errorMessage({ code: 'email_address_not_authorized' })).toContain('cấu hình dịch vụ gửi email');
    expect(errorMessage({ code: 'signup_disabled' })).toContain('chưa cho phép đăng ký');
    expect(errorMessage({ code: 'weak_password' })).toContain('Mật khẩu');
    expect(errorMessage({ code: 'user_already_exists', message: 'internal auth detail' })).not.toContain('internal');
  });
  it('đích thành công là đường dẫn nội bộ; nhận biết callback Auth', () => {
    expect(AUTH_SUCCESS_PATH).toBe('/chuyen-di');
    expect(isAuthCallback({ hash: '#access_token=demo&type=signup', search: '' })).toBe(true);
    expect(isAuthCallback({ hash: '', search: '?code=demo' })).toBe(true);
    expect(isAuthCallback({ hash: '', search: '' })).toBe(false);
    expect(isAuthCallback({ hash: '#access_token=demo&type=recovery', search: '' })).toBe(false);
  });
  it('callback chỉ lấy mã lỗi an toàn, không dùng nội dung lỗi hoặc URL đích bên ngoài', () => {
    expect(authCallbackError({ hash: '#error=access_denied&error_code=otp_expired&error_description=secret', search: '' })).toBe('otp_expired');
    expect(authCallbackError({ hash: '', search: '?error_code=flow_state_expired' })).toBe('flow_state_expired');
    expect(authCallbackError({ hash: '#error_description=secret', search: '' })).toBeNull();
    expect(authCallbackError({ hash: '#error=unknown', search: '' })).toBe('auth_callback_failed');
    expect(authCallbackError({ hash: '', search: '?error_code=untrusted&next=https://example.com' })).toBe('auth_callback_failed');
  });
});
