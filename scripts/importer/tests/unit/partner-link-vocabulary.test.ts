import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  COLLECTION_PARTNER_TYPES,
  PARTNER_LEVELS,
} from '../../src/domain/partner-link-vocabulary.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

/** The backed values of a PHP enum, in declaration order. */
function phpEnumValues(enumFile: string): string[] {
  const source = readFileSync(resolve(repoRoot, 'app/Enums', enumFile), 'utf8');
  return [...source.matchAll(/^\s*case\s+\w+\s*=\s*'([^']*)';/gm)].map((match) => match[1]!);
}

describe('partner link vocabulary (#2796)', () => {
  it('holds the same levels as App\\Enums\\PartnerLevel', () => {
    expect([...PARTNER_LEVELS]).toEqual(phpEnumValues('PartnerLevel.php'));
  });

  it('holds the same link types as App\\Enums\\CollectionPartnerType', () => {
    expect([...COLLECTION_PARTNER_TYPES]).toEqual(phpEnumValues('CollectionPartnerType.php'));
  });
});
