/**
 * Public client-safe surface of the memorisation feature.
 * Server-only exports live in `./server`.
 */
export {
  densityClass,
  densityFill,
  densityLabel,
  densityLevel,
  type DensityLevel,
} from './lib/density';
export { DensityLegend, MushafStrip } from './components/mushaf-strip';
export { PageGrid } from './components/page-grid';
export { ProgressStats } from './components/progress-stats';
export { RecordDialog, type SurahOption } from './components/record-dialog';
export { SurahList, type SurahRow } from './components/surah-list';
