import { describe, expect, it } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';
import { hasRole } from '../../functions/src/shared/roles';
import { parseInput, emptyInputSchema } from '../../functions/src/shared/validation';
import { userProfileSchema } from '../../shared/contracts';

describe('Phân quyền và contract nền', () => {
  it('DRIVER dùng chức năng USER nhưng USER không tự thành DRIVER/ADMIN', () => {
    expect(hasRole(['DRIVER'], 'USER')).toBe(true);
    expect(hasRole(['USER'], 'DRIVER')).toBe(false);
    expect(hasRole(['USER'], 'ADMIN')).toBe(false);
    expect(hasRole(['ADMIN'], 'DRIVER')).toBe(false);
  });
  it('Không chấp nhận role lạ trong hồ sơ', () => {
    expect(userProfileSchema.safeParse({ uid:'x', displayName:'Test', roles:['SUPERUSER'], status:'ACTIVE', studentVerificationStatus:'VERIFIED' }).success).toBe(false);
  });
  it('Không nhận trường role/uid do client thêm vào callable không có input', () => {
    try { parseInput(emptyInputSchema, { uid:'another-user', roles:['ADMIN'] }); }
    catch (error) {
      expect(error).toBeInstanceOf(HttpsError);
      expect((error as HttpsError).code).toBe('invalid-argument');
      return;
    }
    throw new Error('Input giả quyền phải bị từ chối.');
  });
});
