import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind class names, resolving conflicts so the last class wins.
 * Every component uses this instead of template-literal concatenation.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Format a whole number for display with locale-aware grouping.
 * Used for page counts, ayah totals and streak days.
 */
export function formatCount(value: number, locale = 'en'): string {
  return new Intl.NumberFormat(locale).format(value);
}

/**
 * Express `value` as a whole-number percentage of `total`, clamped to 0-100.
 * Returns 0 rather than NaN when the denominator is zero, because progress
 * bars render before a user has any data.
 */
export function toPercent(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((value / total) * 100)));
}
