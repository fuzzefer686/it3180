import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { localSupabaseConfig } from './local-supabase';
const { url, publicKey } = localSupabaseConfig();
const path = 'web/.env.local';
const previous = existsSync(path) ? readFileSync(path, 'utf8') : '';
const previousUrl = previous.match(/^VITE_SUPABASE_URL=(.+)$/m)?.[1]?.replace(/['"]/g, '').trim();
if (previousUrl && !['http://127.0.0.1:54321', 'http://localhost:54321'].includes(previousUrl)) {
  throw new Error('web/.env.local đang trỏ cloud. Chuyển cấu hình đó sang file riêng trước khi chạy local:env.');
}
const rest = previous.split('\n').filter(line => line && !/^VITE_(SUPABASE_|FIREBASE_|USE_EMULATORS|FUNCTIONS_REGION)/.test(line));
writeFileSync(path, [`VITE_SUPABASE_URL=${url}`, `VITE_SUPABASE_PUBLISHABLE_KEY=${publicKey}`, ...rest, ''].join('\n'));
console.log('Đã ghi cấu hình public local vào web/.env.local; không ghi secret/service-role key.');
