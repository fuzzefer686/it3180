import { z } from 'zod';
import { errorMessage } from '../../lib/errors';

// Local contract boundary: shared files belong to other owners and stay unchanged.
const uuid = z.uuid();
const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const bookingActions = ['confirmBooking', 'rejectBooking', 'cancelBooking', 'markPickup', 'markDropoff'] as const;
export type BookingAction = typeof bookingActions[number];
export const bookingSchema = z.object({
  id: uuid, tripId: uuid, passengerId: uuid, driverId: uuid, pickupStopId: uuid, dropoffStopId: uuid,
  pickupLabel: z.string(), dropoffLabel: z.string(), driverName: z.string(), passengerName: z.string(),
  status: z.enum(['WAITING', 'CONFIRMED', 'ONBOARD', 'COMPLETED', 'REJECTED', 'CANCELLED', 'EXPIRED']),
  storedStatus: z.string(), tripStatus: z.enum(['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
  departureTimeMs: integer, createdAtMs: integer, confirmedAtMs: integer.nullable(),
  pickedUpAtMs: integer.nullable(), completedAtMs: integer.nullable(), distanceMeters: integer.nullable(),
  farePoints: integer.nullable(), feePoints: integer.nullable(), driverPoints: integer.nullable(),
  paymentMethod: z.literal('DEMO_WALLET'), cancellationReason: z.string().nullable(),
  contactPhone: z.string().nullable(), paymentId: uuid.nullable(), actions: z.array(z.enum(bookingActions)),
});
export type Booking = z.infer<typeof bookingSchema>;
export const bookingStatusLabels: Record<Booking['status'], string> = {
  WAITING: 'Đang chờ / dự phòng', CONFIRMED: 'Đã nhận', ONBOARD: 'Đã lên xe', COMPLETED: 'Đã trả khách',
  REJECTED: 'Đã từ chối', CANCELLED: 'Đã hủy', EXPIRED: 'Hết hạn',
};
const cursorSchema = z.object({ createdAt: z.string().min(1).max(64), id: uuid }).strict();
export type BookingCursor = z.infer<typeof cursorSchema>;
export type BookingGroup = 'ALL' | 'WAITING' | 'UPCOMING' | 'HISTORY';
const listSchema = z.object({ items: z.array(bookingSchema), nextCursor: cursorSchema.nullable() });
const listInput = z.object({ group: z.enum(['ALL', 'WAITING', 'UPCOMING', 'HISTORY']), cursor: cursorSchema.optional() }).strict();
export const requestRideSchema = z.object({
  tripId: uuid, pickupStopId: uuid, dropoffStopId: uuid, requestId: z.string().trim().min(1).max(128),
}).strict().refine(input => input.pickupStopId !== input.dropoffStopId, 'Điểm trả phải khác điểm đón.');
const idInput = z.object({ bookingId: uuid }).strict();

async function rpc<T>(name: string, input: unknown, output: z.ZodType<T>): Promise<T> {
  const { supabase } = await import('../../lib/supabase');
  const { data, error } = await supabase.rpc(name, { input });
  if (error) throw error;
  return output.parse(data);
}
export function requestRide(input: z.infer<typeof requestRideSchema>) {
  return rpc('request_ride', requestRideSchema.parse(input), bookingSchema);
}
export function getBooking(bookingId: string) {
  return rpc('get_booking', idInput.parse({ bookingId }), bookingSchema);
}
export function listMyBookings(input: z.infer<typeof listInput>) {
  return rpc('list_my_bookings', listInput.parse(input), listSchema);
}
export function listTripBookings(input: z.infer<typeof listInput> & { tripId: string }) {
  return rpc('list_trip_bookings', listInput.extend({ tripId: uuid }).parse(input), listSchema);
}
export function changeBooking(action: BookingAction, bookingId: string, reason = '') {
  const names: Record<BookingAction, string> = {
    confirmBooking: 'confirm_booking', rejectBooking: 'reject_booking', cancelBooking: 'cancel_booking',
    markPickup: 'mark_pickup', markDropoff: 'mark_dropoff',
  };
  const input = action === 'cancelBooking'
    ? idInput.extend({ reason: z.string().trim().max(500) }).parse({ bookingId, reason })
    : idInput.parse({ bookingId });
  return rpc(names[action], input, bookingSchema);
}
export const placeSchema = z.object({ label: z.string(), latitude: z.number().min(8).max(24), longitude: z.number().min(102).max(110) });
export type BookingPlace = z.infer<typeof placeSchema>;
const suggestionsSchema = z.object({ items: z.array(z.object({ refId: z.string(), label: z.string() })) });
export type BookingSuggestion = z.infer<typeof suggestionsSchema>['items'][number];

export function bookingError(error: unknown): string {
  if (error instanceof z.ZodError) return 'Dữ liệu chưa đúng định dạng. Hãy kiểm tra hoặc tải lại.';
  if (error instanceof Error && error.message.startsWith('BOOKING:')) return error.message.slice(8);
  if (error && typeof error === 'object' && 'code' in error) {
    if (error.code === 'PGRST202') return 'Chức năng đặt chuyến chưa sẵn sàng trên server. Vui lòng báo người phụ trách hệ thống.';
    if (error.code === 'PT404') return 'Không tìm thấy yêu cầu hoặc chuyến đi này. Hãy tải lại danh sách.';
  }
  if (error && typeof error === 'object' && 'code' in error && error.code === 'PT403' && 'message' in error) {
    if (error.message === 'Not eligible') return 'Server chưa xác minh hồ sơ sinh viên. Hãy kiểm tra hồ sơ và tải lại trạng thái tài khoản.';
    if (error.message === 'Driver required') return 'Server chưa xác nhận quyền tài xế hoặc thông tin xe. Hãy kiểm tra hồ sơ và tải lại trạng thái tài khoản.';
    if (error.message === 'Account locked') return 'Tài khoản đã bị khóa. Vui lòng liên hệ người quản lý hệ thống.';
  }
  return errorMessage(error);
}
async function mapRequest<T>(body: Record<string, unknown>, output: z.ZodType<T>): Promise<T> {
  const { supabase } = await import('../../lib/supabase');
  const { data, error } = await supabase.functions.invoke('bookings', { body });
  if (error) {
    let code = '';
    if ('context' in error && error.context instanceof Response) {
      try {
        const parsed = z.object({ error: z.object({ code: z.string() }) }).parse(await error.context.json());
        code = parsed.error.code;
      } catch { /* Use a safe message below. */ }
    }
    const messages: Record<string, string> = {
      MAP_NOT_CONFIGURED: 'Tìm địa chỉ chưa được cấu hình. Bạn vẫn có thể chọn điểm dừng bên dưới.',
      MAP_INVALID_KEY: 'VietMap từ chối key tìm địa chỉ. Hãy báo người phụ trách backend hoặc chọn điểm dừng.',
      MAP_QUOTA: 'VietMap đang giới hạn lượt tìm địa chỉ. Hãy thử lại sau ít phút hoặc chọn điểm dừng.',
      MAP_UNAVAILABLE: 'Không tìm được địa chỉ lúc này. Hãy thử lại hoặc chọn điểm dừng.',
      AUTH_REQUIRED: 'Vui lòng đăng nhập lại.', ACCESS_DENIED: 'Bạn chưa đủ điều kiện tìm địa chỉ đặt chuyến.',
      NOT_IMPLEMENTED: 'Backend tìm địa chỉ Booking chưa được triển khai.',
      PROFILE_REQUIRED: 'Cần tải hồ sơ trước khi tìm địa chỉ.', INVALID_INPUT: 'Địa chỉ tìm kiếm chưa hợp lệ.',
      SERVER_ERROR: 'Backend tìm địa chỉ Booking chưa xử lý được yêu cầu. Hãy thử lại hoặc chọn điểm dừng.',
    };
    throw new Error('BOOKING:' + (messages[code] ?? 'Không gọi được tìm địa chỉ Booking. Kiểm tra triển khai backend hoặc chọn điểm dừng.'));
  }
  return output.parse(data);
}
export function searchBookingPlaces(text: string) {
  return mapRequest({ action: 'search', text: z.string().trim().min(2).max(200).parse(text) }, suggestionsSchema);
}
export function getBookingPlace(refId: string) {
  return mapRequest({ action: 'place', refId: z.string().min(1).max(2000).parse(refId) }, z.object({ place: placeSchema }));
}
