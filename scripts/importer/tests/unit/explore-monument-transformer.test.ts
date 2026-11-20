import { describe, expect, it } from 'vitest';

import {
  selectExploreMonumentPeriod,
  transformExploreMonument,
  type ExploreLegacyMonument,
} from '../../src/domain/transformers/explore-monument-transformer.js';

const legacyMonument = (overrides: Partial<ExploreLegacyMonument> = {}): ExploreLegacyMonument => ({
  monumentId: 15,
  locationId: 9,
  title: 'Legacy Base Title',
  geoCoordinates: '31.1, 35.2',
  zoom: 16,
  special_monument: null,
  related_monument: null,
  countryId: null,
  ...overrides,
});

describe('selectExploreMonumentPeriod (M16 G2 #2697)', () => {
  const key = 'mwnf3_explore:monument:1767';

  it('takes period_from and period_to as the start and end years, as written', () => {
    expect(
      selectExploreMonumentPeriod(key, [{ langId: 'en', period_from: '1731', period_to: ' 1781 ' }])
    ).toEqual({ start_date: 1731, end_date: 1781, warnings: [] });
  });

  it('keeps a year every language row agrees on, ignoring rows without one', () => {
    expect(
      selectExploreMonumentPeriod(key, [
        { langId: 'en', period_from: '1700', period_to: '1800' },
        { langId: 'fr', period_from: '1700', period_to: null },
        { langId: 'ar', period_from: '', period_to: '' },
      ])
    ).toEqual({ start_date: 1700, end_date: 1800, warnings: [] });
  });

  it('leaves a year empty, reported, when the language rows disagree', () => {
    const period = selectExploreMonumentPeriod(key, [
      { langId: 'en', period_from: '1731', period_to: '1781' },
      { langId: 'fr', period_from: '1730', period_to: '1781' },
    ]);

    expect(period.start_date).toBeNull();
    expect(period.end_date).toBe(1781);
    expect(period.warnings).toEqual([
      `Explore monument ${key}: period_from differs between languages (1731, 1730), left empty`,
    ]);
  });

  it('leaves a year empty, reported, when it is not a whole number', () => {
    const period = selectExploreMonumentPeriod(key, [
      { langId: 'en', period_from: '1700s', period_to: '-50' },
    ]);

    expect(period.start_date).toBeNull();
    expect(period.end_date).toBe(-50);
    expect(period.warnings).toEqual([
      `Explore monument ${key}: period_from '1700s' is not a whole year, left empty`,
    ]);
  });

  it('gives no years when the monument has none', () => {
    expect(selectExploreMonumentPeriod(key, [])).toEqual({
      start_date: null,
      end_date: null,
      warnings: [],
    });
  });
});

describe('transformExploreMonument', () => {
  it('writes the period years on the item it creates', () => {
    const result = transformExploreMonument(
      legacyMonument(),
      [{ langId: 'en', name: 'Sabil' }],
      'eng',
      [{ langId: 'en', period_from: '1731', period_to: '1781' }]
    );

    expect(result.data.start_date).toBe(1731);
    expect(result.data.end_date).toBe(1781);
  });

  it('uses the english translation name as internal_name instead of a slugged legacy title', () => {
    const result = transformExploreMonument(
      legacyMonument(),
      [
        { langId: 'fr', name: 'Titre francais' },
        { langId: 'en', name: 'English Monument Name' },
      ],
      'eng'
    );

    expect(result.data.internal_name).toBe('English Monument Name');
    expect(result.data.latitude).toBe(31.1);
    expect(result.data.longitude).toBe(35.2);
    expect(result.locationId).toBe(9);
    expect(result.warnings).toEqual([]);
  });

  /**
   * Legacy carries no country on the monument row and derives one at query
   * time through locationId → locations.countryId. The 2-char legacy code is
   * mapped onto the inventory's ISO alpha-3 country id. See #1593.
   */
  it('maps the joined legacy country code onto the ISO alpha-3 country id', () => {
    const result = transformExploreMonument(
      legacyMonument({ countryId: 'in' }),
      [{ langId: 'en', name: 'Indian Monument' }],
      'eng'
    );

    expect(result.data.country_id).toBe('ind');
    expect(result.warnings).toEqual([]);
  });

  it('leaves country_id null when the location has no country', () => {
    for (const countryId of [null, '', '   ']) {
      const result = transformExploreMonument(
        legacyMonument({ countryId }),
        [{ langId: 'en', name: 'Countryless Monument' }],
        'eng'
      );

      expect(result.data.country_id).toBeNull();
      expect(result.warnings).toEqual([]);
    }
  });

  /**
   * mapCountryCode throws on a code it does not know. A single unmapped
   * location must not take the whole import down with it.
   */
  it('downgrades an unknown country code to a warning rather than throwing', () => {
    const result = transformExploreMonument(
      legacyMonument({ countryId: 'zz' }),
      [{ langId: 'en', name: 'Monument in Nowhere' }],
      'eng'
    );

    expect(result.data.country_id).toBeNull();
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("'zz'");
    expect(result.warnings[0]).toContain('mwnf3_explore:monument:15');
  });
});
