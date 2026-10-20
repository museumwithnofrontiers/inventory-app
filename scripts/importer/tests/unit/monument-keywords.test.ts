/**
 * #2233 C23: an mwnf3 monument's keywords column, kept per language as the row
 * writes it. The keyword tags made from it are shared across records, so they
 * give every record one spelling and lose the Arabic list separator.
 */
import { describe, it, expect } from 'vitest';
import { transformMonumentTranslation } from '../../src/domain/transformers/monument-transformer.js';
import type { LegacyMonument } from '../../src/domain/types/legacy.js';

const monument = (fields: Partial<LegacyMonument>): LegacyMonument =>
  ({
    project_id: 'ISL',
    country: 'eg',
    institution_id: 'inst',
    number: '001',
    lang: 'ar',
    name: 'جامع',
    description: 'جامع',
    ...fields,
  }) as LegacyMonument;

const extraOf = (m: LegacyMonument): Record<string, unknown> =>
  JSON.parse(transformMonumentTranslation(m)?.data.extra ?? '{}') as Record<string, unknown>;

describe('transformMonumentTranslation — keywords', () => {
  it('keeps the column as written, Arabic separator and final period included', () => {
    expect(extraOf(monument({ keywords: 'عمارة؛ فاطمي؛ القاهرة.' })).keywords).toBe('عمارة؛ فاطمي؛ القاهرة.');
  });

  it('converts HTML to Markdown', () => {
    expect(extraOf(monument({ lang: 'en', keywords: 'Mosque; <i>minbar</i>' })).keywords).toBe('Mosque; *minbar*');
  });

  it('stores no key when the column is empty', () => {
    expect(extraOf(monument({ keywords: '  ' }))).not.toHaveProperty('keywords');
  });
});
