import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CONTRIBUTOR_CATEGORIES,
  THEMATIC_GALLERY_CATEGORY_BY_LEGACY_KEY,
  THEMATIC_GALLERY_CONTRIBUTOR_CATEGORIES,
} from '../../src/domain/contributor-category.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

/** The backed values of a PHP enum, in declaration order. */
function phpEnumValues(enumFile: string): string[] {
  const source = readFileSync(resolve(repoRoot, 'app/Enums', enumFile), 'utf8');
  return [...source.matchAll(/^\s*case\s+\w+\s*=\s*'([^']*)';/gm)].map((match) => match[1]!);
}

describe('contributor categories (#2795)', () => {
  it('holds the same values as App\\Enums\\ContributorCategory', () => {
    expect([...CONTRIBUTOR_CATEGORIES]).toEqual(phpEnumValues('ContributorCategory.php'));
  });

  it('maps every legacy key to its own category', () => {
    const mapped = Object.values(THEMATIC_GALLERY_CATEGORY_BY_LEGACY_KEY);
    expect(new Set(mapped).size).toBe(mapped.length);
    expect([...mapped].sort()).toEqual([...THEMATIC_GALLERY_CONTRIBUTOR_CATEGORIES].sort());
  });
});
