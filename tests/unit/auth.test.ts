import { describe, expect, it } from 'vitest';
import { emptyInputSchema, responseSchemas } from '../../shared/api';
import { adminReviewInputSchema, profileInputSchema, userProfileSchema } from '../../shared/contracts';
import { authReturnPath, loginInputSchema, signupInputSchema } from '../../web/src/modules/auth/auth-validation';
import { profileFixture, profileInputFixture } from '../fixtures/auth';
import { errorMessage } from '../../web/src/lib/errors';
import { readSupabaseConfig } from '../../web/src/lib/supabase-config';

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
  it('dịch lỗi email chưa xác nhận, đăng ký bị tắt và mật khẩu yếu mà không lộ lỗi thô', () => {
    expect(errorMessage({ code: 'email_not_confirmed' })).toContain('xác nhận email');
    expect(errorMessage({ code: 'signup_disabled' })).toContain('chưa cho phép đăng ký');
    expect(errorMessage({ code: 'weak_password' })).toContain('Mật khẩu');
    expect(errorMessage({ code: 'user_already_exists', message: 'internal auth detail' })).not.toContain('internal');
  });
});
