import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { localSupabaseClients } from '../../scripts/local-supabase';
import { profileInputFixture } from '../fixtures/auth';
import { userProfileSchema } from '../../shared/contracts';

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
  const removed = await admin.from('users').delete().in('id', ids);
  if (removed.error) throw removed.error;
  for (const client of [member, other, reviewer]) await profile(client);
  // Chỉ fixture local dùng service_role cấp admin, không có API tự cấp ADMIN.
  const updated = await admin.from('users').update({ roles: ['USER', 'ADMIN'] }).eq('id', ids[2]);
  if (updated.error) throw updated.error;
});
afterAll(async () => {
  const errors: unknown[] = [];
  for (const client of [member, other, reviewer]) await client.auth.signOut();
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
  it('đăng ký nhận phiên ngay, có dòng users trước RPC, lưu hồ sơ và đăng nhập lại không cần email', async () => {
    const signupClient = createClient(url, publicKey, options);
    const credentials = { email: `signup-${crypto.randomUUID()}@integration.example`, password: 'IntegrationOnly!2026' };
    const created = await signupClient.auth.signUp(credentials);
    try {
      expect(created.error).toBeNull();
      expect(created.data.user).not.toBeNull();
      expect(created.data.session).not.toBeNull();
      const uid = created.data.user!.id;
      // Đọc bằng admin TRƯỚC get_my_profile để không che việc thiếu trigger bằng bootstrap.
      const stored = await admin.from('users').select('*').eq('id', uid).single();
      expect(stored.error).toBeNull();
      expect(stored.data).toMatchObject({ id: uid, display_name: 'Thành viên Về Cùng', roles: ['USER'], status: 'ACTIVE',
        student_verification_status: 'PENDING', driver_verification_status: 'PENDING' });
      expect(stored.data).not.toHaveProperty('password');
      expect((await profile(signupClient)).uid).toBe(uid);

      const saved = await signupClient.rpc('update_my_profile', { input: profileInputFixture });
      expect(saved.error).toBeNull();
      const savedRow = await admin.from('users').select('display_name,phone,school,student_code').eq('id', uid).single();
      expect(savedRow.error).toBeNull();
      expect(savedRow.data).toEqual({ display_name: profileInputFixture.displayName, phone: profileInputFixture.phone,
        school: profileInputFixture.school, student_code: profileInputFixture.studentCode });

      expect((await signupClient.auth.signOut()).error).toBeNull();
      const login = await signupClient.auth.signInWithPassword(credentials);
      expect(login.error).toBeNull();
      expect(login.data.user?.id).toBe(uid);
      expect((await profile(signupClient)).displayName).toBe(profileInputFixture.displayName);
      const duplicate = await signupClient.auth.signUp(credentials);
      expect(duplicate.error).not.toBeNull();
      const count = await admin.from('users').select('id', { count: 'exact', head: true }).eq('id', uid);
      expect(count.error).toBeNull();
      expect(count.count).toBe(1);
    } finally {
      await signupClient.auth.signOut();
      if (created.data.user) {
        const removed = await admin.auth.admin.deleteUser(created.data.user.id);
        if (removed.error) throw removed.error;
      }
    }
  });
  it('Auth metadata ADMIN không được tin, bootstrap an toàn và gọi đồng thời không tạo trùng', async () => {
    const results = await Promise.all([profile(member), profile(member)]);
    expect(results[0]).toMatchObject({ uid: ids[0], roles: ['USER'], status: 'ACTIVE' });
    expect(results[1].uid).toBe(ids[0]);
    const count = await admin.from('users').select('id', { count: 'exact', head: true }).eq('id', ids[0]);
    expect(count.count).toBe(1);
  });
  it('chặn anonymous, đọc bảng riêng tư và sửa role trực tiếp', async () => {
    expect((await anonymous.rpc('get_my_profile', { input: {} })).error).not.toBeNull();
    expect((await member.from('users').select('*')).error?.code).toBe('42501');
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
