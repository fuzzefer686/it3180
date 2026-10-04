type Environment = Record<string, string | undefined>;

// Dùng cùng kiểm tra ở browser, Vite build và scripts deploy.
export function getFirebaseConfig(env: Environment, localOnly = false) {
  const emulatorFlag = env.VITE_USE_EMULATORS ?? 'true';
  if (!['true', 'false'].includes(emulatorFlag)) throw new Error('VITE_USE_EMULATORS phải là true hoặc false.');
  const useEmulators = emulatorFlag === 'true';
  if (localOnly && !useEmulators) throw new Error('npm run dev chỉ dùng Emulator. Dùng lệnh build/deploy cloud riêng; xem docs/firebase-deploy.md.');
  const projectId = env.VITE_FIREBASE_PROJECT_ID ?? 'demo-vecung';
  const region = env.VITE_FUNCTIONS_REGION ?? 'asia-southeast1';
  if (region !== 'asia-southeast1') throw new Error('VITE_FUNCTIONS_REGION phải khớp backend: asia-southeast1.');
  if (useEmulators && projectId !== 'demo-vecung') throw new Error('Local phải dùng project demo-vecung để khớp Emulator và seed.');

  function cloudValue(key: string) {
    const value = env[key]?.trim();
    if (!value || /demo-|YOUR_|CHANGE_ME|[<>]|_THAT|_TU_FIREBASE/i.test(value)) {
      throw new Error(`Thiếu hoặc còn placeholder trong ${key}.`);
    }
    return value;
  }
  const apiKey = useEmulators ? (env.VITE_FIREBASE_API_KEY ?? 'demo-api-key') : cloudValue('VITE_FIREBASE_API_KEY');
  const authDomain = useEmulators ? (env.VITE_FIREBASE_AUTH_DOMAIN ?? 'demo-vecung.firebaseapp.com') : cloudValue('VITE_FIREBASE_AUTH_DOMAIN');
  const appId = useEmulators ? (env.VITE_FIREBASE_APP_ID ?? 'demo-app-id') : cloudValue('VITE_FIREBASE_APP_ID');
  if (!useEmulators) {
    cloudValue('VITE_FIREBASE_PROJECT_ID');
    if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) throw new Error('Firebase project ID cloud chưa hợp lệ.');
    if (!/^AIza[\w-]+$/.test(apiKey)) throw new Error('VITE_FIREBASE_API_KEY phải lấy từ Firebase Web config.');
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(authDomain)) throw new Error('VITE_FIREBASE_AUTH_DOMAIN phải là domain, không có https:// hoặc đường dẫn.');
    if (!/^1:\d+:web:[a-z0-9]+$/i.test(appId)) throw new Error('VITE_FIREBASE_APP_ID phải là appId của ứng dụng Web.');
  }
  return { useEmulators, projectId, region, apiKey, authDomain, appId };
}
