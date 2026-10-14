import { z } from 'zod';
import { userProfileSchema, type ApiContracts } from './contracts';

export const emptyInputSchema = z.object({}).strict();
export const rpcNames: Record<keyof ApiContracts, string> = {
  healthCheck: 'health_check', getMyProfile: 'get_my_profile',
  adminFoundationInfo: 'admin_foundation_info',
};
export const responseSchemas = {
  healthCheck: z.object({ status: z.literal('ok'), database: z.literal('connected'),
    sampleMessage: z.string().nullable(), environment: z.enum(['local', 'cloud']) }),
  getMyProfile: userProfileSchema,
  adminFoundationInfo: z.object({ version: z.string() }),
};
