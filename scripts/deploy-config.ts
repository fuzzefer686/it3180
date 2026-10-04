import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { getFirebaseConfig } from '../web/src/lib/firebase-config';

export type DeployEnvironment = Record<string, string | undefined>;
export function requireDeployTarget(target: string | undefined): 'dev' | 'production-demo' {
  if (target !== 'dev' && target !== 'production-demo') throw new Error('Chọn môi trường dev hoặc production-demo.');
  return target;
}

export function readDeployFile(target: string) {
  requireDeployTarget(target);
  const path = `.env.firebase.${target}`;
  let source: string;
  try { source = readFileSync(path, 'utf8'); }
  catch { throw new Error(`Thiếu ${path}. Sao chép .env.firebase.example và điền config; xem docs/firebase-deploy.md.`); }
  const env = parseEnv(source);
  const allowed = new Set(['ENABLE_FIREBASE_DEPLOY', 'FIREBASE_DEPLOY_ENV', 'FIREBASE_PROJECT_ID',
    'VITE_USE_EMULATORS', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_APP_ID', 'VITE_FUNCTIONS_REGION', 'VITE_VIETMAP_MAP_KEY']);
  for (const key of Object.keys(env)) {
    if (!allowed.has(key)) throw new Error(`Biến ${key} không thuộc file Web/deploy config. Không đặt secrets backend tại đây.`);
  }
  if (env.FIREBASE_DEPLOY_ENV !== target) throw new Error(`FIREBASE_DEPLOY_ENV trong ${path} phải là ${target}.`);
  const otherPath = `.env.firebase.${target === 'dev' ? 'production-demo' : 'dev'}`;
  if (existsSync(otherPath)) {
    const other = parseEnv(readFileSync(otherPath, 'utf8'));
    if (env.FIREBASE_PROJECT_ID && other.FIREBASE_PROJECT_ID === env.FIREBASE_PROJECT_ID) {
      throw new Error('dev và production-demo phải dùng hai Firebase projects riêng.');
    }
  }
  return env;
}

export function validateDeployConfig(env: DeployEnvironment, requireEnabled = false) {
  requireDeployTarget(env.FIREBASE_DEPLOY_ENV);
  if (requireEnabled && env.ENABLE_FIREBASE_DEPLOY !== 'true') throw new Error('Deploy đang tắt. Lead chỉ đặt ENABLE_FIREBASE_DEPLOY=true khi project, billing và quyền deploy đã sẵn sàng.');
  if (env.VITE_USE_EMULATORS !== 'false') throw new Error('Deploy cloud yêu cầu VITE_USE_EMULATORS=false.');
  const config = getFirebaseConfig(env);
  if (env.FIREBASE_PROJECT_ID !== config.projectId) throw new Error('FIREBASE_PROJECT_ID phải khớp VITE_FIREBASE_PROJECT_ID.');
  return config;
}

export function cloudProcessEnv(config: DeployEnvironment, inherited: DeployEnvironment = process.env): DeployEnvironment {
  const env = { ...inherited };
  for (const key of Object.keys(env)) {
    if (key.startsWith('VITE_') || key.includes('EMULATOR') || ['GCLOUD_PROJECT', 'GOOGLE_CLOUD_PROJECT'].includes(key)) delete env[key];
  }
  return { ...env, ...config, VECUNG_CLOUD_BUILD: 'true' };
}
