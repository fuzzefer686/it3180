import { userProfileSchema } from '../shared/contracts';

async function main() {

// Chỉ fixture local; không thể dùng script này để tạo tài khoản ADMIN trên cloud.
const projectId = 'demo-vecung';
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
const dbHost = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
if (authHost !== '127.0.0.1:9099' || dbHost !== '127.0.0.1:8080') {
  throw new Error('Seed chỉ cho Emulator local ở các port mặc định.');
}
process.env.FIREBASE_AUTH_EMULATOR_HOST = authHost;
process.env.FIRESTORE_EMULATOR_HOST = dbHost;
process.env.GCLOUD_PROJECT = projectId;
const { initializeApp } = await import('firebase-admin/app');
const { getAuth } = await import('firebase-admin/auth');
const { getFirestore, Timestamp } = await import('firebase-admin/firestore');
const app = initializeApp({ projectId });
const auth = getAuth(app);
const db = getFirestore(app);
const demos = [
  { uid: 'demo-user', email: 'user@student.example', displayName: 'Sinh viên mẫu', roles: ['USER'] },
  { uid: 'demo-driver', email: 'driver@student.example', displayName: 'Tài xế mẫu', roles: ['USER', 'DRIVER'] },
  { uid: 'demo-admin', email: 'admin@student.example', displayName: 'Quản trị mẫu', roles: ['USER', 'ADMIN'] },
];
for (const demo of demos) {
  try { await auth.getUser(demo.uid); }
  catch (error) {
    if ((error as { code?: string }).code !== 'auth/user-not-found') throw error;
    await auth.createUser({ uid: demo.uid, email: demo.email, password: 'DemoOnly!2026', displayName: demo.displayName });
  }
  const ref = db.doc(`users/${demo.uid}`);
  if (!(await ref.get()).exists) {
    await ref.set(userProfileSchema.parse({ ...demo, status: 'ACTIVE', studentVerificationStatus: 'VERIFIED' }));
  }
}
await db.doc('appMeta/foundation').set({ message: 'Firestore Emulator đã lưu dữ liệu mẫu của Về Cùng.', seededAt: Timestamp.now() });
console.log('Seed local xong. 3 tài khoản mẫu user/driver/admin@student.example; mật khẩu DemoOnly!2026.');
console.log('Không cấp điểm hoặc triển khai nghiệp vụ ví trong scaffold.');

}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
