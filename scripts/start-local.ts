import { spawnSync } from 'node:child_process';
import { cliEnv } from './local-supabase';
import { cliEntry } from './cli-entry';
console.log('Khởi động Supabase local; lần đầu cần tải Docker images.');
const result = spawnSync(process.execPath, [cliEntry('supabase'), 'start'], {
  env: cliEnv, stdio: ['ignore', 'ignore', 'inherit'],
});
if (result.error || result.status !== 0) {
  console.error('Supabase local chưa sẵn sàng. Kiểm tra Docker và kết nối tải images.');
  process.exitCode = result.status || 1;
} else {
  const migration = spawnSync(process.execPath, [cliEntry('supabase'), 'migration', 'up', '--local'], { env: cliEnv, stdio: 'inherit' });
  if (migration.error || migration.status !== 0) {
    console.error('Không áp dụng được migration local. Kiểm tra schema hiện có; không reset database để bỏ qua lỗi.');
    process.exitCode = migration.status || 1;
  } else console.log('Supabase local và migration sẵn sàng: API 54321, Studio 54323.');
}
