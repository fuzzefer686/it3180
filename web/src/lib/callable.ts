import type { ApiContracts } from '../../../shared/contracts';
import { z } from 'zod';
import { inputSchemas, responseSchemas, rpcNames } from '../../../shared/api';
import { TripError } from '../../../shared/trip-errors';
import { supabase } from './supabase';
export { errorMessage } from './errors';

const edgeErrorSchema = z.object({ error: z.object({ code: z.string() }) });
const edgeMessages: Record<string, string> = {
  MAP_NOT_CONFIGURED: 'Bản đồ chưa được cấu hình. Hãy liên hệ người phụ trách backend.',
  MAP_INVALID_KEY: 'VietMap từ chối khoá bản đồ. Hãy báo người phụ trách backend.',
  MAP_QUOTA: 'VietMap đang giới hạn số lần tra cứu. Vui lòng thử lại sau ít phút.',
  MAP_UNAVAILABLE: 'VietMap chưa phản hồi được. Vui lòng thử lại.',
  ROUTE_TOO_LARGE: 'Tuyến quá dài. Hãy chia thành chuyến ngắn hơn.',
  INVALID_INPUT: 'Dữ liệu chưa hợp lệ. Vui lòng kiểm tra lại.',
  AUTH_REQUIRED: 'Vui lòng đăng nhập lại.',
  ACCESS_DENIED: 'Tài khoản không được phép thực hiện thao tác này.',
  PROFILE_NOT_READY: 'Hồ sơ tài xế hoặc backend chuyến đi chưa sẵn sàng.',
  TRIP_CHANGED: 'Chuyến đã thay đổi hoặc không còn được sửa. Hãy tải lại.',
  TRIP_NOT_FOUND: 'Không tìm thấy chuyến đi này.',
};

// Giữ tên wrapper để các module gọi API qua một boundary có kiểu dữ liệu.
export async function callFunction<K extends keyof ApiContracts>(
  name: K, input: ApiContracts[K]['input'],
): Promise<ApiContracts[K]['output']> {
  const validated = inputSchemas[name].parse(input);
  if (!(name in rpcNames)) {
    const { data, error } = await supabase.functions.invoke('trips', { body: { action: name, input: validated } });
    if (error) {
      // Edge chỉ trả mã lỗi nghiệp vụ; không hiển thị lỗi SQL/SDK thô.
      if ('context' in error && error.context instanceof Response) {
        let body: unknown;
        try { body = await error.context.json(); } catch { throw error; }
        const parsed = edgeErrorSchema.safeParse(body);
        if (parsed.success && edgeMessages[parsed.data.error.code]) {
          throw new TripError(parsed.data.error.code, edgeMessages[parsed.data.error.code], error.context.status);
        }
      }
      throw error;
    }
    return responseSchemas[name].parse(data) as ApiContracts[K]['output'];
  }
  const { data, error } = await supabase.rpc(rpcNames[name as keyof typeof rpcNames], { input: validated });
  if (error) throw error;
  return responseSchemas[name].parse(data) as ApiContracts[K]['output'];
}
