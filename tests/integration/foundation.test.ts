import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { localSupabaseClients } from '../../scripts/local-supabase';
import { localQuery, localUserId, removeLocalProfiles } from '../fixtures/local-database';

// Tài khoản Auth tạm; test signup cũng kiểm tra bootstrap hồ sơ qua RPC đã migrate local.
const { admin, url, publicKey, options } = localSupabaseClients();
const client = createClient(url, publicKey, options);
const email = `auth-${crypto.randomUUID()}@integration.example`;
const password = 'IntegrationOnly!2026';
let uid: string | undefined;
let signupUid: string | undefined;
let unconfirmedUid: string | undefined;
const signupClient = createClient(url, publicKey, options);
beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  uid = data.user.id;
});
afterAll(async () => {
  await client.auth.signOut();
  await signupClient.auth.signOut();
  removeLocalProfiles([uid, signupUid, unconfirmedUid].filter((id): id is string => Boolean(id)));
  if (uid) {
    const { error } = await admin.auth.admin.deleteUser(uid);
    if (error) throw error;
  }
  if (signupUid) {
    const { error } = await admin.auth.admin.deleteUser(signupUid);
    if (error) throw error;
  }
  if (unconfirmedUid) {
    const { error } = await admin.auth.admin.deleteUser(unconfirmedUid);
    if (error) throw error;
  }
});
describe('Supabase Auth local', () => {
  it('đăng ký qua Auth SDK tạo ngay hồ sơ trước khi frontend gọi bootstrap', async () => {
    const result = await signupClient.auth.signUp({ email: `signup-${crypto.randomUUID()}@integration.example`, password,
      options: { data: { roles: ['ADMIN'] } } });
    signupUid = result.data.user?.id;
    expect(result.error).toBeNull(); expect(signupUid).toBeTruthy();
    // Local tắt xác nhận email trong config.toml; cloud có thể trả session null.
    expect(result.data.session).not.toBeNull();
    const inserted = localQuery('select id,roles,status from public.users where id=' + localUserId(signupUid!));
    expect(inserted[0]).toMatchObject({ id: signupUid, roles: ['USER', 'DRIVER'], status: 'ACTIVE' });
    const profile = await signupClient.rpc('get_my_profile', { input: {} });
    expect(profile.error).toBeNull(); expect(profile.data.roles).toEqual(['USER', 'DRIVER']);
  });
  it('Auth user chưa xác nhận email cũng có public.users mà không cần session frontend', async () => {
    const created = await admin.auth.admin.createUser({ email: `unconfirmed-${crypto.randomUUID()}@integration.example`, password,
      email_confirm: false, user_metadata: { roles: ['ADMIN'] } });
    unconfirmedUid = created.data.user?.id;
    expect(created.error).toBeNull(); expect(unconfirmedUid).toBeTruthy();
    expect(created.data.user?.email_confirmed_at ?? null).toBeNull();
    const inserted = localQuery('select id,roles,status,student_verification_status from public.users where id=' + localUserId(unconfirmedUid!));
    expect(inserted[0]).toMatchObject({ id: unconfirmedUid, roles: ['USER', 'DRIVER'], status: 'ACTIVE', student_verification_status: 'VERIFIED' });
  });
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
