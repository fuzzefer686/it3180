import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { localSupabaseClients } from '../../scripts/local-supabase';
import { removeLocalProfiles } from '../fixtures/local-database';

const { admin, url, publicKey, options } = localSupabaseClients();
const client = createClient(url, publicKey, options);
const anonymous = createClient(url, publicKey, options);
let uid: string | undefined;
beforeAll(async () => {
  const credentials = { email: `trip-${crypto.randomUUID()}@integration.example`, password: 'LocalTrip!2026' };
  const created = await admin.auth.admin.createUser({ ...credentials, email_confirm: true });
  if (created.error) throw created.error;
  uid = created.data.user.id;
  const login = await client.auth.signInWithPassword(credentials);
  if (login.error) throw login.error;
});
afterAll(async () => {
  await client.auth.signOut();
  if (uid) {
    removeLocalProfiles([uid]);
    const result = await admin.auth.admin.deleteUser(uid);
    if (result.error) throw result.error;
  }
});
describe('Quyền API Trip qua Supabase local', () => {
  it('người chưa đăng nhập không gọi RPC chuyến', async () => {
    const result = await anonymous.rpc('list_trips', { input: {} });
    expect(result.error?.code).toBe('42501');
  });
  it('người đăng nhập ACTIVE đọc qua RLS nhưng không ghi trực tiếp bảng trips', async () => {
    expect((await client.from('trips').select('id')).error).toBeNull();
    expect((await client.from('trips').insert({ driver_id: uid, status: 'COMPLETED' })).error?.code).toBe('42501');
  });
  it('client không được gọi hàm lưu route hoặc giả uid để kiểm tra quyền', async () => {
    expect((await client.rpc('save_trip_route', { actor_id: uid, input: {}, calculated: {} })).error?.code).toBe('42501');
    expect((await client.rpc('check_trip_access', { actor_id: uid, require_driver: true })).error?.code).toBe('42501');
  });
});
