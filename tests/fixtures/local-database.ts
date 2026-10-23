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
  // CLI trả mảng khi chạy thường/CI, hoặc { rows } khi bật chế độ agent.
  const result = JSON.parse(output) as T[] | { rows?: T[] } | null;
  const rows = Array.isArray(result) ? result : result?.rows;
  if (!Array.isArray(rows)) {
    throw new Error('Supabase CLI không trả danh sách dòng JSON hợp lệ.');
  }
  return rows;
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
