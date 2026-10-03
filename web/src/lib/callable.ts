import { httpsCallable } from 'firebase/functions';
import type { CallableContracts } from '../../../shared/contracts';
import { functions } from './firebase';

export async function callFunction<K extends keyof CallableContracts>(
  name: K, input: CallableContracts[K]['input'],
): Promise<CallableContracts[K]['output']> {
  const invoke = httpsCallable<CallableContracts[K]['input'], CallableContracts[K]['output']>(functions, name);
  return (await invoke(input)).data;
}
export function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = String(error.code);
    if (['auth/invalid-credential', 'auth/user-not-found', 'auth/wrong-password'].includes(code)) return 'Email hoặc mật khẩu chưa đúng. Vui lòng kiểm tra lại.';
    if (code === 'auth/invalid-email') return 'Địa chỉ email chưa hợp lệ.';
    if (code === 'auth/too-many-requests') return 'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau ít phút.';
    if (code === 'auth/user-disabled') return 'Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.';
    if (code === 'functions/unauthenticated') return 'Vui lòng đăng nhập lại để tiếp tục.';
    if (code === 'functions/permission-denied') return 'Tài khoản hiện không được phép thực hiện thao tác này.';
    if (code === 'functions/failed-precondition') return 'Hồ sơ của bạn chưa sẵn sàng. Vui lòng thử lại sau.';
    if (['functions/unavailable', 'functions/internal', 'auth/network-request-failed'].includes(code)) {
      return 'Không thể kết nối dịch vụ. Vui lòng thử lại sau.';
    }
  }
  // Không đưa lỗi SDK, đường dẫn hoặc thông tin triển khai ra giao diện.
  return 'Có lỗi xảy ra. Vui lòng thử lại.';
}
