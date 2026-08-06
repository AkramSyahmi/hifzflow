-- ---------------------------------------------------------------------------
-- Memorisation write operations
-- ---------------------------------------------------------------------------
-- The gap-filling and segment-splitting behaviour is the part most likely to
-- be subtly wrong, so it is tested against real rows rather than reasoned about.
-- ---------------------------------------------------------------------------

\echo '== Memorisation operations =='

insert into auth.users (id, email) values
  ('33333333-3333-3333-3333-333333333333', 'khadijah@example.test')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Gap filling
-- ---------------------------------------------------------------------------
do $$
declare
  khadijah uuid := '33333333-3333-3333-3333-333333333333';
  created integer;
begin
  perform test.become(khadijah);

  -- A clean range on an empty account.
  select count(*) into created
    from public.record_memorisation(1, 7);
  perform test.equals(created, 1, 'recording a fresh range creates one segment');

  -- Recording exactly the same range again must be a no-op, not an error.
  select count(*) into created
    from public.record_memorisation(1, 7);
  perform test.equals(created, 0, 'recording an already covered range creates nothing');
  perform test.equals(
    (select count(*)::int from public.memorisation_segments where deleted_at is null),
    1,
    'no duplicate segment was written'
  );

  -- A range that straddles existing coverage fills only the gap.
  select count(*) into created
    from public.record_memorisation(1, 20);
  perform test.equals(created, 1, 'a straddling range creates one segment for the gap');
  perform test.equals(
    (select count(*)::int from public.v_memorised_ayahs),
    20,
    'coverage is 20 ayahs with no double counting'
  );

  -- A range with coverage in the middle produces two gap segments.
  perform public.record_memorisation(40, 50);
  select count(*) into created
    from public.record_memorisation(30, 60);
  perform test.equals(created, 2, 'a range with a hole in the middle creates two segments');
  perform test.equals(
    (select count(*)::int from public.v_memorised_ayahs),
    51,
    'coverage is 20 + 31 ayahs'
  );
end
$$;

-- ---------------------------------------------------------------------------
-- Removal and splitting
-- ---------------------------------------------------------------------------
do $$
declare
  khadijah uuid := '33333333-3333-3333-3333-333333333333';
  removed integer;
begin
  perform test.become(khadijah);

  -- Remove from the middle of a contiguous span: the segment must split.
  removed := public.remove_memorisation(10, 12);
  perform test.equals(removed, 3, 'three ayahs reported removed');
  perform test.equals(
    (select count(*)::int from public.v_memorised_ayahs where ayah_id between 10 and 12),
    0,
    'the removed ayahs are gone'
  );
  perform test.equals(
    (select count(*)::int from public.v_memorised_ayahs where ayah_id between 1 and 20),
    17,
    'the surrounding ayahs survive the split'
  );

  -- Removing a range that is not recorded reports zero rather than failing.
  removed := public.remove_memorisation(5000, 5010);
  perform test.equals(removed, 0, 'removing unrecorded ayahs removes nothing');

  -- Removing a whole segment leaves no remainder.
  removed := public.remove_memorisation(30, 60);
  perform test.equals(removed, 31, 'removing a full span reports its length');
  perform test.equals(
    (select count(*)::int from public.v_memorised_ayahs where ayah_id between 30 and 60),
    0,
    'the full span is gone'
  );
end
$$;

-- ---------------------------------------------------------------------------
-- Metadata is carried across a split
-- ---------------------------------------------------------------------------
do $$
declare
  khadijah uuid := '33333333-3333-3333-3333-333333333333';
begin
  perform test.become(khadijah);

  perform public.record_memorisation(
    100, 120, 'memorised', 4::smallint, current_date - 7, 'with ustaz'
  );
  perform public.remove_memorisation(110, 112);

  perform test.equals(
    (select count(*)::int from public.memorisation_segments
      where deleted_at is null and notes = 'with ustaz'),
    2,
    'both halves of the split keep the original notes'
  );
  perform test.equals(
    (select distinct confidence::int from public.memorisation_segments
      where deleted_at is null and notes = 'with ustaz'),
    4,
    'both halves keep the original confidence'
  );
end
$$;

-- ---------------------------------------------------------------------------
-- Page and surah wrappers
-- ---------------------------------------------------------------------------
do $$
declare
  khadijah uuid := '33333333-3333-3333-3333-333333333333';
  removed integer;
begin
  perform test.become(khadijah);

  -- Surah al-Mulk is 30 ayahs.
  perform public.record_surah(67::smallint);
  perform test.equals(
    (select memorised_ayahs from public.v_surah_progress where surah_number = 67),
    30,
    'recording a surah covers all of it'
  );
  perform test.equals(
    (select percent_complete from public.v_surah_progress where surah_number = 67),
    100.0::numeric,
    'the surah reports complete'
  );

  -- Page 1 of the Madani mushaf is al-Fatihah, already recorded above.
  perform public.record_pages(1::smallint, 3::smallint, 4::smallint);
  perform test.ok(
    (select memorised_ayahs from public.page_status(1::smallint) where page_number = 3)
      = (select ayah_count from public.page_status(1::smallint) where page_number = 3),
    'page 3 is fully covered after recording it'
  );

  removed := public.remove_pages(1::smallint, 3::smallint, 3::smallint);
  perform test.ok(removed > 0, 'removing a page reports the ayahs removed');
  perform test.equals(
    (select memorised_ayahs from public.page_status(1::smallint) where page_number = 3),
    0,
    'page 3 is empty again'
  );
end
$$;

-- ---------------------------------------------------------------------------
-- The functions must not become an authorisation bypass
-- ---------------------------------------------------------------------------
do $$
declare
  aisha uuid := '11111111-1111-1111-1111-111111111111';
  khadijah uuid := '33333333-3333-3333-3333-333333333333';
  removed integer;
begin
  -- Khadijah's writes must never reach Aisha's rows. SECURITY INVOKER is what
  -- guarantees this; a DEFINER function here would quietly bypass RLS.
  perform test.become(khadijah);
  removed := public.remove_memorisation(1, 6236);

  perform test.become(aisha);
  perform test.ok(
    (select count(*)::int from public.memorisation_segments where deleted_at is null) > 0,
    'a wholesale removal by one user leaves another user untouched'
  );
end
$$;

-- ---------------------------------------------------------------------------
-- page_status shape
-- ---------------------------------------------------------------------------
do $$
declare
  khadijah uuid := '33333333-3333-3333-3333-333333333333';
begin
  perform test.become(khadijah);

  perform test.equals(
    (select count(*)::int from public.page_status(1::smallint)),
    604,
    'page_status returns every page, including untouched ones'
  );
  perform test.equals(
    (select sum(ayah_count)::int from public.page_status(1::smallint)),
    6236,
    'page ayah counts still sum to the whole Quran'
  );
  perform test.ok(
    not exists (
      select 1 from public.page_status(1::smallint)
       where memorised_ayahs > ayah_count
    ),
    'no page reports more memorised ayahs than it contains'
  );
  perform test.ok(
    not exists (select 1 from public.page_status(1::smallint) where juz is null),
    'every page resolves to a juz'
  );
end
$$;

\echo '   memorisation operations OK'
