export class TripError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message);
    this.name = 'TripError';
  }
}

export function tripError(message: string, code: string): TripError {
  return new TripError(code, message, 412);
}

export function mapError(): TripError {
  return new TripError('MAP_UNAVAILABLE', 'VietMap chưa phản hồi được. Vui lòng thử lại.', 503);
}

// Key bị nhà cung cấp từ chối (401/403): lỗi cấu hình phía server, người dùng không tự sửa được.
export function mapKeyError(): TripError {
  return new TripError('MAP_INVALID_KEY', 'VietMap từ chối khoá bản đồ. Hãy báo người phụ trách backend.', 503);
}

// Vượt hạn mức/giới hạn tần suất: trả 429 để phía gọi biết đây là lỗi tạm thời, không phải dữ liệu sai.
export function mapQuotaError(retryAfterSeconds: number | null = null): TripError {
  const wait = retryAfterSeconds && retryAfterSeconds > 0 ? ` khoảng ${retryAfterSeconds} giây` : ' ít phút';
  return new TripError('MAP_QUOTA', `VietMap đang giới hạn số lần tra cứu. Vui lòng thử lại sau${wait}.`, 429);
}
