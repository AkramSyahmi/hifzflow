import { describe, expect, it } from 'vitest';

import en from '../../messages/en.json';
import ms from '../../messages/ms.json';

/**
 * Catalogue parity.
 *
 * A missing key does not fail the build — next-intl falls back at runtime — so
 * the only thing that keeps translations complete is a test that walks both
 * trees. Without this, adding an English string quietly leaves the other
 * locale showing a raw key.
 */
function flatten(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, next]) => flatten(next, prefix ? `${prefix}.${key}` : key)
  );
}

const enKeys = flatten(en).sort();
const msKeys = flatten(ms).sort();

describe('message catalogues', () => {
  it('define the same keys', () => {
    expect(msKeys).toEqual(enKeys);
  });

  it('have no empty strings', () => {
    const empties: string[] = [];
    const walk = (value: unknown, path: string) => {
      if (typeof value === 'string') {
        if (value.trim() === '') empties.push(path);
        return;
      }
      if (typeof value === 'object' && value !== null) {
        for (const [key, next] of Object.entries(
          value as Record<string, unknown>
        )) {
          walk(next, path ? `${path}.${key}` : key);
        }
      }
    };
    walk(en, '');
    walk(ms, '');
    expect(empties).toEqual([]);
  });

  it('keep interpolation placeholders consistent across locales', () => {
    const placeholders = (source: unknown, path: string[]): string[] => {
      let node: unknown = source;
      for (const key of path) {
        node = (node as Record<string, unknown>)[key];
      }
      return [...String(node).matchAll(/\{(\w+)\}/g)]
        .map((match) => match[1])
        .filter((name): name is string => name !== undefined)
        .sort();
    };

    const path = ['settings', 'danger', 'confirmLab'];
    expect(placeholders(ms, path)).toEqual(placeholders(en, path));
  });
});
