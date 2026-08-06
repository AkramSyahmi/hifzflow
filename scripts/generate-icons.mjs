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

/** Brand green, matching --primary in the light palette. */
const GREEN = '#1f7a52';

/**
 * The mark on its own, transparent. Used for the favicon and any context that
 * supplies its own background.
 */
const markSvg = (size, colour) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">
  <rect x="3" y="4"  width="18"  height="2.6" rx="1.3" fill="${colour}"/>
  <rect x="3" y="9"  width="18"  height="2.6" rx="1.3" fill="${colour}" opacity="0.7"/>
  <rect x="3" y="14" width="12"  height="2.6" rx="1.3" fill="${colour}" opacity="0.42"/>
  <rect x="3" y="19" width="6.5" height="2.6" rx="1.3" fill="${colour}" opacity="0.22"/>
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
  <rect width="${size}" height="${size}" rx="${radius}" fill="${GREEN}"/>
  <g transform="translate(${offset} ${offset}) scale(${markSize / 24})">
    <rect x="3" y="4"  width="18"  height="2.6" rx="1.3" fill="#ffffff"/>
    <rect x="3" y="9"  width="18"  height="2.6" rx="1.3" fill="#ffffff" opacity="0.72"/>
    <rect x="3" y="14" width="12"  height="2.6" rx="1.3" fill="#ffffff" opacity="0.46"/>
    <rect x="3" y="19" width="6.5" height="2.6" rx="1.3" fill="#ffffff" opacity="0.26"/>
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

writeFileSync(join(OUT, 'icon.svg'), markSvg(24, GREEN).trim(), 'utf8');
console.log('  icon.svg');

const favicon = await sharp(Buffer.from(tileSvg(48, { maskable: false })))
  .png()
  .toBuffer();
writeFileSync(join(__dirname, '..', 'public', 'favicon.ico'), favicon);
console.log('  favicon.ico (PNG payload, which every current browser accepts)');

console.log('\nIcons written to public/icons.');
