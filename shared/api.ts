import { z } from 'zod';
import { userProfileSchema, type ApiContracts } from './contracts';

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

export const inputSchemas: Record<keyof ApiContracts, z.ZodTypeAny> = {
  healthCheck: emptyInputSchema,
  getMyProfile: emptyInputSchema,
  adminFoundationInfo: emptyInputSchema,
  getMyWallet: emptyInputSchema,
  topUpDemo: z.object({ requestId: z.string().min(1).max(100) }),
  payBooking: z.object({ bookingId: z.string().min(1) }),
  getBookingPayment: z.object({ bookingId: z.string().min(1) }),
};

export const rpcNames: Record<keyof ApiContracts, string> = {
  healthCheck: 'health_check',
  getMyProfile: 'get_my_profile',
  adminFoundationInfo: 'admin_foundation_info',
  getMyWallet: 'get_my_wallet',
  topUpDemo: 'top_up_demo',
  payBooking: 'pay_booking',
  getBookingPayment: 'get_booking_payment',
};

export const responseSchemas = {
  healthCheck: z.object({
    status: z.literal('ok'),
    database: z.literal('connected'),
    sampleMessage: z.string().nullable(),
    environment: z.enum(['local', 'cloud']),
  }),
  getMyProfile: userProfileSchema,
  adminFoundationInfo: z.object({ version: z.string() }),
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
