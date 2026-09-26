-- Initial relational schema for the HMC expenses and attendance app.
-- Apply only to a new Supabase project after reviewing the deployment guide.
create extension if not exists pgcrypto;

create table if not exists public.app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  email text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_date date not null,
  person text not null,
  type text not null check (type in ('aporte', 'gasto', 'reintegro', 'cuota_jueves')),
  amount numeric(14,2) not null check (amount >= 0),
  concept text not null,
  created_at timestamptz not null default now()
);
create index if not exists transactions_date_idx on public.transactions (transaction_date desc);
create index if not exists transactions_person_idx on public.transactions (person);
create index if not exists transactions_type_idx on public.transactions (type);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  attendance_date date not null,
  event text not null default 'Reunión General',
  member_name text not null,
  status text not null check (status in ('presente', 'ausente')),
  created_at timestamptz not null default now(),
  unique (attendance_date, event, member_name)
);
create index if not exists attendance_date_event_idx on public.attendance (attendance_date desc, event);

-- The existing app has a shared, client-side login, not individual identities.
-- Keep all tables inaccessible from the public API until Supabase Auth and
-- per-user authorization have been designed and enabled deliberately.
alter table public.members enable row level security;
alter table public.transactions enable row level security;
alter table public.attendance enable row level security;
alter table public.app_users enable row level security;

revoke all on public.app_users, public.members, public.transactions, public.attendance from anon, authenticated;

-- User creation is intentionally an operator action; never expose account
-- provisioning through the public API.
create or replace function public.create_app_user(p_username text, p_email text, p_password text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_user_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'not allowed';
  end if;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', p_email, crypt(p_password, gen_salt('bf')), now(), now(), now())
  returning id into new_user_id;
  insert into public.app_users (id, username, email) values (new_user_id, p_username, p_email);
  return new_user_id;
end;
$$;
revoke all on function public.create_app_user(text, text, text) from public, anon, authenticated;
grant execute on function public.create_app_user(text, text, text) to service_role;

create or replace function public.save_attendance(p_date date, p_event text, p_records jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.attendance where attendance_date = p_date and event = p_event;
  insert into public.attendance (attendance_date, event, member_name, status)
  select p_date, p_event, record->>'member_name', record->>'status'
  from jsonb_array_elements(p_records) as record;
end;
$$;
revoke all on function public.save_attendance(date, text, jsonb) from public, anon, authenticated;
grant execute on function public.save_attendance(date, text, jsonb) to service_role;
