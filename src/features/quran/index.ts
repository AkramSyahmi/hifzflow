/**
 * Public client-safe surface of the quran feature.
 * Server-only exports live in `./server`.
 */
export {
  AyahRangeError,
  createRange,
  gapsWithin,
  isAyahId,
  mergeRanges,
  parseRange,
  rangeContains,
  rangeLength,
  rangesAdjacent,
  rangesOverlap,
  subtractRange,
  toRangeLiteral,
  totalAyahs,
  type AyahRange,
} from './lib/ranges';
