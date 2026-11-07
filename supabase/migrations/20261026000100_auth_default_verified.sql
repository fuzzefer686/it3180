-- Mặc định xác minh sinh viên và tài xế cho mọi tài khoản (demo, không cần admin duyệt).
-- Ràng buộc users_driver_eligible của bảng users vẫn bắt buộc có loại xe + biển số khi
-- mang role DRIVER, nên role DRIVER được cấp tự động ngay khi hồ sơ có đủ hai thông tin xe.
-- Không sửa migration đã áp dụng trên server; đây là thay đổi mới.
begin;

-- 1. Tài khoản mới: đã xác minh sinh viên và tài xế ngay khi Auth tạo tài khoản.
create or replace function private.create_auth_user_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.users (
    id, display_name, roles, status,
    student_verification_status, driver_verification_status, created_at
  ) values (
    new.id, 'Thành viên Về Cùng', array['USER']::text[], 'ACTIVE',
    'VERIFIED', 'VERIFIED', now()
  ) on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.create_auth_user_profile() from public, anon, authenticated;

-- 2. Bootstrap trong get_my_profile chỉ insert id, nên đổi default cột để hồ sơ bù
--    sau này cũng không quay lại PENDING.
alter table public.users alter column student_verification_status set default 'VERIFIED';
alter table public.users alter column driver_verification_status set default 'VERIFIED';

-- 3. Tài khoản đã có: xác minh sẵn cả hai. Giữ nguyên status (LOCKED vẫn bị khóa),
--    các role khác như ADMIN, và chỉ cấp DRIVER cho hồ sơ đã có đủ thông tin xe.
--    Ghi chú duyệt cũ không còn đúng nên xóa khi trạng thái được đặt lại.
update public.users
set student_verification_status = 'VERIFIED',
    student_review_note = null,
    driver_verification_status = 'VERIFIED',
    driver_review_note = null,
    roles = case
      when vehicle_model is not null and length(btrim(vehicle_model)) > 0
        and vehicle_plate is not null and length(btrim(vehicle_plate)) > 0
        then array_append(array_remove(roles, 'DRIVER'), 'DRIVER')
      else array_remove(roles, 'DRIVER') end
where student_verification_status <> 'VERIFIED'
   or driver_verification_status <> 'VERIFIED'
   or ('DRIVER' = any(roles)) <> (
      vehicle_model is not null and length(btrim(vehicle_model)) > 0
      and vehicle_plate is not null and length(btrim(vehicle_plate)) > 0
   );

-- 4. Sửa hồ sơ: giữ trạng thái đã xác minh, chỉ cấp/thu role DRIVER theo thông tin xe
--    người dùng tự nhập. Vẫn là điều kiện của canDrive/require_eligible_user(true).
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
    roles = case when model_value is not null and plate_value is not null
      and current_user_row.student_verification_status = 'VERIFIED'
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
