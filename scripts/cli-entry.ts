import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const localRequire = createRequire(join(process.cwd(), 'package.json'));
// Chạy CLI bằng Node trực tiếp: execFile('npx') không chạy được npx.cmd trên Windows.
export function cliEntry(name: 'supabase' | 'vitest') {
  return join(dirname(localRequire.resolve(`${name}/package.json`)), name === 'supabase' ? 'dist/supabase.js' : 'vitest.mjs');
}
