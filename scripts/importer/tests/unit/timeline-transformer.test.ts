import { describe, expect, it } from 'vitest';

import {
  transformHcrEvent,
  transformHcrEventTranslation,
  transformShHcrEvent,
} from '../../src/domain/transformers/timeline-transformer.js';
import type { LegacyHcrEvent, ShLegacyHcr } from '../../src/domain/types/index.js';

const shHcr = (overrides: Partial<ShLegacyHcr> = {}): ShLegacyHcr => ({
  hcr_id: 1497,
  country: 'es',
  exhibition_id: 1,
  name: 'Event',
  date_from_year: '1701',
  date_to_year: '1714',
  date_from_month: null,
  date_to_month: null,
  date_from_date: null,
  date_to_date: null,
  ...overrides,
});

describe('transformShHcrEvent end year (M16 G2 #2697)', () => {
  it('keeps the end year as written', () => {
    expect(transformShHcrEvent(shHcr()).data.year_to).toBe(1714);
  });

  it('gives no end year, not 0, when legacy has none', () => {
    const event = transformShHcrEvent(shHcr({ date_to_year: '' })).data;

    expect(event.year_to).toBeNull();
    expect(event.date_to).toBeNull();
    expect(event.year_from).toBe(1701);
  });
});

const hcrEvent = (overrides: Partial<LegacyHcrEvent> = {}): LegacyHcrEvent => ({
  hcr_id: 101,
  lang_id: 'en',
  name: 'Portugal Renaissance',
  description: 'Baroque art period',
  datedesc_ah: null,
  datedesc_ad: '1500-1800',
  ...overrides,
});

describe('transformHcrEvent', () => {
  it('derives the plain mwnf3 backward_compatibility key', () => {
    const result = transformHcrEvent({
      hcr_id: 101,
      country_id: 'pt',
      name: 'Portugal 1500-1800',
      from_ad: 1500,
      to_ad: 1800,
      from_ah: null,
      to_ah: null,
    });

    expect(result.backwardCompatibility).toBe('mwnf3:hcr:101');
  });
});

describe('transformHcrEventTranslation', () => {
  it('defaults to the mwnf3 hcr_events backward_compatibility key', () => {
    const result = transformHcrEventTranslation(hcrEvent());
    expect(result.data.backward_compatibility).toBe('mwnf3:hcr_events:101:en');
  });

  it('keeps the mwnf3 key unchanged when called without a prefix (Step 1 call site)', () => {
    const result = transformHcrEventTranslation(hcrEvent({ hcr_id: 202, lang_id: 'fr' }));
    expect(result.data.backward_compatibility).toBe('mwnf3:hcr_events:202:fr');
  });

  it('namespaces the BAR translation under its own prefix for the same hcr_id/lang', () => {
    const legacy = hcrEvent({ hcr_id: 101, lang_id: 'en' });

    const mwnf3Translation = transformHcrEventTranslation(legacy);
    const barTranslation = transformHcrEventTranslation(legacy, 'mwnf3:hcr_events:bar');

    // Same source row, same language — but the keys (and therefore the
    // deterministic ids SqlStrategy derives from them) must differ, otherwise
    // the BAR insert collides with the mwnf3 event's translation and is
    // silently dropped as a duplicate primary key.
    expect(mwnf3Translation.data.backward_compatibility).toBe('mwnf3:hcr_events:101:en');
    expect(barTranslation.data.backward_compatibility).toBe('mwnf3:hcr_events:bar:101:en');
    expect(barTranslation.data.backward_compatibility).not.toBe(
      mwnf3Translation.data.backward_compatibility
    );
  });

  it('preserves the row content regardless of the prefix used', () => {
    const legacy = hcrEvent({ name: 'Iberia Baroque', description: 'A description' });
    const barTranslation = transformHcrEventTranslation(legacy, 'mwnf3:hcr_events:bar');

    expect(barTranslation.data.name).toBe('Iberia Baroque');
    expect(barTranslation.data.description).toBe('A description');
  });
});
