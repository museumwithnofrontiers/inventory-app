import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { COLLECTION_PURPOSES, COLLECTION_TYPES } from '../../src/domain/collection-vocabulary.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

/** The backed values of a PHP enum, in declaration order. */
function phpEnumValues(enumFile: string): string[] {
  const source = readFileSync(resolve(repoRoot, 'app/Enums', enumFile), 'utf8');
  return [...source.matchAll(/^\s*case\s+\w+\s*=\s*'([^']*)';/gm)].map((match) => match[1]!);
}

describe('collection vocabulary (#2794)', () => {
  it('holds the same types as App\\Enums\\CollectionType', () => {
    expect([...COLLECTION_TYPES]).toEqual(phpEnumValues('CollectionType.php'));
  });

  it('holds the same purposes as App\\Enums\\CollectionPurpose', () => {
    expect([...COLLECTION_PURPOSES]).toEqual(phpEnumValues('CollectionPurpose.php'));
  });
});
