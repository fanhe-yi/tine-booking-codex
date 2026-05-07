-- Public booking access for the single-page booking form.
-- Run this in Supabase SQL Editor after schema.sql.

grant usage on schema public to anon;

create or replace view public.public_busy_ranges
with (security_invoker = false)
as
select
  'booking'::text as kind,
  service,
  start_at,
  end_at
from public.bookings
where status = 'confirmed'
union all
select
  'blocked'::text as kind,
  null::service_type as service,
  start_at,
  end_at
from public.blocked_slots;

grant select on public.public_busy_ranges to anon;
grant insert on public.bookings to anon;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'bookings'
      and policyname = 'Allow public booking insert'
  ) then
    create policy "Allow public booking insert"
    on public.bookings
    for insert
    to anon
    with check (
      status = 'confirmed'
      and btrim(customer_name) <> ''
      and btrim(customer_phone) <> ''
      and start_at > now()
      and end_at > start_at
      and end_at <= start_at + interval '4 hours'
    );
  end if;
end $$;
