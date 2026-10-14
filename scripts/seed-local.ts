import { localSupabaseClients } from './local-supabase';
async function main() {
  const { admin, url, publicKey, options } = localSupabaseClients();
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(url, publicKey, options);
  const credentials = { email: 'user@vecung.test', password: '12345678' };
  const login = await client.auth.signInWithPassword(credentials);
  if (login.error) {
    const created = await admin.auth.admin.createUser({ ...credentials, email_confirm: true });
    if (created.error) throw created.error;
  } else await client.auth.signOut();
  console.log('Tài khoản Auth local: user@vecung.test / 12345678. Không tạo hồ sơ, quyền admin hoặc bảng ứng dụng.');
}
main().catch(() => { console.error('Không tạo được tài khoản mẫu. Kiểm tra Supabase local hoặc email đã tồn tại với mật khẩu khác.'); process.exitCode = 1; });
