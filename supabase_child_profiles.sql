-- Child profile support for kids play bookings.
-- Run this in Supabase SQL Editor before enabling saved child profiles in production.

alter table public.bookings
  add column if not exists child_profile_id uuid;

create table if not exists public.child_profiles (
  id uuid primary key default gen_random_uuid(),
  line_user_id text not null,
  line_display_name text,
  nickname text not null,
  age text not null,
  gender text not null,
  address text not null,
  preferences text not null,
  personality text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists child_profiles_line_user_idx
  on public.child_profiles (line_user_id, created_at);

do $$ begin
  alter table public.bookings
    add constraint bookings_child_profile_id_fkey
    foreign key (child_profile_id)
    references public.child_profiles(id)
    on delete set null;
exception when duplicate_object then null;
end $$;

alter table public.child_profiles enable row level security;

grant select, insert, update, delete on public.child_profiles to service_role;
