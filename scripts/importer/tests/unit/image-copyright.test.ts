/**
 * The copyright stored on an imported image row is the text the burn draws
 * verbatim: the legacy value with the mark legacy's watermark used to add,
 * and — for pictures stored once per language — a single, predictable pick.
 */

import { describe, it, expect } from 'vitest';
import { pickImageCopyright, toImageCopyright } from '../../src/utils/image-copyright.js';

describe('toImageCopyright', () => {
  it('adds the copyright mark to a bare rights holder', () => {
    expect(toImageCopyright('Moravská galerie v Brně')).toBe('© Moravská galerie v Brně');
  });

  it('trims before adding the mark', () => {
    expect(toImageCopyright('  Muzeum města Brna \n')).toBe('© Muzeum města Brna');
  });

  it('does not add a second mark', () => {
    expect(toImageCopyright('© Museo Egizio')).toBe('© Museo Egizio');
  });

  it.each([null, undefined, '', '   '])('returns null for a blank value (%j)', (value) => {
    expect(toImageCopyright(value)).toBeNull();
  });
});

describe('pickImageCopyright', () => {
  it('prefers the English text, whatever its position', () => {
    expect(
      pickImageCopyright([
        { lang: 'cs', copyright: 'Moravská galerie v Brně, Muzeum města Brna' },
        { lang: 'en', copyright: 'Muzeum města Brna' },
      ])
    ).toBe('© Muzeum města Brna');
  });

  it('recognises the three-letter English code', () => {
    expect(
      pickImageCopyright([
        { lang: 'ita', copyright: 'Palazzo Chigi Ariccia' },
        { lang: 'eng', copyright: 'MWNF' },
      ])
    ).toBe('© MWNF');
  });

  it('takes the first filled text when there is no English one', () => {
    expect(
      pickImageCopyright([
        { lang: 'fr', copyright: '' },
        { lang: 'it', copyright: 'Palazzo Chigi Ariccia' },
        { lang: 'de', copyright: 'Something else' },
      ])
    ).toBe('© Palazzo Chigi Ariccia');
  });

  it('falls through a blank English row to the other languages', () => {
    expect(
      pickImageCopyright([
        { lang: 'en', copyright: '   ' },
        { lang: 'de', copyright: 'Innsbruck Tourismus' },
      ])
    ).toBe('© Innsbruck Tourismus');
  });

  it('returns null when no language carries a copyright', () => {
    expect(
      pickImageCopyright([
        { lang: 'en', copyright: null },
        { lang: 'fr', copyright: '' },
      ])
    ).toBeNull();
    expect(pickImageCopyright([])).toBeNull();
  });
});
