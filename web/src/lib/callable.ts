import type { ApiContracts } from '../../../shared/contracts';
import { inputSchemas, responseSchemas, rpcNames } from '../../../shared/api';
import { supabase } from './supabase';
export { errorMessage } from './errors';

// Giữ tên wrapper để các module gọi API qua một boundary có kiểu dữ liệu.
export async function callFunction<K extends keyof ApiContracts>(
  name: K, input: ApiContracts[K]['input'],
): Promise<ApiContracts[K]['output']> {
  const { data, error } = await supabase.rpc(rpcNames[name], { input: inputSchemas[name].parse(input) });
  if (error) throw error;
  return responseSchemas[name].parse(data) as ApiContracts[K]['output'];
}
