import type { TripStatus } from '../../../../shared/contracts';
import { errorMessage } from '../../lib/callable';
import { TripError } from '../../../../shared/trip-errors';

export const tripStatusText: Record<TripStatus, string> = {
  OPEN: 'Đang mở', IN_PROGRESS: 'Đang chạy', COMPLETED: 'Đã kết thúc', CANCELLED: 'Đã hủy',
};

export const tripStatusTone: Record<TripStatus, 'emerald' | 'amber' | 'neutral' | 'danger'> = {
  OPEN: 'emerald', IN_PROGRESS: 'amber', COMPLETED: 'neutral', CANCELLED: 'danger',
};

export function distanceText(meters: number): string {
  return (meters / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + ' km';
}

export function estimatedPointsText(meters: number): string {
  const points = Math.max(0, Math.round((meters / 1000) * 5000));
  return points.toLocaleString('vi-VN') + ' điểm';
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

export function isValidVietnamDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function fromVietnamInput(value: string): number {
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) return Number.NaN;
  const parsed = Date.parse(`${match[1]}:${match[2] ?? '00'}+07:00`);
  if (!Number.isFinite(parsed) || toVietnamInput(parsed) !== match[1]) return Number.NaN;
  return parsed;
}

export function tripErrorText(error: unknown): string {
  if (error instanceof TripError) return error.message;
  return errorMessage(error);
}
