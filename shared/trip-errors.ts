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
