# HifzFlow — case study

A Quran memorisation planner. Eleven milestones, built as a portfolio project,
with every architectural decision recorded at the point it was made rather than
reconstructed afterwards.

The short version of what makes it worth reading: **the test suite found three
real bugs in code I had already described as correct.** Two of them were security
claims that were quietly doing nothing. That is the part of this project I would
actually want to be judged on.

---

## The problem

Huffaz — people who have memorised the Quran, or are working toward it — manage
that work in notebooks, spreadsheets and WhatsApp messages. Memorisation is the
easier half. Keeping it is the hard half: 6,236 ayahs, reviewed on a rotation,
for the rest of your life.

Existing Quran apps are built for reading, listening and recitation checking.
Very few are built for **planning and maintaining memorisation over years**,
which is a different problem with a different shape.

---

## The decision that everything else rests on

Track by page, or by surah, or by juz'?

The brief asked for all six units: page, surah, juz', hizb, rub' al-hizb and
maqra'. The obvious implementation is a counter per unit. It is also wrong, and
wrong in a way that only shows up months later.

A page can begin mid-surah. A juz' can begin mid-page. So independent counters
drift apart, and when two screens disagree there is no principled way to decide
which is right.

**So there is one canonical unit — the ayah — and everything else is a view over
it.**

```sql
memorisation_segments (
  user_id     uuid,
  ayah_range  int4range,          -- over a global index, 1..6236
  ...
  exclude using gist (user_id with =, ayah_range with &&)
    where (deleted_at is null)
)
```

Two things follow from that shape:

**Overlapping records are impossible.** Not validated against — *impossible*,
enforced by the database, unbypassable by any future refactor of application
code. The `where` clause is what lets soft delete work: a removed range can be
recorded again because deleted rows fall outside the constraint.

**Someone who has memorised Juz' 30 has one row, not 564.** Ranges compose:
"which page is this ayah on" and "how much of this surah do I know" are both
index-backed range queries rather than aggregations over thousands of rows.

The related call: **maqra' is not a canonical unit.** Juz', hizb and rub' are
fixed and universal. Maqra' varies by institution and by teacher, so hard-coding
one madrasah's convention would make every other user's records wrong. It is
modelled as user-owned data layered on the same index — which also gives the
future halaqah feature most of what it needs without a schema change.

---

## Where the domain knowledge mattered more than the engineering

Spaced repetition is the obvious answer for review scheduling. SM-2 is
well-understood, easy to implement, and demonstrably effective.

It is also unusable here.

SRS assumes independent atomic cards. Huffaz recite **contiguous blocks** —
because recitation flows, and because that is how it is taught. A card-optimal
scheduler produces a queue like *page 12, page 340, page 89*: mathematically
sound and physically impossible to recite.

So the scheduler follows the structure tahfiz institutions already use:

| Tier | Meaning |
| ---- | ------- |
| **Sabqi** | Recent memorisation, still consolidating |
| **Manzil** | Everything older, cycled continuously |
| **Weak** | Last rated at or below threshold, pulled forward |

The manzil rotation advances through a **stored cursor**, so each day's pages are
consecutive and can be recited in sequence. One `ORDER BY` does the work:

```sql
order by case when page_number >= cursor then 0 else 1 end, page_number
```

Cursor-onward first, then wrap. That is what turns a set of pages into a
rotation.

Two decisions inside that are worth more than the algorithm:

**Weak pages are capped at a third of the daily budget.** Without the cap,
someone with fifty weak pages sees nothing but weak pages every day, forever, and
the rotation silently stops being a rotation. That is a product decision wearing a
technical hat — the difference between a scheduler that helps and one that traps
you.

**Only fully memorised pages are scheduled.** Reviewing half a page is a
different activity, and counting partials would make the daily number dishonest.

---

## Three bugs the tests found

This is the section I would read first if someone handed me this project.

### 1. The soft-delete policy forbade soft delete

Milestone 2, `profiles`:

```sql
using (id = auth.uid() and deleted_at is null)   -- looks obviously right
```

PostgreSQL validates the *updated* row against the SELECT policy during an
UPDATE. The moment `deleted_at` is set, the row stops satisfying the policy and
the statement is rejected.

**The policy forbade the exact operation it existed to support.** Soft delete was
impossible, and nothing would have surfaced that until someone tried to delete
their account — probably months later, in production.

The fix is a principle, not a patch: **policies answer "is this row mine", and
nothing else.** Lifecycle filtering belongs in views and queries where it is
visible and testable. Migration `0004` corrects it.

### 2. Column-level `REVOKE` was doing nothing

I claimed column-level defence in two milestone reports:

```sql
revoke update (id, user_id, created_at, updated_at)
  on public.memorisation_segments from authenticated;
```

A column-level REVOKE **cannot subtract from a table-level privilege**, and
`authenticated` holds table-level UPDATE through Supabase's default grants. Every
one of those statements had been inert since I wrote it.

Found by a goals test that tried to rewrite a frozen column and succeeded.

Row policies were never affected — no user could reach another user's rows at any
point. What was missing was the layer stopping a compromised client rewriting
audit columns on rows it does own. Migration `0010` corrects all of them to
revoke-table-then-grant-columns.

### 3. Function `EXECUTE` defaults to `PUBLIC`

Milestone 11, same family of mistake:

```sql
revoke all on function public.prune_rate_limits(integer) from anon, authenticated;
```

PostgreSQL grants EXECUTE on every new function to `PUBLIC`. Revoking from named
roles leaves that grant in place. For a `SECURITY DEFINER` function, that grant is
the difference between a helper and a privilege escalation — and it is applied
silently at creation.

Now guarded permanently:

```sql
-- Fails if any SECURITY DEFINER function is PUBLIC-executable
select p.proname from pg_proc p ... where p.prosecdef
  and has_function_privilege('public', p.oid, 'EXECUTE')
```

There is a pattern across all three. Each was a security property I had
*asserted* rather than *verified*, and each was defeated by a PostgreSQL default
that fails silently. The lesson is not "write more tests" — it is **write the test
that tries to defeat your own defence.**

---

## The reference data

6,236 ayahs, each carrying surah, ayah number, juz', hizb, rub', manzil and
sajdah marking, plus the 604-page Madani map. Derived from `quran-meta` (MIT,
packaging the Tanzil metadata set), committed with a SHA-256, verified on every
`pnpm verify`. Never fetched at runtime.

The generator runs **46,406 assertions** before writing a byte: gapless index,
surah spans tiling exactly, unit nesting, contiguity, and spot checks against
independently known landmarks.

It earned that during development. My first version hardcoded Ya-Sin's global
ayah id from memory — wrong. Then asserted that al-Mulk opens juz' 30 — also
wrong; it opens juz' **29**. Both failed loudly instead of shipping.

I rewrote the checks to assert *structurally*: round-tripping every surah's first
and last ayah through the index, verifying units nest, checking landmarks by
`(surah, ayah)` rather than by remembered global id. Hard-coding ids recalled from
memory is exactly how a plausible-looking off-by-one gets committed, and an
off-by-one here would corrupt every feature built on top of it.

---

## Testing RLS rather than claiming it

Most Supabase projects say RLS is enabled and never verify it. So I installed
PostgreSQL locally, wrote a shim recreating the `auth` schema, `auth.uid()` and
the platform roles, and ran the real migrations against it.

**230 SQL assertions**, each executing as a genuine `authenticated` session with a
real subject claim — the way PostgREST executes a request. Not simulated.

The two that matter most over time:

```
ok  every public table has RLS enabled
ok  every public view is security_invoker
```

Those fail when someone adds a table in a later milestone and forgets. A view
without `security_invoker` runs with its owner's privileges and bypasses every
policy beneath it — the single most common way a Supabase project leaks data.

---

## Decisions I reversed

Recorded because reversing a decision for a stated reason is different from
drifting.

| Planned | Shipped | Why |
| ------- | ------- | --- |
| TanStack Query for optimistic updates | `useOptimistic` | A client cache means a provider, a dependency and a second source of truth beside RSC. `useOptimistic` covers the one case that needed it and discards its value automatically when the action settles. |
| `next-intl` at milestone 2 | Milestone 9 | The expensive part of i18n retrofit is `[locale]` routing, and cookie-based locale is the right choice for an authenticated tool. Only `locale` in the schema had to land early. |
| Theme stored in the profile | localStorage | Server-side storage means a round trip before the correct theme is known, so the flash of the wrong theme returns. The only gain is cross-device sync of a per-device setting. |
| Full Malay translation | Infrastructure plus three surfaces | Translating nine milestones in one pass produces unreviewed Malay, particularly for religious terminology. A parity test makes incremental translation safe. |

---

## Things I would tell you before you looked

**Offline sync is scoped, not solved.** Reads are stale-from-cache; writes go to a
durable IndexedDB outbox replayed sequentially on reconnect. Two devices editing
while both offline is last-write-wins. Real conflict resolution needs CRDTs or
vector clocks, and I could not test that properly, so I did not pretend to.

The outbox works because **both write paths were already idempotent** —
`complete_queue_item` returns the existing session, `record_pages` fills only
gaps. Neither was written for offline. That is earlier decisions paying off rather
than being planned for, which is usually how it goes.

**`/analytics` is 306 kB first load**, most of it Recharts. One route,
code-split, so nothing else pays for it — but it is the heaviest page here and
documented as such rather than glossed over.

**The Malay needs a native speaker.** I have done my best with `messages/ms.json`,
but I am not the right final authority on Malay Islamic terminology.

**Nothing is monitored.** No Sentry, no uptime check. `src/app/error.tsx` has the
comment marking where the reporting client goes.

---

## Numbers

| | |
|---|---|
| Milestones | 11 |
| Migrations | 13 |
| Unit tests | 143 |
| SQL assertions | 230 |
| Reference-data assertions | 46,406 |
| Routes | 17 |
| Recorded decisions | 26 |
| Bugs found by tests, in code already called correct | 3 |

---

## Stack

Next.js 15 App Router · React 19 · TypeScript (strict, `noUncheckedIndexedAccess`)
· Tailwind v4 · shadcn/ui · Supabase (PostgreSQL, Auth, RLS) · Recharts ·
Vitest · Vercel

**PostgreSQL is doing real work here**, which is the part I would point at.
`int4range` with GiST exclusion constraints, `range_agg` and multirange
subtraction for gap-filling, partial indexes matching how reads actually filter,
`security_invoker` views, and multi-statement writes as atomic functions rather
than as several round trips from the client.

The reasoning behind every decision is in
[`docs/ARCHITECTURE.md`](ARCHITECTURE.md), numbered and dated to the milestone
that made it.
