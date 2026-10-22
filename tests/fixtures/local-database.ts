import { execFileSync } from 'node:child_process';
import { cliEntry } from '../../scripts/cli-entry';
import { cliEnv, localSupabaseConfig } from '../../scripts/local-supabase';

// Fixture dùng kết nối database local, không nới quyền service_role trên server.
function runLocalSql(sql: string): string {
  localSupabaseConfig();
  return execFileSync(process.execPath,
    [cliEntry('supabase'), 'db', 'query', '--local', sql, '-o', 'json'],
    { encoding: 'utf8', env: cliEnv, stdio: ['ignore', 'pipe', 'pipe'] });
}

export function localQuery<T>(sql: string): T[] {
  const output = runLocalSql(sql);
  return (JSON.parse(output) as { rows: T[] }).rows;
}

// UPDATE/DELETE không có RETURNING trả command tag (ví dụ DELETE 1), không phải JSON.
export function localExecute(sql: string): void {
  runLocalSql(sql);
}

export function localUserId(id: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Invalid test user UUID');
  return "'" + id + "'::uuid";
}

export function removeLocalProfiles(ids: string[]): void {
  if (ids.length === 0) return;
  localExecute('delete from public.users where id in (' + ids.map(localUserId).join(',') + ')');
}
