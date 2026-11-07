import { z } from 'zod';
import { adminListInputSchema, adminReviewInputSchema, adminStatusInputSchema, profileInputSchema, userProfileSchema } from './contracts';
import { tripResponseSchemas } from './trip-responses';
import { cancelTripSchema, distanceInputSchema, listTripsSchema, stopsSchema,
  tripIdSchema, tripInputSchema, updateTripSchema } from './trip-schemas';

export const emptyInputSchema = z.object({}).strict();

export const walletSchema = z.object({
  uid: z.string(),
  balancePoints: z.number(),
});

export const paymentSchema = z.object({
  bookingId: z.string(),
  passengerId: z.string(),
  driverId: z.string(),
  farePoints: z.number(),
  feePoints: z.number(),
  driverPoints: z.number(),
  status: z.enum(['PENDING', 'SUCCEEDED', 'FAILED']),
});

export const ledgerEntrySchema = z.object({
  id: z.string(),
  walletId: z.string(),
  deltaPoints: z.number(),
  kind: z.enum(['INITIAL_GRANT', 'DEMO_TOP_UP', 'RIDE_PAYMENT', 'DRIVER_INCOME', 'APP_FEE']),
  referenceId: z.string(),
  createdAtMs: z.number(),
});

export const rpcNames = {
  healthCheck: 'health_check', getMyProfile: 'get_my_profile',
  adminFoundationInfo: 'admin_foundation_info',
  updateMyProfile: 'update_my_profile', adminListUsers: 'admin_list_users',
  adminReviewUser: 'admin_review_user', adminSetUserStatus: 'admin_set_user_status',
  listTrips: 'list_trips', getTrip: 'get_trip', startTrip: 'start_trip',
  completeTrip: 'complete_trip', cancelTrip: 'cancel_trip',
  getTripSegmentDistance: 'get_trip_segment_distance',
  getMyWallet: 'get_my_wallet', topUpDemo: 'top_up_demo',
  payBooking: 'pay_booking', getBookingPayment: 'get_booking_payment',
};

export const inputSchemas = {
  healthCheck: emptyInputSchema, getMyProfile: emptyInputSchema, adminFoundationInfo: emptyInputSchema,
  updateMyProfile: profileInputSchema, adminListUsers: adminListInputSchema,
  adminReviewUser: adminReviewInputSchema, adminSetUserStatus: adminStatusInputSchema,
  searchTripPlaces: z.object({ text: z.string().trim().min(2).max(200) }).strict(),
  getTripPlace: z.object({ refId: z.string().min(1).max(2000) }).strict(),
  previewTripRoute: z.object({ stops: stopsSchema }).strict(),
  createTrip: tripInputSchema, updateTrip: updateTripSchema,
  listTrips: listTripsSchema, getTrip: tripIdSchema, startTrip: tripIdSchema,
  completeTrip: tripIdSchema, cancelTrip: cancelTripSchema, getTripSegmentDistance: distanceInputSchema,
  getMyWallet: emptyInputSchema,
  topUpDemo: z.object({ requestId: z.string().trim().min(1).max(100) }).strict(),
  payBooking: z.object({ bookingId: z.string().trim().min(1) }).strict(),
  getBookingPayment: z.object({ bookingId: z.string().trim().min(1) }).strict(),
};

export const responseSchemas = {
  ...tripResponseSchemas,
  healthCheck: z.object({ status: z.literal('ok'), database: z.literal('connected'),
    sampleMessage: z.string().nullable(), environment: z.enum(['local', 'cloud']) }),
  getMyProfile: userProfileSchema,
  adminFoundationInfo: z.object({ version: z.string() }),
  updateMyProfile: userProfileSchema,
  adminListUsers: z.object({ users: z.array(userProfileSchema), total: z.number().int().nonnegative() }),
  adminReviewUser: userProfileSchema, adminSetUserStatus: userProfileSchema,
  getMyWallet: z.object({
    wallet: walletSchema,
    ledgerEntries: z.array(ledgerEntrySchema),
  }),
  topUpDemo: z.object({
    balancePoints: z.number(),
    entry: ledgerEntrySchema,
  }),
  payBooking: z.object({
    payment: paymentSchema,
  }),
  getBookingPayment: z.object({
    payment: paymentSchema.nullable(),
  }),
};
