import { readFileSync } from 'node:fs';
import { validateDeployConfig } from './deploy-config';

try {
  const config = validateDeployConfig(process.env, true);
  const build = JSON.parse(readFileSync('web/dist/firebase-build.json', 'utf8'));
  if (build.useEmulators !== false || build.projectId !== config.projectId || build.region !== config.region || build.appId !== config.appId) {
    throw new Error('Hosting build dùng Emulator hoặc khác Firebase project/app. Chạy build:cloud đúng môi trường trước.');
  }
  console.log('Hosting build khớp Firebase project/app cloud.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Thiếu hoặc sai Hosting build.');
  process.exitCode = 1;
}
