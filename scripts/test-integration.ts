import { execFileSync, spawnSync } from 'node:child_process';
import { cliEnv } from './local-supabase';
let alreadyRunning = false;
try {
  execFileSync('npx', ['--no-install', 'supabase', 'status', '-o', 'json'], { stdio: 'pipe', env: cliEnv });
  alreadyRunning = true;
} catch { /* Khởi động local ở dưới; không fallback cloud. */ }
try {
  console.log('Kiểm thử Supabase Auth local; không tạo bảng ứng dụng.');
  execFileSync('npx', ['--no-install', 'supabase', 'start'], { stdio: ['ignore', 'ignore', 'inherit'], env: cliEnv });
  const test = spawnSync('npx', ['--no-install', 'vitest', 'run', '--config', 'vitest.integration.config.mts'], { stdio: 'inherit', env: cliEnv });
  if (test.error) throw test.error;
  process.exitCode = test.status ?? 1;
} catch {
  console.error('Không chạy được integration. Cần Docker đang chạy và Supabase local; không bỏ qua test.');
  process.exitCode = 1;
} finally {
  // Giữ stack đang phục vụ dev; chỉ dừng stack do lần test này khởi động.
  if (!alreadyRunning) spawnSync('npx', ['--no-install', 'supabase', 'stop'], { stdio: 'pipe', env: cliEnv });
}
