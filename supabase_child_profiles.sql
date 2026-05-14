-- Child profile support for kids play bookings.
-- Run this in Supabase SQL Editor before enabling saved child profiles in production.

alter table public.bookings
  add column if not exists child_profile_id uuid;

create table if not exists public.child_profiles (
  id uuid primary key default gen_random_uuid(),
  line_user_id text,
  line_display_name text,
  nickname text not null,
  age text not null,
  gender text not null,
  address text,
  preferences text,
  personality text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists child_profiles_line_user_idx
  on public.child_profiles (line_user_id, created_at);

alter table public.child_profiles
  alter column line_user_id drop not null,
  alter column address drop not null,
  alter column preferences drop not null;

do $$ begin
  alter table public.bookings
    add constraint bookings_child_profile_id_fkey
    foreign key (child_profile_id)
    references public.child_profiles(id)
    on delete set null;
exception when duplicate_object then null;
end $$;

create table if not exists public.booking_child_profiles (
  booking_id uuid not null references public.bookings(id) on delete cascade,
  child_profile_id uuid not null references public.child_profiles(id) on delete cascade,
  position int not null default 1,
  created_at timestamptz not null default now(),
  primary key (booking_id, child_profile_id)
);

create index if not exists booking_child_profiles_child_idx
  on public.booking_child_profiles (child_profile_id);

alter table public.child_profiles enable row level security;
alter table public.booking_child_profiles enable row level security;

grant select, insert, update, delete on public.child_profiles to service_role;
grant select, insert, update, delete on public.booking_child_profiles to service_role;
