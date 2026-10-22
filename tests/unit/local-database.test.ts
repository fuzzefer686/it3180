import { beforeEach, expect, it, vi } from 'vitest';
import { localExecute, localQuery, removeLocalProfiles } from '../fixtures/local-database';

const mocks = vi.hoisted(() => ({ exec: vi.fn(), config: vi.fn() }));
vi.mock('node:child_process', () => ({ execFileSync: mocks.exec }));
vi.mock('../../scripts/local-supabase', () => ({ cliEnv: {}, localSupabaseConfig: mocks.config }));
vi.mock('../../scripts/cli-entry', () => ({ cliEntry: () => 'supabase.js' }));
beforeEach(() => vi.resetAllMocks());

it('DELETE và UPDATE trả command tag vẫn hoàn tất; chỉ gọi database local', () => {
  mocks.exec.mockReturnValueOnce('DELETE 1\n').mockReturnValueOnce('UPDATE 1\n');
  removeLocalProfiles(['11111111-1111-4111-8111-111111111111']);
  localExecute("update public.users set roles=array['USER','ADMIN']");
  expect(mocks.config).toHaveBeenCalledTimes(2);
  for (const call of mocks.exec.mock.calls) expect(call[1]).toContain('--local');
});

it('SELECT trong CI trả mảng trực tiếp: đọc được count, hồ sơ và kết quả rỗng', () => {
  mocks.exec.mockReturnValueOnce('[{"count":1}]\n');
  expect(localQuery('select count(*)::int as count from public.users')).toEqual([{ count: 1 }]);
  mocks.exec.mockReturnValueOnce('[{"id":"demo","roles":["USER"],"status":"ACTIVE"}]\n');
  expect(localQuery('select id,roles,status from public.users')).toEqual([
    { id: 'demo', roles: ['USER'], status: 'ACTIVE' },
  ]);
  mocks.exec.mockReturnValueOnce('[]\n');
  expect(localQuery('select id from public.users where false')).toEqual([]);
});

it('SELECT ở chế độ agent đọc được rows JSON', () => {
  mocks.exec.mockReturnValueOnce('{"rows":[{"count":1}]}');
  expect(localQuery('select count(*) from public.users')).toEqual([{ count: 1 }]);
});

it('không che lỗi đầu ra hoặc lỗi SQL', () => {
  for (const output of ['{}', 'null', '{"rows":null}', '{"rows":{}}']) {
    mocks.exec.mockReturnValueOnce(output);
    expect(() => localQuery('select 1')).toThrow('Supabase CLI');
  }
  mocks.exec.mockReturnValueOnce('invalid output');
  expect(() => localQuery('select 1')).toThrow();
  mocks.exec.mockImplementationOnce(() => { throw new Error('SQL failed'); });
  expect(() => localExecute('delete from public.users')).toThrow('SQL failed');
});

it('không chạy SQL khi kiểm tra môi trường local thất bại', () => {
  mocks.config.mockImplementationOnce(() => { throw new Error('Local unavailable'); });
  expect(() => localExecute('delete from public.users')).toThrow('Local unavailable');
  expect(mocks.exec).not.toHaveBeenCalled();
});
