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

it('SELECT đọc rows JSON, không che lỗi đầu ra hoặc lỗi SQL', () => {
  mocks.exec.mockReturnValueOnce('{"rows":[{"count":1}]}');
  expect(localQuery('select count(*) from public.users')).toEqual([{ count: 1 }]);
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
