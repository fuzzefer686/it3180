import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { getPlace, searchPlaces } from '../trips/vietmap.ts';
import { TripError } from '../../../shared/trip-errors.ts';

// Booking geocoding only: no route writes, no client REST key and no driver requirement.
const requestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('search'), text: z.string().trim().min(2).max(200) }).strict(),
  z.object({ action: z.literal('place'), refId: z.string().min(1).max(2000) }).strict(),
]);
const accessSchema = z.object({ allowed: z.literal(true) });
const allowedOrigins = (Deno.env.get('BOOKINGS_ALLOWED_ORIGINS')
  ?? 'http://127.0.0.1:5173,http://localhost:5173,https://it3180.pages.dev')
  .split(',').map(value => value.trim()).filter(Boolean);

Deno.serve(async request => {
  const origin = request.headers.get('origin');
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin', 'Cache-Control': 'no-store',
  };
  if (origin && allowedOrigins.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });
  const fail = (code: string, status: number) => reply({ error: { code } }, status);
  try {
    if (origin && !allowedOrigins.includes(origin)) return fail('ACCESS_DENIED', 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return fail('INVALID_INPUT', 405);
    const token = request.headers.get('authorization');
    if (!token?.startsWith('Bearer ')) return fail('AUTH_REQUIRED', 401);
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_ANON_KEY');
    if (!url || !key) return fail('SERVER_ERROR', 503);
    const client = createClient(url, key, {
      global: { headers: { Authorization: token } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    // Verify with Auth, then let the RPC check ACTIVE + current student eligibility.
    const verified = await client.auth.getUser(token.slice(7));
    if (verified.error || !verified.data.user) return fail('AUTH_REQUIRED', 401);
    const access = await client.rpc('check_booking_map_access', { input: {} });
    if (access.error) {
      if (['PT401', 'PGRST301', 'PGRST303'].includes(access.error.code)) return fail('AUTH_REQUIRED', 401);
      if (access.error.code === 'PGRST202') return fail('NOT_IMPLEMENTED', 503);
      if (access.error.code === 'PT412') return fail('PROFILE_REQUIRED', 412);
      if (['PT403', '42501'].includes(access.error.code)) return fail('ACCESS_DENIED', 403);
      console.error('[bookings] access', access.error.code);
      return fail('SERVER_ERROR', 500);
    }
    // Auth and the RPC must both authorize this request; an empty/mismatched
    // response from a different backend version must never unlock VietMap.
    if (!accessSchema.safeParse(access.data).success) return fail('SERVER_ERROR', 500);
    if (Number(request.headers.get('content-length') ?? 0) > 5000) return fail('INVALID_INPUT', 413);
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > 5000) return fail('INVALID_INPUT', 413);
    let data: unknown;
    try { data = JSON.parse(text); } catch { return fail('INVALID_INPUT', 400); }
    const input = requestSchema.parse(data);
    const mapKey = Deno.env.get('VIETMAP_REST_KEY') ?? '';
    if (input.action === 'search') return reply({ items: await searchPlaces(input.text, mapKey) });
    return reply({ place: await getPlace(input.refId, mapKey) });
  } catch (error) {
    if (error instanceof z.ZodError) return fail('INVALID_INPUT', 400);
    // Reused main VietMap helper now distinguishes invalid key and quota errors.
    if (error instanceof TripError) return fail(error.code, error.status);
    console.error('[bookings] unhandled', error instanceof Error ? error.name : 'unknown');
    return fail('SERVER_ERROR', 500);
  }
});
