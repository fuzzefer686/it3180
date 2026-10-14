import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { localSupabaseClients } from '../../scripts/local-supabase';

// Chỉ tài khoản trong Supabase Auth; không tạo bảng ứng dụng.
const { admin, url, publicKey, options } = localSupabaseClients();
const client = createClient(url, publicKey, options);
const email = `auth-${crypto.randomUUID()}@integration.example`;
const password = 'IntegrationOnly!2026';
let uid: string | undefined;
beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  uid = data.user.id;
});
afterAll(async () => {
  await client.auth.signOut();
  if (uid) {
    const { error } = await admin.auth.admin.deleteUser(uid);
    if (error) throw error;
  }
});
describe('Supabase Auth local', () => {
  it('đăng nhập và xác minh đúng user trên Auth server', async () => {
    const login = await client.auth.signInWithPassword({ email, password });
    expect(login.error).toBeNull();
    expect(login.data.user?.id).toBe(uid);
    const verified = await client.auth.getUser();
    expect(verified.error).toBeNull();
    expect(verified.data.user?.id).toBe(uid);
  });
  it('từ chối mật khẩu sai', async () => {
    const other = createClient(url, publicKey, options);
    const result = await other.auth.signInWithPassword({ email, password: 'Wrong!123' });
    expect(result.error?.code).toBe('invalid_credentials');
    expect(result.data.session).toBeNull();
  });
  it('đăng xuất xóa phiên của client', async () => {
    expect((await client.auth.signOut()).error).toBeNull();
    expect((await client.auth.getSession()).data.session).toBeNull();
  });
});
