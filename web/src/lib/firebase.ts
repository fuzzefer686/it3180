import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';
import { getFirebaseConfig } from './firebase-config';

const config = getFirebaseConfig(import.meta.env);
export const { useEmulators, projectId, region } = config;
export const firebaseApp = initializeApp({
  apiKey: config.apiKey, authDomain: config.authDomain,
  projectId, appId: config.appId,
});
export const auth = getAuth(firebaseApp);
export const functions = getFunctions(firebaseApp, region);
if (useEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}
