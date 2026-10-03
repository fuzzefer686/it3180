import { onCall } from 'firebase-functions/v2/https';
import type { HealthResponse } from '../../../../shared/contracts';
import { db } from '../../shared/admin';
import { requireActiveUser, requireRole } from '../../shared/auth';
import { emptyInputSchema, parseInput } from '../../shared/validation';

// Public, chỉ trả một thông điệp fixture không nhạy cảm, không trả config/secrets.
export const healthCheck = onCall(async (request): Promise<HealthResponse> => {
  parseInput(emptyInputSchema, request.data);
  const sample = await db.doc('appMeta/foundation').get();
  const message: unknown = sample.data()?.message;
  return {
    status: 'ok', database: 'connected',
    sampleMessage: typeof message === 'string' ? message : null,
    environment: process.env.FUNCTIONS_EMULATOR === 'true' ? 'emulator' : 'cloud',
  };
});
export const getMyProfile = onCall(async (request) => {
  parseInput(emptyInputSchema, request.data);
  return requireActiveUser(request.auth);
});
// Ví dụ kiểm tra quyền để người 2 mở rộng; chưa phải trang admin nghiệp vụ.
export const adminFoundationInfo = onCall(async (request) => {
  parseInput(emptyInputSchema, request.data);
  const user = await requireActiveUser(request.auth);
  requireRole(user, 'ADMIN');
  return { version: '0.1.0' };
});
