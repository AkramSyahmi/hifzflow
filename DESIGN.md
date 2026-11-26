---
name: HifzFlow
description: Quran memorisation and murajaah planner, built like a 1960s Malaysian mosque.
colors:
  terrazzo: "oklch(0.968 0.005 175)"
  terrazzo-card: "oklch(0.992 0.003 175)"
  terrazzo-wash: "oklch(0.93 0.008 180)"
  terrazzo-accent: "oklch(0.925 0.012 180)"
  teal-black-ink: "oklch(0.23 0.022 195)"
  muted-ink: "oklch(0.49 0.018 195)"
  hairline: "oklch(0.885 0.01 180)"
  input-stroke: "oklch(0.85 0.012 180)"
  primary: "oklch(0.45 0.075 195)"
  primary-foreground: "oklch(0.985 0.005 180)"
  roof: "oklch(0.5 0.085 192)"
  roof-night: "oklch(0.33 0.055 196)"
  sun: "oklch(0.8 0.13 82)"
  block: "oklch(0.86 0.012 180)"
  destructive: "oklch(0.53 0.16 30)"
  state-new: "oklch(0.915 0.008 180)"
  state-new-foreground: "oklch(0.42 0.02 195)"
  state-learning: "oklch(0.86 0.05 225)"
  state-learning-foreground: "oklch(0.3 0.06 235)"
  state-memorised: "oklch(0.54 0.09 182)"
  state-memorised-foreground: "oklch(0.985 0.005 180)"
  state-weak: "oklch(0.78 0.13 80)"
  state-weak-foreground: "oklch(0.27 0.05 70)"
  state-overdue: "oklch(0.53 0.15 35)"
  state-overdue-foreground: "oklch(0.985 0.005 35)"
  hifz-0: "oklch(0.915 0.008 180)"
  hifz-1: "oklch(0.85 0.05 180)"
  hifz-2: "oklch(0.74 0.08 182)"
  hifz-3: "oklch(0.6 0.09 185)"
  hifz-4: "oklch(0.45 0.075 195)"
  light-manzil: "oklch(0.88 0.09 178)"
  light-sabqi: "oklch(0.84 0.07 232)"
  night-ground: "oklch(0.19 0.018 200)"
  night-card: "oklch(0.225 0.02 200)"
  night-ink: "oklch(0.95 0.008 180)"
  night-primary: "oklch(0.74 0.1 180)"
typography:
  display:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(4.5rem, 8vw, 7.5rem)"
    fontWeight: 700
    lineHeight: 0.9
    fontVariation: "'wdth' 118"
    fontFeature: "'tnum'"
  headline:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "3rem"
    fontWeight: 700
    lineHeight: 1.06
    letterSpacing: "-0.025em"
    fontVariation: "'wdth' 118"
  title:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.025em"
    fontVariation: "'wdth' 118"
  card-title:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.025em"
    fontVariation: "'wdth' 118"
  body:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.625
  body-sm:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.625
  label:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.33
  arabic:
    fontFamily: "Noto Naskh Arabic, serif"
    lineHeight: 2.1
rounded:
  none: "0px"
  block: "2px"
  md: "2px"
  lg: "4px"
  xl: "6px"
spacing:
  block-gap: "2px"
  gutter: "24px"
  card: "24px"
  section: "80px"
  section-lg: "112px"
  column: "72rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-primary-lg:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    padding: "0 24px"
    height: "40px"
  button-outline:
    backgroundColor: "{colors.terrazzo}"
    textColor: "{colors.teal-black-ink}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-outline-hover:
    backgroundColor: "{colors.terrazzo-accent}"
  button-ghost-hover:
    backgroundColor: "{colors.terrazzo-accent}"
    textColor: "{colors.teal-black-ink}"
  card:
    backgroundColor: "{colors.terrazzo-card}"
    textColor: "{colors.teal-black-ink}"
    rounded: "{rounded.md}"
    padding: "24px"
  badge-memorised:
    backgroundColor: "{colors.state-memorised}"
    textColor: "{colors.state-memorised-foreground}"
    rounded: "{rounded.md}"
    padding: "2px 8px"
  badge-learning:
    backgroundColor: "{colors.state-learning}"
    textColor: "{colors.state-learning-foreground}"
    rounded: "{rounded.md}"
    padding: "2px 8px"
  badge-weak:
    backgroundColor: "{colors.state-weak}"
    textColor: "{colors.state-weak-foreground}"
    rounded: "{rounded.md}"
    padding: "2px 8px"
  breeze-block:
    backgroundColor: "{colors.block}"
    rounded: "{rounded.block}"
    size: "36px"
  roof-band:
    backgroundColor: "{colors.roof}"
    textColor: "{colors.night-ink}"
    height: "56px"
---

# Design System: HifzFlow

## Overview

**Creative North Star: "The Breeze-Block Screen"**

HifzFlow is built from 1960s Malaysian mosque modernism: a terrazzo floor, a roof of teal mosaic with a folded-plate edge, and perforated concrete breeze-block screens that let light through. The whole mushaf is one such screen. Each of the 604 pages is one block, and a memorised page lets light through its quatrefoil opening. The brand mark is a single block with brass sunlight behind it, so the logo, the tracking grid and the landing screen are the same unit at different sizes.

Structure stays in cool terrazzo neutrals (green-grey, never cream) and teal-black ink. Teal is the committed brand field: the roof band over every signed-in page, and full-height roof fields on the landing and auth pages. Inside a roof field, text and controls use the night palette, so light-on-teal reads the same in both themes. Depth comes from flat overlapping planes and hairline rules. There are no soft shadows on cards or controls, and no gradients.

Density is operational: the app is a daily tool used on phones, so the world lives in tokens, the roof, the page grid and the today panel, not in decoration. Display type is Archivo pulled wide, like lettering cast in concrete. Running text stays at normal width.

**Key Characteristics:**
- Terrazzo ground, roof-teal field, turquoise light, brass sun, clay for overdue.
- One unit, the breeze block, reused for logo, page grid, legends and the landing screen.
- A folded-plate pleat strip as the roof line under the app header and over the landing field.
- Sharp corners (2px), hairline borders, flat planes, no card or control shadows.
- Archivo at two widths: expanded (118%) for display, normal for UI and reading.
- Tabular figures on every number that counts pages, days or ayahs.

## Colors

A cool mineral palette: terrazzo neutrals carry structure, one teal carries the brand, and three warm or light hues carry memorisation state.

### Primary
- **Roof Mosaic Teal** (`primary`): buttons, active links, the "Next" page numeral in the review queue, focus rings, chart series 1, the top step of the density ramp. In dark theme it lifts to **Night Turquoise** (`night-primary`).
- **Roof Band Teal** (`roof`): the field colour for the app header, its eave strip, and the landing and auth roof panels. It has its own token because content inside it uses the dark palette. In dark theme the roof deepens to `roof-night`, set only at `:root.dark` so nested `.dark` roof wrappers keep the page theme's roof.

### Secondary
- **Brass Sun** (`sun`): the light behind the logo's opening, weak pages on the landing screen, the streak icon, and the single call to action that sits on a roof field. Warm, rare, and always meaning sunlight or attention.

### Tertiary
- **Turquoise Light** (`light-manzil`) and **Sky Light** (`light-sabqi`): the colours seen through a block's opening on the roof field, for manzil and sabqi pages. These are used on the landing and auth screens and their legend.
- **Clay** (`state-overdue`, `destructive`): overdue reviews and destructive actions.

### Neutral
- **Terrazzo** (`terrazzo`): page ground. **Terrazzo Card** (`terrazzo-card`): card and popover surfaces, a half-step lighter than the floor.
- **Terrazzo Wash** (`terrazzo-wash`, `terrazzo-accent`): secondary and muted fills, ghost and outline hover.
- **Teal-Black Ink** (`teal-black-ink`): all body text. **Muted Ink** (`muted-ink`): descriptions, captions, meta.
- **Hairline** (`hairline`) and **Input Stroke** (`input-stroke`): every border and divider.
- **Cast Concrete** (`block`): the frame of a breeze block around its opening.
- **Night** (`night-ground`, `night-card`, `night-ink`): the dark theme, "the surau after Isya, lit from inside". Borders become white at 10%, inputs white at 16%.

### State and ramp
- **Memorisation states** (`state-new`, `state-learning`, `state-memorised`, `state-weak`, `state-overdue`, each with a `-foreground`): solid pairs used by badges, the review queue and the page grid. Tinted washes were rejected because the lighter states fell below 4.5:1.
- **Density ramp** (`hifz-0` to `hifz-4`): terrazzo through turquoise light to roof teal. It is used for the page grid openings, the mushaf strip, the legend and the activity heatmap.

### Named Rules
**The Light-Through Rule.** Turquoise and teal light inside a block means memorised. Never use the density ramp or `state-memorised` for decoration. A lit block is a claim about the user's hifz.

**The One Status Source Rule.** Status colours come only from the `state-*` and `hifz-*` tokens. A page never invents its own status colour.

**The Roof Inverts Rule.** Anything placed on a roof field is wrapped in the dark palette, so its text is light on teal in both themes.

## Typography

**Display Font:** Archivo, expanded to 118% width via the `wdth` axis (with ui-sans-serif, system-ui)
**Body Font:** Archivo at normal width
**Arabic Font:** Noto Naskh Arabic, right-to-left, line-height 2.1, loaded up front

**Character:** One grotesque family at two widths. Wide and bold for anything that reads as cast lettering, normal width and regular weight for everything a hafiz reads while working.

### Hierarchy
- **Display** (700, clamp(4.5rem, 8vw, 7.5rem), 0.9, expanded, tabular): the monumental page numeral on the landing and auth roof fields. In the app, the review queue's "Next" page numeral uses the same treatment at 3rem in primary teal.
- **Headline** (700, 2.25rem to 3rem, 1.06, -0.025em, expanded): the landing h1, balanced wrap.
- **Title** (700, 1.5rem to 1.875rem, expanded): section headings on the landing and page headings in the app.
- **Card Title** (600, 1rem, leading none, expanded): card titles, juz' headings in the grid, defined terms.
- **Body** (400, 1rem or 0.875rem, 1.625): explanations, max width about 28rem to 32rem (`max-w-md` to `max-w-lg`).
- **Label** (500, 0.75rem): meta, captions, legends, mobile nav. Sentence case, no tracking.

### Named Rules
**The Two Widths Rule.** Expanded width only with `font-display`. Body, buttons, labels and form text stay at normal width.

**The Steady Numbers Rule.** Every page count, streak, ayah count and table cell uses tabular figures so readouts never jitter as they increment.

## Layout

Content sits in a single 72rem column with 24px side gutters. App pages use 40px vertical padding. The landing page uses a 12-column grid from `lg` up: text in 5 columns, the roof field in 7. Full-bleed roof sections align their text to the column edge. Landing sections breathe at 80px vertical spacing (112px from `sm`).

The app shell uses a sticky roof header 56px tall, not a sidebar, so the page grid gets the full width. Below `md` the navigation moves into a horizontally scrollable 12px strip inside the roof band, with all five destinations visible. It never collapses into a hamburger. The auth layout is two columns on `lg`, with the roof panel on the right. Below `lg` the roof panel is dropped and the form fills the screen. On the landing page at mobile width, the headline and button come first and the screen follows at full width.

Breeze blocks sit 2px apart (a 1px to 2px gap) so the grid reads as one perforated wall, not a set of tiles. Juz' groups in the tracking grid are spaced 20px apart.

## Elevation & Depth

The system is flat. `shadow-xs` and `shadow-sm` are set to `none`, so buttons, inputs and cards carry no shadow. Depth comes from overlapping flat planes: a terrazzo card on a terrazzo floor with a hairline edge, a teal roof band over the page, and the pleated eave hanging over the content below. Only floating layers (menus, popovers, selects, dialogs) keep their stock shadow, because there it separates planes.

### Shadow Vocabulary
- **Floating layer** (`box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)`, Tailwind `shadow-md`): dropdowns, popovers, selects. Dialogs use `shadow-lg`.

### Named Rules
**The Flat Planes Rule.** Surfaces at rest have no shadow. Separate planes with a hairline or a change of tone. A shadow is allowed only on a layer that floats over the page.

## Shapes

Corners are sharp. The base radius is 2px: cards, buttons, badges and blocks all use 2px. The `sm` step resolves to 0. Larger steps (4px, 6px) are kept only for stock floating layers. Borders are 1px hairlines.

The silhouette of the world is the **folded-plate pleat**: a 22px strip of deep triangular pleats repeating every 112px, cut with a CSS mask from the roof colour. The **eave** hangs below a roof band with its points down (the app header). The **ridge** sits on top of a roof field with its points up (the landing field). Use one roof line per view.

The **quatrefoil opening** is four circles and a centre circle masked out of a square. It is the only cut-out shape, and it is the same geometry in the logo, the app icons and every block.

## Components

### Buttons
Flat and decisive: a solid teal slab with no shadow.
- **Shape:** sharp (2px).
- **Primary:** roof mosaic teal with near-white text, 36px tall, 16px padding. Large size is 40px tall with 24px padding (the landing call to action).
- **Hover / Focus:** hover drops the fill to 90%. Focus shows a 3px ring in `ring` at 50%.
- **Outline:** terrazzo fill with a hairline border. On hover it fills with terrazzo accent. Used for secondary actions in cards ("Open murajaah", "Record progress").
- **Ghost:** no fill until hover. Used for header links.
- **On a roof field:** the single call to action uses brass sun with dark brass ink, so it reads against teal.

### Chips / Badges
- **Style:** 2px corners, 12px medium text, 2px by 8px padding.
- **State:** memorised, learning and weak use the solid state pairs. Default is primary teal. Secondary is terrazzo wash.

### Cards / Containers
- **Corner Style:** 2px.
- **Background:** terrazzo card on the terrazzo floor.
- **Shadow Strategy:** none (see Flat Planes).
- **Border:** 1px hairline.
- **Internal Padding:** 24px, with 24px between header and content.

### Navigation
- **Style:** a roof band (`roof`, 56px) with the logo and links in night ink, and a pleated eave below it.
- **Links:** 14px. Inactive links are ink at 85%. Hover adds a 10% ink wash. Active links get a 15% ink wash, semibold, and `aria-current="page"`.
- **Mobile:** a scrolling 12px strip inside the same band. The active link scrolls into view.

### Breeze Block (signature)
One page of the mushaf. It is a cast-concrete square (`block`, 2px corners) with a quatrefoil opening, and the page's state shows through the opening.
- **Page grid:** 36px blocks (32px from `sm`), with the page number in 11px semibold tabular figures. The opening uses the density ramp. Hover adds a 2px ink ring at 30%. Focus adds a 2px `ring`. Pending blocks fade to 60%.
- **Roof screen:** blocks on the roof field have a white frame at 18%. Today's pages have a solid white frame. The openings use `light-manzil`, `light-sabqi`, `sun` for weak pages, or black at 30% when not memorised. Rows are juz', and arrow keys and pointer name each page in a live caption. Colour transitions take 700ms. The today set advances every 6 seconds and stops under reduced motion.
- **Legend:** 14px blocks with the five ramp steps, labelled "None" and "Complete".

### Mushaf Strip
All 604 pages as one 40px horizontal band of density-ramp slivers, with juz' boundaries drawn as 1px rules. It is an overview and does not respond to input.

### Review Queue
A divided list. Each row has a 36px position tile (muted, or memorised with a check when done) and 1 to 5 rating buttons. The rating buttons are 40px squares on phones and 32px from `sm`, outlined, and fill with teal on hover. The next page is shown as a large expanded teal numeral, sized to read from a rehal.

## Do's and Don'ts

### Do:
- **Do** build page-level visuals from the breeze block. One block equals one page.
- **Do** keep text on any roof field in the dark palette (wrap the field in `.dark`).
- **Do** use `font-display` (expanded Archivo) for headings and numerals only.
- **Do** use tabular figures on every count, page number and table cell.
- **Do** take status colours only from `state-*` and `hifz-*` tokens.
- **Do** separate surfaces with 1px hairlines and tone, and keep corners at 2px.
- **Do** honour reduced motion: page enter is 180ms ease-out, and looping motion stops.

### Don't:
- **Don't** use cream or warm-white grounds. Terrazzo is cool green-grey.
- **Don't** add shadows to cards, buttons or inputs, and don't use gradients for fills.
- **Don't** draw more than one pleated roof line in a view.
- **Don't** light a block (turquoise, teal or brass in its opening) unless it states real memorisation data. On marketing surfaces, label example data as an example.
- **Don't** use the Arabic face or sacred text as ornament. Arabic appears only as content, right to left, at line-height 2.1.
