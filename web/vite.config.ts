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
    build: {
      // SDK VietMap (~770 KB) chỉ tải khi mở bản đồ nên được phép vượt mức cảnh báo mặc định.
      chunkSizeWarningLimit: 800,
      rolldownOptions: {
        output: {
          // Tách thư viện ít thay đổi để trình duyệt giữ cache khi code app đổi.
          codeSplitting: {
            groups: [
              { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/ },
              { name: 'supabase', test: /node_modules[\\/]@supabase[\\/]/ },
              { name: 'zod', test: /node_modules[\\/]zod[\\/]/ },
            ],
          },
        },
      },
    },
  };
});
