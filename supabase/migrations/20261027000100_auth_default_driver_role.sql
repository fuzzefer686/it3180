-- Demo: mọi tài khoản mặc định có USER + DRIVER và được xác minh cả hai.
-- Áp dụng sau 20261026000100_auth_default_verified.sql; không sửa migration cũ.
-- Trip/Booking vẫn kiểm tra ACTIVE, xác minh và thông tin xe trong RPC.
begin;

-- DRIVER là role mặc định, khác điều kiện được đăng chuyến (canDrive).
-- Giữ kiểm tra xác minh; chuyển kiểm tra xe về RPC Auth/Trip/Booking đang có.
-- Server nhóm từng thiếu CHECK này, nên hỗ trợ cả schema đó và baseline local.
alter table public.users drop constraint if exists users_driver_eligible;
alter table public.users add constraint users_driver_eligible check (
  not ('DRIVER' = any(roles)) or (
    student_verification_status = 'VERIFIED'
    and driver_verification_status = 'VERIFIED'
  )
);
alter table public.users alter column roles set default array['USER','DRIVER']::text[];

create or replace function private.create_auth_user_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.users (
    id, display_name, roles, status,
    student_verification_status, driver_verification_status, created_at
  ) values (
    new.id, 'Thành viên Về Cùng', array['USER','DRIVER']::text[], 'ACTIVE',
    'VERIFIED', 'VERIFIED', now()
  ) on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function private.create_auth_user_profile() from public, anon, authenticated;

-- Bù hồ sơ nếu Auth user đã tồn tại nhưng chưa có public.users.
-- Dùng default VERIFIED của migration trước, không tin Auth user_metadata.
insert into public.users(id) select id from auth.users on conflict (id) do nothing;

-- Giữ ADMIN, trạng thái LOCKED, thông tin hồ sơ và xe; không cấp ADMIN mới.
update public.users
set student_verification_status = 'VERIFIED', student_review_note = null,
    driver_verification_status = 'VERIFIED', driver_review_note = null,
    roles = array_append(array_remove(roles, 'DRIVER'), 'DRIVER')
where not ('DRIVER' = any(roles))
   or student_verification_status <> 'VERIFIED'
   or driver_verification_status <> 'VERIFIED';

-- Sửa/xóa thông tin xe không xóa role DRIVER mặc định.
-- Nếu admin chủ động từ chối xác minh sau migration, không tự khôi phục role.
create or replace function public.update_my_profile(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  current_user_row public.users := private.require_active_user(); result public.users;
  name_value text; phone_value text; school_value text; code_value text; evidence_value text;
  model_value text; plate_value text;
begin
  perform private.check_auth_input(input, array['displayName','phone','school','studentCode','studentEvidenceDemo','vehicleModel','vehiclePlate']);
  name_value := private.auth_text(input, 'displayName', 100);
  phone_value := private.auth_text(input, 'phone', 20);
  school_value := private.auth_text(input, 'school', 150);
  code_value := private.auth_text(input, 'studentCode', 50);
  evidence_value := private.auth_text(input, 'studentEvidenceDemo', 500);
  model_value := private.auth_text(input, 'vehicleModel', 100, true);
  plate_value := private.auth_text(input, 'vehiclePlate', 20, true);
  if phone_value !~ '^(0|\+84)[0-9]{9}$' or (model_value is null) <> (plate_value is null) then
    raise sqlstate 'PT400' using message = 'Invalid phone or vehicle';
  end if;
  update public.users set display_name = name_value, phone = phone_value, school = school_value,
    student_code = code_value, student_evidence_demo = evidence_value,
    vehicle_model = model_value, vehicle_plate = plate_value,
    roles = case when current_user_row.student_verification_status = 'VERIFIED'
      and current_user_row.driver_verification_status = 'VERIFIED'
      then array_append(array_remove(roles, 'DRIVER'), 'DRIVER')
      else array_remove(roles, 'DRIVER') end
  where id = current_user_row.id returning * into result;
  return private.auth_profile_json(result);
end;
$$;
revoke all on function public.update_my_profile(jsonb) from public, anon, authenticated;
grant execute on function public.update_my_profile(jsonb) to authenticated;

commit;
