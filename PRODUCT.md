# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Real huffaz: students and adults who are memorising the Quran or keeping what
they have already memorised, for example Malaysian tahfiz students. They use
HifzFlow daily, often on a phone, to see today's review (murajaah), rate each
page as they recite it, and record new memorisation.

## Product Purpose

HifzFlow plans memorisation and murajaah over months and years. It replaces
notebooks, spreadsheets and WhatsApp messages. Success is a user who opens the
app every day, finishes the day's review and can see where their memorisation
stands across the whole mushaf.

## Positioning

Most Quran apps are built for reading, listening and recitation checking.
HifzFlow is built for planning and maintaining memorisation. Review follows
recitation: a contiguous manzil rotation with sabqi (recent material) and weak
pages pulled forward, not card-style spaced repetition that scatters pages.

## Operating Context

- Daily ritual: open the app, recite the day's pages, rate each page 1 (very
  shaky) to 5 (fluent).
- Progress is recorded by page, surah or ayah range on the Madani mushaf
  (604 pages, 30 juz', 6,236 ayahs). The ayah is the single source of truth.
- Goals are a scope plus a date; pace is measured against what was actually
  recorded.
- Works offline as a PWA; ratings made offline sync later.

## Capabilities and Constraints

- Features: dashboard, memorisation tracking (page grid, mushaf strip),
  murajaah plan and daily queue, weak pages, goals, analytics (growth, review
  volume, strongest/weakest, consistency heatmap), settings (profile,
  timezone, language, theme, reminders, data export, account deletion).
- Stack: Next.js 15, React 19, Tailwind v4, shadcn/ui, Supabase, deployed on
  Vercel from the GitHub `main` branch.
- Interface languages: English and Bahasa Melayu. Layouts must fit the longer
  Malay strings. Malay currently covers navigation, settings and sign-in.
- Light and dark themes; respects reduced motion.
- Reminders are saved but not yet delivered.

## Brand Commitments

- The name "HifzFlow" stays.
- The current logo, green brand colour and public design-system page are not
  binding and may be replaced.

## Evidence on Hand

- No testimonials, user counts, reviews or institutional endorsements exist.
  None may be invented.
- Real facts that can be shown: 604 pages, 30 juz', 6,236 ayahs, the
  scheduling rules (manzil, sabqi, weak-page cap of a third of the day).
- Logo files: `brand-assets/`, `public/icons/`.

## Product Principles

- Today's review is the main action; everything else supports it.
- Honest numbers: show what was actually recorded, never flattering
  projections.
- Follow how huffaz really recite and are taught, not generic study-app
  patterns.
- Respect the Quran: sacred text and terms are handled with care, never as
  decoration.

## Accessibility & Inclusion

- Used daily on phones: comfortable touch targets and readable text at small
  sizes.
- Bilingual English/Malay; Arabic terms (juz', murajaah, sabqi, manzil) are
  used as huffaz use them.
