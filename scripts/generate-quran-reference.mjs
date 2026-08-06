/**
 * Quran reference data generator.
 *
 * Derives the canonical ayah index and the Madani 604 page map from
 * `quran-meta` (MIT, github.com/quran-center/quran-meta), which packages the
 * Tanzil metadata set.
 *
 * This runs once, by hand, and its output is committed. The application never
 * calls it and never fetches reference data at runtime: a network dependency
 * in the hot path of a memorisation tracker is unacceptable, and reference
 * data that shifts under you silently invalidates every user's records.
 *
 * Usage:
 *   pnpm quran:generate
 *
 * Every invariant is asserted before anything is written. If the upstream
 * package changes shape, this fails loudly rather than emitting a subtly wrong
 * seed — an off-by-one here would corrupt every feature built on top of it and
 * would not be noticed for weeks.
 */

import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { surahNamesEn } from 'quran-meta';
import {
  HizbQuarterList,
  JuzList,
  ManzilList,
  meta,
  PageList,
  SajdaList,
  SurahList,
} from 'quran-meta/hafs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'supabase', 'seed');

const TOTAL_AYAHS = 6236;
const TOTAL_SURAHS = 114;
const TOTAL_JUZ = 30;
const TOTAL_HIZB = 60;
const TOTAL_RUB = 240;
const TOTAL_MANZIL = 7;
const MADANI_PAGES = 604;
const TOTAL_SAJDAH = 15;

let checks = 0;

function assert(condition, message) {
  checks += 1;
  if (!condition) {
    console.error(`\n  FAILED: ${message}\n`);
    process.exit(1);
  }
}

/**
 * The upstream lists are 1-indexed start markers with a trailing sentinel of
 * TOTAL_AYAHS + 1, so unit n covers [list[n], list[n + 1] - 1].
 */
function unitRanges(list, expectedCount, label) {
  assert(
    list.length === expectedCount + 2,
    `${label}: expected ${expectedCount + 2} entries (placeholder + ${expectedCount} + sentinel), found ${list.length}`
  );
  assert(list[1] === 1, `${label}: unit 1 must start at ayah 1`);
  assert(
    list[expectedCount + 1] === TOTAL_AYAHS + 1,
    `${label}: sentinel must be ${TOTAL_AYAHS + 1}, found ${list[expectedCount + 1]}`
  );

  const ranges = [];
  for (let n = 1; n <= expectedCount; n += 1) {
    const start = list[n];
    const end = list[n + 1] - 1;
    assert(start <= end, `${label} ${n}: start ${start} is after end ${end}`);
    ranges.push({ number: n, start, end });
  }

  // Contiguity: unit n + 1 must begin exactly where unit n ended.
  for (let i = 1; i < ranges.length; i += 1) {
    assert(
      ranges[i].start === ranges[i - 1].end + 1,
      `${label}: gap or overlap between unit ${i} and unit ${i + 1}`
    );
  }

  assert(ranges[0].start === 1, `${label}: must begin at ayah 1`);
  assert(
    ranges.at(-1).end === TOTAL_AYAHS,
    `${label}: must end at ayah ${TOTAL_AYAHS}`
  );

  return ranges;
}

function lookupFor(ranges) {
  const table = new Int16Array(TOTAL_AYAHS + 1);
  for (const { number, start, end } of ranges) {
    for (let id = start; id <= end; id += 1) table[id] = number;
  }
  return table;
}

function sqlString(value) {
  if (value === null || value === undefined) return 'null';
  return `'${String(value).replace(/'/g, "''")}'`;
}

// ---------------------------------------------------------------------------
// Validate upstream totals
// ---------------------------------------------------------------------------

assert(
  meta.riwayaName === 'Hafs',
  `expected Hafs riwayah, got ${meta.riwayaName}`
);
assert(
  meta.numAyahs === TOTAL_AYAHS,
  `upstream reports ${meta.numAyahs} ayahs`
);
assert(
  meta.numSurahs === TOTAL_SURAHS,
  `upstream reports ${meta.numSurahs} surahs`
);
assert(
  meta.numPages === MADANI_PAGES,
  `upstream reports ${meta.numPages} pages`
);
assert(meta.numJuzs === TOTAL_JUZ, `upstream reports ${meta.numJuzs} juz`);
assert(meta.numHizbs === TOTAL_HIZB, `upstream reports ${meta.numHizbs} hizb`);
assert(
  meta.numRubAlHizbs === TOTAL_RUB,
  `upstream reports ${meta.numRubAlHizbs} rub`
);
assert(
  meta.numManzils === TOTAL_MANZIL,
  `upstream reports ${meta.numManzils} manzil`
);

const juzRanges = unitRanges(JuzList, TOTAL_JUZ, 'juz');
const pageRanges = unitRanges(PageList, MADANI_PAGES, 'page');
const rubRanges = unitRanges(HizbQuarterList, TOTAL_RUB, 'rub al-hizb');
const manzilRanges = unitRanges(ManzilList, TOTAL_MANZIL, 'manzil');

const juzOf = lookupFor(juzRanges);
const rubOf = lookupFor(rubRanges);
const manzilOf = lookupFor(manzilRanges);

// ---------------------------------------------------------------------------
// Surahs
// ---------------------------------------------------------------------------
// SurahList entries are tuples:
//   [startAyahId, ayahCount, revelationOrder, rukuCount, arabicName, isMeccan]
// Index 0 is a placeholder and index 115 is a sentinel.

const surahs = [];
let expectedStart = 1;

for (let n = 1; n <= TOTAL_SURAHS; n += 1) {
  const entry = SurahList[n];
  assert(Array.isArray(entry), `surah ${n}: missing entry`);

  const [
    startAyahId,
    ayahCount,
    revelationOrder,
    rukuCount,
    nameArabic,
    isMeccan,
  ] = entry;

  assert(
    startAyahId === expectedStart,
    `surah ${n}: starts at ${startAyahId}, expected ${expectedStart}`
  );
  assert(ayahCount > 0, `surah ${n}: non-positive ayah count`);
  assert(
    typeof nameArabic === 'string' && /[\u0600-\u06FF]/.test(nameArabic),
    `surah ${n}: Arabic name missing or not in Arabic script`
  );
  assert(
    typeof isMeccan === 'boolean',
    `surah ${n}: isMeccan is not a boolean`
  );

  const names = surahNamesEn[n];
  assert(
    Array.isArray(names) && names.length >= 2,
    `surah ${n}: English names missing`
  );

  surahs.push({
    number: n,
    firstAyahId: startAyahId,
    lastAyahId: startAyahId + ayahCount - 1,
    ayahCount,
    rukuCount,
    revelationOrder,
    isMeccan,
    nameArabic,
    nameTransliterated: names[0],
    nameEnglish: names[1],
  });

  expectedStart += ayahCount;
}

assert(
  expectedStart - 1 === TOTAL_AYAHS,
  `surah ayah counts sum to ${expectedStart - 1}, expected ${TOTAL_AYAHS}`
);
assert(
  new Set(surahs.map((s) => s.revelationOrder)).size === TOTAL_SURAHS,
  `revelation order is not a permutation of 1..${TOTAL_SURAHS}`
);
assert(
  new Set(surahs.map((s) => s.nameArabic)).size === TOTAL_SURAHS,
  'duplicate Arabic surah names'
);

// ---------------------------------------------------------------------------
// Sajdah
// ---------------------------------------------------------------------------
// Fifteen marked positions, per the Tanzil set. Schools differ on which are
// obligatory and which recommended — notably Sad 38:24 — so the flag records
// only that a sajdah is marked and deliberately does not classify it.

const sajdahIds = new Set(
  SajdaList.filter((v) => typeof v === 'number' && v > 0)
);
assert(
  sajdahIds.size === TOTAL_SAJDAH,
  `expected ${TOTAL_SAJDAH} sajdah positions, found ${sajdahIds.size}`
);
for (const id of sajdahIds) {
  assert(id >= 1 && id <= TOTAL_AYAHS, `sajdah ayah ${id} out of range`);
}

// ---------------------------------------------------------------------------
// Build the ayah index
// ---------------------------------------------------------------------------

const surahOf = new Int16Array(TOTAL_AYAHS + 1);
const ayahNumOf = new Int16Array(TOTAL_AYAHS + 1);
for (const s of surahs) {
  for (let id = s.firstAyahId; id <= s.lastAyahId; id += 1) {
    surahOf[id] = s.number;
    ayahNumOf[id] = id - s.firstAyahId + 1;
  }
}

const ayahs = [];
for (let id = 1; id <= TOTAL_AYAHS; id += 1) {
  const rub = rubOf[id];
  ayahs.push({
    id,
    surah: surahOf[id],
    ayah: ayahNumOf[id],
    juz: juzOf[id],
    // Four rub' al-hizb per hizb, two hizb per juz'.
    hizb: Math.floor((rub - 1) / 4) + 1,
    rub,
    manzil: manzilOf[id],
    hasSajdah: sajdahIds.has(id),
  });
}

assert(ayahs.length === TOTAL_AYAHS, 'ayah count mismatch');
for (const a of ayahs) {
  assert(a.surah >= 1 && a.surah <= TOTAL_SURAHS, `ayah ${a.id}: bad surah`);
  assert(a.ayah >= 1, `ayah ${a.id}: bad ayah number`);
  assert(a.juz >= 1 && a.juz <= TOTAL_JUZ, `ayah ${a.id}: bad juz`);
  assert(a.hizb >= 1 && a.hizb <= TOTAL_HIZB, `ayah ${a.id}: bad hizb`);
  assert(a.rub >= 1 && a.rub <= TOTAL_RUB, `ayah ${a.id}: bad rub`);
  assert(a.manzil >= 1 && a.manzil <= TOTAL_MANZIL, `ayah ${a.id}: bad manzil`);
  // Units must nest: every ayah of a hizb sits inside exactly one juz'.
  assert(
    Math.ceil(a.hizb / 2) === a.juz,
    `ayah ${a.id}: hizb ${a.hizb} does not nest inside juz ${a.juz}`
  );
}

// ---------------------------------------------------------------------------
// Spot checks against independently well-known facts.
// These are the canary: if the upstream data or this derivation ever shifts,
// they break before a wrong seed reaches anyone's database.
// ---------------------------------------------------------------------------

function spot(id, expected, label) {
  const a = ayahs[id - 1];
  for (const [key, value] of Object.entries(expected)) {
    assert(
      a[key] === value,
      `spot check "${label}": ayah ${id} ${key} is ${a[key]}, expected ${value}`
    );
  }
}

// Absolute ids, only where they follow from counts that are beyond dispute.
spot(
  1,
  { surah: 1, ayah: 1, juz: 1, hizb: 1, rub: 1, manzil: 1 },
  'al-Fatihah 1:1'
);
spot(8, { surah: 2, ayah: 1 }, 'al-Baqarah 2:1 (al-Fatihah has 7 ayahs)');
spot(262, { surah: 2, ayah: 255, juz: 3 }, 'Ayat al-Kursi 2:255');
spot(TOTAL_AYAHS, { surah: 114, ayah: 6, juz: 30, manzil: 7 }, 'an-Nas 114:6');

/**
 * Everything else is asserted structurally, against the surah table rather
 * than against a remembered global id. Hard-coding ids recalled from memory is
 * how a plausible-looking off-by-one gets committed.
 */
const firstAyahOf = (surahNumber) => surahs[surahNumber - 1].firstAyahId;
const at = (id) => ayahs[id - 1];

function spotSurahAyah(surahNumber, ayahNumber, expected, label) {
  const id = firstAyahOf(surahNumber) + ayahNumber - 1;
  const a = at(id);
  assert(
    a.surah === surahNumber && a.ayah === ayahNumber,
    `${label}: round trip failed — ${surahNumber}:${ayahNumber} resolved to ${a.surah}:${a.ayah}`
  );
  for (const [key, value] of Object.entries(expected)) {
    assert(
      a[key] === value,
      `${label}: ${surahNumber}:${ayahNumber} ${key} is ${a[key]}, expected ${value}`
    );
  }
  return id;
}

// Round-trip every surah's first and last ayah through the index.
for (const s of surahs) {
  const first = at(s.firstAyahId);
  const last = at(s.lastAyahId);
  assert(
    first.surah === s.number && first.ayah === 1,
    `surah ${s.number}: first ayah does not round trip`
  );
  assert(
    last.surah === s.number && last.ayah === s.ayahCount,
    `surah ${s.number}: last ayah does not round trip`
  );
}

// Well-known structural facts about where the major divisions fall.
spotSurahAyah(50, 1, { manzil: 7 }, 'Qaf 50:1 opens manzil 7');
spotSurahAyah(67, 1, { juz: 29 }, 'al-Mulk 67:1 opens juz 29 (Tabarak)');
spotSurahAyah(78, 1, { juz: 30 }, 'an-Naba 78:1 opens juz 30 (Amma)');
spotSurahAyah(7, 206, { hasSajdah: true }, 'al-Araf 7:206 is a sajdah');
spotSurahAyah(96, 19, { hasSajdah: true }, 'al-Alaq 96:19 is a sajdah');
spotSurahAyah(32, 15, { hasSajdah: true }, 'as-Sajdah 32:15 is a sajdah');

assert(
  surahOf[juzRanges[28].start] === 67 && ayahNumOf[juzRanges[28].start] === 1,
  'juz 29 must open exactly at al-Mulk 67:1'
);
assert(
  surahOf[juzRanges[29].start] === 78 && ayahNumOf[juzRanges[29].start] === 1,
  'juz 30 must open exactly at an-Naba 78:1'
);
assert(
  surahOf[manzilRanges[6].start] === 50 &&
    ayahNumOf[manzilRanges[6].start] === 1,
  'manzil 7 must open exactly at Qaf 50:1'
);
assert(
  surahs[0].ayahCount === 7 && surahs[1].ayahCount === 286,
  'al-Fatihah must have 7 ayahs and al-Baqarah 286'
);
assert(surahs[113].ayahCount === 6, 'an-Nas must have 6 ayahs');

// Page boundaries. Al-Fatihah opens page 1, Ayat al-Kursi sits on page 42 of
// the Madani mushaf, and the closing ayah falls on the closing page.
const pageOf = (id) => pageRanges.find((p) => id >= p.start && id <= p.end);
assert(pageOf(1)?.number === 1, 'al-Fatihah 1:1 must be on page 1');
assert(
  pageOf(262)?.number === 42,
  `Ayat al-Kursi should be on Madani page 42, computed ${pageOf(262)?.number}`
);
assert(
  pageOf(TOTAL_AYAHS)?.number === MADANI_PAGES,
  'the last ayah must fall on the last page'
);
assert(
  pageOf(firstAyahOf(67))?.number === 562,
  `Surah al-Mulk should open Madani page 562, computed ${pageOf(firstAyahOf(67))?.number}`
);

// ---------------------------------------------------------------------------
// Emit SQL
// ---------------------------------------------------------------------------

mkdirSync(OUT_DIR, { recursive: true });

const rule = '-- ' + '-'.repeat(73);
const lines = [];

lines.push(rule);
lines.push('-- Quran reference data — Hafs riwayah, Madani 604 mushaf');
lines.push(rule);
lines.push('-- GENERATED FILE. Do not edit by hand.');
lines.push(
  '--   Source:     quran-meta (MIT) — github.com/quran-center/quran-meta'
);
lines.push('--   Generator:  scripts/generate-quran-reference.mjs');
lines.push('--   Regenerate: pnpm quran:generate');
lines.push('--   Verify:     pnpm quran:verify');
lines.push('--');
lines.push(
  `--   ${TOTAL_SURAHS} surahs · ${TOTAL_AYAHS} ayahs · ${MADANI_PAGES} pages`
);
lines.push(
  `--   ${TOTAL_JUZ} juz · ${TOTAL_HIZB} hizb · ${TOTAL_RUB} rub al-hizb · ${TOTAL_MANZIL} manzil · ${TOTAL_SAJDAH} sajdah`
);
lines.push(rule);
lines.push('');
lines.push('begin;');
lines.push('');

lines.push(
  '-- Mushaf editions ---------------------------------------------------------'
);
lines.push(
  'insert into public.mushaf_editions (id, slug, name, riwayah, page_count, is_default) values'
);
lines.push(
  "  (1, 'madani-604', 'Madani Mushaf (604 pages)', 'hafs', 604, true)"
);
lines.push('on conflict (id) do nothing;');
lines.push('');

lines.push(
  '-- Surahs ------------------------------------------------------------------'
);
lines.push(
  'insert into public.surahs (number, name_arabic, name_transliterated, name_english, ayah_count, ruku_count, revelation_order, revelation_place, first_ayah_id, last_ayah_id) values'
);
lines.push(
  surahs
    .map(
      (s) =>
        `  (${s.number}, ${sqlString(s.nameArabic)}, ${sqlString(s.nameTransliterated)}, ${sqlString(s.nameEnglish)}, ${s.ayahCount}, ${s.rukuCount}, ${s.revelationOrder}, ${sqlString(s.isMeccan ? 'meccan' : 'medinan')}, ${s.firstAyahId}, ${s.lastAyahId})`
    )
    .join(',\n')
);
lines.push('on conflict (number) do nothing;');
lines.push('');

lines.push(
  '-- Ayah index --------------------------------------------------------------'
);
lines.push(
  'insert into public.ayahs (id, surah_number, ayah_number, juz, hizb, rub, manzil, has_sajdah) values'
);
lines.push(
  ayahs
    .map(
      (a) =>
        `  (${a.id},${a.surah},${a.ayah},${a.juz},${a.hizb},${a.rub},${a.manzil},${a.hasSajdah})`
    )
    .join(',\n')
);
lines.push('on conflict (id) do nothing;');
lines.push('');

lines.push(
  '-- Madani 604 page map -----------------------------------------------------'
);
lines.push(
  'insert into public.mushaf_pages (edition_id, page_number, ayah_range) values'
);
lines.push(
  pageRanges
    .map((p) => `  (1,${p.number},int4range(${p.start},${p.end},'[]'))`)
    .join(',\n')
);
lines.push('on conflict (edition_id, page_number) do nothing;');
lines.push('');

lines.push('commit;');
lines.push('');

const sql = lines.join('\n');
writeFileSync(join(OUT_DIR, 'quran_reference.sql'), sql, 'utf8');

const checksum = createHash('sha256').update(sql).digest('hex');
writeFileSync(
  join(OUT_DIR, 'quran_reference.sha256'),
  `${checksum}  quran_reference.sql\n`,
  'utf8'
);

console.log('Quran reference data generated.\n');
console.log(`  surahs        ${surahs.length}`);
console.log(`  ayahs         ${ayahs.length}`);
console.log(`  pages         ${pageRanges.length}`);
console.log(`  juz           ${juzRanges.length}`);
console.log(`  rub al-hizb   ${rubRanges.length}`);
console.log(`  manzil        ${manzilRanges.length}`);
console.log(`  sajdah        ${sajdahIds.size}`);
console.log(`\n  assertions    ${checks} passed`);
console.log('  file          supabase/seed/quran_reference.sql');
console.log(`  sha256        ${checksum}`);
