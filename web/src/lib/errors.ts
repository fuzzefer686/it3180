export function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    switch (String(error.code)) {
      case 'invalid_credentials': return 'Email hoặc mật khẩu chưa đúng. Vui lòng kiểm tra lại.';
      case 'email_address_invalid': return 'Địa chỉ email chưa hợp lệ.';
      case 'over_request_rate_limit': case 'over_email_send_rate_limit': return 'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau ít phút.';
      case 'user_banned': return 'Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.';
      case 'PT401': case 'PGRST301': case 'PGRST303': return 'Vui lòng đăng nhập lại để tiếp tục.';
      case 'PT403': case '42501': return 'Tài khoản hiện không được phép thực hiện thao tác này.';
      case 'PGRST202': return 'Chức năng này chưa được triển khai.';
      case 'PT412': return 'Hồ sơ của bạn chưa sẵn sàng. Vui lòng thử lại sau.';
      case 'PT400': return 'Dữ liệu chưa hợp lệ. Vui lòng kiểm tra lại.';
    }
  }
  // Không đưa lỗi SDK, SQL hoặc thông tin triển khai ra giao diện.
  return 'Có lỗi xảy ra. Vui lòng thử lại.';
}
