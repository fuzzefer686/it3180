import { execFileSync, spawnSync } from 'node:child_process';
import { cliEnv } from './local-supabase';
import { cliEntry } from './cli-entry';
// Fail sớm và rõ ràng nếu thiếu Docker; tuyệt đối không chuyển qua cloud.
const docker = spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], { stdio: 'pipe', timeout: 15000 });
if (docker.error || docker.status !== 0) {
  console.error('Không chạy được integration: cần cài và mở Docker Desktop. Chưa kiểm thử Supabase local.');
  process.exit(1);
}
const supabase = [cliEntry('supabase')];
let alreadyRunning = false;
try {
  execFileSync(process.execPath, [...supabase, 'status', '-o', 'json'], { stdio: 'pipe', env: cliEnv });
  alreadyRunning = true;
} catch { /* Khởi động local ở dưới; không fallback cloud. */ }
try {
  console.log('Kiểm thử Auth/hồ sơ/quyền với Supabase local và migration của repo.');
  execFileSync(process.execPath, [...supabase, 'start'], { stdio: ['ignore', 'ignore', 'inherit'], env: cliEnv });
  execFileSync(process.execPath, [...supabase, 'migration', 'up', '--local'], { stdio: 'inherit', env: cliEnv });
  const test = spawnSync(process.execPath, [cliEntry('vitest'), 'run', '--config', 'vitest.integration.config.mts'], { stdio: 'inherit', env: cliEnv });
  if (test.error) throw test.error;
  process.exitCode = test.status ?? 1;
} catch {
  console.error('Không chạy được integration. Cần Docker đang chạy và Supabase local; không bỏ qua test.');
  process.exitCode = 1;
} finally {
  // Giữ stack đang phục vụ dev; chỉ dừng stack do lần test này khởi động.
  if (!alreadyRunning) spawnSync(process.execPath, [...supabase, 'stop'], { stdio: 'pipe', env: cliEnv });
}
