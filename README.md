# HifzFlow

**Smart Quran memorisation and murajaah planner.**

Most huffaz manage memorisation in notebooks, spreadsheets and WhatsApp
messages. Most Quran apps are built for reading and listening, not for planning
and maintaining memorisation over months and years. HifzFlow is built for the
second problem.

---

## Status

**Complete.** Eleven milestones, 13 migrations, 143 unit tests and 230 SQL
assertions — including an RLS suite that runs against a real PostgreSQL instance
and found three bugs in code that had already been described as correct.

Start with the [case study](docs/CASE-STUDY.md) for the decisions and what the
tests caught. [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) covers going live.

See [`docs/SETUP.md`](docs/SETUP.md) for Supabase configuration and
[`docs/DATABASE.md`](docs/DATABASE.md) for the schema and its reasoning.

| #   | Milestone                         | Status      |
| --- | --------------------------------- | ----------- |
| 1   | Project initialisation            | Complete    |
| 2   | Authentication                    | Complete    |
| 3   | Database and Quran reference data | Complete    |
| 4   | Memorisation tracking             | Complete    |
| 5   | Murajaah scheduler                | Complete    |
| 6   | Dashboard                         | Complete    |
| 7   | Goals                             | Complete    |
| 8   | Analytics                         | Complete    |
| 9   | Settings and i18n                 | Complete    |
| 10  | PWA and offline                   | Complete    |
| 11  | Deployment and documentation      | Complete    |

---

## Stack

| Layer      | Choice                                     |
| ---------- | ------------------------------------------ |
| Framework  | Next.js 15 (App Router), React 19          |
| Language   | TypeScript, strict                         |
| Styling    | Tailwind CSS v4, shadcn/ui                 |
| Forms      | React Hook Form + Zod                      |
| Backend    | Supabase (PostgreSQL, Auth, RLS)           |
| Charts     | Recharts, plus a custom SVG heatmap        |
| Testing    | Vitest, Testing Library                    |
| Deployment | Vercel                                     |
| Tooling    | pnpm, ESLint 9 flat config, Prettier       |

---

## Getting started

**Requirements:** Node 20.11 or newer, pnpm 9 or newer.

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Accounts require a Supabase project. Follow
[`docs/SETUP.md`](docs/SETUP.md) first — it covers the migration, redirect
URLs, Google OAuth and the email templates.

**Public routes**

- `/` — landing page
- `/design-system` — every colour token, type role and component
- `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`
- `/api/health` — liveness JSON

**Protected routes**

- `/dashboard` — today's review, activity and progress
- `/memorisation` — the tracking grid and record form
- `/murajaah` — today's review, weak pages and the plan
- `/goals` — targets, required pace and projections
- `/analytics` — trends, strengths, weaknesses and consistency
- `/settings` — profile, language, theme, reminders, data and deletion

---

## Scripts

| Command            | Does                                            |
| ------------------ | ----------------------------------------------- |
| `pnpm dev`         | Development server                              |
| `pnpm build`       | Production build                                |
| `pnpm start`       | Serve the production build                      |
| `pnpm typecheck`   | `tsc --noEmit`                                  |
| `pnpm lint`        | ESLint                                          |
| `pnpm lint:fix`    | ESLint with autofix                             |
| `pnpm format`      | Prettier write                                  |
| `pnpm test`        | Vitest, single run                              |
| `pnpm test:watch`  | Vitest, watch mode                              |
| `pnpm verify`      | Typecheck, lint, format, seed checksum and tests |
| `pnpm db:test`     | Apply migrations and seed, run the SQL suite    |
| `pnpm quran:generate` | Regenerate the Quran reference seed          |
| `pnpm quran:verify`   | Check the seed against its checksum          |
| `pnpm icons:generate` | Rasterise the brand mark into PWA icons      |

`pnpm verify` is the gate. Every milestone is handed over green.

---

## Project structure

```
src/
├── app/                    Routes only — thin by design
│   ├── api/health/         Liveness endpoint
│   ├── design-system/      Living token and component reference
│   ├── globals.css         All design tokens, light and dark
│   ├── layout.tsx          Fonts, theme provider, metadata
│   ├── error.tsx           Root error boundary
│   ├── not-found.tsx       404
│   └── page.tsx            Landing page
├── features/               Vertical feature slices (see its README)
│   ├── auth/               Sign in, sign up, recovery, OAuth
│   ├── profile/            Profile record, timezone, locale
│   ├── quran/              Ayah index, ranges, mushaf editions
│   ├── memorisation/       Memorised ranges, tracking grid
│   ├── murajaah/           Review plans, daily queue, weak pages
│   ├── analytics/          Activity heatmap and consistency
│   ├── goals/              Targets, pace and projection
│   ├── settings/           Profile, language, reminders, account
│   └── offline/            Outbox, connection status, service worker
├── components/
│   ├── ui/                 shadcn/ui primitives
│   ├── providers/          Context providers
│   ├── brand/              Logo and brand marks
│   └── theme-toggle.tsx
├── i18n/                   Locale resolution (cookie + profile, no routing)
├── lib/                    Helpers, env validation, constants
├── hooks/                  Cross-feature client hooks
└── types/                  Cross-feature types
messages/
├── en.json                 English catalogue
└── ms.json                 Bahasa Malaysia catalogue
supabase/
├── migrations/             Versioned SQL, applied in order
├── seed/                   Generated Quran reference data + checksum
└── tests/                  SQL test suite, incl. RLS isolation
scripts/
├── generate-quran-reference.mjs
├── verify-quran-seed.mjs
└── db-test.sh
docs/
├── CASE-STUDY.md           The decisions, and what the tests caught
├── ARCHITECTURE.md         Every decision, numbered, with reasoning
├── DATABASE.md             Schema, constraints and the RLS model
├── API.md                  Every Server Action, RPC and route handler
├── SETUP.md                Supabase, OAuth and email configuration
└── DEPLOYMENT.md           Vercel, hardening and the go-live checklist
```

---

## Architectural decisions

The reasoning behind each is in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
In short:

1. **The ayah is the canonical unit.** Memorisation is stored as ranges over a
   global ayah index. Pages, surahs and juz' are derived views, so no two
   screens can disagree about what a user knows.
2. **Overlaps are impossible by constraint.** Segments use PostgreSQL range
   types with a GiST exclusion constraint, not application-level checks.
3. **Mushaf editions are data.** Page numbers mean nothing without an edition.
   Madani 604 is seeded; others are rows, not migrations.
4. **Murajaah is a cycle with a spaced-repetition overlay.** Pure SM-2 produces
   a scattered, unrecitable queue. The hybrid keeps contiguous review while
   still prioritising weak passages.
5. **Server-first state.** Server Components read, Server Actions mutate. No
   global client store.
6. **Authorisation lives in the database.** RLS policies scope every row to its
   owner, so a bug in application code cannot leak another user's data.
7. **Auth responses never reveal whether an account exists.** Sign-in, sign-up
   and password reset all respond identically for known and unknown addresses.
8. **Policies check ownership, not lifecycle.** A SELECT policy containing
   `deleted_at is null` makes soft delete impossible, because PostgreSQL
   validates the updated row against it. Filtering belongs in views and queries.
9. **Reference data is generated and checksummed**, never fetched at runtime.
10. **Multi-statement writes live in the database.** Gap-filling and segment
    splitting are PostgreSQL functions so they are atomic, and `SECURITY
    INVOKER` so RLS still applies to them.
11. **Murajaah is a contiguous rotation, not card-based SRS.** Huffaz recite in
    sequence; a card-optimal queue is unrecitable. Weak pages layer on top,
    capped so the rotation keeps moving.
12. **Every date is the user's own.** Queue dates and streaks resolve against
    the profile timezone, never the server clock.
13. **Goals project from observed pace.** Required pace is computed over what
    remains; the projection uses the last fortnight of recorded work. At zero
    pace there is no date, and the goal says so.
14. **Strength requires evidence.** Ratings are weighted toward recency, and
    pages with fewer than three reviews are excluded from the rankings rather
    than presented as strong.
15. **Locale by cookie and profile, not by route.** A `[locale]` segment would
    restructure every route for SEO benefits an authenticated tool does not
    need. Translation is incremental; a test asserts catalogue parity.
16. **Deletion is deletion.** `delete_my_account()` removes the auth row and
    cascades. No soft-delete fallback pretending to be one.
17. **The service worker never touches writes.** Only GET is cached. Offline
    writes go to an outbox in IndexedDB, replayed sequentially on reconnect.
    Replay is safe because the write functions were already idempotent.
18. **Rate limiting lives in PostgreSQL.** In-memory counters are useless on
    serverless; Redis is a service and two secrets for a handful of endpoints.
    Limited by identifier *and* IP, hashed so no PII is stored, failing open.
19. **CSP carries a per-request nonce**, generated in middleware because that is
    the only place that sees both the header and the scripts it authorises.

---

## Documentation

| Document | Contents |
| -------- | -------- |
| [CASE-STUDY.md](docs/CASE-STUDY.md) | The problem, the decisions, the three bugs the tests found |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | 29 numbered decisions with reasoning |
| [DATABASE.md](docs/DATABASE.md) | Schema, constraints, RLS model, test coverage |
| [API.md](docs/API.md) | Every Server Action, database function and route handler |
| [SETUP.md](docs/SETUP.md) | Local setup: Supabase, OAuth, email templates |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Vercel, production hardening, go-live checklist |

---

## Licence

MIT. The Quran reference data is derived from
[quran-meta](https://github.com/quran-center/quran-meta), also MIT.
