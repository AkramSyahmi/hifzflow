# Setup

Everything needed to run HifzFlow locally with a working account system.

---

## 1. Install and run

Requires Node 20.11+ and pnpm 9+.

```bash
pnpm install
cp .env.example .env.local
```

The app will not start until `.env.local` has real Supabase values — `src/lib/env.ts`
validates them at load and throws with the exact variable that is wrong.

---

## 2. Create the Supabase project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and create a project.
   Pick the region closest to your users — `Southeast Asia (Singapore)` for a
   Malaysian audience.
2. Save the database password somewhere safe. It is shown once.
3. Open **Project Settings → API** and copy into `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
```

The anon key is public by design. It is safe in the browser **only** because
Row Level Security is enabled on every table. Never disable RLS, and never put
the service role key in a `NEXT_PUBLIC_` variable.

---

## 3. Apply the migration

**Option A — SQL editor (fastest).**
Open **SQL Editor → New query** and run each file in `supabase/migrations/`
**in filename order**, then run `supabase/seed/quran_reference.sql` last. The
seed is large — around 6,200 insert rows — so paste it as its own query.

**Option B — Supabase CLI (what you want now that there are several).**

```bash
pnpm dlx supabase login
pnpm dlx supabase link --project-ref <project-ref>
pnpm dlx supabase db push

# Seed the Quran reference data (once)
pnpm dlx supabase db execute --file supabase/seed/quran_reference.sql
```

### Verify it worked

Run this in the SQL editor. All three rows should come back.

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public' and tablename = 'profiles';
-- rowsecurity must be true

select policyname, cmd from pg_policies
where schemaname = 'public' and tablename = 'profiles';
-- profiles_select_own (SELECT), profiles_update_own (UPDATE)

select tgname from pg_trigger where tgname = 'on_auth_user_created';
-- the signup trigger
```

If `rowsecurity` is false, stop and fix it before creating any accounts.

### Verify the reference data

```sql
select
  (select count(*) from public.surahs)                          as surahs,       -- 114
  (select count(*) from public.ayahs)                           as ayahs,        -- 6236
  (select count(*) from public.mushaf_pages where edition_id=1) as pages;        -- 604

-- Ayat al-Kursi must resolve to 2:255 on Madani page 42.
select a.surah_number, a.ayah_number, p.page_number
from public.ayahs a
join public.mushaf_pages p on p.edition_id = 1 and p.ayah_range @> a.id
where a.id = 262;
```

If any count is short the seed was truncated on paste. Re-run it — the inserts
are idempotent, so running it twice is safe.

### Run the database test suite

Against a local PostgreSQL 15+ (not Supabase — the suite creates and drops its
own scratch database):

```bash
pnpm db:test
```

This applies every migration, verifies the seed checksum, loads the data, and
runs 230 assertions covering reference integrity, the write operations,
murajaah scheduling, activity, goals, analytics, account handling, rate limiting
and RLS isolation. Worth doing before pushing schema
changes.

---

## 4. Configure auth

**Authentication → URL Configuration**

| Field           | Local value                     | Production value                |
| --------------- | ------------------------------- | ------------------------------- |
| Site URL        | `http://localhost:3000`         | `https://your-domain.com`       |
| Redirect URLs   | `http://localhost:3000/auth/**` | `https://your-domain.com/auth/**` |

Both entries must be present once you deploy — the local one keeps development
working after go-live.

**Authentication → Providers → Email**

- Confirm email: **on**. The sign-up flow depends on it.

---

## 5. Google sign-in

1. In [Google Cloud Console](https://console.cloud.google.com), create a project.
2. **APIs & Services → OAuth consent screen** — External, fill in app name,
   support email and developer email.
3. **Credentials → Create credentials → OAuth client ID → Web application.**
4. Authorised redirect URI — this is Supabase's callback, not yours:

   ```
   https://<project-ref>.supabase.co/auth/v1/callback
   ```

5. Copy the client ID and secret into **Supabase → Authentication → Providers →
   Google**, and enable it.

The app's own `/auth/callback` route is where Supabase sends the user
afterwards. It is already covered by the `/auth/**` redirect rule in step 4.

---

## 6. Email templates

The default templates use a `{{ .ConfirmationURL }}` link that skips our route
handler. Update them under **Authentication → Email Templates** so the token
flows through `/auth/confirm`, which is what verifies it and creates the
session.

**Confirm signup**

```html
<h2>Confirm your email</h2>
<p>Open the link below to finish setting up your HifzFlow account.</p>
<p>
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup">
    Confirm my email
  </a>
</p>
<p>The link expires in 24 hours. If you did not sign up, ignore this email.</p>
```

**Reset password**

```html
<h2>Set a new password</h2>
<p>Open the link below to choose a new password.</p>
<p>
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">
    Set a new password
  </a>
</p>
<p>The link expires in one hour and can be used once.</p>
```

Supabase's built-in SMTP is rate limited to a handful of emails per hour and is
not for production. Connect a real provider (Resend, Postmark, SES) under
**Project Settings → Auth → SMTP Settings** before launch.

---

## 7. Run it

```bash
pnpm dev
```

### What to check

| Step | Expected |
| ---- | -------- |
| Visit `/dashboard` signed out | Redirected to `/sign-in?next=/dashboard` |
| Create an account | "Check your inbox" panel, no redirect |
| `profiles` table | New row with your name, timezone and locale |
| Open the confirmation email link | Lands on `/dashboard` with a confirmation banner |
| Dashboard timezone | Matches your machine, not UTC |
| Visit `/sign-in` while signed in | Redirected to `/dashboard` |
| Sign out from the avatar menu | Back to `/sign-in` |
| Forgot password with an unregistered address | Same success message as a real one |
| Sign in with Google | Profile row gets name and avatar from Google |

The timezone check is the one worth doing carefully. Every streak and daily
target in later milestones resolves against it, and if it silently defaults to
UTC the bug will not surface until someone's streak resets at 8am.

---

## Troubleshooting

**`Invalid public environment variables` on startup**
`.env.local` is missing or a value is malformed. The error names the variable.
Restart the dev server after editing — Next.js reads env at boot.

**Signed out immediately after signing in**
Middleware is not running. Confirm `src/middleware.ts` exists and that the path
you are visiting is not excluded by the matcher.

**No `profiles` row after signup**
The `on_auth_user_created` trigger did not fire. Re-run the migration and check
for errors; a partially applied migration can create the table without the
trigger.

**Google sign-in returns to `/sign-in?error=oauth`**
The redirect URI in Google Cloud must be Supabase's
`https://<project-ref>.supabase.co/auth/v1/callback`, not your app's URL. It is
the most common misconfiguration.

**Confirmation link says expired on first use**
Some corporate mail scanners fetch links before the recipient does, consuming
the single-use token. Request a fresh link, or use Google sign-in.
