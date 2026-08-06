-- ---------------------------------------------------------------------------
-- 0002 · Quran reference data
-- ---------------------------------------------------------------------------
-- The canonical unit of this application is the ayah, identified by a global
-- index from 1 to 6236. A user's memorisation is stored as ranges over that
-- index; pages, surahs, juz', hizb and rub' al-hizb are all derived views of
-- the same underlying record.
--
-- Storing progress separately per unit would guarantee drift: a page can begin
-- mid-surah and a juz' can begin mid-page, so independent counters eventually
-- disagree with no principled way to decide which is right.
--
-- These tables are reference data. They are seeded once from
-- supabase/seed/quran_reference.sql and are read-only to every application
-- role — there are deliberately no INSERT, UPDATE or DELETE policies.
-- ---------------------------------------------------------------------------

-- Required for exclusion constraints that mix equality on a scalar column with
-- overlap on a range column.
create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- mushaf_editions
-- ---------------------------------------------------------------------------
-- Page numbers are meaningless without an edition. The Madani 604 layout is
-- seeded as the default; Mushaf Malaysia, the Indonesian standard and others
-- are added as rows, not as migrations against user data.
--
-- Note the scope: an edition varies the *pagination* of a fixed text. A
-- different riwayah (Warsh, Qalun) has a different ayah count entirely and
-- would need its own ayah index, which is a deliberate future decision rather
-- than something this table models.
-- ---------------------------------------------------------------------------
create table public.mushaf_editions (
  id          smallint    primary key,
  slug        text        not null unique,
  name        text        not null,
  riwayah     text        not null default 'hafs',
  page_count  smallint    not null,
  is_default  boolean     not null default false,
  created_at  timestamptz not null default now(),

  constraint mushaf_editions_slug_shape
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint mushaf_editions_riwayah_supported
    check (riwayah in ('hafs')),
  constraint mushaf_editions_page_count_sane
    check (page_count between 1 and 2000)
);

comment on table public.mushaf_editions is
  'Printed mushaf layouts. Determines what a page number means.';

-- At most one default edition. A partial unique index expresses this more
-- precisely than a constraint could.
create unique index mushaf_editions_one_default_idx
  on public.mushaf_editions (is_default)
  where is_default;

-- ---------------------------------------------------------------------------
-- surahs
-- ---------------------------------------------------------------------------
create table public.surahs (
  number              smallint primary key,
  name_arabic         text     not null,
  name_transliterated text     not null,
  name_english        text     not null,
  ayah_count          smallint not null,
  ruku_count          smallint not null,
  revelation_order    smallint not null unique,
  revelation_place    text     not null,
  first_ayah_id       integer  not null unique,
  last_ayah_id        integer  not null unique,

  constraint surahs_number_range check (number between 1 and 114),
  constraint surahs_ayah_count_positive check (ayah_count > 0),
  constraint surahs_revelation_place
    check (revelation_place in ('meccan', 'medinan')),
  constraint surahs_revelation_order_range
    check (revelation_order between 1 and 114),
  constraint surahs_span_matches_count
    check (last_ayah_id - first_ayah_id + 1 = ayah_count),
  constraint surahs_ayah_ids_in_range
    check (first_ayah_id between 1 and 6236 and last_ayah_id between 1 and 6236)
);

comment on table public.surahs is
  'The 114 surahs. first_ayah_id and last_ayah_id map each onto the global ayah index.';

-- ---------------------------------------------------------------------------
-- ayahs
-- ---------------------------------------------------------------------------
-- The canonical index. `id` is integer rather than smallint specifically so
-- that it composes with int4range, which the memorisation model depends on.
--
-- juz, hizb, rub and manzil live here rather than in their own tables because
-- they are fixed for a given riwayah and never vary by edition. Pages do vary,
-- so they live in mushaf_pages instead.
-- ---------------------------------------------------------------------------
create table public.ayahs (
  id            integer  primary key,
  surah_number  smallint not null references public.surahs (number),
  ayah_number   smallint not null,
  juz           smallint not null,
  hizb          smallint not null,
  rub           smallint not null,
  manzil        smallint not null,
  has_sajdah    boolean  not null default false,

  constraint ayahs_id_range check (id between 1 and 6236),
  constraint ayahs_ayah_number_positive check (ayah_number > 0),
  constraint ayahs_juz_range check (juz between 1 and 30),
  constraint ayahs_hizb_range check (hizb between 1 and 60),
  constraint ayahs_rub_range check (rub between 1 and 240),
  constraint ayahs_manzil_range check (manzil between 1 and 7),
  -- Units nest: two hizb per juz', four rub' per hizb.
  constraint ayahs_hizb_nests_in_juz check (ceil(hizb / 2.0) = juz),
  constraint ayahs_rub_nests_in_hizb check (ceil(rub / 4.0) = hizb),

  unique (surah_number, ayah_number)
);

comment on table public.ayahs is
  'Canonical ayah index, 1..6236 (Hafs). Every memorisation record is a range over this.';
comment on column public.ayahs.id is
  'Global ayah number. Integer, not smallint, so it composes with int4range.';

create index ayahs_surah_idx on public.ayahs (surah_number);
create index ayahs_juz_idx on public.ayahs (juz);
create index ayahs_hizb_idx on public.ayahs (hizb);
create index ayahs_rub_idx on public.ayahs (rub);
create index ayahs_sajdah_idx on public.ayahs (id) where has_sajdah;

-- ---------------------------------------------------------------------------
-- mushaf_pages
-- ---------------------------------------------------------------------------
-- 604 rows for the Madani edition rather than 6236 ayah-to-page rows. The
-- exclusion constraint makes overlapping pages within one edition impossible,
-- and the GiST index makes "which page holds ayah N" an index lookup.
-- ---------------------------------------------------------------------------
create table public.mushaf_pages (
  edition_id  smallint  not null references public.mushaf_editions (id) on delete cascade,
  page_number smallint  not null,
  ayah_range  int4range not null,

  primary key (edition_id, page_number),

  constraint mushaf_pages_page_positive check (page_number >= 1),
  constraint mushaf_pages_range_bounded
    check (lower(ayah_range) >= 1 and upper(ayah_range) <= 6237),
  constraint mushaf_pages_range_nonempty check (not isempty(ayah_range)),

  -- Two pages of the same edition cannot claim the same ayah.
  exclude using gist (edition_id with =, ayah_range with &&)
);

comment on table public.mushaf_pages is
  'Ayah ranges per printed page, per edition. Ranges are canonicalised to [) by PostgreSQL.';

create index mushaf_pages_range_idx
  on public.mushaf_pages using gist (edition_id, ayah_range);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- Reference data is world-readable to signed-in users and writable by nobody.
-- The absence of write policies is the enforcement: RLS denies by default, and
-- only roles that bypass RLS entirely (postgres, service_role) can seed it.
-- ---------------------------------------------------------------------------
alter table public.mushaf_editions enable row level security;
alter table public.surahs enable row level security;
alter table public.ayahs enable row level security;
alter table public.mushaf_pages enable row level security;

create policy "mushaf_editions_read" on public.mushaf_editions
  for select to authenticated using (true);

create policy "surahs_read" on public.surahs
  for select to authenticated using (true);

create policy "ayahs_read" on public.ayahs
  for select to authenticated using (true);

create policy "mushaf_pages_read" on public.mushaf_pages
  for select to authenticated using (true);
