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
});
export type UserProfile = z.infer<typeof userProfileSchema>;
export const tripStatusSchema = z.enum(['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);
export const bookingStatusSchema = z.enum(['WAITING', 'CONFIRMED', 'ONBOARD', 'COMPLETED', 'REJECTED', 'CANCELLED', 'EXPIRED']);
export type TripStatus = z.infer<typeof tripStatusSchema>;
export type BookingStatus = z.infer<typeof bookingStatusSchema>;

// API dùng milliseconds; Firestore dùng Timestamp, chuyển ở backend boundary.
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
  environment: 'emulator' | 'cloud';
}
export interface CallableContracts {
  healthCheck: { input: Record<string, never>; output: HealthResponse };
  getMyProfile: { input: Record<string, never>; output: UserProfile };
  adminFoundationInfo: { input: Record<string, never>; output: { version: string } };
  getMyWallet: { input: Record<string, never>; output: { wallet: Wallet; ledgerEntries: LedgerEntry[] } };
  topUpDemo: { input: { requestId: string }; output: { balancePoints: number; entry: LedgerEntry } };
  payBooking: { input: { bookingId: string }; output: { payment: Payment } };
  getBookingPayment: { input: { bookingId: string }; output: { payment: Payment | null } };
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
