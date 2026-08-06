# Deployment

Vercel and Supabase. Everything below assumes you have worked through
[`SETUP.md`](SETUP.md) locally first.

---

## 1. Production Supabase project

**Use a separate project from development.** Not a separate branch, a separate
project. Sharing one means a migration you are still testing is applied to real
users' data, and the first time that matters is the time it goes wrong.

Create it, then apply the schema in order:

```bash
pnpm dlx supabase link --project-ref <production-ref>
pnpm dlx supabase db push
pnpm dlx supabase db execute --file supabase/seed/quran_reference.sql
```

### Verify before going further

```sql
-- Every table must have RLS on. If any row says false, stop.
select tablename, rowsecurity
  from pg_tables
 where schemaname = 'public' and rowsecurity = false;

-- Every view must be security_invoker, or it bypasses RLS.
select c.relname
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'v'
   and coalesce(
     (select option_value from pg_options_to_table(c.reloptions)
       where option_name = 'security_invoker'), 'false') <> 'true';

-- Reference data must be complete.
select
  (select count(*) from surahs) as surahs,        -- 114
  (select count(*) from ayahs)  as ayahs,         -- 6236
  (select count(*) from mushaf_pages) as pages;   -- 604
```

Both of the first two queries should return **no rows**. The database test suite
asserts the same things, so a green `pnpm db:test` locally is good evidence — but
these run against the project that will actually hold user data.

### Auth configuration

**Authentication → URL Configuration**

| Field | Value |
| ----- | ----- |
| Site URL | `https://your-domain.com` |
| Redirect URLs | `https://your-domain.com/auth/**` |

Keep `http://localhost:3000/auth/**` in the list as well, or local development
stops working the moment you go live.

**Authentication → Providers → Google** — add a second authorised redirect URI
in Google Cloud for the production project:
`https://<production-ref>.supabase.co/auth/v1/callback`. The development one is
not reused.

**Email templates** — reapply the templates from `SETUP.md`. They do not carry
across projects, and the default template bypasses `/auth/confirm`, so
verification appears to work while failing to establish a session.

### SMTP

Supabase's built-in mailer is rate limited to a handful of messages per hour and
is explicitly not for production. Configure a real provider under **Project
Settings → Auth → SMTP Settings** before launch — Resend, Postmark and SES are
all fine. Without this, sign-ups fail silently once a small number of people try
on the same day.

### Hardening

- **Project Settings → Database → Connection pooling** — leave enabled. Serverless
  functions open a connection per invocation and will exhaust direct connections.
- **Project Settings → API → Exposed schemas** — `public` only. Remove anything
  else that has crept in.
- **Authentication → Sessions** — set a refresh token expiry that suits you;
  the default is generous.
- **Never expose the service role key.** It bypasses RLS entirely. In this
  codebase it is referenced in exactly one file,
  `src/app/api/cron/keepalive/route.ts`. If it appears anywhere else, that is a
  bug.

---

## 2. Vercel

```bash
pnpm dlx vercel link
pnpm dlx vercel --prod
```

Or connect the repository in the dashboard and let it deploy on push.

### Environment variables

Set these for **Production** and **Preview** separately. Preview deployments
pointing at the production database is the most common way a portfolio project
loses its own data.

| Variable | Value | Exposure |
| -------- | ----- | -------- |
| `NEXT_PUBLIC_SITE_URL` | `https://your-domain.com` | Public |
| `NEXT_PUBLIC_SUPABASE_URL` | Production project URL | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production anon key | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | Production service role key | **Server only** |
| `CRON_SECRET` | `openssl rand -base64 32` | **Server only** |

`src/lib/env.ts` validates the public variables at startup and throws with the
name of whichever one is wrong, so a typo fails the build rather than surfacing
as `undefined` in front of a user.

### Build settings

Defaults are correct. Install command `pnpm install`, build `pnpm build`. Do not
disable type checking or linting to get a deploy through — `next.config.ts` sets
both to fail the build deliberately, and a green build is the contract every
milestone was handed over against.

---

## 3. The free-tier pause problem

**Supabase pauses a free-tier project after seven days without database
activity.** For a portfolio project this is worse than it sounds: recruiters
visit sporadically, so the demo is asleep precisely when someone looks at it, and
the first visitor gets an error instead of the app.

`vercel.json` schedules `/api/cron/keepalive` twice a week. It runs a trivial
read against reference data and prunes stale rate-limit buckets while it is
there.

The endpoint **refuses every request without a valid `CRON_SECRET`**, which is
the intended failure mode — it holds the service role key and runs a privileged
prune, so an unauthenticated version of it would be a hole rather than a
convenience.

Verify it after the first deploy:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://your-domain.com/api/cron/keepalive
```

Expect `{"status":"ok","pinged":true,...}`. Vercel's Hobby plan allows a limited
number of cron invocations per day; twice a week is comfortably inside it.

If the project matters, the paid Supabase tier removes the problem entirely and
is the honest answer for anything with real users.

---

## 4. Content Security Policy

The policy is built per request in middleware, because it carries a nonce. See
`src/lib/security/csp.ts` — the two compromises it makes are documented there
rather than left for you to discover.

After deploying, confirm no violations in the browser console on:

- `/` and `/sign-in` — fonts and the theme script
- `/dashboard` — the heatmap SVG
- `/analytics` — Recharts, the most inline-style-heavy page
- `/settings` — the export download, which creates a `blob:` URL

A violation appears as `Refused to …` in the console. The likely causes are a
new third-party origin needing an entry in `connect-src`, or an inline script
added without the nonce.

---

## 5. Go-live checklist

Schema and data:

- [ ] Migrations applied in order to the production project
- [ ] Quran reference data seeded — 114 / 6,236 / 604
- [ ] RLS verification queries return no rows
- [ ] `pnpm db:test` passes locally against the same migration set

Auth:

- [ ] Site URL and redirect URLs set, localhost retained
- [ ] Google redirect URI added for the production project
- [ ] Email templates reapplied, pointing at `/auth/confirm`
- [ ] Real SMTP provider configured
- [ ] Sign-up, verify, sign-in, reset and Google all exercised end to end

Environment:

- [ ] Production and Preview variables set separately
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set as server-only
- [ ] `CRON_SECRET` set, and the keepalive endpoint returns `ok`

Application:

- [ ] `pnpm verify` passes
- [ ] Lighthouse: PWA installable, no console CSP violations
- [ ] Offline: load the app, disconnect, record a page, reconnect, confirm sync
- [ ] Rate limiting: submit a wrong password repeatedly and confirm the refusal
- [ ] Account deletion on a throwaway account, then confirm the rows are gone

---

## Rollback

Vercel keeps every deployment. **Promote to Production** on a previous one is
instant and needs no rebuild.

Database migrations are the part that does not roll back automatically. They are
append-only by convention for this reason: the two corrections in this project
(`0004` and `0010`) are forward migrations that fix earlier ones, not edits to
them. If a migration needs undoing, write the migration that undoes it.

Take a backup before applying anything you have not run locally first. On the
free tier that means **Database → Backups → Download**, since scheduled backups
are a paid feature.

---

## Monitoring

Not configured, and worth being clear about rather than implying otherwise.

What would go in first, roughly in order of value:

1. **Error reporting** — Sentry. `src/app/error.tsx` currently logs to the
   console and has a `// Replaced by the error reporting client` comment marking
   the spot.
2. **Uptime** — anything hitting `/api/health`, which is dependency-free
   precisely so it stays green when a downstream service is not.
3. **Analytics** — Vercel Analytics is one line and privacy-preserving.

Supabase's own dashboard covers slow queries and connection counts in the
meantime.
