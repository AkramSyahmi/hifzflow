/**
 * Rasterises the brand mark into the PNG sizes installable web apps need.
 *
 * Run after changing the mark:
 *   pnpm icons:generate
 *
 * The output is committed. Generating icons at build time would mean shipping
 * an image toolchain to CI for assets that change once a year.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'public', 'icons');

/** Roof teal and brass sunlight, matching --roof and --sun in the light palette. */
const TEAL = '#16767a';
const SUN = '#e3b04b';

/**
 * One breeze block: a concrete square with a quatrefoil opening, sunlight
 * showing through. Same geometry as LogoMark in src/components/brand/logo.tsx.
 */
const blockMark = (block) => `
  <defs>
    <mask id="b">
      <rect width="24" height="24" fill="#fff"/>
      <circle cx="12" cy="7.6" r="3.6" fill="#000"/>
      <circle cx="12" cy="16.4" r="3.6" fill="#000"/>
      <circle cx="7.6" cy="12" r="3.6" fill="#000"/>
      <circle cx="16.4" cy="12" r="3.6" fill="#000"/>
    </mask>
  </defs>
  <rect x="3" y="3" width="18" height="18" fill="${SUN}"/>
  <rect x="2" y="2" width="20" height="20" fill="${block}" mask="url(#b)"/>`;

/**
 * The mark on its own, transparent. Used for the favicon and any context that
 * supplies its own background.
 */
const markSvg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">${blockMark(TEAL)}
</svg>`;

/**
 * A filled tile. Android and iOS both composite icons onto their own shapes, so
 * a transparent icon ends up floating on whatever the launcher decides.
 */
const tileSvg = (size, { maskable }) => {
  // Maskable icons are cropped to a circle inscribed in the safe zone, so the
  // mark has to sit inside the middle 80 percent or the edges get shaved off.
  const inset = maskable ? 0.2 : 0.14;
  const markSize = Math.round(size * (1 - inset * 2));
  const offset = Math.round((size - markSize) / 2);
  const radius = maskable ? 0 : Math.round(size * 0.22);

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="${TEAL}"/>
  <g transform="translate(${offset} ${offset}) scale(${markSize / 24})">${blockMark('#f3f6f4')}
  </g>
</svg>`;
};

mkdirSync(OUT, { recursive: true });

const targets = [
  { file: 'icon-192.png', size: 192, svg: tileSvg(192, { maskable: false }) },
  { file: 'icon-512.png', size: 512, svg: tileSvg(512, { maskable: false }) },
  {
    file: 'maskable-512.png',
    size: 512,
    svg: tileSvg(512, { maskable: true }),
  },
  // iOS ignores the manifest and looks for this specific link tag target.
  {
    file: 'apple-touch-icon.png',
    size: 180,
    svg: tileSvg(180, { maskable: false }),
  },
];

for (const target of targets) {
  const png = await sharp(Buffer.from(target.svg)).png().toBuffer();
  writeFileSync(join(OUT, target.file), png);
  console.log(`  ${target.file}  ${target.size}x${target.size}`);
}

writeFileSync(join(OUT, 'icon.svg'), markSvg(24).trim(), 'utf8');
console.log('  icon.svg');

const favicon = await sharp(Buffer.from(tileSvg(48, { maskable: false })))
  .png()
  .toBuffer();
writeFileSync(join(__dirname, '..', 'public', 'favicon.ico'), favicon);
console.log('  favicon.ico (PNG payload, which every current browser accepts)');

console.log('\nIcons written to public/icons.');
