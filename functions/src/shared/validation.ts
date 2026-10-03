import { HttpsError } from 'firebase-functions/v2/https';
import { z } from 'zod';
export const emptyInputSchema = z.object({}).strict();
export function parseInput<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) throw new HttpsError('invalid-argument', 'Dữ liệu đầu vào không hợp lệ.');
  return result.data;
}
