-- Tạo hồ sơ ngay khi Auth tạo tài khoản, không phụ thuộc frontend có session.
-- Áp dụng sau khi đã có public.users theo schema Auth của nhóm.
-- Không sửa migration cũ đã được áp dụng trên server.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create function private.create_auth_user_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.users (
    id, display_name, roles, status,
    student_verification_status, driver_verification_status, created_at
  ) values (
    new.id, 'Thành viên Về Cùng', array['USER']::text[], 'ACTIVE',
    'PENDING', 'PENDING', now()
  ) on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.create_auth_user_profile() from public, anon, authenticated;

create trigger auth_create_app_profile
  after insert on auth.users
  for each row execute function private.create_auth_user_profile();

-- Bù hồ sơ còn thiếu cho tài khoản đã đăng ký trước khi trigger được triển khai.
-- Giữ nguyên hồ sơ, quyền và trạng thái hiện có, kể cả LOCKED/ADMIN/DRIVER.
insert into public.users (
  id, display_name, roles, status,
  student_verification_status, driver_verification_status, created_at
)
select id, 'Thành viên Về Cùng', array['USER']::text[], 'ACTIVE',
       'PENDING', 'PENDING', now()
from auth.users
on conflict (id) do nothing;
