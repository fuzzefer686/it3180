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
  return ['/dat-chuyen', '/vi-diem', '/quan-tri'].includes(from.split(/[?#]/)[0]) ? from : null;
}
