/**
 * Tests for code mappings utility functions
 */

import { describe, it, expect } from 'vitest';
import {
  keyByLanguageId,
  mapLanguageCode,
  mapCountryCode,
  LANGUAGE_CODE_MAP,
  COUNTRY_CODE_MAP,
} from '../../src/utils/code-mappings.js';

describe('mapLanguageCode', () => {
  it('should map English', () => {
    expect(mapLanguageCode('en')).toBe('eng');
  });

  it('should map Arabic', () => {
    expect(mapLanguageCode('ar')).toBe('ara');
  });

  it('should map French', () => {
    expect(mapLanguageCode('fr')).toBe('fra');
  });

  it('should map Chinese (legacy ch code)', () => {
    expect(mapLanguageCode('ch')).toBe('zho');
  });

  it('should throw on unknown code', () => {
    expect(() => mapLanguageCode('xx')).toThrow('Unknown language code');
  });

  it('should have mappings for all supported languages', () => {
    expect(Object.keys(LANGUAGE_CODE_MAP).length).toBeGreaterThan(15);
  });
});

describe('mapCountryCode', () => {
  it('should map France', () => {
    expect(mapCountryCode('fr')).toBe('fra');
  });

  it('should map Egypt', () => {
    expect(mapCountryCode('eg')).toBe('egy');
  });

  it('should map Morocco', () => {
    expect(mapCountryCode('ma')).toBe('mar');
  });

  it('should map United Kingdom', () => {
    expect(mapCountryCode('uk')).toBe('gbr');
  });

  it('should throw on unknown code', () => {
    expect(() => mapCountryCode('xx')).toThrow('Unknown country code');
  });

  it('should have mappings for all supported countries', () => {
    expect(Object.keys(COUNTRY_CODE_MAP).length).toBeGreaterThan(50);
  });
});

describe('keyByLanguageId', () => {
  it("keys a legacy map by language id, legacy's own codes included", () => {
    const unknown: string[] = [];
    expect(keyByLanguageId({ en: 'A', se: 'B', ch: 'C' }, (code) => unknown.push(code))).toEqual({
      eng: 'A',
      swe: 'B',
      zho: 'C',
    });
    expect(unknown).toEqual([]);
  });

  it('leaves out a key with no mapping and reports it', () => {
    const unknown: string[] = [];
    expect(keyByLanguageId({ en: 'A', xx: 'B' }, (code) => unknown.push(code))).toEqual({
      eng: 'A',
    });
    expect(unknown).toEqual(['xx']);
  });
});
