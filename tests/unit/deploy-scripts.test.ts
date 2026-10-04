import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

const root = process.cwd();
const fixtureDir = mkdtempSync(join(tmpdir(), 'vecung-deploy-test-'));
const cloudConfig = {
  FIREBASE_DEPLOY_ENV: 'dev', ENABLE_FIREBASE_DEPLOY: 'true',
  FIREBASE_PROJECT_ID: 'vecung-fixture-dev', VITE_FIREBASE_PROJECT_ID: 'vecung-fixture-dev',
  VITE_USE_EMULATORS: 'false', VITE_FIREBASE_API_KEY: 'AIzaFixtureOnlyNeverUseOnCloud',
  VITE_FIREBASE_AUTH_DOMAIN: 'vecung-fixture-dev.firebaseapp.com',
  VITE_FIREBASE_APP_ID: '1:123456789:web:abcdef', VITE_FUNCTIONS_REGION: 'asia-southeast1',
};
const env = { ...process.env, GITHUB_ACTIONS: 'false', GCLOUD_PROJECT: '', ...cloudConfig };
function run(script: string, args: string[] = [], overrides: Record<string, string> = {}) {
  return spawnSync(process.execPath, ['--import', pathToFileURL(resolve(root, 'node_modules/tsx/dist/loader.mjs')).href, resolve(root, `scripts/${script}.ts`), ...args], {
    cwd: fixtureDir, env: { ...env, ...overrides }, encoding: 'utf8', timeout: 10000,
  });
}
afterAll(() => rmSync(fixtureDir, { recursive: true, force: true }));

describe('Deploy scripts chặn trước khi gọi Firebase', () => {
  it('Thiếu file config không thể deploy', () => {
    const result = run('deploy-firebase', ['deploy', 'dev']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Thiếu .env.firebase.dev');
  });
  it('Có config nhưng guard tắt vẫn không gọi build/deploy', () => {
    const source = Object.entries(cloudConfig)
      .map(([key, value]) => `${key}=${key === 'ENABLE_FIREBASE_DEPLOY' ? 'false' : value}`).join('\n');
    writeFileSync(join(fixtureDir, '.env.firebase.dev'), source);
    expect(run('deploy-firebase', ['check', 'dev']).status).toBe(0);
    const blocked = run('deploy-firebase', ['deploy', 'dev']);
    expect(blocked.status).toBe(1);
    expect(blocked.stderr).toContain('Deploy đang tắt');
  });
  it('Predeploy hook kiểm tra cả guard và project CLI thực chọn', () => {
    expect(run('check-deploy', ['--enabled'], { ENABLE_FIREBASE_DEPLOY: 'false' }).status).toBe(1);
    const mismatch = run('check-deploy', ['--enabled'], { GCLOUD_PROJECT: 'vecung-other-dev' });
    expect(mismatch.status).toBe(1);
    expect(mismatch.stderr).toContain('Project Firebase CLI');
  });
  it('Chặn hai môi trường dùng chung project', () => {
    const otherPath = join(fixtureDir, '.env.firebase.production-demo');
    writeFileSync(otherPath, `FIREBASE_DEPLOY_ENV=production-demo\nFIREBASE_PROJECT_ID=${env.FIREBASE_PROJECT_ID}\n`);
    try {
      const result = run('deploy-firebase', ['check', 'dev']);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('hai Firebase projects riêng');
    } finally { rmSync(otherPath); }
  });
  it('CI thiếu WIF không báo config sẵn sàng', () => {
    const result = run('check-deploy', [], { GITHUB_ACTIONS: 'true', WIF_PROVIDER: '', DEPLOY_SERVICE_ACCOUNT: '' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('WIF_PROVIDER');
  });
});

describe('Hosting không upload nhầm bản local hoặc project khác', () => {
  const path = join(fixtureDir, 'web/dist/firebase-build.json');
  it('Thiếu manifest build bị chặn', () => {
    expect(run('check-hosting-build').status).toBe(1);
  });
  it('Build Emulator bị chặn', () => {
    mkdirSync(join(fixtureDir, 'web/dist'), { recursive: true });
    writeFileSync(path, JSON.stringify({ projectId: 'demo-vecung', useEmulators: true, region: 'asia-southeast1', appId: 'demo-app-id' }));
    expect(run('check-hosting-build').status).toBe(1);
  });
  it('Build đúng project/app cloud mới được chấp nhận', () => {
    writeFileSync(path, JSON.stringify({ projectId: env.FIREBASE_PROJECT_ID, useEmulators: false, region: env.VITE_FUNCTIONS_REGION, appId: env.VITE_FIREBASE_APP_ID }));
    expect(run('check-hosting-build').status).toBe(0);
    expect(run('check-hosting-build', [], { FIREBASE_PROJECT_ID: 'vecung-prod-demo', VITE_FIREBASE_PROJECT_ID: 'vecung-prod-demo' }).status).toBe(1);
    expect(run('check-hosting-build', [], { VITE_FIREBASE_APP_ID: '1:123456789:web:123abc' }).status).toBe(1);
  });
});
