import { z } from 'zod';
import { adminListInputSchema, adminReviewInputSchema, adminStatusInputSchema, profileInputSchema, userProfileSchema, type ApiContracts } from './contracts';

export const emptyInputSchema = z.object({}).strict();
export const rpcNames: Record<keyof ApiContracts, string> = {
  healthCheck: 'health_check', getMyProfile: 'get_my_profile',
  adminFoundationInfo: 'admin_foundation_info',
  updateMyProfile: 'update_my_profile', adminListUsers: 'admin_list_users',
  adminReviewUser: 'admin_review_user', adminSetUserStatus: 'admin_set_user_status',
};
export const inputSchemas = {
  healthCheck: emptyInputSchema, getMyProfile: emptyInputSchema, adminFoundationInfo: emptyInputSchema,
  updateMyProfile: profileInputSchema, adminListUsers: adminListInputSchema,
  adminReviewUser: adminReviewInputSchema, adminSetUserStatus: adminStatusInputSchema,
};
export const responseSchemas = {
  healthCheck: z.object({ status: z.literal('ok'), database: z.literal('connected'),
    sampleMessage: z.string().nullable(), environment: z.enum(['local', 'cloud']) }),
  getMyProfile: userProfileSchema,
  adminFoundationInfo: z.object({ version: z.string() }),
  updateMyProfile: userProfileSchema,
  adminListUsers: z.object({ users: z.array(userProfileSchema), total: z.number().int().nonnegative() }),
  adminReviewUser: userProfileSchema, adminSetUserStatus: userProfileSchema,
};
