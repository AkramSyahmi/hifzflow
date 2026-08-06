-- ---------------------------------------------------------------------------
-- 0005 · Memorisation write operations
-- ---------------------------------------------------------------------------
-- Recording and removing memorisation are not single-row operations.
--
-- Recording pages 1-10 when 3-5 are already recorded must insert only the
-- gaps, or the exclusion constraint rejects the whole statement and the user
-- is told to go away and work out which parts are new. Removing ayahs from the
-- middle of a segment must split it in two.
--
-- Both are multi-statement, and doing them from the client would leave a
-- window where a range is deleted but its remainder has not yet been written.
-- They belong in the database, in one transaction.
--
-- SECURITY INVOKER is deliberate: these run as the calling user, so RLS still
-- applies and a caller cannot touch another user's rows. A SECURITY DEFINER
-- function here would silently become an authorisation bypass.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- record_memorisation
-- ---------------------------------------------------------------------------
-- Marks an inclusive ayah range as memorised, inserting only the portions not
-- already covered. Returns the rows it created, which may be none if the range
-- was already fully covered.
-- ---------------------------------------------------------------------------
create or replace function public.record_memorisation(
  p_first_ayah  integer,
  p_last_ayah   integer,
  p_status      text     default 'memorised',
  p_confidence  smallint default null,
  p_memorised_on date    default null,
  p_notes       text     default null
)
returns setof public.memorisation_segments
language plpgsql
security invoker
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  requested int4range;
begin
  if caller is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if p_first_ayah is null or p_last_ayah is null then
    raise exception 'ayah bounds are required' using errcode = '22004';
  end if;

  if p_first_ayah < 1 or p_last_ayah > 6236 then
    raise exception 'ayah range %-% falls outside 1-6236', p_first_ayah, p_last_ayah
      using errcode = '22003';
  end if;

  if p_first_ayah > p_last_ayah then
    raise exception 'range start % is after its end %', p_first_ayah, p_last_ayah
      using errcode = '22003';
  end if;

  requested := int4range(p_first_ayah, p_last_ayah, '[]');

  /*
   * Subtract everything already recorded from the requested range, leaving the
   * gaps. range_agg collapses the existing segments into a single multirange
   * so the subtraction is one operation rather than an iterative loop.
   */
  return query
  with existing as (
    select coalesce(range_agg(s.ayah_range), '{}'::int4multirange) as covered
      from public.memorisation_segments s
     where s.user_id = caller
       and s.deleted_at is null
       and s.ayah_range && requested
  ),
  gaps as (
    select unnest(
             multirange(requested) - (select covered from existing)
           ) as gap
  )
  insert into public.memorisation_segments (
    user_id, ayah_range, status, confidence, memorised_on, notes
  )
  select
    caller,
    gap,
    coalesce(p_status, 'memorised'),
    p_confidence,
    coalesce(p_memorised_on, current_date),
    p_notes
  from gaps
  where not isempty(gap)
  returning *;
end;
$$;

comment on function public.record_memorisation is
  'Marks an inclusive ayah range as memorised, inserting only the parts not already covered. Returns the created rows.';

-- ---------------------------------------------------------------------------
-- remove_memorisation
-- ---------------------------------------------------------------------------
-- Removes an inclusive ayah range. Segments fully inside the range are soft
-- deleted; segments that straddle it are soft deleted and their surviving
-- portions reinserted, carrying the original metadata forward.
--
-- Returns the number of ayahs actually removed, so the caller can report
-- honestly rather than assuming the whole request applied.
-- ---------------------------------------------------------------------------
create or replace function public.remove_memorisation(
  p_first_ayah integer,
  p_last_ayah  integer
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  requested int4range;
  affected  record;
  remainder int4range;
  removed   integer := 0;
begin
  if caller is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if p_first_ayah is null or p_last_ayah is null then
    raise exception 'ayah bounds are required' using errcode = '22004';
  end if;

  if p_first_ayah > p_last_ayah then
    raise exception 'range start % is after its end %', p_first_ayah, p_last_ayah
      using errcode = '22003';
  end if;

  requested := int4range(p_first_ayah, p_last_ayah, '[]');

  for affected in
    select *
      from public.memorisation_segments
     where user_id = caller
       and deleted_at is null
       and ayah_range && requested
     for update
  loop
    removed := removed + public.ayah_range_length(affected.ayah_range * requested);

    /*
     * Soft delete first. The exclusion constraint ignores deleted rows, so the
     * remainders below can be inserted without colliding with the row they
     * came from.
     */
    update public.memorisation_segments
       set deleted_at = now()
     where id = affected.id;

    -- Reinsert whatever survives on either side of the removed span.
    for remainder in
      select unnest(multirange(affected.ayah_range) - multirange(requested))
    loop
      if not isempty(remainder) then
        insert into public.memorisation_segments (
          user_id, ayah_range, status, confidence, memorised_on, notes
        )
        values (
          caller,
          remainder,
          affected.status,
          affected.confidence,
          affected.memorised_on,
          affected.notes
        );
      end if;
    end loop;
  end loop;

  return removed;
end;
$$;

comment on function public.remove_memorisation is
  'Removes an inclusive ayah range, splitting straddling segments and preserving their metadata. Returns the ayah count removed.';

-- ---------------------------------------------------------------------------
-- Page-level convenience wrappers
-- ---------------------------------------------------------------------------
-- Pages are how most people record progress, so the translation from page
-- numbers to ayah ids happens here rather than being repeated by every caller.
-- ---------------------------------------------------------------------------
create or replace function public.record_pages(
  p_edition_id   smallint,
  p_first_page   smallint,
  p_last_page    smallint,
  p_status       text     default 'memorised',
  p_confidence   smallint default null,
  p_memorised_on date     default null,
  p_notes        text     default null
)
returns setof public.memorisation_segments
language plpgsql
security invoker
set search_path = public
as $$
declare
  span int4range;
begin
  if p_first_page > p_last_page then
    raise exception 'page % is after page %', p_first_page, p_last_page
      using errcode = '22003';
  end if;

  select int4range(min(lower(ayah_range)), max(upper(ayah_range) - 1), '[]')
    into span
    from public.mushaf_pages
   where edition_id = p_edition_id
     and page_number between p_first_page and p_last_page;

  if span is null then
    raise exception 'no pages found in %-% for edition %',
      p_first_page, p_last_page, p_edition_id
      using errcode = '22023';
  end if;

  return query
  select *
    from public.record_memorisation(
      lower(span),
      upper(span) - 1,
      p_status,
      p_confidence,
      p_memorised_on,
      p_notes
    );
end;
$$;

comment on function public.record_pages is
  'Marks whole printed pages as memorised, resolving them to ayah ids for the given edition.';

create or replace function public.remove_pages(
  p_edition_id smallint,
  p_first_page smallint,
  p_last_page  smallint
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  span int4range;
begin
  if p_first_page > p_last_page then
    raise exception 'page % is after page %', p_first_page, p_last_page
      using errcode = '22003';
  end if;

  select int4range(min(lower(ayah_range)), max(upper(ayah_range) - 1), '[]')
    into span
    from public.mushaf_pages
   where edition_id = p_edition_id
     and page_number between p_first_page and p_last_page;

  if span is null then
    return 0;
  end if;

  return public.remove_memorisation(lower(span), upper(span) - 1);
end;
$$;

comment on function public.remove_pages is
  'Removes whole printed pages, resolving them to ayah ids for the given edition.';

-- ---------------------------------------------------------------------------
-- Surah convenience wrappers
-- ---------------------------------------------------------------------------
create or replace function public.record_surah(
  p_surah_number smallint,
  p_status       text     default 'memorised',
  p_confidence   smallint default null,
  p_memorised_on date     default null,
  p_notes        text     default null
)
returns setof public.memorisation_segments
language plpgsql
security invoker
set search_path = public
as $$
declare
  s public.surahs%rowtype;
begin
  select * into s from public.surahs where number = p_surah_number;

  if not found then
    raise exception 'surah % does not exist', p_surah_number using errcode = '22023';
  end if;

  return query
  select *
    from public.record_memorisation(
      s.first_ayah_id, s.last_ayah_id, p_status, p_confidence, p_memorised_on, p_notes
    );
end;
$$;

create or replace function public.remove_surah(p_surah_number smallint)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  s public.surahs%rowtype;
begin
  select * into s from public.surahs where number = p_surah_number;

  if not found then
    raise exception 'surah % does not exist', p_surah_number using errcode = '22023';
  end if;

  return public.remove_memorisation(s.first_ayah_id, s.last_ayah_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Page-level status for the tracking grid
-- ---------------------------------------------------------------------------
-- Returns every page of an edition with how much of it the caller has
-- memorised. Pages with no progress are included with a zero count, because
-- the grid has to render all 604 either way and a left join in SQL is cheaper
-- than reconciling two lists in application code.
-- ---------------------------------------------------------------------------
create or replace function public.page_status(p_edition_id smallint)
returns table (
  page_number     smallint,
  juz             smallint,
  ayah_count      integer,
  memorised_ayahs integer
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    p.page_number,
    (select a.juz from public.ayahs a where a.id = lower(p.ayah_range)) as juz,
    public.ayah_range_length(p.ayah_range) as ayah_count,
    coalesce(m.memorised, 0) as memorised_ayahs
  from public.mushaf_pages p
  left join lateral (
    select count(*)::integer as memorised
      from public.v_memorised_ayahs v
     where v.ayah_id <@ p.ayah_range
  ) m on true
  where p.edition_id = p_edition_id
  order by p.page_number;
$$;

comment on function public.page_status is
  'Every page of an edition with the caller''s memorised ayah count. Drives the tracking grid.';
