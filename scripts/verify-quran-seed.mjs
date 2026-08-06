/**
 * Verifies the committed Quran seed against its recorded checksum.
 *
 * The seed is generated data that everything else depends on. If it is edited
 * by hand, or corrupted in a merge, this catches it before it reaches a
 * database. Runs as part of `pnpm verify`.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedDir = join(__dirname, '..', 'supabase', 'seed');

const sql = readFileSync(join(seedDir, 'quran_reference.sql'), 'utf8');
const recorded = readFileSync(join(seedDir, 'quran_reference.sha256'), 'utf8')
  .trim()
  .split(/\s+/)[0];

const actual = createHash('sha256').update(sql).digest('hex');

if (actual !== recorded) {
  console.error('Quran seed checksum mismatch.\n');
  console.error(`  recorded  ${recorded}`);
  console.error(`  actual    ${actual}\n`);
  console.error(
    'The seed has been modified. Regenerate it with `pnpm quran:generate`'
  );
  console.error('rather than editing it by hand.');
  process.exit(1);
}

console.log(`Quran seed checksum OK (${actual.slice(0, 16)}…)`);
