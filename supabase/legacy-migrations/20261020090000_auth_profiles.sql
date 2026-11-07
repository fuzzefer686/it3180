-- Bảng users theo thiết kế nhóm cung cấp ngày 20/10/2026.
-- Chỉ áp dụng local trước. Nếu server đã có users, lead cần đối chiếu baseline,
-- không chạy CREATE TABLE này lên server đã có bảng và không reset remote.
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Thành viên Về Cùng' check (length(btrim(display_name)) between 1 and 100),
  phone text check (phone ~ '^(0|\+84)[0-9]{9}$'),
  school text check (length(btrim(school)) between 1 and 150),
  student_code text check (length(btrim(student_code)) between 1 and 50),
  student_evidence_demo text check (length(btrim(student_evidence_demo)) between 1 and 500),
  roles text[] not null default array['USER']::text[]
    check (roles <@ array['USER','DRIVER','ADMIN']::text[] and roles @> array['USER']::text[]),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','LOCKED')),
  student_verification_status text not null default 'PENDING' check (student_verification_status in ('PENDING','VERIFIED','REJECTED')),
  student_review_note text check (length(student_review_note) <= 500),
  driver_verification_status text not null default 'PENDING' check (driver_verification_status in ('PENDING','VERIFIED','REJECTED')),
  driver_review_note text check (length(driver_review_note) <= 500),
  vehicle_model text check (length(btrim(vehicle_model)) between 1 and 100),
  vehicle_plate text check (length(btrim(vehicle_plate)) between 1 and 20),
  created_at timestamptz not null default now(),
  constraint vehicle_pair check ((vehicle_model is null) = (vehicle_plate is null))
);
alter table public.users enable row level security;
-- Không mở bảng chứa điện thoại/minh chứng cho client. Chỉ đọc/ghi qua RPC.
revoke all on public.users from public, anon, authenticated;
grant all on public.users to service_role;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create function private.auth_uid() returns uuid language plpgsql set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise sqlstate 'PT401' using message = 'Authentication required'; end if;
  return uid;
end;
$$;

create function private.check_auth_input(input jsonb, allowed text[]) returns void
language plpgsql set search_path = '' as $$
begin
  if input is null or jsonb_typeof(input) <> 'object' then
    raise sqlstate 'PT400' using message = 'Invalid input';
  end if;
  if exists (select 1 from jsonb_object_keys(input) as k(key) where not (key = any(allowed))) then
    raise sqlstate 'PT400' using message = 'Unknown input field';
  end if;
end;
$$;

create function private.auth_text(input jsonb, field text, max_length int, optional boolean default false)
returns text language plpgsql set search_path = '' as $$
declare value text;
begin
  if optional and (not (input ? field) or input->field = 'null'::jsonb) then return null; end if;
  if jsonb_typeof(input->field) is distinct from 'string' then
    raise sqlstate 'PT400' using message = 'Text field required';
  end if;
  value := btrim(input->>field);
  if length(value) < 1 or length(value) > max_length then
    raise sqlstate 'PT400' using message = 'Invalid text length';
  end if;
  return value;
end;
$$;

create function private.auth_target(input jsonb) returns uuid language plpgsql set search_path = '' as $$
begin
  return private.auth_text(input, 'uid', 36)::uuid;
exception when invalid_text_representation then
  raise sqlstate 'PT400' using message = 'Invalid user ID';
end;
$$;

create function private.require_active_user() returns public.users
language plpgsql set search_path = '' as $$
declare result public.users;
begin
  select * into result from public.users where id = private.auth_uid() for update;
  if not found then raise sqlstate 'PT412' using message = 'Profile required'; end if;
  if result.status <> 'ACTIVE' then raise sqlstate 'PT403' using message = 'Account locked'; end if;
  return result;
end;
$$;

-- Module Trip/Booking gọi helper này BÊN TRONG RPC để kiểm tra dữ liệu hiện tại.
-- Khóa dòng giữ việc kiểm tra ACTIVE và thao tác nghiệp vụ trong cùng transaction.
create function private.require_eligible_user(as_driver boolean default false) returns public.users
language plpgsql set search_path = '' as $$
declare result public.users := private.require_active_user();
begin
  if result.student_verification_status <> 'VERIFIED' or
    (as_driver and (not ('DRIVER' = any(result.roles)) or result.driver_verification_status <> 'VERIFIED'
      or result.vehicle_model is null or result.vehicle_plate is null)) then
    raise sqlstate 'PT403' using message = 'Not eligible';
  end if;
  return result;
end;
$$;

create function private.require_auth_admin() returns uuid language plpgsql set search_path = '' as $$
declare result public.users := private.require_active_user();
begin
  if not ('ADMIN' = any(result.roles)) then raise sqlstate 'PT403' using message = 'Admin required'; end if;
  return result.id;
end;
$$;

create function private.auth_profile_json(u public.users) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'uid', u.id, 'displayName', u.display_name, 'roles', u.roles, 'status', u.status,
    'phone', u.phone, 'school', u.school, 'studentCode', u.student_code,
    'studentEvidenceDemo', u.student_evidence_demo, 'studentReviewNote', u.student_review_note,
    'studentVerificationStatus', u.student_verification_status,
    'driverVerificationStatus', u.driver_verification_status, 'driverReviewNote', u.driver_review_note,
    'vehicleModel', u.vehicle_model, 'vehiclePlate', u.vehicle_plate,
    'eligibility', jsonb_build_object(
      'canBook', u.status = 'ACTIVE' and u.student_verification_status = 'VERIFIED',
      'canDrive', u.status = 'ACTIVE' and u.student_verification_status = 'VERIFIED'
        and u.driver_verification_status = 'VERIFIED' and 'DRIVER' = any(u.roles)
        and u.vehicle_model is not null and u.vehicle_plate is not null)
  );
$$;

create function public.get_my_profile(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.auth_uid(); result public.users;
begin
  perform private.check_auth_input(input, array[]::text[]);
  -- Bootstrap idempotent: gọi lại không đặt lại quyền, trạng thái hoặc hồ sơ.
  insert into public.users(id) values (uid) on conflict (id) do nothing;
  select * into strict result from public.users where id = uid;
  return private.auth_profile_json(result);
end;
$$;

create function public.update_my_profile(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  current_user_row public.users := private.require_active_user(); result public.users;
  name_value text; phone_value text; school_value text; code_value text; evidence_value text;
  model_value text; plate_value text; student_changed boolean; driver_changed boolean;
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
  student_changed := row(current_user_row.school, current_user_row.student_code, current_user_row.student_evidence_demo)
    is distinct from row(school_value, code_value, evidence_value);
  driver_changed := student_changed or row(current_user_row.vehicle_model, current_user_row.vehicle_plate)
    is distinct from row(model_value, plate_value);
  update public.users set display_name = name_value, phone = phone_value, school = school_value,
    student_code = code_value, student_evidence_demo = evidence_value, vehicle_model = model_value, vehicle_plate = plate_value,
    student_verification_status = case when student_changed then 'PENDING' else student_verification_status end,
    student_review_note = case when student_changed then null else student_review_note end,
    driver_verification_status = case when driver_changed then 'PENDING' else driver_verification_status end,
    driver_review_note = case when driver_changed then null else driver_review_note end,
    roles = case when driver_changed then array_remove(roles, 'DRIVER') else roles end
  where id = current_user_row.id returning * into result;
  return private.auth_profile_json(result);
end;
$$;

create function public.admin_list_users(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare page_value int; result jsonb; total bigint;
begin
  perform private.require_auth_admin();
  perform private.check_auth_input(input, array['page']);
  if jsonb_typeof(input->'page') is distinct from 'number' or (input->>'page') !~ '^[0-9]{1,5}$' then
    raise sqlstate 'PT400' using message = 'Invalid page';
  end if;
  page_value := (input->>'page')::int;
  if page_value < 1 or page_value > 10000 then raise sqlstate 'PT400' using message = 'Invalid page'; end if;
  select count(*) into total from public.users;
  select coalesce(jsonb_agg(private.auth_profile_json(u::public.users) order by u.created_at, u.id), '[]'::jsonb) into result
  from (select * from public.users order by created_at, id limit 20 offset ((page_value - 1) * 20)) u;
  return jsonb_build_object('users', result, 'total', total);
end;
$$;

create function public.admin_review_user(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare target uuid; kind_value text; decision_value text; reason_value text; result public.users;
begin
  perform private.require_auth_admin();
  perform private.check_auth_input(input, array['uid','kind','decision','reason']);
  target := private.auth_target(input);
  kind_value := private.auth_text(input, 'kind', 7);
  decision_value := private.auth_text(input, 'decision', 8);
  if jsonb_typeof(input->'reason') is distinct from 'string' then raise sqlstate 'PT400' using message = 'Reason required'; end if;
  reason_value := nullif(btrim(input->>'reason'), '');
  if kind_value not in ('STUDENT','DRIVER') or decision_value not in ('VERIFIED','REJECTED')
    or length(reason_value) > 500 or (decision_value = 'REJECTED' and reason_value is null) then
    raise sqlstate 'PT400' using message = 'Invalid review';
  end if;
  select * into result from public.users where id = target for update;
  if not found then raise sqlstate 'PT412' using message = 'Profile required'; end if;
  if decision_value = 'VERIFIED' and (result.status <> 'ACTIVE' or result.phone is null or result.school is null
    or result.student_code is null or result.student_evidence_demo is null
    or (kind_value = 'DRIVER' and (result.student_verification_status <> 'VERIFIED'
      or result.vehicle_model is null or result.vehicle_plate is null))) then
    raise sqlstate 'PT409' using message = 'Profile not ready for approval';
  end if;
  if kind_value = 'STUDENT' then
    update public.users set student_verification_status = decision_value, student_review_note = reason_value,
      roles = case when decision_value = 'REJECTED' then array_remove(roles, 'DRIVER') else roles end,
      driver_verification_status = case when decision_value = 'REJECTED' then 'PENDING' else driver_verification_status end,
      driver_review_note = case when decision_value = 'REJECTED' then null else driver_review_note end
    where id = target returning * into result;
  else
    update public.users set driver_verification_status = decision_value, driver_review_note = reason_value,
      roles = case when decision_value = 'VERIFIED' then array_append(array_remove(roles, 'DRIVER'), 'DRIVER')
        else array_remove(roles, 'DRIVER') end
    where id = target returning * into result;
  end if;
  return private.auth_profile_json(result);
end;
$$;

create function public.admin_set_user_status(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.require_auth_admin(); target uuid; status_value text; result public.users;
begin
  perform private.check_auth_input(input, array['uid','status']);
  target := private.auth_target(input);
  status_value := private.auth_text(input, 'status', 6);
  if status_value not in ('ACTIVE','LOCKED') then raise sqlstate 'PT400' using message = 'Invalid status'; end if;
  if target = actor and status_value = 'LOCKED' then raise sqlstate 'PT409' using message = 'Cannot lock yourself'; end if;
  update public.users set status = status_value where id = target returning * into result;
  if not found then raise sqlstate 'PT412' using message = 'Profile required'; end if;
  return private.auth_profile_json(result);
end;
$$;

revoke all on function private.auth_uid(), private.check_auth_input(jsonb,text[]),
  private.auth_text(jsonb,text,int,boolean), private.auth_target(jsonb), private.require_active_user(),
  private.require_eligible_user(boolean), private.require_auth_admin(), private.auth_profile_json(public.users)
  from public, anon, authenticated;
revoke all on function public.get_my_profile(jsonb), public.update_my_profile(jsonb),
  public.admin_list_users(jsonb), public.admin_review_user(jsonb), public.admin_set_user_status(jsonb)
  from public, anon, authenticated;
grant execute on function public.get_my_profile(jsonb), public.update_my_profile(jsonb),
  public.admin_list_users(jsonb), public.admin_review_user(jsonb), public.admin_set_user_status(jsonb)
  to authenticated;
