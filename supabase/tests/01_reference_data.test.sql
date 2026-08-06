-- ---------------------------------------------------------------------------
-- Reference data integrity
-- ---------------------------------------------------------------------------
-- The seed is generated and checksummed, but these assertions run against the
-- database that actually received it. A truncated import or a partially
-- applied transaction would pass the generator's checks and fail here.
-- ---------------------------------------------------------------------------

\echo '== Reference data =='

do $$
begin
  perform test.equals((select count(*)::int from public.surahs), 114, 'surah count');
  perform test.equals((select count(*)::int from public.ayahs), 6236, 'ayah count');
  perform test.equals((select count(*)::int from public.mushaf_pages where edition_id = 1), 604, 'Madani page count');
  perform test.equals((select count(*)::int from public.mushaf_editions), 1, 'seeded editions');

  -- Distinct unit counts.
  perform test.equals((select count(distinct juz)::int from public.ayahs), 30, 'distinct juz');
  perform test.equals((select count(distinct hizb)::int from public.ayahs), 60, 'distinct hizb');
  perform test.equals((select count(distinct rub)::int from public.ayahs), 240, 'distinct rub al-hizb');
  perform test.equals((select count(distinct manzil)::int from public.ayahs), 7, 'distinct manzil');
  perform test.equals((select count(*)::int from public.ayahs where has_sajdah), 15, 'sajdah positions');

  -- The ayah index must be gapless from 1 to 6236.
  perform test.equals((select min(id)::int from public.ayahs), 1, 'lowest ayah id');
  perform test.equals((select max(id)::int from public.ayahs), 6236, 'highest ayah id');
  perform test.ok(
    not exists (
      select 1 from generate_series(1, 6236) g(id)
      left join public.ayahs a on a.id = g.id
      where a.id is null
    ),
    'no gaps in the ayah index'
  );

  -- Surah spans must tile the index exactly, with no gap and no overlap.
  perform test.equals(
    (select sum(ayah_count)::int from public.surahs), 6236, 'surah ayah counts sum to the whole'
  );
  perform test.ok(
    not exists (
      select 1 from public.surahs s
      join public.ayahs a on a.id between s.first_ayah_id and s.last_ayah_id
      where a.surah_number <> s.number
    ),
    'every ayah in a surah span reports that surah'
  );

  -- Pages must tile the index exactly.
  perform test.equals(
    (select sum(public.ayah_range_length(ayah_range))::int
       from public.mushaf_pages where edition_id = 1),
    6236,
    'Madani pages cover every ayah exactly once'
  );
  perform test.ok(
    not exists (
      select 1 from generate_series(1, 6236) g(id)
      where not exists (
        select 1 from public.mushaf_pages p
        where p.edition_id = 1 and p.ayah_range @> g.id
      )
    ),
    'every ayah falls on a Madani page'
  );

  -- Independently known landmarks.
  perform test.equals(
    (select surah_number::int from public.ayahs where id = 262), 2, 'ayah 262 is in al-Baqarah'
  );
  perform test.equals(
    (select ayah_number::int from public.ayahs where id = 262), 255, 'ayah 262 is 2:255, Ayat al-Kursi'
  );
  perform test.equals(
    (select page_number::int from public.mushaf_pages
      where edition_id = 1 and ayah_range @> 262),
    42,
    'Ayat al-Kursi is on Madani page 42'
  );
  perform test.equals(
    (select a.juz::int from public.ayahs a
      join public.surahs s on s.number = 67 and a.id = s.first_ayah_id),
    29,
    'al-Mulk opens juz 29'
  );
  perform test.equals(
    (select a.juz::int from public.ayahs a
      join public.surahs s on s.number = 78 and a.id = s.first_ayah_id),
    30,
    'an-Naba opens juz 30'
  );
  perform test.equals(
    (select ayah_count::int from public.surahs where number = 1), 7, 'al-Fatihah has 7 ayahs'
  );
  perform test.equals(
    (select ayah_count::int from public.surahs where number = 2), 286, 'al-Baqarah has 286 ayahs'
  );

  -- Nesting invariants, enforced by CHECK but asserted against real rows.
  perform test.ok(
    not exists (select 1 from public.ayahs where ceil(hizb / 2.0) <> juz),
    'every hizb nests inside its juz'
  );
  perform test.ok(
    not exists (select 1 from public.ayahs where ceil(rub / 4.0) <> hizb),
    'every rub al-hizb nests inside its hizb'
  );
end
$$;

\echo '   reference data OK'
