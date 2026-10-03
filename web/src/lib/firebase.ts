import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';

export const useEmulators = (import.meta.env.VITE_USE_EMULATORS ?? 'true') === 'true';
export const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'demo-vecung';
export const region = import.meta.env.VITE_FUNCTIONS_REGION ?? 'asia-southeast1';
if (useEmulators && !projectId.startsWith('demo-')) {
  throw new Error('Local phải dùng project ID demo-… để tránh chạm cloud.');
}
if (!useEmulators && projectId.startsWith('demo-')) {
  throw new Error('Chưa cấu hình Firebase project cloud. Xem README.');
}
export const firebaseApp = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? 'demo-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? 'demo-vecung.firebaseapp.com',
  projectId, appId: import.meta.env.VITE_FIREBASE_APP_ID ?? 'demo-app-id',
});
export const auth = getAuth(firebaseApp);
export const functions = getFunctions(firebaseApp, region);
if (useEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}
