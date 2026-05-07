-- Server-side admin support for the Next.js/Netlify version.
-- Keep customer data private: do not grant anon select on public.bookings.
-- The Next.js API routes should use SUPABASE_SERVICE_ROLE_KEY on the server.

grant usage on schema public to service_role;
grant select, insert, update, delete on public.bookings to service_role;
grant select, insert, update, delete on public.blocked_slots to service_role;

-- Optional, only if blocked_slots uses an identity/serial id and grants are needed.
grant usage, select on all sequences in schema public to service_role;

-- Frontend public access remains in supabase_public_booking_access.sql:
-- - anon can select public_busy_ranges
-- - anon can insert confirmed bookings under the RLS policy
