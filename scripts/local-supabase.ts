import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

export const cliEnv = { ...process.env, SUPABASE_TELEMETRY_DISABLED: '1',
  SUPABASE_INTERNAL_IMAGE_REGISTRY: process.env.SUPABASE_INTERNAL_IMAGE_REGISTRY ?? 'docker.io' };

export function localSupabaseConfig() {
  // Không nhận URL/key từ env: seed và test không thể trỏ nhầm cloud.
  const status = JSON.parse(execFileSync('npx', ['--no-install', 'supabase', 'status', '-o', 'json'],
    { encoding: 'utf8', env: cliEnv, stdio: ['ignore', 'pipe', 'pipe'] })) as Record<string, string>;
  if (status.API_URL !== 'http://127.0.0.1:54321') throw new Error('Chỉ cho phép Supabase local ở port 54321.');
  const publicKey = status.PUBLISHABLE_KEY || status.ANON_KEY;
  const secretKey = status.SERVICE_ROLE_KEY || status.SECRET_KEY;
  if (!publicKey || !secretKey) throw new Error('Supabase local chưa có đủ key.');
  return { url: status.API_URL, publicKey, secretKey };
}
export function localSupabaseClients() {
  const config = localSupabaseConfig();
  const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
  return { ...config, options, admin: createClient(config.url, config.secretKey, options) };
}
