import { spawnSync } from 'node:child_process';
import { cliEnv } from './local-supabase';
console.log('Khởi động Supabase local; lần đầu cần tải Docker images.');
const result = spawnSync('npx', ['--no-install', 'supabase', 'start'], {
  env: cliEnv, stdio: ['ignore', 'ignore', 'inherit'],
});
if (result.error || result.status !== 0) {
  console.error('Supabase local chưa sẵn sàng. Kiểm tra Docker và kết nối tải images.');
  process.exitCode = result.status || 1;
} else console.log('Supabase local sẵn sàng: API 54321, Studio 54323.');
