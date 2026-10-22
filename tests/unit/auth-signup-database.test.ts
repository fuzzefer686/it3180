import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { UserProfile } from '../../shared/contracts';

// PostgreSQL nhúng kiểm tra trigger/backfill; Auth service/JWT thật cần integration Docker.
const db = new PGlite();
const legacyMissing = '11111111-1111-4111-8111-111111111111';
const legacyLocked = '22222222-2222-4222-8222-222222222222';
const legacyAdmin = '33333333-3333-4333-8333-333333333333';
const legacyDriver = '44444444-4444-4444-8444-444444444444';
beforeAll(async () => {
  await db.exec(`
    create role anon; create role authenticated; create role service_role; create role supabase_auth_admin;
    create schema auth;
    create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}', email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as
      'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
    grant usage on schema auth to supabase_auth_admin;
    grant insert on auth.users to supabase_auth_admin;
  `);
  await db.exec(readFileSync('supabase/migrations/20261020090000_auth_profiles.sql', 'utf8'));
  for (const id of [legacyMissing, legacyLocked, legacyAdmin, legacyDriver]) await db.query('insert into auth.users(id) values ($1)', [id]);
  await db.query("insert into public.users(id,display_name,status) values ($1,'Hồ sơ bị khóa','LOCKED')", [legacyLocked]);
  await db.query("insert into public.users(id,roles) values ($1,array['USER','ADMIN'])", [legacyAdmin]);
  await db.query("insert into public.users(id,roles,student_verification_status,driver_verification_status,vehicle_model,vehicle_plate) values ($1,array['USER','DRIVER'],'VERIFIED','VERIFIED','Xe Demo','DEMO-001')", [legacyDriver]);
  await db.exec(readFileSync('supabase/migrations/20261020130000_auth_signup_profile.sql', 'utf8'));
});
afterAll(async () => { await db.close(); });
async function read(id: string) {
  const result = await db.query<{ profile: UserProfile }>('select private.auth_profile_json(u) as profile from public.users u where id=$1', [id]);
  return result.rows[0]?.profile;
}
describe('Tạo public.users khi Auth đăng ký tài khoản', () => {
  it('backfill hồ sơ còn thiếu trước migration mà không cần phiên hoặc xác minh email', async () => {
    expect(await read(legacyMissing)).toMatchObject({ uid: legacyMissing, roles: ['USER'], status: 'ACTIVE',
      studentVerificationStatus: 'PENDING', driverVerificationStatus: 'PENDING', eligibility: { canBook: false, canDrive: false } });
    expect((await db.query<{ confirmed: string | null }>('select email_confirmed_at as confirmed from auth.users where id=$1', [legacyMissing])).rows[0].confirmed).toBeNull();
  });
  it('backfill giữ nguyên hồ sơ đã có, LOCKED, ADMIN và DRIVER', async () => {
    expect(await read(legacyLocked)).toMatchObject({ displayName: 'Hồ sơ bị khóa', status: 'LOCKED', roles: ['USER'] });
    expect((await read(legacyAdmin)).roles).toEqual(['USER', 'ADMIN']);
    expect(await read(legacyDriver)).toMatchObject({ roles: ['USER', 'DRIVER'], driverVerificationStatus: 'VERIFIED', vehiclePlate: 'DEMO-001' });
  });
  it('Auth insert tạo hồ sơ ngay, không tin quyền/trạng thái từ metadata', async () => {
    const id = crypto.randomUUID();
    await db.query('insert into auth.users(id,raw_user_meta_data) values ($1,$2::jsonb)', [id,
      JSON.stringify({ roles: ['ADMIN', 'DRIVER'], status: 'LOCKED', student_verification_status: 'VERIFIED', display_name: 'Admin tự khai' })]);
    expect(await read(id)).toMatchObject({ uid: id, displayName: 'Thành viên Về Cùng', roles: ['USER'], status: 'ACTIVE',
      studentVerificationStatus: 'PENDING', driverVerificationStatus: 'PENDING' });
  });
  it('Auth service không có quyền đọc bảng users vẫn tạo được hồ sơ qua trigger', async () => {
    const id = crypto.randomUUID();
    await db.exec('set role supabase_auth_admin');
    try {
      await db.query('insert into auth.users(id) values ($1)', [id]);
      await expect(db.query('select * from public.users')).rejects.toMatchObject({ code: '42501' });
    } finally { await db.exec('reset role'); }
    expect((await read(id)).uid).toBe(id);
  });
  it('bootstrap sau login không tạo trùng hoặc đặt lại quyền/trạng thái', async () => {
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [legacyLocked]);
    await db.exec('set role authenticated');
    try {
      for (let i = 0; i < 2; i++) {
        const result = await db.query<{ profile: UserProfile }>("select public.get_my_profile('{}') as profile");
        expect(result.rows[0].profile.status).toBe('LOCKED');
      }
    } finally { await db.exec('reset role'); }
    expect((await db.query<{ count: number }>('select count(*)::int as count from public.users where id=$1', [legacyLocked])).rows[0].count).toBe(1);
  });
  it('lỗi ghi hồ sơ làm Auth insert rollback thay vì tạo thành công một nửa', async () => {
    const id = '55555555-5555-4555-8555-555555555555';
    await db.exec(`alter table public.users add constraint test_reject_profile check (id <> '${id}'::uuid)`);
    try {
      await expect(db.query('insert into auth.users(id) values ($1)', [id])).rejects.toMatchObject({ code: '23514' });
      expect((await db.query('select id from auth.users where id=$1', [id])).rows).toHaveLength(0);
      expect(await read(id)).toBeUndefined();
    } finally { await db.exec('alter table public.users drop constraint test_reject_profile'); }
  });
  it('client không được gọi helper hoặc tự insert hồ sơ tùy ý', async () => {
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      try {
        await expect(db.query('select private.create_auth_user_profile()')).rejects.toMatchObject({ code: '42501' });
        await expect(db.query('insert into public.users(id) values ($1)', [crypto.randomUUID()])).rejects.toMatchObject({ code: '42501' });
      } finally { await db.exec('reset role'); }
    }
  });
});
