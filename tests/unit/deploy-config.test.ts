import { describe, expect, it } from 'vitest';
import { getFirebaseConfig } from '../../web/src/lib/firebase-config';
import { cloudProcessEnv, requireDeployTarget, validateDeployConfig } from '../../scripts/deploy-config';

// Config hư cấu đúng định dạng; không gọi cloud hoặc dùng credential thật.
const cloud = {
  FIREBASE_DEPLOY_ENV: 'dev', ENABLE_FIREBASE_DEPLOY: 'false',
  FIREBASE_PROJECT_ID: 'vecung-test-dev', VITE_FIREBASE_PROJECT_ID: 'vecung-test-dev',
  VITE_USE_EMULATORS: 'false', VITE_FIREBASE_API_KEY: 'AIzaFixtureOnlyNeverUseOnCloud',
  VITE_FIREBASE_AUTH_DOMAIN: 'vecung-test-dev.firebaseapp.com',
  VITE_FIREBASE_APP_ID: '1:123456789:web:abcdef', VITE_FUNCTIONS_REGION: 'asia-southeast1',
};

describe('Local và cloud config không lẫn môi trường', () => {
  it('Clone mới không cần env; local dùng demo-vecung', () => {
    expect(getFirebaseConfig({}, true)).toMatchObject({ useEmulators: true, projectId: 'demo-vecung' });
  });
  it('Dev server từ chối cloud và Emulator từ chối project thật', () => {
    expect(() => getFirebaseConfig(cloud, true)).toThrow('npm run dev');
    expect(() => getFirebaseConfig({ ...cloud, VITE_USE_EMULATORS: 'true' })).toThrow('demo-vecung');
  });
  it.each(['', 'yes', 'TRUE'])('Không coi flag %j là cloud config', flag => {
    expect(() => getFirebaseConfig({ ...cloud, VITE_USE_EMULATORS: flag })).toThrow();
  });
  it.each(['VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_APP_ID'])('Cloud thiếu %s không fallback sang demo', key => {
    expect(() => getFirebaseConfig({ ...cloud, [key]: undefined })).toThrow();
    expect(() => getFirebaseConfig({ ...cloud, [key]: 'YOUR_VALUE' })).toThrow();
  });
  it('Không build/deploy sai region backend', () => {
    expect(() => getFirebaseConfig({ ...cloud, VITE_FUNCTIONS_REGION: 'us-central1' })).toThrow('asia-southeast1');
  });
  it('Không chấp nhận URL hoặc appId không phải ứng dụng Web', () => {
    expect(() => getFirebaseConfig({ ...cloud, VITE_FIREBASE_AUTH_DOMAIN: 'https://vecung-test-dev.firebaseapp.com' })).toThrow();
    expect(() => getFirebaseConfig({ ...cloud, VITE_FIREBASE_APP_ID: '1:123:android:abcdef' })).toThrow();
  });
});

describe('Guard deploy', () => {
  it('Kiểm tra/build được khi deploy tắt; deploy chỉ được khi lead bật guard', () => {
    expect(validateDeployConfig(cloud).projectId).toBe('vecung-test-dev');
    expect(() => validateDeployConfig(cloud, true)).toThrow('Deploy đang tắt');
    expect(validateDeployConfig({ ...cloud, ENABLE_FIREBASE_DEPLOY: 'true' }, true).useEmulators).toBe(false);
  });
  it('Chặn project frontend/backend khác nhau và project demo', () => {
    expect(() => validateDeployConfig({ ...cloud, FIREBASE_PROJECT_ID: 'vecung-other-dev' })).toThrow('khớp');
    expect(() => validateDeployConfig({ ...cloud, VITE_FIREBASE_PROJECT_ID: 'demo-vecung', FIREBASE_PROJECT_ID: 'demo-vecung' })).toThrow();
    expect(() => validateDeployConfig({ ...cloud, VITE_USE_EMULATORS: 'true' })).toThrow();
  });
  it('Chọn môi trường rõ ràng, không mặc định thành production', () => {
    expect(requireDeployTarget('production-demo')).toBe('production-demo');
    for (const target of [undefined, '', 'main', '../dev']) expect(() => requireDeployTarget(target)).toThrow();
  });
  it('Build cloud không kế thừa VITE/Emulator/GCLOUD từ terminal local; vẫn giữ ADC', () => {
    const env = cloudProcessEnv(cloud, {
      VITE_USE_EMULATORS: 'true', VITE_VIETMAP_MAP_KEY: 'old-local-map-key',
      FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
      GCLOUD_PROJECT: 'demo-vecung', GOOGLE_APPLICATION_CREDENTIALS: '/tmp/fixture-adc.json',
    });
    expect(env).toMatchObject({ VITE_USE_EMULATORS: 'false', VECUNG_CLOUD_BUILD: 'true', GOOGLE_APPLICATION_CREDENTIALS: '/tmp/fixture-adc.json' });
    for (const key of ['VITE_VIETMAP_MAP_KEY', 'FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST', 'GCLOUD_PROJECT']) expect(env[key]).toBeUndefined();
  });
});
