import type { TripStatus } from '../../../../shared/contracts';
import { errorMessage } from '../../lib/callable';
import { TripError } from '../../../../shared/trip-errors';

export const tripStatusText: Record<TripStatus, string> = {
  OPEN: 'Đang mở', IN_PROGRESS: 'Đang chạy', COMPLETED: 'Đã kết thúc', CANCELLED: 'Đã hủy',
};
export function distanceText(meters: number): string {
  return (meters / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + ' km';
}
export function tripTime(milliseconds: number): string {
  return new Date(milliseconds).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit',
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}
export function toVietnamInput(milliseconds: number): string {
  return new Date(milliseconds + 7 * 60 * 60 * 1000).toISOString().slice(0, 16);
}
export function fromVietnamInput(value: string): number {
  return Date.parse(value + ':00+07:00');
}
export function tripErrorText(error: unknown): string {
  if (error instanceof TripError) return error.message;
  return errorMessage(error);
}
