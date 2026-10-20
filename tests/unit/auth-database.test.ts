import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { profileInputFixture } from '../fixtures/auth';
import { userProfileSchema, type UserProfile } from '../../shared/contracts';

// PostgreSQL thật chạy nhúng; auth.uid() giả lập claim đã xác minh.
// Không thay thế integration qua Supabase Auth/PostgREST trong Docker.
const db = new PGlite();
const member = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const admin = '33333333-3333-4333-8333-333333333333';
beforeAll(async () => {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
  `);
  await db.exec(readFileSync('supabase/migrations/20261020090000_auth_profiles.sql', 'utf8'));
});
beforeEach(async () => {
  await db.exec('reset role; truncate auth.users cascade;');
  await db.query('insert into auth.users(id) values ($1),($2),($3)', [member, other, admin]);
  await db.query("insert into public.users(id, roles) values ($1,array['USER','ADMIN'])", [admin]);
});
afterAll(async () => { await db.close(); });
async function rpc<T = UserProfile>(uid: string | null, name: string, input: unknown = {}): Promise<T> {
  // Tên hàm lấy từ test tĩnh, dữ liệu luôn qua SQL parameters.
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid ?? '']);
  await db.exec('set role authenticated');
  try {
    const result = await db.query<{ result: T }>(`select public.${name}($1::jsonb) as result`, [JSON.stringify(input)]);
    return result.rows[0].result;
  } finally { await db.exec('reset role'); }
}
async function setupMember() { await rpc(member, 'get_my_profile'); await rpc(member, 'update_my_profile', profileInputFixture); }
async function approveDriver() {
  await setupMember();
  await rpc(admin, 'admin_review_user', { uid: member, kind: 'STUDENT', decision: 'VERIFIED', reason: '' });
  return rpc(admin, 'admin_review_user', { uid: member, kind: 'DRIVER', decision: 'VERIFIED', reason: '' });
}
describe('Auth database: migration, grants và nghiệp vụ hồ sơ', () => {
  it('bootstrap đúng uid, USER/ACTIVE, không đọc metadata và gọi lại không tạo trùng', async () => {
    const value = await rpc(member, 'get_my_profile');
    expect(userProfileSchema.safeParse(value).success).toBe(true);
    expect(value).toMatchObject({ uid: member, roles: ['USER'], status: 'ACTIVE', eligibility: { canBook: false, canDrive: false } });
    await rpc(member, 'get_my_profile');
    expect((await db.query<{ count: number }>('select count(*)::int as count from public.users where id=$1', [member])).rows[0].count).toBe(1);
  });
  it('từ chối không có uid, uid người khác và tự gửi role/status', async () => {
    await expect(rpc(null, 'get_my_profile')).rejects.toMatchObject({ code: 'PT401' });
    await expect(rpc(member, 'get_my_profile', { uid: other })).rejects.toMatchObject({ code: 'PT400' });
    await setupMember();
    for (const extra of [{ uid: other }, { roles: ['ADMIN'] }, { status: 'ACTIVE' }, { studentVerificationStatus: 'VERIFIED' }]) {
      await expect(rpc(member, 'update_my_profile', { ...profileInputFixture, ...extra })).rejects.toMatchObject({ code: 'PT400' });
    }
    expect((await rpc(member, 'get_my_profile')).roles).toEqual(['USER']);
  });
  it('chặn đọc/ghi bảng trực tiếp và không cho client gọi helper private', async () => {
    await setupMember();
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      try {
        await expect(db.query('select * from public.users')).rejects.toMatchObject({ code: '42501' });
        await expect(db.query("update public.users set roles=array['USER','ADMIN']")).rejects.toMatchObject({ code: '42501' });
        await expect(db.query('select private.require_active_user()')).rejects.toMatchObject({ code: '42501' });
        if (role === 'anon') await expect(db.query("select public.get_my_profile('{}')")).rejects.toMatchObject({ code: '42501' });
      } finally { await db.exec('reset role'); }
    }
  });
  it('user chỉ sửa hồ sơ của mình; API admin từ chối USER', async () => {
    await setupMember(); await rpc(other, 'get_my_profile');
    expect((await rpc(member, 'get_my_profile')).displayName).toBe(profileInputFixture.displayName);
    expect((await rpc(other, 'get_my_profile')).displayName).toBe('Thành viên Về Cùng');
    await expect(rpc(member, 'admin_list_users', { page: 1 })).rejects.toMatchObject({ code: 'PT403' });
    await expect(rpc(member, 'admin_review_user', { uid: member, kind: 'STUDENT', decision: 'VERIFIED', reason: '' })).rejects.toMatchObject({ code: 'PT403' });
    await expect(rpc(member, 'admin_set_user_status', { uid: other, status: 'LOCKED' })).rejects.toMatchObject({ code: 'PT403' });
  });
  it('kiểm tra dữ liệu server: số điện thoại, field lạ, xe thiếu cặp và trang sai', async () => {
    await setupMember();
    for (const changes of [{ phone: 'abc' }, { displayName: '' }, { school: null }, { vehiclePlate: null }]) {
      await expect(rpc(member, 'update_my_profile', { ...profileInputFixture, ...changes })).rejects.toMatchObject({ code: 'PT400' });
    }
    for (const page of [0, 1.2, 10001, '1']) await expect(rpc(admin, 'admin_list_users', { page })).rejects.toMatchObject({ code: 'PT400' });
  });
  it('admin cần lý do từ chối và không duyệt hồ sơ thiếu hoặc driver chưa xác minh sinh viên', async () => {
    await rpc(member, 'get_my_profile');
    await expect(rpc(admin, 'admin_review_user', { uid: member, kind: 'STUDENT', decision: 'VERIFIED', reason: '' })).rejects.toMatchObject({ code: 'PT409' });
    await setupMember();
    await expect(rpc(admin, 'admin_review_user', { uid: member, kind: 'DRIVER', decision: 'VERIFIED', reason: '' })).rejects.toMatchObject({ code: 'PT409' });
    await expect(rpc(admin, 'admin_review_user', { uid: member, kind: 'STUDENT', decision: 'REJECTED', reason: ' ' })).rejects.toMatchObject({ code: 'PT400' });
    const rejected = await rpc(admin, 'admin_review_user', { uid: member, kind: 'STUDENT', decision: 'REJECTED', reason: 'Minh chứng demo thiếu thông tin' });
    expect(rejected.studentReviewNote).toBe('Minh chứng demo thiếu thông tin');
  });
  it('duyệt driver cấp DRIVER và vẫn giữ USER; bootstrap không đặt lại quyền', async () => {
    const approved = await approveDriver();
    expect(approved.roles).toEqual(['USER', 'DRIVER']);
    expect(approved.eligibility).toEqual({ canBook: true, canDrive: true });
    expect((await rpc(member, 'get_my_profile')).roles).toEqual(['USER', 'DRIVER']);
  });
  it('đổi xe thu hồi DRIVER, đổi sinh viên yêu cầu duyệt lại; sửa liên hệ giữ duyệt', async () => {
    await approveDriver();
    const contact = await rpc(member, 'update_my_profile', { ...profileInputFixture, phone: '0911111111' });
    expect(contact.eligibility.canDrive).toBe(true);
    const vehicle = await rpc(member, 'update_my_profile', { ...profileInputFixture, vehiclePlate: 'DEMO-002' });
    expect(vehicle).toMatchObject({ roles: ['USER'], studentVerificationStatus: 'VERIFIED', driverVerificationStatus: 'PENDING' });
    const student = await rpc(member, 'update_my_profile', { ...profileInputFixture, studentCode: 'DEMO-002' });
    expect(student.eligibility).toEqual({ canBook: false, canDrive: false });
  });
  it('từ chối sinh viên đã duyệt thu hồi quyền driver', async () => {
    await approveDriver();
    const rejected = await rpc(admin, 'admin_review_user', { uid: member, kind: 'STUDENT', decision: 'REJECTED', reason: 'Duyệt lại minh chứng demo' });
    expect(rejected.roles).toEqual(['USER']); expect(rejected.eligibility.canDrive).toBe(false);
  });
  it('LOCKED không sửa được hồ sơ, không khôi phục quyền qua bootstrap; admin mở lại', async () => {
    await approveDriver();
    const locked = await rpc(admin, 'admin_set_user_status', { uid: member, status: 'LOCKED' });
    expect(locked.eligibility).toEqual({ canBook: false, canDrive: false });
    await expect(rpc(member, 'update_my_profile', profileInputFixture)).rejects.toMatchObject({ code: 'PT403' });
    expect((await rpc(member, 'get_my_profile')).status).toBe('LOCKED');
    expect((await rpc(admin, 'admin_set_user_status', { uid: member, status: 'ACTIVE' })).eligibility.canDrive).toBe(true);
    await expect(rpc(admin, 'admin_set_user_status', { uid: admin, status: 'LOCKED' })).rejects.toMatchObject({ code: 'PT409' });
  });
  it('admin bị khóa mất quyền ngay; danh sách admin phân trang và chỉ chứa hồ sơ ứng dụng', async () => {
    await setupMember();
    const list = await rpc<{ users: UserProfile[]; total: number }>(admin, 'admin_list_users', { page: 1 });
    expect(list.total).toBe(2); expect(list.users.map(value => value.uid)).toContain(member);
    expect(list.users[0]).not.toHaveProperty('password');
    await db.query("update public.users set status='LOCKED' where id=$1", [admin]);
    await expect(rpc(admin, 'admin_list_users', { page: 1 })).rejects.toMatchObject({ code: 'PT403' });
  });
  it('helper cho Trip/Booking kiểm tra ACTIVE và eligibility trên dữ liệu hiện tại', async () => {
    await setupMember();
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [member]);
    await expect(db.query('select private.require_eligible_user(false)')).rejects.toMatchObject({ code: 'PT403' });
    await approveDriver();
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [member]);
    await expect(db.query('select private.require_eligible_user(true)')).resolves.toBeTruthy();
    await rpc(admin, 'admin_set_user_status', { uid: member, status: 'LOCKED' });
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [member]);
    await expect(db.query('select private.require_eligible_user(true)')).rejects.toMatchObject({ code: 'PT403' });
  });
  it('phân trang không trùng hồ sơ và xóa Auth user dọn hồ sơ liên quan', async () => {
    for (let i = 10; i < 31; i++) {
      const id = `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
      await db.query('insert into auth.users(id) values ($1)', [id]);
      await db.query('insert into public.users(id) values ($1)', [id]);
    }
    const first = await rpc<{ users: UserProfile[]; total: number }>(admin, 'admin_list_users', { page: 1 });
    const next = await rpc<{ users: UserProfile[]; total: number }>(admin, 'admin_list_users', { page: 2 });
    expect(first.total).toBe(22); expect(first.users).toHaveLength(20); expect(next.users).toHaveLength(2);
    expect(first.users.some(a => next.users.some(b => a.uid === b.uid))).toBe(false);
    await db.query('delete from auth.users where id=$1', [next.users[0].uid]);
    expect((await db.query('select id from public.users where id=$1', [next.users[0].uid])).rows).toHaveLength(0);
  });
});
