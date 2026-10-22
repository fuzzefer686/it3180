import { z } from 'zod';
import type { RouteStop } from '../../../shared/contracts.ts';
import type { PlaceSuggestion, RouteSnapshot, TripStopInput } from '../../../shared/trips.ts';
import { decodeTripPolyline, encodeTripPolyline } from '../../../shared/trip-polyline.ts';
import { mapError, tripError } from '../../../shared/trip-errors.ts';
import { validateStops } from '../../../shared/trip-schemas.ts';

async function requestVietmap(path: string, params: URLSearchParams, key: string): Promise<unknown> {
  if (!key.trim()) throw tripError('Bản đồ chưa được cấu hình.', 'MAP_NOT_CONFIGURED');
  params.set('apikey', key.trim());
  const url = 'https://maps.vietmap.vn/api/' + path + '?' + params.toString();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(7000) });
    if (!response.ok) throw mapError();
    return await response.json();
  } catch {
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
  if (!result.success) throw mapError();
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
  if (!result.success) throw mapError();
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
export async function computeRoute(inputs: TripStopInput[], key: string): Promise<{ stops: RouteStop[]; route: RouteSnapshot }> {
  validateStops(inputs);
  if (!key.trim()) throw tripError('Bản đồ chưa được cấu hình.', 'MAP_NOT_CONFIGURED');
  const stops: RouteStop[] = [];
  const stopIds = inputs.map(() => crypto.randomUUID());
  const coordinates: [number, number][] = [];
  let totalDurationMs = 0;
  const route: RouteSnapshot = {
    provider: 'VIETMAP', vehicleType: 'MOTORCYCLE',
    encodedPolyline: '', segments: [], totalDistanceMeters: 0, totalDurationMs: 0,
  };
  // Tính từng cặp để quãng A -> C luôn đúng bằng AB + BC.
  for (let i = 0; i < inputs.length; i++) {
    const current = inputs[i];
    if (i > 0) {
      const previous = inputs[i - 1];
      const params = new URLSearchParams({ vehicle: 'motorcycle', points_encoded: 'true' });
      params.append('point', previous.latitude + ',' + previous.longitude);
      params.append('point', current.latitude + ',' + current.longitude);
      const data = await requestVietmap('route/v4', params, key);
      const result = routeSchema.safeParse(data);
      if (!result.success) throw mapError();
      const leg = result.data.paths[0];
      try {
        for (const coordinate of decodeTripPolyline(leg.points)) {
          coordinates.push(coordinate);
        }
      } catch {
        throw mapError();
      }
      // Schema nhóm dùng mét nguyên; làm tròn từng chặng rồi mới cộng dồn.
      const distanceMeters = Math.max(1, Math.round(leg.distance));
      route.segments.push({
        fromStopId: stopIds[i - 1], toStopId: stopIds[i],
        distanceMeters, durationMs: leg.time, encodedPolyline: leg.points,
      });
      route.totalDistanceMeters += distanceMeters;
      totalDurationMs += leg.time;
    }
    stops.push({
      id: stopIds[i], order: i, label: current.label,
      latitude: current.latitude, longitude: current.longitude,
      distanceFromStartMeters: route.totalDistanceMeters,
    });
  }
  route.encodedPolyline = encodeTripPolyline(coordinates);
  route.totalDurationMs = totalDurationMs;
  // Giới hạn kích thước tuyến để tránh lưu payload quá lớn.
  if (new TextEncoder().encode(JSON.stringify({ stops, route })).byteLength > 600000) {
    throw tripError('Tuyến quá dài để lưu. Vui lòng chia thành chuyến ngắn hơn.', 'ROUTE_TOO_LARGE');
  }
  return { stops, route };
}
