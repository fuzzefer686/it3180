import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initializeApp as initializeAdminApp, deleteApp as deleteAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, doc, getDoc, setDoc, terminate } from 'firebase/firestore';
import { initializeTestEnvironment, assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing';

const projectId = 'demo-vecung';
// CLI emulators:exec phải cung cấp env; không bao giờ fallback về cloud.
if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080' || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099') {
  throw new Error('Chạy npm run test:integration; test chỉ được chạy với Emulator.');
}
const adminApp = initializeAdminApp({ projectId }, 'integration-admin');
const db = getAdminFirestore(adminApp);
const adminAuth = getAdminAuth(adminApp);
const webApp = initializeApp({ apiKey:'demo-api-key', projectId }, 'integration-client');
const auth = getAuth(webApp);
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings:true });
const clientDb = getFirestore(webApp);
connectFirestoreEmulator(clientDb, '127.0.0.1', 8080);
let rules: RulesTestEnvironment;
const password = 'IntegrationOnly!2026';
async function call(name: string, data: unknown = {}, token?: string) {
  const response = await fetch(`http://127.0.0.1:5001/${projectId}/asia-southeast1/${name}`, {
    method:'POST', headers:{ 'Content-Type':'application/json', ...(token ? { Authorization:`Bearer ${token}` } : {}) },
    body:JSON.stringify({ data }),
  });
  return { status:response.status, body:await response.json() as { result?:unknown; error?:{ status:string; message:string } } };
}
async function login(kind: 'user' | 'admin' | 'missing') {
  const credential = await signInWithEmailAndPassword(auth, `${kind}@integration.example`, password);
  return credential.user.getIdToken();
}
beforeAll(async () => {
  rules = await initializeTestEnvironment({ projectId, firestore:{host:'127.0.0.1',port:8080,rules:readFileSync('firestore.rules','utf8')} });
  for (const kind of ['user','admin','missing'] as const) {
    await adminAuth.createUser({ uid:`integration-${kind}`, email:`${kind}@integration.example`, password });
    if (kind !== 'missing') await db.doc(`users/integration-${kind}`).set({ uid:`integration-${kind}`, displayName:'Test', roles:kind === 'admin' ? ['ADMIN'] : ['USER'], status:'ACTIVE', studentVerificationStatus:'PENDING' });
  }
  await db.doc('appMeta/foundation').set({ message:'Fixture integration đã lưu trong Firestore.' });
});
afterAll(async () => {
  await signOut(auth); await terminate(clientDb); await deleteApp(webApp);
  await rules?.cleanup(); await db.terminate(); await deleteAdminApp(adminApp);
});

describe('Luồng thật Auth → callable → Firestore Emulator', () => {
  it('healthCheck đọc fixture đã lưu qua Admin SDK', async () => {
    const response = await call('healthCheck');
    expect(response.status).toBe(200);
    expect(response.body.result).toEqual({status:'ok',database:'connected',sampleMessage:'Fixture integration đã lưu trong Firestore.',environment:'emulator'});
  });
  it('getMyProfile bắt buộc đăng nhập', async () => {
    const response = await call('getMyProfile');
    expect(response.status).toBe(401);
    expect(response.body.error?.status).toBe('UNAUTHENTICATED');
  });
  it('Lấy uid từ token và trả đúng hồ sơ; không nhận role giả từ input', async () => {
    const token = await login('user');
    expect((await call('getMyProfile', {}, token)).body.result).toMatchObject({uid:'integration-user',roles:['USER']});
    const forged = await call('getMyProfile', {uid:'integration-admin',roles:['ADMIN']}, token);
    expect(forged.status).toBe(400);
    expect(forged.body.error?.status).toBe('INVALID_ARGUMENT');
  });
  it('USER bị chặn admin callable, ADMIN được phép', async () => {
    const denied = await call('adminFoundationInfo', {}, await login('user'));
    expect(denied.status).toBe(403);
    expect(denied.body.error?.status).toBe('PERMISSION_DENIED');
    expect((await call('adminFoundationInfo', {}, await login('admin'))).status).toBe(200);
  });
  it('Khóa tài khoản ở DB có hiệu lực với token đã cấp trước đó', async () => {
    const token = await login('user');
    await db.doc('users/integration-user').update({status:'LOCKED'});
    const denied = await call('getMyProfile', {}, token);
    expect(denied.status).toBe(403);
    await db.doc('users/integration-user').update({status:'ACTIVE'});
  });
  it('Đăng nhập Auth nhưng chưa có hồ sơ không được dùng nghiệp vụ', async () => {
    const response = await call('getMyProfile', {}, await login('missing'));
    expect(response.status).toBe(400);
    expect(response.body.error?.status).toBe('FAILED_PRECONDITION');
  });
  it('Client đã đăng nhập vẫn không đọc/ghi users trực tiếp', async () => {
    await login('user');
    await expect(getDoc(doc(clientDb,'users/integration-user'))).rejects.toMatchObject({code:'permission-denied'});
    await expect(setDoc(doc(clientDb,'users/integration-user'),{roles:['ADMIN']})).rejects.toMatchObject({code:'permission-denied'});
  });
  it('Rules chặn cả ví/Booking/Trip và client chưa đăng nhập', async () => {
    const anonymousDb = rules.unauthenticatedContext().firestore();
    await assertFails(anonymousDb.doc('trips/fake').get());
    const signedDb = rules.authenticatedContext('integration-admin').firestore();
    await assertFails(signedDb.doc('wallets/integration-admin').set({balancePoints:99999999}));
    await assertFails(signedDb.doc('bookings/fake').set({status:'CONFIRMED'}));
  });
});
