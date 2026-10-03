import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { userProfileSchema, type Role, type UserProfile } from '../../../shared/contracts';
import { db } from './admin';
import { hasRole } from './roles';

// Bootstrap hồ sơ dùng requireUid; nghiệp vụ còn lại dùng requireActiveUser.
export function requireUid(auth: CallableRequest<unknown>['auth']): string {
  if (!auth) throw new HttpsError('unauthenticated', 'Bạn cần đăng nhập.');
  return auth.uid;
}

// Firebase xác minh ID token; quyền/status lấy từ DB, không từ input/custom claims cũ.
export async function requireActiveUser(auth: CallableRequest<unknown>['auth']): Promise<UserProfile> {
  const uid = requireUid(auth);
  const snapshot = await db.doc(`users/${uid}`).get();
  if (!snapshot.exists) throw new HttpsError('failed-precondition', 'Chưa có hồ sơ tài khoản.');
  const result = userProfileSchema.safeParse(snapshot.data());
  if (!result.success || result.data.uid !== uid) {
    throw new HttpsError('failed-precondition', 'Hồ sơ tài khoản chưa hợp lệ.');
  }
  if (result.data.status !== 'ACTIVE') throw new HttpsError('permission-denied', 'Tài khoản đã bị khóa.');
  return result.data;
}
export function requireRole(user: UserProfile, role: Role): void {
  if (!hasRole(user.roles, role)) throw new HttpsError('permission-denied', 'Bạn không có quyền thực hiện.');
}
