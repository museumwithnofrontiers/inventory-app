/**
 * Tests for Object Transformer
 */

import { describe, it, expect } from 'vitest';
import {
  groupObjectsByPK,
  transformObject,
  transformObjectTranslation,
  extractObjectTags,
  extractObjectArtists,
  parseTagString,
  planTranslations,
  parseItemYear,
} from '../../src/domain/transformers/object-transformer.js';
import type { LegacyObject, ObjectGroup } from '../../src/domain/types/legacy.js';

describe('groupObjectsByPK', () => {
  it('should group objects by non-lang PK columns', () => {
    const objects: LegacyObject[] = [
      { project_id: 'EPM', country: 'eg', museum_id: 'cairo', number: '001', lang: 'en' },
      { project_id: 'EPM', country: 'eg', museum_id: 'cairo', number: '001', lang: 'ar' },
      { project_id: 'EPM', country: 'eg', museum_id: 'cairo', number: '002', lang: 'en' },
    ];

    const groups = groupObjectsByPK(objects);

    expect(groups.length).toBe(2);
    expect(groups[0]?.translations.length).toBe(2);
    expect(groups[1]?.translations.length).toBe(1);
  });

  it('should preserve object data in groups', () => {
    const objects: LegacyObject[] = [
      {
        project_id: 'EPM',
        country: 'eg',
        museum_id: 'cairo',
        number: '001',
        lang: 'en',
        name: 'Test',
      },
    ];

    const groups = groupObjectsByPK(objects);

    expect(groups[0]?.project_id).toBe('EPM');
    expect(groups[0]?.country).toBe('eg');
    expect(groups[0]?.museum_id).toBe('cairo');
    expect(groups[0]?.number).toBe('001');
    expect(groups[0]?.translations[0]?.name).toBe('Test');
  });
});

describe('transformObject', () => {
  it('should transform object group to item data', () => {
    const group: ObjectGroup = {
      project_id: 'EPM',
      country: 'eg',
      museum_id: 'cairo',
      number: '001',
      translations: [
        {
          project_id: 'EPM',
          country: 'eg',
          museum_id: 'cairo',
          number: '001',
          lang: 'en',
          inventory_id: 'INV001',
          name: 'Egyptian Vase',
        },
      ],
    };

    const result = transformObject(group, 'eng');

    expect(result.data.type).toBe('object');
    expect(result.data.internal_name).toBe('Egyptian Vase');
    expect(result.data.owner_reference).toBe('INV001');
    expect(result.backwardCompatibility).toBe('mwnf3:objects:EPM:eg:cairo:001');
    expect(result.countryId).toBe('egy');
  });

  it('throws when translation missing name', () => {
    const group: ObjectGroup = {
      project_id: 'EPM',
      country: 'eg',
      museum_id: 'cairo',
      number: '001',
      translations: [
        { project_id: 'EPM', country: 'eg', museum_id: 'cairo', number: '001', lang: 'en' },
      ],
    };

    expect(() => transformObject(group, 'eng')).toThrow(
      'Object mwnf3:objects:EPM:eg:cairo:001 missing required name field'
    );
  });
});

describe('transformObjectTranslation', () => {
  it('should transform object to translation data', () => {
    const obj: LegacyObject = {
      project_id: 'EPM',
      country: 'eg',
      museum_id: 'cairo',
      number: '001',
      lang: 'en',
      name: 'Test Object',
      description: 'A test description',
    };

    const result = transformObjectTranslation(obj, 'description');

    expect(result).not.toBeNull();
    expect(result?.data.name).toBe('Test Object');
    expect(result?.data.description).toBe('A test description');
    expect(result?.data.language_id).toBe('eng');
  });

  it('should keep the record and null the description when the description is empty', () => {
    const obj: LegacyObject = {
      project_id: 'EPM',
      country: 'eg',
      museum_id: 'cairo',
      number: '001',
      lang: 'en',
      name: 'Test',
      description: '',
      dimensions: 'Height: 22.2 cm',
    };

    const result = transformObjectTranslation(obj, 'description');

    // `item_translations.description` is nullable, and legacy publishes objects
    // that were catalogued without descriptive text. Dropping the translation
    // would lose the name and every technical field with it.
    expect(result).not.toBeNull();
    expect(result?.data.name).toBe('Test');
    expect(result?.data.description).toBeNull();
    expect(result?.data.dimensions).toBe('Height: 22.2 cm');
  });

  it('should return null for missing name', () => {
    const obj: LegacyObject = {
      project_id: 'EPM',
      country: 'eg',
      museum_id: 'cairo',
      number: '001',
      lang: 'en',
      description: 'Test',
    };

    const result = transformObjectTranslation(obj, 'description');

    expect(result).toBeNull();
  });

  it('should truncate long alternate_name', () => {
    const longName = 'A'.repeat(300);
    const obj: LegacyObject = {
      project_id: 'EPM',
      country: 'eg',
      museum_id: 'cairo',
      number: '001',
      lang: 'en',
      name: 'Test',
      name2: longName,
      description: 'Test description',
    };

    const result = transformObjectTranslation(obj, 'description');

    expect(result?.data.alternate_name?.length).toBe(255);
    expect(result?.warnings.length).toBeGreaterThan(0);
  });

  it('should extract author names', () => {
    const obj: LegacyObject = {
      project_id: 'EPM',
      country: 'eg',
      museum_id: 'cairo',
      number: '001',
      lang: 'en',
      name: 'Test',
      description: 'Test',
      preparedby: 'John Doe',
      copyeditedby: 'Jane Doe',
    };

    const result = transformObjectTranslation(obj, 'description');

    expect(result?.authorName).toBe('John Doe');
    expect(result?.textCopyEditorName).toBe('Jane Doe');
  });

  it('should include provenance in translation data', () => {
    const obj: LegacyObject = {
      project_id: 'ISL',
      country: 'eg',
      museum_id: 'Mus01',
      number: '1',
      lang: 'en',
      name: 'Test Object',
      description: 'A test description',
      provenance: 'Egypt, probably Cairo.',
    };

    const result = transformObjectTranslation(obj, 'description');

    expect(result).not.toBeNull();
    expect(result?.data.provenance).toBe('Egypt, probably Cairo.');
  });

  it('should set provenance to null when not provided', () => {
    const obj: LegacyObject = {
      project_id: 'ISL',
      country: 'eg',
      museum_id: 'Mus01',
      number: '1',
      lang: 'en',
      name: 'Test Object',
      description: 'A test description',
    };

    const result = transformObjectTranslation(obj, 'description');

    expect(result).not.toBeNull();
    expect(result?.data.provenance === null || result?.data.provenance === undefined).toBe(true);
  });

  it('keeps the free-text Period / Dynasty line in extra.dynasty', () => {
    const obj: LegacyObject = {
      project_id: 'DCA',
      country: 'uk',
      museum_id: 'Mus31',
      number: '19',
      lang: 'en',
      name: 'Carpet',
      description: 'A carpet',
      dynasty: 'Qajar',
    };

    const result = transformObjectTranslation(obj, 'description');

    expect(JSON.parse(result?.data.extra ?? '{}').dynasty).toBe('Qajar');
  });

  it('keeps the free-text Material(s) / Technique(s) line in extra.materials', () => {
    const obj: LegacyObject = {
      project_id: 'EPM',
      country: 'at',
      museum_id: 'Mus21',
      number: '2',
      lang: 'en',
      name: 'Bowl',
      description2: 'A bowl',
      materials: 'Brass with decoration in <i>niello</i>-technique; silver',
    };

    const result = transformObjectTranslation(obj, 'description2');

    const materials = JSON.parse(result?.data.extra ?? '{}').materials as string;
    expect(materials).toMatch(/^Brass with decoration in \*niello\*.*technique; silver$/);
    expect(materials).not.toContain('<i>');
  });

  it('stores no materials key when the column is empty', () => {
    const obj: LegacyObject = {
      project_id: 'EPM',
      country: 'at',
      museum_id: 'Mus21',
      number: '3',
      lang: 'en',
      name: 'Bowl',
      description2: 'A bowl',
      materials: '  ',
      dynasty: 'Mamluk',
    };

    const result = transformObjectTranslation(obj, 'description2');

    expect(JSON.parse(result?.data.extra ?? '{}')).not.toHaveProperty('materials');
  });

  it('keeps the keywords column as this row writes it in extra.keywords', () => {
    const obj: LegacyObject = {
      project_id: 'ISL',
      country: 'eg',
      museum_id: 'Mus01',
      number: '12',
      lang: 'ar',
      name: 'صحن',
      description: 'صحن',
      keywords: 'خزف؛ فاطمي؛ بريق معدني.',
    };

    const result = transformObjectTranslation(obj, 'description');

    // The Arabic separator and the final period stay: legacy prints the column as written.
    expect(JSON.parse(result?.data.extra ?? '{}').keywords).toBe('خزف؛ فاطمي؛ بريق معدني.');
  });

  it('converts HTML in the keywords column and stores no key when it is empty', () => {
    const withHtml: LegacyObject = {
      project_id: 'ISL',
      country: 'eg',
      museum_id: 'Mus01',
      number: '13',
      lang: 'en',
      name: 'Dish',
      description: 'A dish',
      keywords: 'Ceramics; <i>lustre</i>',
    };
    const empty: LegacyObject = { ...withHtml, number: '14', keywords: ' ' };

    expect(JSON.parse(transformObjectTranslation(withHtml, 'description')?.data.extra ?? '{}').keywords).toBe(
      'Ceramics; *lustre*'
    );
    expect(JSON.parse(transformObjectTranslation(empty, 'description')?.data.extra ?? '{}')).not.toHaveProperty(
      'keywords'
    );
  });
});

describe('extractObjectTags', () => {
  it('should extract materials and keywords (dynasties handled by DynastyImporter)', () => {
    const obj: LegacyObject = {
      project_id: 'EPM',
      country: 'eg',
      museum_id: 'cairo',
      number: '001',
      lang: 'en',
      materials: 'gold; silver',
      dynasty: '18th Dynasty',
      keywords: 'pharaoh; egypt',
    };

    const result = extractObjectTags(obj);

    expect(result.materials).toEqual(['gold', 'silver']);
    expect(result.keywords).toEqual(['pharaoh', 'egypt']);
    expect(result.languageId).toBe('eng');
  });
});

describe('extractObjectArtists', () => {
  it('should extract single artist', () => {
    const obj: LegacyObject = {
      project_id: 'EPM',
      country: 'eg',
      museum_id: 'cairo',
      number: '001',
      lang: 'en',
      artist: 'Imhotep',
      birthplace: 'Memphis',
    };

    const result = extractObjectArtists(obj);

    expect(result.length).toBe(1);
    expect(result[0]?.name).toBe('Imhotep');
    expect(result[0]?.birthplace).toBe('Memphis');
  });

  it('should extract multiple artists', () => {
    const obj: LegacyObject = {
      project_id: 'EPM',
      country: 'eg',
      museum_id: 'cairo',
      number: '001',
      lang: 'en',
      artist: 'Artist 1; Artist 2; Artist 3',
    };

    const result = extractObjectArtists(obj);

    expect(result.length).toBe(3);
    expect(result[0]?.name).toBe('Artist 1');
    expect(result[1]?.name).toBe('Artist 2');
    expect(result[2]?.name).toBe('Artist 3');
  });

  it('should return empty array for no artist', () => {
    const obj: LegacyObject = {
      project_id: 'EPM',
      country: 'eg',
      museum_id: 'cairo',
      number: '001',
      lang: 'en',
    };

    const result = extractObjectArtists(obj);

    expect(result).toEqual([]);
  });

  it('should strip HTML tags before splitting', () => {
    const obj: LegacyObject = {
      project_id: 'ISL',
      country: 'tr',
      museum_id: 'Mus01',
      number: '1',
      lang: 'en',
      artist: 'Calligraphers: Kasim<br/>\nPainters: Osman',
    };

    const result = extractObjectArtists(obj);

    // The <br/>\n is stripped to a space, and with no semicolon the column is
    // one record
    expect(result.length).toBe(1);
    expect(result[0]?.name).toBe('Calligraphers: Kasim Painters: Osman');
  });

  it('keeps the commas inside one artist, as legacy prints them', () => {
    const obj: LegacyObject = {
      project_id: 'DGA',
      country: 'ch',
      museum_id: 'Mus01',
      number: '1',
      lang: 'en',
      artist: 'Albin Schweri, design, (1885 Ramsen, Switzerland - 1946 Bern, Switzerland)',
    };

    const result = extractObjectArtists(obj);

    expect(result.map((a) => a.name)).toEqual([
      'Albin Schweri, design, (1885 Ramsen, Switzerland - 1946 Bern, Switzerland)',
    ]);
  });

  it('keeps an Arabic comma inside its artist', () => {
    const obj: LegacyObject = {
      project_id: 'EPM',
      country: 'ir',
      museum_id: 'Mus01',
      number: '1',
      lang: 'ar',
      artist: 'أبو زيد ، فارسي ، نشط في أواخر القرن الثاني عشر',
    };

    expect(extractObjectArtists(obj)).toHaveLength(1);
  });

  it('splits roles at their semicolons, each with its commas', () => {
    const obj: LegacyObject = {
      project_id: 'BAR',
      country: 'it',
      museum_id: 'Mus01',
      number: '1',
      lang: 'en',
      artist:
        'Etching: Giacomo Maria Giovannini (1667, Bologna – 1717, Parma); designer: Marco Antonio Chiarini (1652, Bologna – 1730, Bologna)',
    };

    const result = extractObjectArtists(obj);

    expect(result.map((a) => a.name)).toEqual([
      'Etching: Giacomo Maria Giovannini (1667, Bologna – 1717, Parma)',
      'designer: Marco Antonio Chiarini (1652, Bologna – 1730, Bologna)',
    ]);
  });

  it('should split on Arabic semicolon (U+061B)', () => {
    const obj: LegacyObject = {
      project_id: 'ISL',
      country: 'tr',
      museum_id: 'Mus01',
      number: '1',
      lang: 'ar',
      artist: 'فنان أول\u061B فنان ثان',
    };

    const result = extractObjectArtists(obj);

    expect(result.length).toBe(2);
    expect(result[0]?.name).toBe('فنان أول');
    expect(result[1]?.name).toBe('فنان ثان');
  });
});

describe('parseTagString', () => {
  it('should parse semicolon-separated tags', () => {
    const result = parseTagString('tag1; tag2; tag3');
    expect(result).toEqual(['tag1', 'tag2', 'tag3']);
  });

  it('keeps a comma inside its entry, as legacy prints it', () => {
    const result = parseTagString('Wool warp and weft, wool pile');
    expect(result).toEqual(['Wool warp and weft, wool pile']);
  });

  it('should split semicolon-separated data even with colons in values', () => {
    const result = parseTagString('Warp: wool; Weft: cotton');
    expect(result).toEqual(['Warp: wool', 'Weft: cotton']);
  });

  it('splits mixed comma-and-semicolon strings at the semicolons only', () => {
    const result = parseTagString(
      'Church, Jesuit order, Mathäus Nepauer; Johann Michael Hamon, Buda'
    );
    expect(result).toEqual(['Church, Jesuit order, Mathäus Nepauer', 'Johann Michael Hamon, Buda']);
  });

  it('keeps an Arabic comma (U+060C) inside its entry', () => {
    const result = parseTagString('زجاج\u060C زخرفة كتابية\u060C سنان');
    expect(result).toEqual(['زجاج\u060C زخرفة كتابية\u060C سنان']);
  });

  it('should split Arabic semicolon (U+061B) separated tags', () => {
    const result = parseTagString('gold\u061B silver\u061B bronze');
    expect(result).toEqual(['gold', 'silver', 'bronze']);
  });

  it('should return empty array for empty string', () => {
    expect(parseTagString('')).toEqual([]);
    expect(parseTagString(null)).toEqual([]);
    expect(parseTagString(undefined)).toEqual([]);
  });
});

describe('planTranslations', () => {
  it('still plans an EPM translation without description2', () => {
    const group: ObjectGroup = {
      project_id: 'EPM',
      country: 'gr',
      museum_id: 'Mus21',
      number: '30',
      translations: [
        {
          project_id: 'EPM',
          country: 'gr',
          museum_id: 'Mus21',
          number: '30',
          lang: 'el',
          name: 'Door panel',
        },
      ],
    };

    const plans = planTranslations(group, false);

    expect(plans).toHaveLength(1);
    expect(plans[0]?.descriptionField).toBe('description2');
    expect(
      transformObjectTranslation(plans[0]!.translation, 'description2')?.data.description
    ).toBeNull();
  });

  it('should plan EPM translations using description2', () => {
    const group: ObjectGroup = {
      project_id: 'EPM',
      country: 'eg',
      museum_id: 'cairo',
      number: '001',
      translations: [
        {
          project_id: 'EPM',
          country: 'eg',
          museum_id: 'cairo',
          number: '001',
          lang: 'en',
          description2: 'EPM content',
        },
      ],
    };

    const plans = planTranslations(group, false);

    expect(plans.length).toBe(1);
    expect(plans[0]?.contextType).toBe('own');
    expect(plans[0]?.descriptionField).toBe('description2');
  });

  it('should plan non-EPM translations with description and description2', () => {
    const group: ObjectGroup = {
      project_id: 'VM',
      country: 'eg',
      museum_id: 'cairo',
      number: '001',
      translations: [
        {
          project_id: 'VM',
          country: 'eg',
          museum_id: 'cairo',
          number: '001',
          lang: 'en',
          description: 'VM content',
          description2: 'EPM content',
        },
      ],
    };

    const plans = planTranslations(group, true);

    expect(plans.length).toBe(2);
    expect(plans[0]?.contextType).toBe('own');
    expect(plans[0]?.descriptionField).toBe('description');
    expect(plans[1]?.contextType).toBe('epm');
    expect(plans[1]?.descriptionField).toBe('description2');
  });

  it('should still plan an own-context translation when neither description exists', () => {
    const group: ObjectGroup = {
      project_id: 'GalEx6',
      country: 'us',
      museum_id: 'Mus82',
      number: '3',
      translations: [
        {
          project_id: 'GalEx6',
          country: 'us',
          museum_id: 'Mus82',
          number: '3',
          lang: 'en',
          name: '"Alexander and the Circle of Seven Sages"',
          materials: 'Ink, opaque watercolour, and gold on paper',
        },
      ],
    };

    const plans = planTranslations(group, true);

    expect(plans.length).toBe(1);
    expect(plans[0]?.contextType).toBe('own');
    expect(plans[0]?.descriptionField).toBe('description');
  });

  it('should not plan an own-context translation when only description2 exists', () => {
    const group: ObjectGroup = {
      project_id: 'VM',
      country: 'eg',
      museum_id: 'cairo',
      number: '001',
      translations: [
        {
          project_id: 'VM',
          country: 'eg',
          museum_id: 'cairo',
          number: '001',
          lang: 'en',
          description2: 'EPM content',
        },
      ],
    };

    const plans = planTranslations(group, true);

    expect(plans.length).toBe(1);
    expect(plans[0]?.contextType).toBe('epm');
    expect(plans[0]?.descriptionField).toBe('description2');
  });
});

describe('parseItemYear', () => {
  it('returns numeric value for valid positive year', () => {
    expect(parseItemYear('1492')).toMatchObject({ value: 1492, warning: null });
  });

  it('returns numeric value for valid negative year', () => {
    expect(parseItemYear('-500')).toMatchObject({ value: -500, warning: null });
  });

  it('returns null with warning for non-integer string', () => {
    const result = parseItemYear('12th century');
    expect(result.value).toBeNull();
    expect(result.warning).not.toBeNull();
  });

  it('returns null with warning for out-of-range value (too large)', () => {
    const result = parseItemYear('40000');
    expect(result.value).toBeNull();
    expect(result.warning).not.toBeNull();
  });

  it('returns null with warning for out-of-range value (too small)', () => {
    const result = parseItemYear('-40000');
    expect(result.value).toBeNull();
    expect(result.warning).not.toBeNull();
  });

  it('returns null without warning for null/undefined input', () => {
    expect(parseItemYear(null)).toMatchObject({ value: null, warning: null });
    expect(parseItemYear(undefined)).toMatchObject({ value: null, warning: null });
  });

  it('returns value at SMALLINT boundary (32767)', () => {
    expect(parseItemYear('32767')).toMatchObject({ value: 32767, warning: null });
    const over = parseItemYear('32768');
    expect(over.value).toBeNull();
    expect(over.warning).not.toBeNull();
  });
});
