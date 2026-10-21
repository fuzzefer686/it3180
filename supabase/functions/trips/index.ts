import { createClient } from '@supabase/supabase-js';
import { handleTripRequest } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL') ?? '';
const adminKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const admin = createClient(url, adminKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(request => handleTripRequest(request, {
  // getUser hỏi Auth server để xác minh token, không tin payload client tự giải mã.
  authenticate: async token => {
    const { data, error } = await admin.auth.getUser(token);
    return error ? null : data.user;
  },
  rpc: (name, args) => admin.rpc(name, args),
  mapKey: Deno.env.get('VIETMAP_REST_KEY') ?? '',
  allowedOrigins: (Deno.env.get('TRIPS_ALLOWED_ORIGINS') ?? 'http://127.0.0.1:5173,http://localhost:5173')
    .split(',').map(value => value.trim()).filter(Boolean),
}));
