import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { localSupabaseClients } from '../../scripts/local-supabase';
import { profileInputFixture } from '../fixtures/auth';
import { userProfileSchema } from '../../shared/contracts';
import { localExecute, localQuery, localUserId, removeLocalProfiles } from '../fixtures/local-database';

const { admin, url, publicKey, options } = localSupabaseClients();
const member = createClient(url, publicKey, options);
const other = createClient(url, publicKey, options);
const reviewer = createClient(url, publicKey, options);
const anonymous = createClient(url, publicKey, options);
const ids: string[] = [];
beforeAll(async () => {
  for (const client of [member, other, reviewer]) {
    const email = `profile-${crypto.randomUUID()}@integration.example`;
    const password = 'IntegrationOnly!2026';
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true,
      user_metadata: { roles: ['ADMIN'], status: 'ACTIVE' } });
    if (created.error) throw created.error;
    ids.push(created.data.user.id);
    const login = await client.auth.signInWithPassword({ email, password });
    if (login.error) throw login.error;
  }
});
beforeEach(async () => {
  if (ids.length !== 3) throw new Error('Thiếu tài khoản test local');
  removeLocalProfiles(ids);
  for (const client of [member, other, reviewer]) await profile(client);
  // Chỉ SQL fixture local cấp admin; không mở quyền ghi bảng qua API.
  localExecute("update public.users set roles=array['USER','ADMIN'] where id=" + localUserId(ids[2]));
});
afterAll(async () => {
  const errors: unknown[] = [];
  for (const client of [member, other, reviewer]) await client.auth.signOut();
  removeLocalProfiles(ids);
  for (const id of ids) {
    const result = await admin.auth.admin.deleteUser(id);
    if (result.error) errors.push(result.error);
  }
  if (errors.length) throw new Error('Không dọn được hết tài khoản test local');
});
async function profile(client: SupabaseClient) {
  const result = await client.rpc('get_my_profile', { input: {} });
  if (result.error) throw result.error;
  return userProfileSchema.parse(result.data);
}
async function save() {
  const result = await member.rpc('update_my_profile', { input: profileInputFixture });
  if (result.error) throw result.error;
}
describe('Auth/hồ sơ/admin qua Supabase local thật', () => {
  it('Auth metadata ADMIN không được tin, bootstrap an toàn và gọi đồng thời không tạo trùng', async () => {
    const results = await Promise.all([profile(member), profile(member)]);
    expect(results[0]).toMatchObject({ uid: ids[0], roles: ['USER'], status: 'ACTIVE' });
    expect(results[1].uid).toBe(ids[0]);
    const rows = localQuery<{ count: number }>('select count(*)::int as count from public.users where id=' + localUserId(ids[0]));
    expect(rows[0].count).toBe(1);
  });
  it('chặn anonymous, đọc bảng riêng tư và sửa role trực tiếp', async () => {
    expect((await anonymous.rpc('get_my_profile', { input: {} })).error).not.toBeNull();
    const ownProfile = await member.from('users').select('id');
    expect(ownProfile.error).toBeNull();
    expect(ownProfile.data).toEqual([{ id: ids[0] }]);
    expect((await member.from('users').update({ roles: ['USER', 'ADMIN'] }).eq('id', ids[0])).error?.code).toBe('42501');
    expect((await profile(member)).roles).toEqual(['USER']);
  });
  it('không thể chọn uid khác hoặc chèn field quyền vào API hồ sơ', async () => {
    await save();
    for (const extra of [{ uid: ids[1] }, { roles: ['ADMIN'] }, { studentVerificationStatus: 'VERIFIED' }]) {
      expect((await member.rpc('update_my_profile', { input: { ...profileInputFixture, ...extra } })).error?.code).toBe('PT400');
    }
    expect((await profile(other)).phone).toBeNull();
    expect((await profile(member)).phone).toBe(profileInputFixture.phone);
  });
  it('USER không gọi được bất kỳ thao tác admin nào', async () => {
    expect((await member.rpc('admin_list_users', { input: { page: 1 } })).error?.code).toBe('PT403');
    expect((await member.rpc('admin_review_user', { input: { uid: ids[0], kind: 'STUDENT', decision: 'VERIFIED', reason: '' } })).error?.code).toBe('PT403');
    expect((await member.rpc('admin_set_user_status', { input: { uid: ids[1], status: 'LOCKED' } })).error?.code).toBe('PT403');
  });
  it('duyệt sinh viên trước driver; cấp DRIVER giữ USER và sửa xe phải duyệt lại', async () => {
    await save();
    const review = (kind: string) => reviewer.rpc('admin_review_user', { input: { uid: ids[0], kind, decision: 'VERIFIED', reason: '' } });
    expect((await review('DRIVER')).error?.code).toBe('PT409');
    expect((await review('STUDENT')).error).toBeNull(); expect((await review('DRIVER')).error).toBeNull();
    expect((await profile(member)).eligibility).toEqual({ canBook: true, canDrive: true });
    const edit = await member.rpc('update_my_profile', { input: { ...profileInputFixture, vehiclePlate: 'DEMO-002' } });
    expect(edit.error).toBeNull(); expect(edit.data.roles).toEqual(['USER']);
    expect(edit.data.driverVerificationStatus).toBe('PENDING');
  });
  it('từ chối cần lý do, lưu ghi chú và khóa chặn thao tác bằng phiên đã cấp trước đó', async () => {
    await save();
    const input = { uid: ids[0], kind: 'STUDENT', decision: 'REJECTED', reason: '' };
    expect((await reviewer.rpc('admin_review_user', { input })).error?.code).toBe('PT400');
    expect((await reviewer.rpc('admin_review_user', { input: { ...input, reason: 'Minh chứng demo cần bổ sung' } })).error).toBeNull();
    expect((await profile(member)).studentReviewNote).toBe('Minh chứng demo cần bổ sung');
    expect((await reviewer.rpc('admin_set_user_status', { input: { uid: ids[0], status: 'LOCKED' } })).error).toBeNull();
    expect((await member.rpc('update_my_profile', { input: profileInputFixture })).error?.code).toBe('PT403');
    expect((await profile(member)).status).toBe('LOCKED');
    expect((await reviewer.rpc('admin_set_user_status', { input: { uid: ids[0], status: 'ACTIVE' } })).error).toBeNull();
  });
});
