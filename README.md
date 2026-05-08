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
   SOX_LINE_CHANNEL_ID
   SOX_LINE_CHANNEL_SECRET
   SOX_LINE_CHANNEL_ACCESS_TOKEN
   SOX_LINE_ADMIN_USER_ID
   NEXT_PUBLIC_SOX_LIFF_ID
   READING_LINE_CHANNEL_ID
   READING_LINE_CHANNEL_SECRET
   READING_LINE_CHANNEL_ACCESS_TOKEN
   READING_LINE_ADMIN_USER_ID
   NEXT_PUBLIC_READING_LIFF_ID
   CRON_SECRET
   ```

## Supabase SQL

Run `supabase_public_booking_access.sql` for public booking access, then run
`supabase_admin_access.sql` for server-side admin API access.

For LINE notification support, also run:

```bash
supabase_line_notifications.sql
```

## LINE Setup

This project uses two LINE official accounts:

- Ear-cleaning booking (`service = sox`)
- Kids-reading booking (`service = reading`)

Create one LIFF app for each official account:

- Ear-cleaning LIFF endpoint: `https://your-site.vercel.app/`
- Kids-reading LIFF endpoint: `https://your-site.vercel.app/kids-reading`

Set Messaging API webhook URLs:

- Ear-cleaning: `https://your-site.vercel.app/api/line/sox/webhook`
- Kids-reading: `https://your-site.vercel.app/api/line/reading/webhook`

Vercel Cron calls `/api/line/reminders` every day at 12:00 UTC, which is
20:00 in Taipei. Set `CRON_SECRET` in Vercel before enabling the cron job.
