import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readSupabaseConfig } from './src/lib/supabase-config.ts';
export default defineConfig(({ command, mode }) => {
  // Dừng build sớm để Pages không phát hành frontend gọi Auth về máy người dùng.
  if (command === 'build') {
    const env = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), 'VITE_');
    readSupabaseConfig(env, { allowLocal: false });
  }
  return {
    plugins: [react(), tailwindcss()],
    server: { port: 5173, strictPort: true },
  };
});
