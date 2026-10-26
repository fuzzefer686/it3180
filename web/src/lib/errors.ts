export function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    switch (String(error.code)) {
      case 'invalid_credentials': return 'Email hoặc mật khẩu chưa đúng. Vui lòng kiểm tra lại.';
      case 'email_address_invalid': return 'Địa chỉ email chưa hợp lệ.';
      case 'email_not_confirmed': return 'Vui lòng xác minh email trước khi đăng nhập. Bạn có thể gửi lại email xác minh bên trên.';
      case 'auth_session_missing': return 'Chưa nhận được phiên đăng nhập từ Supabase. Vui lòng thử đăng nhập lại.';
      case 'auth_signup_result_missing': return 'Supabase chưa trả kết quả đăng ký hợp lệ. Vui lòng thử lại.';
      case 'otp_expired': case 'flow_state_expired': case 'flow_state_not_found': return 'Liên kết xác minh đã hết hạn hoặc không còn hợp lệ. Vui lòng gửi lại email xác minh.';
      case 'auth_callback_failed': return 'Liên kết xác minh không thành công. Vui lòng dùng email mới nhất hoặc đăng nhập lại.';
      case 'email_address_not_authorized': return 'Supabase chưa cho phép gửi email tới địa chỉ này. Server cần cấu hình dịch vụ gửi email để hoàn tất đăng ký.';
      case 'email_provider_disabled': return 'Supabase chưa bật đăng nhập bằng email và mật khẩu. Quản trị viên cần bật Email provider.';
      case 'user_already_exists': case 'email_exists': return 'Không thể đăng ký email này. Nếu đã có tài khoản, hãy đăng nhập.';
      case 'weak_password': return 'Mật khẩu chưa đáp ứng yêu cầu bảo mật của server. Hãy dùng mật khẩu dài và khó đoán hơn.';
      case 'signup_disabled': return 'Server hiện chưa cho phép đăng ký tài khoản mới.';
      case 'PT409': return 'Dữ liệu đã thay đổi hoặc thao tác không còn phù hợp. Vui lòng tải lại.';
      case 'over_request_rate_limit': case 'over_email_send_rate_limit': return 'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau ít phút.';
      case 'user_banned': return 'Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.';
      case 'PT401': case 'PGRST301': case 'PGRST303': return 'Vui lòng đăng nhập lại để tiếp tục.';
      case 'PT403': case '42501': return 'Tài khoản hiện không được phép thực hiện thao tác này.';
      case 'PGRST202': return 'Chức năng này chưa được triển khai.';
      case 'PT412': return 'Hồ sơ của bạn chưa sẵn sàng. Vui lòng thử lại sau.';
      case 'PT400': return 'Dữ liệu chưa hợp lệ. Vui lòng kiểm tra lại.';
      case 'PT404': return 'Không tìm thấy chuyến đi này.';
    }
  }
  // Không đưa lỗi SDK, SQL hoặc thông tin triển khai ra giao diện.
  return 'Có lỗi xảy ra. Vui lòng thử lại.';
}
