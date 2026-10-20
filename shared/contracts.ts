import { z } from 'zod';

// Owner: lead; đổi contract phải báo module sử dụng.
export const roleSchema = z.enum(['USER', 'DRIVER', 'ADMIN']);
export type Role = z.infer<typeof roleSchema>;
export const userStatusSchema = z.enum(['ACTIVE', 'LOCKED']);
export const verificationStatusSchema = z.enum(['PENDING', 'VERIFIED', 'REJECTED']);
export const userProfileSchema = z.object({
  uid: z.string().min(1), displayName: z.string().min(1),
  roles: z.array(roleSchema).min(1), status: userStatusSchema,
  studentVerificationStatus: verificationStatusSchema,
  phone: z.string().nullable(), school: z.string().nullable(), studentCode: z.string().nullable(),
  studentEvidenceDemo: z.string().nullable(), studentReviewNote: z.string().nullable(),
  driverVerificationStatus: verificationStatusSchema, driverReviewNote: z.string().nullable(),
  vehicleModel: z.string().nullable(), vehiclePlate: z.string().nullable(),
  eligibility: z.object({ canBook: z.boolean(), canDrive: z.boolean() }),
});
export type UserProfile = z.infer<typeof userProfileSchema>;
export const profileInputSchema = z.object({
  displayName: z.string().trim().min(1, 'Nhập họ tên.').max(100, 'Họ tên tối đa 100 ký tự.'),
  phone: z.string().trim().regex(/^(?:0|\+84)[0-9]{9}$/, 'Nhập số điện thoại Việt Nam hợp lệ.'),
  school: z.string().trim().min(1, 'Nhập tên trường.').max(150, 'Tên trường tối đa 150 ký tự.'),
  studentCode: z.string().trim().min(1, 'Nhập mã sinh viên.').max(50, 'Mã sinh viên tối đa 50 ký tự.'),
  studentEvidenceDemo: z.string().trim().min(1, 'Nhập minh chứng hư cấu để duyệt thử.').max(500, 'Minh chứng tối đa 500 ký tự.'),
  vehicleModel: z.string().trim().min(1, 'Nhập loại xe máy.').max(100, 'Tên xe tối đa 100 ký tự.').nullable(),
  vehiclePlate: z.string().trim().min(1, 'Nhập biển số xe.').max(20, 'Biển số tối đa 20 ký tự.').nullable(),
}).strict().refine(value => Boolean(value.vehicleModel) === Boolean(value.vehiclePlate), {
  message: 'Điền cả loại xe và biển số khi đăng ký tài xế.', path: ['vehiclePlate'],
});
export type ProfileInput = z.infer<typeof profileInputSchema>;
export const adminListInputSchema = z.object({ page: z.number().int().min(1).max(10000) }).strict();
export const adminReviewInputSchema = z.object({
  uid: z.uuid(), kind: z.enum(['STUDENT', 'DRIVER']),
  decision: z.enum(['VERIFIED', 'REJECTED']), reason: z.string().trim().max(500),
}).strict().refine(value => value.decision !== 'REJECTED' || value.reason.length > 0, {
  message: 'Cần ghi lý do từ chối.', path: ['reason'],
});
export const adminStatusInputSchema = z.object({ uid: z.uuid(), status: userStatusSchema }).strict();
export const tripStatusSchema = z.enum(['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);
export const bookingStatusSchema = z.enum(['WAITING', 'CONFIRMED', 'ONBOARD', 'COMPLETED', 'REJECTED', 'CANCELLED', 'EXPIRED']);
export type TripStatus = z.infer<typeof tripStatusSchema>;
export type BookingStatus = z.infer<typeof bookingStatusSchema>;

// API dùng milliseconds; PostgreSQL dùng timestamptz, chuyển ở backend boundary.
export interface RouteStop {
  id: string; label: string; order: number;
  latitude: number; longitude: number;
  distanceFromStartMeters: number;
}
export interface Trip {
  id: string; driverId: string; departureTimeMs: number; status: TripStatus;
  vehicleType: 'MOTORCYCLE'; stops: RouteStop[];
  confirmedBookingId: string | null; hasServedPassenger: boolean;
}
export interface Booking {
  id: string; tripId: string; passengerId: string; driverId: string;
  pickupStopId: string; dropoffStopId: string; status: BookingStatus;
  farePoints: number; feePoints: number; driverPoints: number;
  paymentMethod: 'DEMO_WALLET'; createdAtMs: number;
}
export interface Wallet { uid: string; balancePoints: number }
export interface Payment {
  bookingId: string; passengerId: string; driverId: string;
  farePoints: number; feePoints: number; driverPoints: number;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED';
}
export interface LedgerEntry {
  id: string; walletId: string; deltaPoints: number;
  kind: 'INITIAL_GRANT' | 'DEMO_TOP_UP' | 'RIDE_PAYMENT' | 'DRIVER_INCOME' | 'APP_FEE';
  referenceId: string; createdAtMs: number;
}
export interface HealthResponse {
  status: 'ok'; database: 'connected'; sampleMessage: string | null;
  environment: 'local' | 'cloud';
}
export interface ApiContracts {
  healthCheck: { input: Record<string, never>; output: HealthResponse };
  getMyProfile: { input: Record<string, never>; output: UserProfile };
  updateMyProfile: { input: ProfileInput; output: UserProfile };
  adminListUsers: { input: z.infer<typeof adminListInputSchema>; output: { users: UserProfile[]; total: number } };
  adminReviewUser: { input: z.infer<typeof adminReviewInputSchema>; output: UserProfile };
  adminSetUserStatus: { input: z.infer<typeof adminStatusInputSchema>; output: UserProfile };
  adminFoundationInfo: { input: Record<string, never>; output: { version: string } };
}

// Các tên/input dự kiến dưới đây chưa có handler; owner chốt qua PR trước khi dùng.
export interface PlannedInputs {
  createTrip: { stops: Array<Pick<RouteStop, 'label' | 'latitude' | 'longitude'>>; departureTimeMs: number };
  requestRide: { tripId: string; pickupStopId: string; dropoffStopId: string; requestId: string };
  confirmBooking: { bookingId: string };
  cancelBooking: { bookingId: string; reason: string };
  markPickup: { bookingId: string };
  markDropoff: { bookingId: string };
  payBooking: { bookingId: string };
  topUpDemo: { requestId: string };
}
