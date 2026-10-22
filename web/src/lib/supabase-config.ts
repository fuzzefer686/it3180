export function readSupabaseConfig(env: Record<string, string | undefined>, { allowLocal = true } = {}) {
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Thiếu cấu hình Supabase. Điền URL/key server vào web/.env.local hoặc biến môi trường Cloudflare Pages.');
  const parsed = new URL(url);
  const hostname = parsed.hostname.replace(/\.$/, '');
  const local = ['localhost', '0.0.0.0', '[::1]', '[::]'].includes(hostname) ||
    hostname.endsWith('.localhost') || /^127\./.test(hostname);
  if (local && !allowLocal) throw new Error('Bản build frontend phải dùng Supabase online qua HTTPS; không được trỏ tới localhost.');
  if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/' ||
    (!local && parsed.protocol !== 'https:') || !['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Supabase URL phải là origin HTTPS hoặc localhost.');
  }
  if (key.startsWith('sb_secret_')) throw new Error('Không được đưa secret key vào frontend.');
  // Legacy anon JWT vẫn được Supabase hỗ trợ; service_role tuyệt đối không dùng trong bundle.
  if (!key.startsWith('sb_publishable_')) {
    try {
      const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { role?: string };
      if (payload.role !== 'anon') throw new Error();
    } catch { throw new Error('Frontend chỉ dùng publishable key hoặc anon key.'); }
  }
  return { url: parsed.origin, key };
}
