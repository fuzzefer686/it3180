import { z } from 'zod';
import type { RouteStop } from '../../../shared/contracts.ts';
import type { PlaceSuggestion, RouteSnapshot, TripStopInput } from '../../../shared/trips.ts';
import { decodeTripPolyline, encodeTripPolyline } from '../../../shared/trip-polyline.ts';
import { mapError, mapKeyError, mapQuotaError, tripError } from '../../../shared/trip-errors.ts';
import { validateStops } from '../../../shared/trip-schemas.ts';

// Ghi log nguyên nhân thật để Dashboard Logs chỉ ra được lỗi, nhưng không bao giờ ghi URL/khoá.
function logVietmapFailure(kind: string, path: string, detail: string, key: string): void {
  const secret = key.trim();
  const safe = (secret ? detail.split(secret).join('[key]') : detail).slice(0, 300);
  console.error('[vietmap]', kind, path, safe);
}

async function requestVietmap(path: string, params: URLSearchParams, key: string): Promise<unknown> {
  if (!key.trim()) throw tripError('Bản đồ chưa được cấu hình.', 'MAP_NOT_CONFIGURED');
  params.set('apikey', key.trim());
  const url = 'https://maps.vietmap.vn/api/' + path + '?' + params.toString();
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(7000) });
  } catch (error) {
    // Timeout, DNS, TLS hoặc mất kết nối: thông điệp có thể chứa URL nên phải lọc khoá trước khi log.
    const name = error instanceof Error ? error.name : 'Error';
    const message = error instanceof Error ? error.message : String(error);
    logVietmapFailure('fetch', path, name + ': ' + message, key);
    throw mapError();
  }
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    logVietmapFailure('http', path, response.status + ' ' + body, key);
    if (response.status === 401 || response.status === 403) throw mapKeyError();
    if (response.status === 429) {
      throw mapQuotaError(Number(response.headers.get('retry-after')) || null);
    }
    throw mapError();
  }
  try {
    return await response.json();
  } catch (error) {
    logVietmapFailure('json', path, error instanceof Error ? error.message : String(error), key);
    throw mapError();
  }
}
const suggestionSchema = z.object({
  ref_id: z.string().min(1),
  display: z.string().min(1).max(300),
});
export async function searchPlaces(text: string, key: string): Promise<PlaceSuggestion[]> {
  const params = new URLSearchParams({ text, display_type: '1' });
  const data = await requestVietmap('autocomplete/v4', params, key);
  const result = z.array(suggestionSchema).safeParse(data);
  if (!result.success) {
    logVietmapFailure('schema', 'autocomplete/v4', JSON.stringify(data).slice(0, 200), key);
    throw mapError();
  }
  const items: PlaceSuggestion[] = [];
  for (const item of result.data.slice(0, 10)) {
    items.push({ refId: item.ref_id, label: item.display });
  }
  return items;
}
const placeSchema = z.object({
  display: z.string().min(1).max(300),
  lat: z.number().min(8).max(24),
  lng: z.number().min(102).max(110),
});
export async function getPlace(refId: string, key: string): Promise<TripStopInput> {
  const data = await requestVietmap('place/v4', new URLSearchParams({ refid: refId }), key);
  const result = placeSchema.safeParse(data);
  if (!result.success) {
    logVietmapFailure('schema', 'place/v4', JSON.stringify(data).slice(0, 200), key);
    throw mapError();
  }
  return { label: result.data.display, latitude: result.data.lat, longitude: result.data.lng };
}
const routeSchema = z.object({
  code: z.literal('OK'),
  paths: z.array(z.object({
    distance: z.number().positive().finite(),
    time: z.number().nonnegative().finite(),
    points_encoded: z.literal(true),
    points: z.string().min(1).max(80000),
  })).min(1),
});
interface RouteLeg {
  distanceMeters: number;
  durationMs: number;
  encodedPolyline: string;
  coordinates: [number, number][];
}
async function requestLeg(previous: TripStopInput, current: TripStopInput, key: string): Promise<RouteLeg> {
  const params = new URLSearchParams({ vehicle: 'motorcycle', points_encoded: 'true' });
  params.append('point', previous.latitude + ',' + previous.longitude);
  params.append('point', current.latitude + ',' + current.longitude);
  const data = await requestVietmap('route/v4', params, key);
  const result = routeSchema.safeParse(data);
  if (!result.success) {
    // Chỉ log tên field sai; body route chứa polyline rất dài nên không log toàn bộ.
    logVietmapFailure('schema', 'route/v4',
      result.error.issues.map(issue => issue.path.join('.') + ': ' + issue.message).join('; '), key);
    throw mapError();
  }
  const leg = result.data.paths[0];
  let coordinates: [number, number][];
  try {
    coordinates = decodeTripPolyline(leg.points);
  } catch {
    logVietmapFailure('polyline', 'route/v4', 'không giải mã được points', key);
    throw mapError();
  }
  return {
    // Schema nhóm dùng mét nguyên; làm tròn từng chặng rồi mới cộng dồn.
    distanceMeters: Math.max(1, Math.round(leg.distance)),
    durationMs: leg.time,
    encodedPolyline: leg.points,
    coordinates,
  };
}

export async function computeRoute(inputs: TripStopInput[], key: string): Promise<{ stops: RouteStop[]; route: RouteSnapshot }> {
  validateStops(inputs);
  if (!key.trim()) throw tripError('Bản đồ chưa được cấu hình.', 'MAP_NOT_CONFIGURED');
  const stops: RouteStop[] = [];
  const stopIds = inputs.map(() => crypto.randomUUID());
  // Mỗi chặng độc lập nhau nên gọi VietMap song song; 8 điểm không phải chờ 7 lần nối tiếp.
  const legs = await Promise.all(
    inputs.slice(1).map((current, index) => requestLeg(inputs[index], current, key)),
  );
  const coordinates: [number, number][] = [];
  const segments: RouteSnapshot['segments'] = [];
  let totalDistanceMeters = 0;
  let totalDurationMs = 0;
  // Tính từng cặp để quãng A -> C luôn đúng bằng AB + BC.
  for (let i = 0; i < inputs.length; i++) {
    if (i > 0) {
      const leg = legs[i - 1];
      for (const coordinate of leg.coordinates) coordinates.push(coordinate);
      segments.push({
        fromStopId: stopIds[i - 1], toStopId: stopIds[i],
        distanceMeters: leg.distanceMeters, durationMs: leg.durationMs, encodedPolyline: leg.encodedPolyline,
      });
      totalDistanceMeters += leg.distanceMeters;
      totalDurationMs += leg.durationMs;
    }
    stops.push({
      id: stopIds[i], order: i, label: inputs[i].label,
      latitude: inputs[i].latitude, longitude: inputs[i].longitude,
      distanceFromStartMeters: totalDistanceMeters,
    });
  }
  const route: RouteSnapshot = {
    provider: 'VIETMAP', vehicleType: 'MOTORCYCLE',
    encodedPolyline: encodeTripPolyline(coordinates),
    segments, totalDistanceMeters, totalDurationMs,
  };
  // Giới hạn kích thước tuyến để tránh lưu payload quá lớn.
  if (new TextEncoder().encode(JSON.stringify({ stops, route })).byteLength > 600000) {
    throw tripError('Tuyến quá dài để lưu. Vui lòng chia thành chuyến ngắn hơn.', 'ROUTE_TOO_LARGE');
  }
  return { stops, route };
}
