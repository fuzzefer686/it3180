import { describe, expect, it } from 'vitest';
import { emptyInputSchema, responseSchemas } from '../../shared/api';
import { userProfileSchema } from '../../shared/contracts';
import { errorMessage } from '../../web/src/lib/errors';
import { readSupabaseConfig } from '../../web/src/lib/supabase-config';

describe('Contract và cấu hình Supabase', () => {
  it('không nhận quyền lạ hoặc field giả quyền trong API nền', () => {
    expect(userProfileSchema.safeParse({ uid: 'x', displayName: 'Test', roles: ['SUPERUSER'], status: 'ACTIVE', studentVerificationStatus: 'VERIFIED' }).success).toBe(false);
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
});
