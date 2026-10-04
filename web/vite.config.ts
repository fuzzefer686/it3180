import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { getFirebaseConfig } from './src/lib/firebase-config.ts';
export default defineConfig(({ command, mode, isPreview }) => {
  const cloudBuild = process.env.VECUNG_CLOUD_BUILD === 'true';
  // Build cloud nhận config từ script/CI, không bị .env.local của teammate ghi đè.
  const env = cloudBuild ? process.env : { ...loadEnv(mode, process.cwd()), ...process.env };
  const config = getFirebaseConfig(env, command === 'serve' && !isPreview);
  if (cloudBuild && config.useEmulators) throw new Error('Build cloud không được kết nối Emulator.');
  return {
    envDir: cloudBuild ? false : undefined,
    plugins: [react(), tailwindcss(), {
      name: 'firebase-build-config',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'firebase-build.json', source: JSON.stringify({
          projectId: config.projectId, region: config.region, appId: config.appId, useEmulators: config.useEmulators,
        }) });
      },
    }],
    server: { port: 5173, strictPort: true },
  };
});
