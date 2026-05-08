-- LINE notification support for LIFF-origin bookings.
-- Run this in Supabase SQL Editor before enabling LINE LIFF links in production.

alter table public.bookings
  add column if not exists line_user_id text,
  add column if not exists line_display_name text,
  add column if not exists line_channel service_type,
  add column if not exists line_confirmed_at timestamptz,
  add column if not exists line_reminded_at timestamptz;

create table if not exists public.line_notification_settings (
  service service_type primary key,
  notify_customer_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.line_notification_settings (service, notify_customer_enabled)
values
  ('sox', true),
  ('reading', false)
on conflict (service) do nothing;

create index if not exists bookings_line_reminder_idx
on public.bookings (start_at)
where status = 'confirmed'
  and line_user_id is not null
  and line_reminded_at is null;

grant usage on schema public to service_role;
grant select, insert, update, delete on public.bookings to service_role;
grant select, insert, update, delete on public.line_notification_settings to service_role;
