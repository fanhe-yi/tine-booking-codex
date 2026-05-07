# 襪子先生預約

Next.js + TypeScript booking site with ear-cleaning and kids-reading booking pages,
a password-protected admin calendar, and Supabase storage.

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy environment variables:

   ```bash
   cp .env.example .env.local
   ```

3. Generate an admin password hash:

   ```bash
   npm run hash-admin-password
   ```

4. Fill `.env.local`, then run:

   ```bash
   npm run dev
   ```

## Netlify Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_PASSWORD_HASH`
- `ADMIN_SESSION_SECRET`

## Vercel Deployment

Recommended production hosting is Vercel Hobby with Supabase as the database.

1. Import `git@github.com:fanhe-yi/tine-booking-codex.git` into Vercel.
2. Use the default Next.js framework settings. `vercel.json` sets `npm run build`.
3. Set Production environment variables:

   ```text
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY
   ADMIN_PASSWORD_HASH
   ADMIN_SESSION_SECRET
   ```

## Supabase SQL

Run `supabase_public_booking_access.sql` for public booking access, then run
`supabase_admin_access.sql` for server-side admin API access.
