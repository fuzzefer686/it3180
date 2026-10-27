import { afterEach, describe, expect, it, vi } from 'vitest';
import { tripInputSchema, listTripsSchema, validateStops, validateTimes } from '../../shared/trip-schemas';
import { computeRoute } from '../../supabase/functions/trips/vietmap';
import { handleTripRequest } from '../../supabase/functions/trips/handler';
import { decodeTripPolyline, encodeTripPolyline } from '../../shared/trip-polyline';

const stops = [
  { label: 'A', latitude: 21.01, longitude: 105.81 },
  { label: 'B', latitude: 21.02, longitude: 105.82 },
  { label: 'C', latitude: 21.03, longitude: 105.83 },
];
afterEach(() => vi.unstubAllGlobals());

describe('Trip trên Supabase', () => {
  it('gộp tọa độ thành polyline rồi đọc lại đúng cả tọa độ âm', () => {
    const points: [number, number][] = [[105.81, 21.01], [105.82, 21.02], [-120.2, 38.5]];
    expect(decodeTripPolyline(encodeTripPolyline(points))).toEqual(points);
  });
  it('không nhận uid, role, route hoặc khoảng cách do frontend gửi khi lưu', () => {
    const input = { stops, departureTimeMs: Date.now() + 60000, arrivalTimeMs: Date.now() + 120000, note: '' };
    expect(tripInputSchema.safeParse(input).success).toBe(true);
    for (const extra of [{ uid: 'other' }, { roles: ['ADMIN'] }, { route: {} }, { farePoints: 0 }]) {
      expect(tripInputSchema.safeParse({ ...input, ...extra }).success).toBe(false);
    }
    expect(listTripsSchema.safeParse({ date: '2026-02-30' }).success).toBe(false);
  });
  it('từ chối điểm liền nhau trùng và giờ đi đã qua', () => {
    expect(() => validateStops([stops[0], stops[0]])).toThrow();
    expect(() => validateTimes({ departureTimeMs: 1, arrivalTimeMs: 2 })).toThrow();
  });
  it('tính từng đoạn motorcycle, cộng khoảng cách và không gọi API khi thiếu key', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ code: 'OK', paths: [
      { distance: 1200, time: 90000, points_encoded: true, points: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' },
    ] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(computeRoute(stops, '')).rejects.toMatchObject({ code: 'MAP_NOT_CONFIGURED' });
    expect(fetchMock).not.toHaveBeenCalled();
    const result = await computeRoute(stops, 'test-only-key');
    expect(result.route.totalDistanceMeters).toBe(2400);
    expect(result.stops[2].distanceFromStartMeters).toBe(2400);
    expect(result.stops.every(stop => /^[0-9a-f-]{36}$/.test(stop.id))).toBe(true);
    expect(decodeTripPolyline(result.route.encodedPolyline)).toHaveLength(6);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get('vehicle')).toBe('motorcycle');
  });
  it('gọi các chặng VietMap song song và vẫn giữ đúng thứ tự chặng', async () => {
    let started = 0;
    let releaseGate: () => void = () => {};
    const gate = new Promise<void>(resolve => { releaseGate = resolve; });
    const fetchMock = vi.fn(async () => {
      const index = started++;
      await gate;
      return new Response(JSON.stringify({ code: 'OK', paths: [
        { distance: 1000 + index, time: 60000 + index, points_encoded: true, points: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' },
      ] }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const pending = computeRoute(stops, 'test-only-key');
    // Chặng sau phải được gọi trước khi chặng đầu trả về; gọi tuần tự sẽ dừng ở 1.
    await vi.waitFor(() => expect(started).toBe(2));
    releaseGate();
    const { route } = await pending;
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(route.segments.map(segment => segment.distanceMeters)).toEqual([1000, 1001]);
    expect(route.segments.map(segment => segment.durationMs)).toEqual([60000, 60001]);
    expect(route.totalDistanceMeters).toBe(2001);
    expect(route.totalDurationMs).toBe(120001);
  });
  it('không trả thành công giả hoặc tiết lộ key khi VietMap lỗi', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('URL contains secret-key')));
    await expect(computeRoute(stops, 'secret-key')).rejects.toMatchObject({ code: 'MAP_UNAVAILABLE' });
    try { await computeRoute(stops, 'secret-key'); } catch (error) {
      expect(String(error)).not.toContain('secret-key');
    }
  });
  it('phân biệt hết hạn mức, khoá bị từ chối và lỗi mạng; log không chứa khoá', async () => {
    const key = 'k9-hunter2';
    const logged: string[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      logged.push(args.map(value => String(value)).join(' '));
    });
    try {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"message":"quota"}', {
        status: 429, headers: { 'retry-after': '30' },
      })));
      await expect(computeRoute(stops, key)).rejects.toMatchObject({ code: 'MAP_QUOTA', status: 429 });
      await expect(computeRoute(stops, key)).rejects.toThrow('30 giây');

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 403 })));
      await expect(computeRoute(stops, key)).rejects.toMatchObject({ code: 'MAP_INVALID_KEY', status: 503 });

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{not-json', { status: 200 })));
      await expect(computeRoute(stops, key)).rejects.toMatchObject({ code: 'MAP_UNAVAILABLE' });

      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(
        new TypeError('connect failed https://maps.vietmap.vn/api/route/v4?apikey=' + key)));
      await expect(computeRoute(stops, key)).rejects.toMatchObject({ code: 'MAP_UNAVAILABLE' });

      const text = logged.join('\n');
      expect(text).toContain('[vietmap]');
      expect(text).toContain('[key]');
      expect(text).toContain('| query=');
      // Dấu vân tay giúp so khoá đang dùng với key thật mà không in khoá.
      expect(text).toContain('sha256=');
      expect(text).toContain('key len=10');
      expect(text).not.toContain(key);
    } finally {
      spy.mockRestore();
    }
  });
  it('Edge từ chối token thiếu/sai trước khi kiểm tra quyền hoặc gọi VietMap', async () => {
    const authenticate = vi.fn().mockResolvedValue(null);
    const rpc = vi.fn();
    const dependencies = { authenticate, rpc, mapKey: '', allowedOrigins: ['http://127.0.0.1:5173'] };
    for (const headers of [new Headers(), new Headers({ authorization: 'Bearer invalid-token' })]) {
      const response = await handleTripRequest(new Request('http://local/trips', {
        method: 'POST', headers, body: JSON.stringify({ action: 'previewTripRoute', input: { stops } }),
      }), dependencies);
      expect(response.status).toBe(401);
    }
    expect(rpc).not.toHaveBeenCalled();
  });
  it('Edge trả preflight cho origin preview và production đã cho phép', async () => {
    const origins = [
      'https://feat-3-trips-vietmap-supabas.it3180.pages.dev',
      'https://it3180.pages.dev',
    ];
    for (const origin of origins) {
      const response = await handleTripRequest(new Request('http://local/trips', {
        method: 'OPTIONS', headers: { origin, 'access-control-request-method': 'POST' },
      }), { authenticate: vi.fn(), rpc: vi.fn(), mapKey: '', allowedOrigins: origins });
      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(origin);
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    }
  });
  it('Edge không tin actor_id từ request và không nhận thao tác lạ', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: {}, error: null });
    const dependencies = { authenticate: vi.fn().mockResolvedValue({ id: 'verified-user' }), rpc,
      mapKey: '', allowedOrigins: ['http://127.0.0.1:5173'] };
    const response = await handleTripRequest(new Request('http://local/trips', {
      method: 'POST', headers: { authorization: 'Bearer test' },
      body: JSON.stringify({ action: 'createTrip', input: { actor_id: 'forged' } }),
    }), dependencies);
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('Edge lưu bằng uid đã xác minh và route do backend tự tính', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ code: 'OK', paths: [
      { distance: 1200.25, time: 90000, points_encoded: true, points: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' },
    ] })));
    vi.stubGlobal('fetch', fetchMock);
    const rpc = vi.fn().mockResolvedValue({ data: { trip: { id: 'saved' } }, error: null });
    const response = await handleTripRequest(new Request('http://local/trips', {
      method: 'POST', headers: { authorization: 'Bearer test' },
      body: JSON.stringify({ action: 'createTrip', input: {
        stops, departureTimeMs: Date.now() + 60000, arrivalTimeMs: Date.now() + 120000, note: '',
      } }),
    }), { authenticate: async () => ({ id: 'verified-user' }), rpc, mapKey: 'test-only', allowedOrigins: [] });
    expect(response.status).toBe(200);
    expect(rpc.mock.calls[0]).toEqual(['check_trip_access', { actor_id: 'verified-user', require_driver: true }]);
    expect(rpc.mock.calls[1][0]).toBe('save_trip_route');
    expect(rpc.mock.calls[1][1].actor_id).toBe('verified-user');
    expect(rpc.mock.calls[1][1].calculated.route.totalDistanceMeters).toBe(2400);
  });
  it('hồ sơ bị từ chối thì không gọi VietMap', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await handleTripRequest(new Request('http://local/trips', {
      method: 'POST', headers: { authorization: 'Bearer test' },
      body: JSON.stringify({ action: 'previewTripRoute', input: { stops } }),
    }), { authenticate: async () => ({ id: 'verified-user' }),
      rpc: async () => ({ data: null, error: { code: 'PT403' } }), mapKey: 'test-only', allowedOrigins: [] });
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('sửa chuyến đã bị xóa trả 404 và không lộ thông báo SQL', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 'OK', paths: [
      { distance: 1200, time: 90000, points_encoded: true, points: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' },
    ] }))));
    const rpc = vi.fn().mockResolvedValueOnce({ data: {}, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: 'PT404', message: 'internal SQL details' } });
    const response = await handleTripRequest(new Request('http://local/trips', {
      method: 'POST', headers: { authorization: 'Bearer test' },
      body: JSON.stringify({ action: 'updateTrip', input: { stops: stops.slice(0, 2),
        tripId: 'missing-trip', routeVersion: 1, departureTimeMs: Date.now() + 60000,
        arrivalTimeMs: Date.now() + 120000, note: '' } }),
    }), { authenticate: async () => ({ id: 'verified-user' }), rpc, mapKey: 'test-only', allowedOrigins: [] });
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { code: 'TRIP_NOT_FOUND' } });
  });
});
