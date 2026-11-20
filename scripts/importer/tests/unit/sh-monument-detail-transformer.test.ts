import { describe, expect, it } from 'vitest';

import { transformShMonumentDetailTranslation } from '../../src/domain/transformers/sh-monument-detail-transformer.js';
import type { ShLegacyMonumentDetailText } from '../../src/domain/types/index.js';

const text = (overrides: Partial<ShLegacyMonumentDetailText> = {}): ShLegacyMonumentDetailText => ({
  project_id: 'SH',
  country: 'es',
  number: 1,
  detail_id: 2,
  lang: 'en',
  name: 'Mihrab',
  description: 'A prayer niche.',
  location: 'Córdoba',
  date: 'AH 354 / AD 965',
  artist: '',
  ...overrides,
});

describe('transformShMonumentDetailTranslation (M16 G2 #2697)', () => {
  it('keeps the date and location in their columns, as written', () => {
    const data = transformShMonumentDetailTranslation(text())!.data;

    expect(data.dates).toBe('AH 354 / AD 965');
    expect(data.location).toBe('Córdoba');
  });

  it('no longer copies the date and location into extra', () => {
    expect(transformShMonumentDetailTranslation(text())!.data.extra).toBeNull();
  });

  it('still keeps the artist in extra', () => {
    const data = transformShMonumentDetailTranslation(text({ artist: 'Unknown master' }))!.data;

    expect(JSON.parse(data.extra!)).toEqual({ artist: 'Unknown master' });
  });
});
