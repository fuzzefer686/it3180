import { z } from 'zod';

export const loginInputSchema = z.object({
  email: z.string().trim().pipe(z.email('Nhập địa chỉ email hợp lệ.')),
  password: z.string().min(1, 'Nhập mật khẩu.'),
});
export const signupInputSchema = z.object({
  email: z.string().trim().pipe(z.email('Nhập địa chỉ email hợp lệ.')),
  password: z.string().min(8, 'Mật khẩu cần ít nhất 8 ký tự.'),
  confirmPassword: z.string(),
}).refine(value => value.password === value.confirmPassword, {
  message: 'Mật khẩu nhập lại chưa khớp.', path: ['confirmPassword'],
});

export function authReturnPath(state: unknown): string | null {
  if (!state || typeof state !== 'object' || !('from' in state) || typeof state.from !== 'string') return null;
  const from = state.from;
  const pathname = from.split(/[?#]/)[0];
  if (['/dat-chuyen', '/vi-diem', '/quan-tri', '/chuyen-di/dang', '/chuyen-di/cua-toi'].includes(pathname)) {
    return from;
  }
  // Chỉ chi tiết/sửa Trip nội bộ; không nhận URL ngoài hoặc đường dẫn tùy ý.
  if (/^\/chuyen-di\/[a-zA-Z0-9_-]+(\/sua)?$/.test(pathname)) return from;
  return null;
}
