/**
 * The copyright stored on an imported image row is the text the burn draws
 * verbatim: the legacy value with the mark legacy's watermark used to add,
 * and — for pictures stored once per language — a single, predictable pick.
 */

import { describe, it, expect } from 'vitest';
import {
  copyrightNotInColumn,
  mwnf3ProjectCopyright,
  pickImageCopyright,
  pickMwnf3PictureCopyright,
  SHARING_HISTORY_COPYRIGHT,
  toImageCopyright,
} from '../../src/utils/image-copyright.js';
import { sanitizeAllStrings } from '../../src/utils/html-to-markdown.js';

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

describe('copyrightNotInColumn (M16 I4)', () => {
  it('keeps nothing when the column, without its mark, is the legacy text', () => {
    expect(copyrightNotInColumn('  Moravská galerie v Brně ')).toBeNull();
    expect(copyrightNotInColumn('')).toBeNull();
    expect(copyrightNotInColumn(null)).toBeNull();
  });

  it('keeps a legacy text that already carries the mark', () => {
    expect(copyrightNotInColumn('© The Museum')).toBe('© The Museum');
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

describe('mwnf3ProjectCopyright', () => {
  it.each([
    ['ISL', '© Discover Islamic Art (MWNF)'],
    ['isl', '© Discover Islamic Art (MWNF)'],
    ['IAM', '© Islamic Art in the Mediterranean (MWNF)'],
  ])('gives %s the line legacy printed on its pictures', (projectId, line) => {
    expect(mwnf3ProjectCopyright(projectId)).toBe(line);
  });

  it.each(['BAR', 'EPM', 'DCA', 'GALLERIES'])(
    'leaves %s to the global fallback',
    (projectId) => {
      expect(mwnf3ProjectCopyright(projectId)).toBeNull();
    }
  );
});

describe('pickMwnf3PictureCopyright', () => {
  const rows = [{ lang: 'en', copyright: 'Museo Arqueológico Nacional' }];

  it('drops the picture text of a project whose line legacy always printed', () => {
    expect(pickMwnf3PictureCopyright('ISL', rows)).toBeNull();
    expect(pickMwnf3PictureCopyright('iam', rows)).toBeNull();
  });

  it('keeps the picture text elsewhere', () => {
    expect(pickMwnf3PictureCopyright('BAR', rows)).toBe('© Museo Arqueológico Nacional');
  });
});

describe('project credit lines survive the string sanitizer', () => {
  it.each(['© Discover Islamic Art (MWNF)', SHARING_HISTORY_COPYRIGHT])('%s', (line) => {
    expect(sanitizeAllStrings({ copyright: line }).copyright).toBe(line);
  });
});
