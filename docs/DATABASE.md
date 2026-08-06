# Database

PostgreSQL 15+ on Supabase. Every table has Row Level Security enabled, and
the policies are exercised by an actual test suite rather than assumed correct.

---

## The central idea

A user's memorisation is stored as **ranges over a global ayah index**, 1 to
6,236. Pages, surahs, juz', hizb and rub' al-hizb are derived views of that one
record.

The alternative — a counter per unit — guarantees drift. A page can begin
mid-surah and a juz' can begin mid-page, so independent counters eventually
disagree and there is no principled way to decide which is right. One source of
truth removes the class of bug entirely.

```
memorisation_segments.ayah_range  ──▶  ayahs  ──▶  surahs
                                         │
                                         └──▶  mushaf_pages (per edition)
```

---

## Entity relationships

```
auth.users
    │ 1:1
    ├──── profiles
    │ 1:N
    ├──── memorisation_segments ──┐
    │ 1:N                         │ ayah_range (int4range)
    └──── custom_unit_sets        │
              │ 1:N               ▼
              └──── custom_units  ayahs (1..6236)
                                    │ N:1
                                    └──── surahs (1..114)

mushaf_editions
    │ 1:N
    └──── mushaf_pages ── ayah_range (int4range) ──▶ ayahs
```

---

## Tables

### Reference data — seeded, read-only

| Table | Rows | Purpose |
| ----- | ---- | ------- |
| `mushaf_editions` | 1 | Printed layouts. Determines what a page number means. |
| `surahs` | 114 | Names, ayah counts, revelation order, span in the global index. |
| `ayahs` | 6,236 | The canonical index. Surah, ayah, juz', hizb, rub', manzil, sajdah. |
| `mushaf_pages` | 604 | Ayah range per printed page, per edition. |

These have a SELECT policy for `authenticated` and **no write policies at all**.
The absence is the enforcement: RLS denies by default, so only roles that bypass
it entirely (`postgres`, `service_role`) can seed them.

### User data

| Table | Purpose |
| ----- | ------- |
| `profiles` | One row per auth user. Timezone, locale, display name. |
| `memorisation_segments` | Non-overlapping ayah ranges a user has memorised. |
| `custom_unit_sets` | User-defined division schemes, such as a madrasah maqra'. |
| `custom_units` | Individual divisions within a set. |

### Views

All are `security_invoker = true`. Without that flag a view runs with its
owner's privileges and bypasses every policy underneath — the most common way a
Supabase project leaks data. A test asserts no view is missing it.

| View | Grain |
| ---- | ----- |
| `v_memorised_ayahs` | One row per memorised ayah per user. |
| `v_surah_progress` | Count and percentage per surah. |
| `v_juz_progress` | Count and percentage per juz'. |
| `v_page_progress` | Count and percentage per printed page, per edition. |
| `v_memorisation_summary` | Headline totals per user. |
| `v_page_review_state` | Every memorised page with tier, last review and weakness. |
| `v_review_queue` | Queue items joined to page and surah context. |
| `v_review_streak` | Current and longest streaks, in the user's own timezone. |
| `v_daily_activity` | One row per day with any review or memorisation. |
| `v_activity_summary` | Consistency counts over rolling windows. |
| `v_page_strength` | Per-page review record and recency-weighted strength. |
| `v_review_totals` | Lifetime review totals per user. |

---

## Decisions

### Ranges, not rows per ayah

`memorisation_segments.ayah_range` is an `int4range`. Someone who has memorised
Juz' 30 has one row, not 564.

```sql
exclude using gist (user_id with =, ayah_range with &&)
  where (deleted_at is null)
```

That constraint makes overlapping segments **impossible at the database level**,
rather than prevented by application code a future refactor could bypass. It
requires the `btree_gist` extension, because it mixes equality on a scalar with
overlap on a range.

The `where` clause is what allows soft delete to work: a removed range can be
recorded again because deleted rows are outside the constraint.

PostgreSQL normalises `int4range` to half-open `[start, end)`, so ayahs 1–7 is
stored as `[1,8)` and arrives over the wire as the string `"[1,8)"`. The
conversion to and from the inclusive form people actually read happens in
`src/features/quran/lib/ranges.ts` and nowhere else.

### Mushaf editions are data

Page numbers mean nothing without an edition. Madani 604 is seeded as the
default; Mushaf Malaysia and others are **rows**, not migrations against user
data. Adding one is an INSERT plus a page map.

An edition varies pagination of a fixed text. A different *riwayah* (Warsh,
Qalun) has a different ayah count entirely and would need its own ayah index —
a deliberate future decision, not something this table models. The `riwayah`
column carries a CHECK restricting it to `hafs` so that assumption is explicit
rather than implied.

### Maqra' is user-defined

Juz', hizb and rub' al-hizb are fixed and universal. Maqra' varies by
institution and by teacher. Hard-coding one madrasah's convention would make
every other user's records wrong, so custom divisions are user-owned data
layered on the same index. This also gives halaqah most of what it needs later:
a shared set becomes a teacher's syllabus without a schema change.

### Policies express ownership; queries express lifecycle

This one was found by the test suite, and it is worth stating plainly.

Migration 0001 originally wrote:

```sql
using (id = auth.uid() and deleted_at is null)   -- wrong
```

PostgreSQL validates the *updated* row against the SELECT policy during an
UPDATE. The moment `deleted_at` is set the row no longer satisfies the policy,
so the statement fails with `new row violates row-level security policy`. **The
policy forbade the exact operation it existed to support.** Migration 0004
corrects it.

The rule now: a policy answers *is this row mine*, and nothing else. Filtering
soft-deleted rows happens in the views and in feature queries, where it is
visible and testable.

### Offline-ready from the start

Client-generatable UUID primary keys, `updated_at` on every table maintained by
a shared trigger, and soft deletes. Offline sync ships much later, but
retrofitting these three means migrating every table, and they cost nothing now.

---

## Column-level defence

Row policies are not the only lock. Columns a user must never set on themselves
are not writable at all:

```sql
revoke update on public.memorisation_segments from authenticated;
grant update (ayah_range, status, confidence, memorised_on, notes, deleted_at)
  on public.memorisation_segments to authenticated;
```

**The order matters, and getting it wrong fails silently.** Migrations 0001 to
0007 originally wrote this as `revoke update (col) ... from authenticated`,
which does nothing: a column-level REVOKE cannot subtract from a table-level
privilege, and `authenticated` holds table-level UPDATE through Supabase's
default grants. Every one of those statements was inert until a test tried to
rewrite a frozen column and succeeded. Migration 0010 corrects them all.

Row policies were never affected — no user could reach another user's rows at
any point. What was missing is the layer that stops a compromised client
rewriting ownership or audit columns on rows it does own. Now asserted by test.

---

## Migrations

Applied in filename order. Append-only once released.

| File | Contents |
| ---- | -------- |
| `20250101000000_profiles.sql` | `profiles`, `set_updated_at()`, signup trigger, RLS |
| `20250102000000_quran_reference.sql` | `btree_gist`, editions, surahs, ayahs, pages |
| `20250103000000_memorisation.sql` | Segments, custom units, helper functions, views |
| `20250104000000_fix_soft_delete_policies.sql` | Corrects the 0001 policy bug |
| `20250105000000_memorisation_operations.sql` | Atomic record/remove functions, `page_status` |
| `20250106000000_murajaah_plans.sql` | Review plans, session log, `v_page_review_state` |
| `20250107000000_murajaah_queue.sql` | Daily queues, generation and completion, streaks |
| `20250108000000_activity.sql` | Daily activity views and the heatmap calendar |
| `20250109000000_goals.sql` | Goals, scope resolution, `v_goal_progress` |
| `20250110000000_fix_column_privileges.sql` | Corrects the inert column REVOKEs |
| `20250111000000_analytics.sql` | Page strength, review trend, growth curve |
| `20250112000000_preferences_and_account.sql` | Reminders, export, account deletion |
| `20250113000000_rate_limiting.sql` | Fixed-window counters for pre-auth endpoints |

---

## Reference data

Generated, not hand-written.

```bash
pnpm quran:generate   # regenerate from quran-meta
pnpm quran:verify     # check the committed seed against its checksum
```

`scripts/generate-quran-reference.mjs` derives everything from `quran-meta`
(MIT, packaging the Tanzil metadata set) and runs **46,406 assertions** before
writing anything: gapless index, surah spans tiling exactly, unit nesting,
contiguity, and spot checks against independently known landmarks.

The output is committed with a SHA-256 checksum. The application never fetches
reference data at runtime — a network dependency in the hot path of a
memorisation tracker is unacceptable, and reference data that shifts underneath
you silently invalidates every user's records.

The generator asserts structurally rather than against remembered ayah ids.
During development it caught two wrong hard-coded values, which is the argument
for writing it that way.

---

## Write operations

Recording and removing memorisation are not single-row operations, so they are
database functions rather than application code.

| Function | Behaviour |
| -------- | --------- |
| `record_memorisation(first, last, …)` | Inserts only the parts not already covered |
| `remove_memorisation(first, last)` | Soft deletes, reinserting surviving remainders |
| `record_pages` / `remove_pages` | Page numbers resolved to ayah ids per edition |
| `record_surah` / `remove_surah` | Surah spans resolved from the surah table |
| `page_status(edition)` | Every page with the caller's memorised count |

Recording pages 1–10 when 3–5 are already recorded inserts only the gaps —
`range_agg` collapses existing coverage into a multirange and the requested
range is subtracted from it in one operation. Removing from the middle of a
segment splits it in two, and both halves keep the original notes, confidence
and date.

All are `SECURITY INVOKER`. They run as the caller, so RLS still scopes every
row they touch. A `SECURITY DEFINER` function here would be an authorisation
bypass; a test asserts that one user removing their entire Quran leaves another
user's records intact.

## Murajaah

Scheduling follows the structure tahfiz programmes already use rather than a
generic spaced-repetition scheme.

| Tier | Meaning |
| ---- | ------- |
| `sabqi` | Memorised within the plan's window, still consolidating |
| `manzil` | Everything older, cycled continuously |
| `weak` | Last rated at or below the plan's threshold, pulled forward |

`review_plans` expresses the daily budget two ways — a fixed quantity, or a
fixed cycle length from which the quantity is derived. `effective_daily_pages()`
collapses both to pages per day, so there is one engine and two ways of stating
intent.

`manzil_cursor` is the position in the long rotation. It is what makes each
day's review contiguous and therefore recitable; `complete_queue_item()`
advances it, and will not rewind it when items are completed out of order.

Queues are **persisted** rather than derived. A derived queue would rearrange
itself as items were completed, and "overdue" would be unknowable.

Allocation order in `ensure_review_queue()`:

1. Weak pages, **capped at a third of the budget**. Without the cap a user with
   fifty weak pages would see nothing else and the rotation would stop.
2. Sabqi, up to its own allocation.
3. Manzil fills the remainder, taken contiguously from the cursor.

Only **fully memorised** pages are scheduled. Reviewing half a page is a
different exercise, and including partials would make the daily count dishonest.

## Analytics

`v_page_strength` blends the mean of every rating with the most recent one, two
parts recent to one part history, and sets `is_measured = false` below three
reviews. Those pages are excluded from the strongest and weakest rankings: one
review rated five is a single impression, not strength, and ranking it makes the
list a record of luck.

`review_trend(from, to)` returns weekly volume by tier with mean confidence.
Empty weeks come back as zeroes — a chart that omits the fortnight someone
stopped reviewing tells the opposite of the truth. The week series is generated
between *truncated* bounds, because stepping weekly from `p_from` can stop short
of the week containing `p_to` and silently drop the current week.

`memorisation_growth(from, to)` returns a running total seeded with everything
recorded before the window, computed from segment dates rather than a stored
counter so it stays correct when a segment is edited or backdated.

## Export and deletion

`export_my_data()` returns everything the application holds about the caller as
one JSON document, assembled in a single call so the export is a consistent
snapshot rather than a set of reads that could interleave with a write. Ranges
are converted back to inclusive ayah numbers on the way out. Reference data is
excluded — it is identical for every user.

`delete_my_account()` removes the `auth.users` row, and every user table
cascades from it. It is the **only** `SECURITY DEFINER` function in the schema,
because the auth schema is not writable by application roles. It is safe for one
specific reason: it takes no arguments and deletes exactly `auth.uid()`, so
there is no parameter through which a caller could name a different user. A test
asserts that no argument-accepting overload exists, so adding one would fail the
suite.

## Testing

```bash
pnpm db:test
```

Applies every migration and the seed to a scratch database, then runs the SQL
suite. Requires PostgreSQL 15+ with `btree_gist`; point `PGHOST` / `PGPORT` /
`PGUSER` at a local server or a Supabase branch.

`supabase/tests/00_local_shim.sql` recreates the parts of the Supabase platform
the migrations depend on — the `auth` schema, `auth.uid()`, and the `anon`,
`authenticated` and `service_role` roles — so the schema can be exercised
against plain PostgreSQL. It is never applied to Supabase itself.

**Reference integrity** (25 assertions) — counts, gapless index, surah spans
tiling the index exactly, pages covering every ayah exactly once, unit nesting,
and landmarks such as Ayat al-Kursi resolving to 2:255 on Madani page 42.

**Write operations** (25 assertions) — gap filling, no-op on already-covered
ranges, segment splitting, metadata carried across a split, page and surah
wrappers, `page_status` shape, and cross-user isolation of the functions.

**Murajaah scheduling** (35 assertions) — budget conversion in both modes, tier
assignment, queue idempotency, contiguity, cursor advance and non-rewind, the
rotation continuing across days rather than repeating, the weak-page cap, rest
days, streaks, and cross-user isolation of the queue functions.

**Activity** (10 assertions) — days with reviews, memorisation-only days,
absent inactive days, gap filling by `activity_calendar`, and isolation.

**Goals** (30 assertions) — scope resolution for every scope type, baseline
handling, required pace computed over what remains, observed pace, projection
at zero pace, and the on-track / behind / stalled / overdue / complete
transitions.

**Analytics** (23 assertions) — strength weighting, the measurement threshold,
recent ratings outweighing history without discarding it, weekly bucketing
including empty weeks and the current week, growth seeding and monotonicity,
lifetime totals, and isolation.

**Account** (20 assertions) — reminder preferences and their constraints, export
contents and range conversion, export scoping, deletion cascading through every
table, and the properties that make the definer function safe.

**Rate limiting** (20 assertions) — window behaviour, bucket independence,
expiry and reset, the table being unreachable directly, malformed input, pruning,
and a guard that no `SECURITY DEFINER` function is executable by `PUBLIC`.

**Row Level Security** (41 assertions) — each runs as a real `authenticated`
session with a real subject claim, the way PostgREST executes a request:

- one user cannot read, update or delete another's rows
- forging `user_id` on insert is rejected
- reassigning ownership is rejected at the column level
- views do not leak across users
- the overlap exclusion constraint holds, per user
- soft delete works, and a removed range can be re-recorded
- ownership inherited through a parent set cannot be bypassed
- `anon` reads nothing, including reference data
- **every** public table has RLS enabled
- **every** public view is `security_invoker`

The last two are the ones that matter over time: they fail when someone adds a
table or view in a later migration and forgets to protect it.
