/**
 * Unit tests for thg-theme-item-resolver.ts
 *
 * Verifies that resolvePictureItemBackwardCompatibility returns the correct
 * picture item backward-compatibility key for every supported source family,
 * and returns null for rows with missing image columns.
 */

import { describe, expect, it } from 'vitest';
import {
  resolvePictureItemBackwardCompatibility,
  THEME_ITEM_SELECT_COLUMNS,
  THEME_ITEM_SOURCE_COLUMNS,
  themeItemSelectColumns,
} from '../../src/importers/phase-10/thg-theme-item-resolver.js';
import type { LegacyThemeItem } from '../../src/importers/phase-10/thg-theme-item-resolver.js';
import { UnifiedTracker } from '../../src/core/tracker.js';

/** A fully-null base row for building test fixtures. */
const NULL_ROW: LegacyThemeItem = {
  mwnf3_object_project_id: null,
  mwnf3_object_country_id: null,
  mwnf3_object_partner_id: null,
  mwnf3_object_item_id: null,
  mwnf3_object_item_type: null,
  mwnf3_object_image_id: null,
  mwnf3_monument_project_id: null,
  mwnf3_monument_country_id: null,
  mwnf3_monument_partner_id: null,
  mwnf3_monument_item_id: null,
  mwnf3_monument_item_type: null,
  mwnf3_monument_image_id: null,
  mwnf3_monument_detail_project_id: null,
  mwnf3_monument_detail_country_id: null,
  mwnf3_monument_detail_partner_id: null,
  mwnf3_monument_detail_item_id: null,
  mwnf3_monument_detail_detail_id: null,
  mwnf3_monument_detail_image_id: null,
  sh_object_project_id: null,
  sh_object_country_id: null,
  sh_object_item_id: null,
  sh_object_item_type: null,
  sh_object_image_id: null,
  sh_monument_project_id: null,
  sh_monument_country_id: null,
  sh_monument_item_id: null,
  sh_monument_item_type: null,
  sh_monument_image_id: null,
  sh_monument_detail_project_id: null,
  sh_monument_detail_country_id: null,
  sh_monument_detail_item_id: null,
  sh_monument_detail_detail_id: null,
  sh_monument_detail_image_id: null,
  explore_monument_item_id: null,
  explore_monument_item_type: null,
  explore_monument_image_id: null,
  travel_monument_project_id: null,
  travel_monument_country_id: null,
  travel_monument_trail_id: null,
  travel_monument_itinerary_id: null,
  travel_monument_location_id: null,
  travel_monument_item_id: null,
  travel_monument_item_type: null,
  travel_monument_image_id: null,
};

describe('resolvePictureItemBackwardCompatibility', () => {
  describe('mwnf3 object picture', () => {
    it('resolves to objects_pictures key', () => {
      const row: LegacyThemeItem = {
        ...NULL_ROW,
        mwnf3_object_project_id: 'BAR',
        mwnf3_object_country_id: 'hr',
        mwnf3_object_partner_id: 'Mon11',
        mwnf3_object_item_id: 33,
        mwnf3_object_item_type: null,
        mwnf3_object_image_id: 1,
      };
      expect(resolvePictureItemBackwardCompatibility(row)).toBe(
        'mwnf3:objects_pictures:BAR:hr:Mon11:33:1'
      );
    });

    it('returns null when image_id is missing', () => {
      const row: LegacyThemeItem = {
        ...NULL_ROW,
        mwnf3_object_project_id: 'BAR',
        mwnf3_object_country_id: 'hr',
        mwnf3_object_partner_id: 'Mon11',
        mwnf3_object_item_id: 33,
        mwnf3_object_image_id: null,
      };
      expect(resolvePictureItemBackwardCompatibility(row)).toBeNull();
    });

    it('returns null when item_id is missing', () => {
      const row: LegacyThemeItem = {
        ...NULL_ROW,
        mwnf3_object_project_id: 'BAR',
        mwnf3_object_country_id: 'hr',
        mwnf3_object_partner_id: 'Mon11',
        mwnf3_object_item_id: null,
        mwnf3_object_image_id: 2,
      };
      expect(resolvePictureItemBackwardCompatibility(row)).toBeNull();
    });

    it('appends a non-empty item_type (matches ObjectPictureImporter behaviour)', () => {
      const row: LegacyThemeItem = {
        ...NULL_ROW,
        mwnf3_object_project_id: 'ISL',
        mwnf3_object_country_id: 'MAR',
        mwnf3_object_partner_id: 'MUS001',
        mwnf3_object_item_id: 42,
        mwnf3_object_item_type: 'detail',
        mwnf3_object_image_id: 3,
      };
      expect(resolvePictureItemBackwardCompatibility(row)).toBe(
        'mwnf3:objects_pictures:ISL:MAR:MUS001:42:3:detail'
      );
    });

    it.each([
      ['empty', ''],
      ['whitespace', '   '],
      ['null', null],
    ])('leaves the default photo untouched for a %s item_type', (_label, type) => {
      const row: LegacyThemeItem = {
        ...NULL_ROW,
        mwnf3_object_project_id: 'ISL',
        mwnf3_object_country_id: 'MAR',
        mwnf3_object_partner_id: 'MUS001',
        mwnf3_object_item_id: 42,
        mwnf3_object_item_type: type,
        mwnf3_object_image_id: 3,
      };
      expect(resolvePictureItemBackwardCompatibility(row)).toBe(
        'mwnf3:objects_pictures:ISL:MAR:MUS001:42:3'
      );
    });
  });

  describe('mwnf3 monument picture', () => {
    it('resolves to monuments_pictures key', () => {
      const row: LegacyThemeItem = {
        ...NULL_ROW,
        mwnf3_monument_project_id: 'BAR',
        mwnf3_monument_country_id: 'hr',
        mwnf3_monument_partner_id: 'Mon11',
        mwnf3_monument_item_id: 33,
        mwnf3_monument_item_type: null,
        mwnf3_monument_image_id: 2,
      };
      expect(resolvePictureItemBackwardCompatibility(row)).toBe(
        'mwnf3:monuments_pictures:BAR:hr:Mon11:33:2'
      );
    });

    it('appends a non-empty item_type (matches MonumentPictureImporter behaviour)', () => {
      const row: LegacyThemeItem = {
        ...NULL_ROW,
        mwnf3_monument_project_id: 'BAR',
        mwnf3_monument_country_id: 'hr',
        mwnf3_monument_partner_id: 'Mon11',
        mwnf3_monument_item_id: 33,
        mwnf3_monument_item_type: 'plan',
        mwnf3_monument_image_id: 2,
      };
      expect(resolvePictureItemBackwardCompatibility(row)).toBe(
        'mwnf3:monuments_pictures:BAR:hr:Mon11:33:2:plan'
      );
    });

    it('returns null when image_id is missing', () => {
      const row: LegacyThemeItem = {
        ...NULL_ROW,
        mwnf3_monument_project_id: 'BAR',
        mwnf3_monument_country_id: 'hr',
        mwnf3_monument_partner_id: 'Mon11',
        mwnf3_monument_item_id: 33,
        mwnf3_monument_image_id: null,
      };
      expect(resolvePictureItemBackwardCompatibility(row)).toBeNull();
    });
  });

  describe('mwnf3 monument detail picture', () => {
    it('resolves to monument_detail_pictures key — St. Joseph Dream example', () => {
      const row: LegacyThemeItem = {
        ...NULL_ROW,
        mwnf3_monument_detail_project_id: 'BAR',
        mwnf3_monument_detail_country_id: 'hr',
        mwnf3_monument_detail_partner_id: 'Mon11',
        mwnf3_monument_detail_item_id: 33,
        mwnf3_monument_detail_detail_id: 4,
        mwnf3_monument_detail_image_id: 1,
      };
      expect(resolvePictureItemBackwardCompatibility(row)).toBe(
        'mwnf3:monument_detail_pictures:BAR:hr:Mon11:33:4:1'
      );
    });

    it('returns null when image_id is missing', () => {
      const row: LegacyThemeItem = {
        ...NULL_ROW,
        mwnf3_monument_detail_project_id: 'BAR',
        mwnf3_monument_detail_country_id: 'hr',
        mwnf3_monument_detail_partner_id: 'Mon11',
        mwnf3_monument_detail_item_id: 33,
        mwnf3_monument_detail_detail_id: 4,
        mwnf3_monument_detail_image_id: null,
      };
      expect(resolvePictureItemBackwardCompatibility(row)).toBeNull();
    });

    it('returns null when detail_id is missing', () => {
      const row: LegacyThemeItem = {
        ...NULL_ROW,
        mwnf3_monument_detail_project_id: 'BAR',
        mwnf3_monument_detail_country_id: 'hr',
        mwnf3_monument_detail_partner_id: 'Mon11',
        mwnf3_monument_detail_item_id: 33,
        mwnf3_monument_detail_detail_id: null,
        mwnf3_monument_detail_image_id: 1,
      };
      expect(resolvePictureItemBackwardCompatibility(row)).toBeNull();
    });
  });

  describe('SH object picture', () => {
    it('resolves to sh_object_images key with lowercased strings', () => {
      const row: LegacyThemeItem = {
        ...NULL_ROW,
        sh_object_project_id: 'ISL',
        sh_object_country_id: 'MA',
        sh_object_item_id: 7,
        sh_object_item_type: null,
        sh_object_image_id: 2,
      };
      expect(resolvePictureItemBackwardCompatibility(row)).toBe(
        'mwnf3_sharing_history:sh_object_images:isl:ma:7:_:2'
      );
    });

    it('uses underscore for blank item_type', () => {
      const row: LegacyThemeItem = {
        ...NULL_ROW,
        sh_object_project_id: 'ISL',
        sh_object_country_id: 'MA',
        sh_object_item_id: 7,
        sh_object_item_type: '',
        sh_object_image_id: 1,
      };
      expect(resolvePictureItemBackwardCompatibility(row)).toBe(
        'mwnf3_sharing_history:sh_object_images:isl:ma:7:_:1'
      );
    });

    it('lowercases non-empty item_type', () => {
      const row: LegacyThemeItem = {
        ...NULL_ROW,
        sh_object_project_id: 'ISL',
        sh_object_country_id: 'MA',
        sh_object_item_id: 7,
        sh_object_item_type: 'Detail',
        sh_object_image_id: 3,
      };
      expect(resolvePictureItemBackwardCompatibility(row)).toBe(
        'mwnf3_sharing_history:sh_object_images:isl:ma:7:detail:3'
      );
    });

    it('returns null when image_id is missing', () => {
      const row: LegacyThemeItem = {
        ...NULL_ROW,
        sh_object_project_id: 'ISL',
        sh_object_country_id: 'MA',
        sh_object_item_id: 7,
        sh_object_image_id: null,
      };
      expect(resolvePictureItemBackwardCompatibility(row)).toBeNull();
    });
  });

  describe('SH monument picture', () => {
    it('resolves to sh_monument_images key with lowercased strings', () => {
      const row: LegacyThemeItem = {
        ...NULL_ROW,
        sh_monument_project_id: 'BAR',
        sh_monument_country_id: 'HR',
        sh_monument_item_id: 11,
        sh_monument_item_type: null,
        sh_monument_image_id: 1,
      };
      expect(resolvePictureItemBackwardCompatibility(row)).toBe(
        'mwnf3_sharing_history:sh_monument_images:bar:hr:11:_:1'
      );
    });

    it('uses underscore for blank item_type', () => {
      const row: LegacyThemeItem = {
        ...NULL_ROW,
        sh_monument_project_id: 'BAR',
        sh_monument_country_id: 'HR',
        sh_monument_item_id: 11,
        sh_monument_item_type: '',
        sh_monument_image_id: 2,
      };
      expect(resolvePictureItemBackwardCompatibility(row)).toBe(
        'mwnf3_sharing_history:sh_monument_images:bar:hr:11:_:2'
      );
    });

    it('returns null when image_id is missing', () => {
      const row: LegacyThemeItem = {
        ...NULL_ROW,
        sh_monument_project_id: 'BAR',
        sh_monument_country_id: 'HR',
        sh_monument_item_id: 11,
        sh_monument_image_id: null,
      };
      expect(resolvePictureItemBackwardCompatibility(row)).toBeNull();
    });
  });

  describe('SH monument detail picture', () => {
    it('resolves to sh_monument_detail_pictures key with lowercased strings', () => {
      const row: LegacyThemeItem = {
        ...NULL_ROW,
        sh_monument_detail_project_id: 'BAR',
        sh_monument_detail_country_id: 'HR',
        sh_monument_detail_item_id: 33,
        sh_monument_detail_detail_id: 4,
        sh_monument_detail_image_id: 1,
      };
      expect(resolvePictureItemBackwardCompatibility(row)).toBe(
        'mwnf3_sharing_history:sh_monument_detail_pictures:bar:hr:33:4:1'
      );
    });

    it('returns null when image_id is missing', () => {
      const row: LegacyThemeItem = {
        ...NULL_ROW,
        sh_monument_detail_project_id: 'BAR',
        sh_monument_detail_country_id: 'HR',
        sh_monument_detail_item_id: 33,
        sh_monument_detail_detail_id: 4,
        sh_monument_detail_image_id: null,
      };
      expect(resolvePictureItemBackwardCompatibility(row)).toBeNull();
    });

    it('returns null when detail_id is missing', () => {
      const row: LegacyThemeItem = {
        ...NULL_ROW,
        sh_monument_detail_project_id: 'BAR',
        sh_monument_detail_country_id: 'HR',
        sh_monument_detail_item_id: 33,
        sh_monument_detail_detail_id: null,
        sh_monument_detail_image_id: 1,
      };
      expect(resolvePictureItemBackwardCompatibility(row)).toBeNull();
    });
  });

  describe('Explore monument picture', () => {
    it('resolves to the explore monument_picture key', () => {
      const row: LegacyThemeItem = {
        ...NULL_ROW,
        explore_monument_item_id: 1419,
        explore_monument_item_type: '',
        explore_monument_image_id: 5,
      };

      expect(resolvePictureItemBackwardCompatibility(row)).toBe(
        'mwnf3_explore:monument_picture:1419:_:5'
      );
    });

    it('carries a non-empty image type into the key', () => {
      const row: LegacyThemeItem = {
        ...NULL_ROW,
        explore_monument_item_id: 206,
        explore_monument_item_type: 'detail',
        explore_monument_image_id: 1,
      };

      expect(resolvePictureItemBackwardCompatibility(row)).toBe(
        'mwnf3_explore:monument_picture:206:detail:1'
      );
    });

    it('treats monument id 0 as absent', () => {
      const row: LegacyThemeItem = {
        ...NULL_ROW,
        explore_monument_item_id: 0,
        explore_monument_image_id: 1,
      };

      expect(resolvePictureItemBackwardCompatibility(row)).toBeNull();
    });

    it('returns null when the image column is missing', () => {
      const row: LegacyThemeItem = {
        ...NULL_ROW,
        explore_monument_item_id: 206,
        explore_monument_image_id: null,
      };

      expect(resolvePictureItemBackwardCompatibility(row)).toBeNull();
    });
  });

  describe('Travels monument picture', () => {
    it('resolves to the travels monument_picture key', () => {
      const row: LegacyThemeItem = {
        ...NULL_ROW,
        travel_monument_project_id: 'IAM',
        travel_monument_country_id: 'pa',
        travel_monument_trail_id: 1,
        travel_monument_itinerary_id: 'I',
        travel_monument_location_id: '1',
        travel_monument_item_id: 'c',
        travel_monument_item_type: '',
        travel_monument_image_id: 12,
      };

      expect(resolvePictureItemBackwardCompatibility(row)).toBe(
        'mwnf3_travels:monument_picture:IAM:pa:1:I:1:c:_:12'
      );
    });

    it('returns null when part of the composite key is missing', () => {
      const row: LegacyThemeItem = {
        ...NULL_ROW,
        travel_monument_project_id: 'IAM',
        travel_monument_country_id: 'pa',
        travel_monument_trail_id: 1,
        travel_monument_itinerary_id: null,
        travel_monument_location_id: '1',
        travel_monument_item_id: 'c',
        travel_monument_image_id: 12,
      };

      expect(resolvePictureItemBackwardCompatibility(row)).toBeNull();
    });
  });

  describe('unsupported / empty rows', () => {
    it('returns null for a fully null row (no reference in any family)', () => {
      expect(resolvePictureItemBackwardCompatibility(NULL_ROW)).toBeNull();
    });
  });

  describe('priority — first matching family wins', () => {
    it('prefers mwnf3 object over monument when both are set', () => {
      const row: LegacyThemeItem = {
        ...NULL_ROW,
        mwnf3_object_project_id: 'ISL',
        mwnf3_object_country_id: 'MAR',
        mwnf3_object_partner_id: 'MUS',
        mwnf3_object_item_id: 1,
        mwnf3_object_image_id: 1,
        mwnf3_monument_project_id: 'BAR',
        mwnf3_monument_country_id: 'HR',
        mwnf3_monument_partner_id: 'MON',
        mwnf3_monument_item_id: 2,
        mwnf3_monument_image_id: 2,
      };
      const result = resolvePictureItemBackwardCompatibility(row);
      expect(result).toContain('objects_pictures');
      expect(result).not.toContain('monuments_pictures');
    });
  });

  // #1534. The mwnf3, Explore and Travels branches emit the legacy spelling
  // verbatim, and legacy is not internally consistent — mwnf3.monuments_pictures
  // stores both `isl` and `ISL`, mwnf3_travels both `iam` and `IAM`. No casing rule
  // in the resolver could match all of them, so what has to hold instead is that
  // the lookup layer is case-insensitive. These tests pin that end to end: a key
  // the resolver spells in legacy's casing finds an item the picture importer
  // registered in the other casing.
  describe('casing — resolver output is matched case-insensitively by the tracker', () => {
    const trackerWith = (backwardCompatibility: string): UnifiedTracker => {
      const tracker = new UnifiedTracker();
      tracker.register({
        uuid: 'ffffffff-0000-4000-8000-000000000001',
        backwardCompatibility,
        entityType: 'item',
        createdAt: new Date(0),
      });
      return tracker;
    };

    it('resolves an upper-case monument reference against a lower-case stored key', () => {
      const row: LegacyThemeItem = {
        ...NULL_ROW,
        mwnf3_monument_project_id: 'BAR',
        mwnf3_monument_country_id: 'hu',
        mwnf3_monument_partner_id: 'Mon11',
        mwnf3_monument_item_id: 10,
        mwnf3_monument_image_id: 1,
      };
      const key = resolvePictureItemBackwardCompatibility(row);
      expect(key).toBe('mwnf3:monuments_pictures:BAR:hu:Mon11:10:1');

      // What the picture importer actually wrote for this row.
      const tracker = trackerWith('mwnf3:monuments_pictures:bar:hu:Mon11:10:1');
      expect(tracker.getUuid(key!, 'item')).toBe('ffffffff-0000-4000-8000-000000000001');
    });

    it('resolves an upper-case Travels reference against a lower-case stored key', () => {
      const row: LegacyThemeItem = {
        ...NULL_ROW,
        travel_monument_project_id: 'IAM',
        travel_monument_country_id: 'pa',
        travel_monument_trail_id: 1,
        travel_monument_itinerary_id: 'I',
        travel_monument_location_id: '1',
        travel_monument_item_id: 'c',
        travel_monument_image_id: 12,
      };
      const key = resolvePictureItemBackwardCompatibility(row);
      expect(key).toBe('mwnf3_travels:monument_picture:IAM:pa:1:I:1:c:_:12');

      const tracker = trackerWith('mwnf3_travels:monument_picture:iam:pa:1:i:1:c:_:12');
      expect(tracker.getUuid(key!, 'item')).toBe('ffffffff-0000-4000-8000-000000000001');
    });

    it('keeps the legacy spelling in the key it returns', () => {
      const row: LegacyThemeItem = {
        ...NULL_ROW,
        mwnf3_monument_detail_project_id: 'BAR',
        mwnf3_monument_detail_country_id: 'at',
        mwnf3_monument_detail_partner_id: 'Mon11',
        mwnf3_monument_detail_item_id: 47,
        mwnf3_monument_detail_detail_id: 3,
        mwnf3_monument_detail_image_id: 3,
      };
      // Not lowercased: monument_detail_pictures stores this family upper-case.
      expect(resolvePictureItemBackwardCompatibility(row)).toBe(
        'mwnf3:monument_detail_pictures:BAR:at:Mon11:47:3:3'
      );
    });
  });
});

describe('THEME_ITEM_SELECT_COLUMNS', () => {
  it('contains the mwnf3 object image column', () => {
    expect(THEME_ITEM_SELECT_COLUMNS).toContain('mwnf3_object_image_id');
  });

  it('contains the mwnf3 monument image column', () => {
    expect(THEME_ITEM_SELECT_COLUMNS).toContain('mwnf3_monument_image_id');
  });

  it('contains the mwnf3 monument detail image column', () => {
    expect(THEME_ITEM_SELECT_COLUMNS).toContain('mwnf3_monument_detail_image_id');
  });

  it('contains the SH object image column', () => {
    expect(THEME_ITEM_SELECT_COLUMNS).toContain('sh_object_image_id');
  });

  it('contains the SH monument image column', () => {
    expect(THEME_ITEM_SELECT_COLUMNS).toContain('sh_monument_image_id');
  });

  it('contains the SH monument detail image column', () => {
    expect(THEME_ITEM_SELECT_COLUMNS).toContain('sh_monument_detail_image_id');
  });

  it('contains the Explore monument image column', () => {
    expect(THEME_ITEM_SELECT_COLUMNS).toContain('explore_monument_image_id');
  });

  it('contains the Travels monument composite key columns', () => {
    expect(THEME_ITEM_SELECT_COLUMNS).toContain('travel_monument_image_id');
    expect(THEME_ITEM_SELECT_COLUMNS).toContain('travel_monument_trail_id');
    expect(THEME_ITEM_SELECT_COLUMNS).toContain('travel_monument_location_id');
  });
});

describe('MWNF-635 picture borrowed from the record an Explore monument points to', () => {
  const borrowed = (
    sourceType: string,
    sourceKey: string,
    itemType: string | null,
    image: number
  ): LegacyThemeItem => ({
    ...NULL_ROW,
    explore_monument_item_id: 934,
    explore_monument_source_type: sourceType,
    explore_monument_source_key: sourceKey,
    explore_monument_source_item_type: itemType,
    explore_monument_source_image_id: image,
  });

  it('links a borrowed Travel picture to the Travels picture item', () => {
    expect(
      resolvePictureItemBackwardCompatibility(borrowed('travel', 'IAM;sy;1;I;1;a', '', 3))
    ).toBe('mwnf3_travels:monument_picture:IAM:sy:1:I:1:a:_:3');
  });

  it('links a borrowed DIA monument picture to the mwnf3 monument picture item', () => {
    expect(
      resolvePictureItemBackwardCompatibility(borrowed('monument', 'ISL;sy;Mon01;12', '', 2))
    ).toBe('mwnf3:monuments_pictures:ISL:sy:Mon01:12:2');
  });

  it('keeps a typed DIA monument picture distinct from the default photo', () => {
    expect(
      resolvePictureItemBackwardCompatibility(borrowed('monument', 'ISL;sy;Mon01;12', 'plan', 2))
    ).toBe('mwnf3:monuments_pictures:ISL:sy:Mon01:12:2:plan');
  });

  it('links a borrowed Sharing History monument picture with lower-cased key parts', () => {
    expect(
      resolvePictureItemBackwardCompatibility(borrowed('sh_monument', 'AWE;SY;7', '', 1))
    ).toBe('mwnf3_sharing_history:sh_monument_images:awe:sy:7:_:1');
  });

  it('returns null for a borrowed museum picture (museum pictures are partner images, not items)', () => {
    expect(
      resolvePictureItemBackwardCompatibility(borrowed('museum', 'sy;Mus01', '', 1))
    ).toBeNull();
  });

  it('returns null for a source key with the wrong number of parts', () => {
    expect(
      resolvePictureItemBackwardCompatibility(borrowed('travel', 'IAM;sy;1', '', 1))
    ).toBeNull();
  });

  it('still resolves an own Explore picture when the source columns are null', () => {
    const row: LegacyThemeItem = {
      ...NULL_ROW,
      explore_monument_item_id: 1806,
      explore_monument_item_type: '',
      explore_monument_image_id: 1,
      explore_monument_source_type: null,
      explore_monument_source_key: null,
      explore_monument_source_item_type: null,
      explore_monument_source_image_id: null,
    };
    expect(resolvePictureItemBackwardCompatibility(row)).toBe(
      'mwnf3_explore:monument_picture:1806:_:1'
    );
  });
});

describe('themeItemSelectColumns', () => {
  const db = (n: number) => ({ query: async <T>() => [{ n } as unknown as T] });

  it('adds the borrowed-picture columns when the legacy schema has them', async () => {
    const columns = await themeItemSelectColumns(db(1));
    expect(columns).toContain(THEME_ITEM_SELECT_COLUMNS);
    expect(columns).toContain(THEME_ITEM_SOURCE_COLUMNS);
  });

  it('keeps the original columns on a legacy schema without them', async () => {
    expect(await themeItemSelectColumns(db(0))).toBe(THEME_ITEM_SELECT_COLUMNS);
  });
});
