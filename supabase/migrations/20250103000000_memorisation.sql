-- ---------------------------------------------------------------------------
-- 0003 · Memorisation
-- ---------------------------------------------------------------------------
-- What a user has committed to memory, stored as non-overlapping ranges over
-- the canonical ayah index.
--
-- The central design decision is the exclusion constraint: two live segments
-- belonging to the same user cannot overlap, enforced by the database rather
-- than by application code that a future refactor could bypass.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- memorisation_segments
-- ---------------------------------------------------------------------------
-- Ranges are stored as int4range and normalised to the half-open form [start,
-- end) by PostgreSQL, so ayahs 1..7 is int4range(1, 8) and the upper bound is
-- exclusive. Helper functions below hide that from callers.
--
-- `confidence` is the user's self-assessment at the time of memorising. From
-- the murajaah milestone onward, current strength is derived from review
-- history instead; this column remains the starting point, not the live value.
-- ---------------------------------------------------------------------------
create table public.memorisation_segments (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users (id) on delete cascade,
  ayah_range    int4range   not null,
  status        text        not null default 'memorised',
  confidence    smallint,
  memorised_on  date,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,

  constraint memorisation_segments_status
    check (status in ('learning', 'memorised')),
  constraint memorisation_segments_confidence_range
    check (confidence is null or confidence between 1 and 5),
  constraint memorisation_segments_range_bounded
    check (lower(ayah_range) >= 1 and upper(ayah_range) <= 6237),
  constraint memorisation_segments_range_nonempty
    check (not isempty(ayah_range)),
  constraint memorisation_segments_notes_length
    check (notes is null or char_length(notes) <= 2000),
  -- A date in the future is always a mistake; the check is loose enough to
  -- tolerate a client clock that is a day ahead of the server.
  constraint memorisation_segments_memorised_on_not_future
    check (memorised_on is null or memorised_on <= (current_date + 1)),

  -- The heart of the model. Soft-deleted rows are excluded so that a user can
  -- re-record a range they previously removed.
  constraint memorisation_segments_no_overlap
    exclude using gist (user_id with =, ayah_range with &&)
    where (deleted_at is null)
);

comment on table public.memorisation_segments is
  'Non-overlapping ayah ranges a user has memorised. Overlap is impossible by constraint, not by convention.';
comment on column public.memorisation_segments.ayah_range is
  'int4range over the canonical ayah index. Normalised to [start, end) by PostgreSQL.';
comment on column public.memorisation_segments.confidence is
  'Self-assessment at time of memorising, 1-5. Live strength is derived from review history.';

create index memorisation_segments_user_idx
  on public.memorisation_segments (user_id)
  where deleted_at is null;

create index memorisation_segments_range_idx
  on public.memorisation_segments using gist (user_id, ayah_range)
  where deleted_at is null;

create index memorisation_segments_memorised_on_idx
  on public.memorisation_segments (user_id, memorised_on desc)
  where deleted_at is null;

create trigger memorisation_segments_set_updated_at
  before update on public.memorisation_segments
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- custom_unit_sets and custom_units
-- ---------------------------------------------------------------------------
-- Maqra' is not a canonical division. Unlike juz', hizb and rub' al-hizb,
-- which are fixed, a maqra' is defined by an institution or a teacher and
-- varies between them. Hard-coding one madrasah's convention would make every
-- other user's records wrong, so custom divisions are user-owned data layered
-- on the same ayah index.
--
-- This also gives halaqah most of what it needs later: a shared set becomes a
-- teacher's syllabus without a schema change.
-- ---------------------------------------------------------------------------
create table public.custom_unit_sets (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users (id) on delete cascade,
  name        text        not null,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,

  constraint custom_unit_sets_name_length
    check (char_length(btrim(name)) between 1 and 80),
  constraint custom_unit_sets_description_length
    check (description is null or char_length(description) <= 500)
);

comment on table public.custom_unit_sets is
  'User-defined division schemes, such as a madrasah maqra. Layered over the ayah index.';

create unique index custom_unit_sets_unique_name_idx
  on public.custom_unit_sets (user_id, lower(btrim(name)))
  where deleted_at is null;

create trigger custom_unit_sets_set_updated_at
  before update on public.custom_unit_sets
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Units within a set may not overlap each other, but sets are independent of
-- one another, so the constraint is scoped to set_id rather than user_id.
-- ---------------------------------------------------------------------------
create table public.custom_units (
  id         uuid        primary key default gen_random_uuid(),
  set_id     uuid        not null references public.custom_unit_sets (id) on delete cascade,
  ordinal    smallint    not null,
  label      text        not null,
  ayah_range int4range   not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint custom_units_ordinal_positive check (ordinal >= 1),
  constraint custom_units_label_length
    check (char_length(btrim(label)) between 1 and 80),
  constraint custom_units_range_bounded
    check (lower(ayah_range) >= 1 and upper(ayah_range) <= 6237),
  constraint custom_units_range_nonempty check (not isempty(ayah_range)),

  unique (set_id, ordinal),
  constraint custom_units_no_overlap
    exclude using gist (set_id with =, ayah_range with &&)
);

comment on table public.custom_units is
  'Individual divisions within a custom set. Non-overlapping within their set.';

create index custom_units_set_idx on public.custom_units (set_id, ordinal);

create trigger custom_units_set_updated_at
  before update on public.custom_units
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------
-- Callers work in inclusive ayah numbers because that is how a person reads a
-- mushaf. PostgreSQL stores half-open ranges. These two functions are the only
-- place that conversion happens.
-- ---------------------------------------------------------------------------
create or replace function public.ayah_range(first_ayah integer, last_ayah integer)
returns int4range
language sql
immutable
parallel safe
as $$
  select int4range(first_ayah, last_ayah, '[]');
$$;

comment on function public.ayah_range(integer, integer) is
  'Builds an inclusive ayah range. Use this instead of writing int4range literals.';

create or replace function public.ayah_range_length(r int4range)
returns integer
language sql
immutable
parallel safe
as $$
  select case when isempty(r) then 0 else upper(r) - lower(r) end;
$$;

comment on function public.ayah_range_length(int4range) is
  'Number of ayahs a range covers.';

-- ---------------------------------------------------------------------------
-- Progress views
-- ---------------------------------------------------------------------------
-- security_invoker = true is essential. Without it a view executes with the
-- privileges of its owner, which bypasses the RLS policies on the tables
-- underneath and would expose every user's progress to every other user. It is
-- the single most common way a Supabase project leaks data.
-- ---------------------------------------------------------------------------

-- Every individual ayah a user has memorised, expanded from their ranges.
create view public.v_memorised_ayahs
with (security_invoker = true) as
select
  s.user_id,
  g.ayah_id
from public.memorisation_segments s
cross join lateral generate_series(
  lower(s.ayah_range),
  upper(s.ayah_range) - 1
) as g(ayah_id)
where s.deleted_at is null
  and s.status = 'memorised';

comment on view public.v_memorised_ayahs is
  'One row per memorised ayah per user. Ranges expanded for aggregation.';

-- Per-surah completion.
create view public.v_surah_progress
with (security_invoker = true) as
select
  m.user_id,
  sr.number                      as surah_number,
  sr.name_transliterated,
  sr.ayah_count,
  count(*)::integer              as memorised_ayahs,
  round(count(*)::numeric * 100 / sr.ayah_count, 1) as percent_complete
from public.v_memorised_ayahs m
join public.ayahs a on a.id = m.ayah_id
join public.surahs sr on sr.number = a.surah_number
group by m.user_id, sr.number, sr.name_transliterated, sr.ayah_count;

comment on view public.v_surah_progress is
  'Memorised ayah count and percentage per surah, per user. Surahs with no progress are absent.';

-- Per-juz' completion.
create view public.v_juz_progress
with (security_invoker = true) as
select
  m.user_id,
  a.juz,
  count(*)::integer as memorised_ayahs,
  totals.ayah_count,
  round(count(*)::numeric * 100 / totals.ayah_count, 1) as percent_complete
from public.v_memorised_ayahs m
join public.ayahs a on a.id = m.ayah_id
join (
  select juz, count(*)::integer as ayah_count
  from public.ayahs
  group by juz
) totals on totals.juz = a.juz
group by m.user_id, a.juz, totals.ayah_count;

comment on view public.v_juz_progress is
  'Memorised ayah count and percentage per juz, per user.';

-- Per-page completion, scoped to a mushaf edition.
create view public.v_page_progress
with (security_invoker = true) as
select
  m.user_id,
  p.edition_id,
  p.page_number,
  count(*)::integer as memorised_ayahs,
  public.ayah_range_length(p.ayah_range) as ayah_count,
  round(
    count(*)::numeric * 100 / public.ayah_range_length(p.ayah_range),
    1
  ) as percent_complete
from public.v_memorised_ayahs m
join public.mushaf_pages p on p.ayah_range @> m.ayah_id
group by m.user_id, p.edition_id, p.page_number, p.ayah_range;

comment on view public.v_page_progress is
  'Memorised ayah count and percentage per printed page, per edition, per user.';

-- Headline totals.
create view public.v_memorisation_summary
with (security_invoker = true) as
select
  m.user_id,
  count(*)::integer as memorised_ayahs,
  round(count(*)::numeric * 100 / 6236, 2) as percent_of_quran,
  count(distinct a.surah_number)::integer as surahs_touched,
  count(distinct a.juz)::integer as juz_touched
from public.v_memorised_ayahs m
join public.ayahs a on a.id = m.ayah_id
group by m.user_id;

comment on view public.v_memorisation_summary is
  'Headline memorisation totals per user.';

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.memorisation_segments enable row level security;
alter table public.custom_unit_sets enable row level security;
alter table public.custom_units enable row level security;

-- ---------------------------------------------------------------------------
-- Policies express ownership only. Lifecycle filtering (deleted_at) lives in
-- the views and in feature queries.
--
-- This is not a stylistic preference. PostgreSQL validates the updated row
-- against the SELECT policy, so a policy of the form
--   using (user_id = auth.uid() and deleted_at is null)
-- makes soft delete impossible for the row's owner: the moment deleted_at is
-- set, the new row no longer satisfies the policy and the UPDATE is rejected.
-- The policy forbids the exact operation it exists to support.
-- ---------------------------------------------------------------------------

-- memorisation_segments -----------------------------------------------------
create policy "memorisation_segments_select_own"
  on public.memorisation_segments
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "memorisation_segments_insert_own"
  on public.memorisation_segments
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "memorisation_segments_update_own"
  on public.memorisation_segments
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- No DELETE policy: removal is a soft delete performed through UPDATE.

revoke update (id, user_id, created_at, updated_at)
  on public.memorisation_segments from authenticated;

-- custom_unit_sets ----------------------------------------------------------
create policy "custom_unit_sets_select_own"
  on public.custom_unit_sets
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "custom_unit_sets_insert_own"
  on public.custom_unit_sets
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "custom_unit_sets_update_own"
  on public.custom_unit_sets
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke update (id, user_id, created_at, updated_at)
  on public.custom_unit_sets from authenticated;

-- custom_units --------------------------------------------------------------
-- Ownership is inherited from the parent set. The EXISTS subquery is the only
-- correct way to express that: checking auth.uid() directly is impossible here
-- because this table has no user_id column, and adding one would let the two
-- copies of ownership disagree.
create policy "custom_units_select_via_set"
  on public.custom_units
  for select to authenticated
  using (
    exists (
      select 1 from public.custom_unit_sets s
      where s.id = custom_units.set_id
        and s.user_id = (select auth.uid())
    )
  );

create policy "custom_units_insert_via_set"
  on public.custom_units
  for insert to authenticated
  with check (
    exists (
      select 1 from public.custom_unit_sets s
      where s.id = custom_units.set_id
        and s.user_id = (select auth.uid())
    )
  );

create policy "custom_units_update_via_set"
  on public.custom_units
  for update to authenticated
  using (
    exists (
      select 1 from public.custom_unit_sets s
      where s.id = custom_units.set_id
        and s.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.custom_unit_sets s
      where s.id = custom_units.set_id
        and s.user_id = (select auth.uid())
    )
  );

create policy "custom_units_delete_via_set"
  on public.custom_units
  for delete to authenticated
  using (
    exists (
      select 1 from public.custom_unit_sets s
      where s.id = custom_units.set_id
        and s.user_id = (select auth.uid())
    )
  );
