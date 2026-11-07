import { z } from 'zod';
import { TripError } from '../../../shared/trip-errors.ts';
import { stopsSchema, tripInputSchema, updateTripSchema, validateStops, validateTimes } from '../../../shared/trip-schemas.ts';
import { computeRoute, getPlace, searchPlaces } from './vietmap.ts';

interface RpcResult {
  data: unknown;
  error: { code?: string; message?: string } | null;
}
interface Dependencies {
  authenticate: (token: string) => Promise<{ id: string } | null>;
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<RpcResult>;
  mapKey: string;
  allowedOrigins: string[];
}
const requestSchema = z.object({
  action: z.enum(['searchTripPlaces', 'getTripPlace', 'previewTripRoute', 'createTrip', 'updateTrip']),
  input: z.unknown(),
}).strict();
const inputSchemas = {
  searchTripPlaces: z.object({ text: z.string().trim().min(2).max(200) }).strict(),
  getTripPlace: z.object({ refId: z.string().min(1).max(2000) }).strict(),
  previewTripRoute: z.object({ stops: stopsSchema }).strict(),
  createTrip: tripInputSchema,
  updateTrip: updateTripSchema,
};

function databaseError(error: NonNullable<RpcResult['error']>): TripError {
  // Không đưa SQL, tên bảng hoặc thông tin SDK vào phản hồi.
  if (error.code === 'PT401') return new TripError('AUTH_REQUIRED', 'Vui lòng đăng nhập lại.', 401);
  if (error.code === 'PT403' || error.code === '42501') {
    return new TripError('ACCESS_DENIED', 'Tài khoản không được phép thực hiện thao tác này.', 403);
  }
  if (error.code === 'PGRST202' || error.code === 'PT412') {
    return new TripError('PROFILE_NOT_READY', 'Hồ sơ tài xế hoặc backend chuyến đi chưa sẵn sàng.', 412);
  }
  if (error.code === 'PT409') return new TripError('TRIP_CHANGED', 'Chuyến đã thay đổi hoặc không còn được sửa. Hãy tải lại.', 409);
  if (error.code === 'PT404') return new TripError('TRIP_NOT_FOUND', 'Không tìm thấy chuyến đi này.', 404);
  if (error.code === 'PT400') return new TripError('INVALID_INPUT', 'Dữ liệu chuyến đi chưa hợp lệ.', 400);
  // Lỗi chưa phân loại: log mã để tra cứu, nhưng phản hồi cho client vẫn giữ nguyên câu chung.
  console.error('[trips] database', error.code ?? 'unknown', (error.message ?? '').slice(0, 200));
  return new TripError('SERVER_ERROR', 'Không xử lý được chuyến đi. Vui lòng thử lại.', 500);
}

export async function handleTripRequest(request: Request, dependencies: Dependencies): Promise<Response> {
  const origin = request.headers.get('origin');
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
    'Cache-Control': 'no-store',
  };
  if (origin && dependencies.allowedOrigins.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  function respond(body: unknown, status: number): Response {
    return Response.json(body, { status, headers });
  }
  try {
    if (origin && !dependencies.allowedOrigins.includes(origin)) {
      throw new TripError('ACCESS_DENIED', 'Nguồn yêu cầu không được phép.', 403);
    }
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') throw new TripError('INVALID_METHOD', 'Chỉ hỗ trợ POST.', 405);
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) throw new TripError('AUTH_REQUIRED', 'Bạn cần đăng nhập.', 401);
    const user = await dependencies.authenticate(authorization.slice(7));
    if (!user) throw new TripError('AUTH_REQUIRED', 'Phiên đăng nhập không hợp lệ.', 401);
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > 20000) throw new TripError('INVALID_INPUT', 'Yêu cầu quá lớn.', 413);
    let body: unknown;
    try { body = JSON.parse(text); } catch { throw new TripError('INVALID_INPUT', 'Dữ liệu không hợp lệ.'); }
    const { action, input } = requestSchema.parse(body);
    const validated = inputSchemas[action].parse(input);
    const access = await dependencies.rpc('check_trip_access', { actor_id: user.id, require_driver: true });
    if (access.error) throw databaseError(access.error);
    if (action === 'searchTripPlaces') {
      return respond({ items: await searchPlaces(inputSchemas.searchTripPlaces.parse(validated).text, dependencies.mapKey) }, 200);
    }
    if (action === 'getTripPlace') {
      return respond({ place: await getPlace(inputSchemas.getTripPlace.parse(validated).refId, dependencies.mapKey) }, 200);
    }
    if (action === 'previewTripRoute') {
      return respond(await computeRoute(inputSchemas.previewTripRoute.parse(validated).stops, dependencies.mapKey), 200);
    }
    const saveInput = action === 'updateTrip' ? updateTripSchema.parse(validated) : tripInputSchema.parse(validated);
    validateStops(saveInput.stops);
    validateTimes(saveInput);
    // Gọi VietMap trước transaction SQL; tuyệt đối không nhận route từ trình duyệt.
    const calculated = await computeRoute(saveInput.stops, dependencies.mapKey);
    const saved = await dependencies.rpc('save_trip_route', { actor_id: user.id, input: saveInput, calculated });
    if (saved.error) throw databaseError(saved.error);
    return respond(saved.data, 200);
  } catch (error) {
    if (error instanceof z.ZodError) return respond({ error: { code: 'INVALID_INPUT', message: 'Dữ liệu chưa hợp lệ.' } }, 400);
    if (error instanceof TripError) return respond({ error: { code: error.code, message: error.message } }, error.status);
    // Lỗi ngoài dự kiến: log để tra cứu trên Dashboard, không trả chi tiết cho trình duyệt.
    console.error('[trips] unhandled', error instanceof Error ? error.name + ': ' + error.message : 'unknown');
    return respond({ error: { code: 'SERVER_ERROR', message: 'Không xử lý được yêu cầu. Vui lòng thử lại.' } }, 500);
  }
}
