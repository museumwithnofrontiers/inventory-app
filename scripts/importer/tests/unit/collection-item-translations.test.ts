import { describe, expect, it, vi } from 'vitest';
import { CollectionItemTranslationsImporter } from '../../src/importers/phase-11/collection-item-translations-importer.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import { UnifiedTracker } from '../../src/core/tracker.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';
import {
  COLLECTION_ITEM_TRANSLATION_KEYS,
  descriptionKey,
  placementTranslationUuidName,
  splitCollectionItemTranslations,
} from '../../src/utils/collection-item-translations.js';

const MWNF3_PAGE = 'mwnf3:exhibition_pages:264';
const THG_THEME = 'mwnf3_thematic_gallery:theme:55:11';

describe('splitCollectionItemTranslations (M16 C2)', () => {
  it("moves an mwnf3 page's caption, detail name and description per language", () => {
    const { extra, translations, kept } = splitCollectionItemTranslations(
      {
        item_name: { eng: 'Fountain', ita: 'Fontana' },
        item_date: { eng: '1650' },
        item_location: { eng: 'Rome' },
        item_museum: { ita: 'Museo' },
        detail_name: { eng: 'The Vision Fountain' },
        detail_justification: { eng: 'A fountain.' },
        item_dynasty: { eng: 'Barberini' },
        item_artist: { ita: 'Bernini' },
        item_material: { ita: 'Marmo' },
        membership: 'project',
      },
      MWNF3_PAGE
    );
    expect(kept).toEqual([]);
    expect(extra).toEqual({ membership: 'project' });
    expect(Object.fromEntries(translations)).toEqual({
      eng: {
        title: 'The Vision Fountain',
        description: 'A fountain.',
        item_name: 'Fountain',
        item_date: '1650',
        item_location: 'Rome',
        item_dynasty: 'Barberini',
      },
      ita: { item_name: 'Fontana', item_museum: 'Museo', item_artist: 'Bernini', item_material: 'Marmo' },
    });
  });

  it("moves a theme's description, caption and each text's legacy key", () => {
    const { extra, translations } = splitCollectionItemTranslations(
      {
        contextual_descriptions: { eng: 'A gold medal.' },
        image_captions: { eng: 'Orientalist painting (detail)' },
        source_bc_by_language: { eng: 'mwnf3_thematic_gallery:theme_item_i18n:55:11:16:en' },
      },
      THG_THEME
    );
    expect(extra).toBeNull();
    expect(translations.get('eng')).toEqual({
      description: 'A gold medal.',
      caption: 'Orientalist painting (detail)',
      backward_compatibility: 'mwnf3_thematic_gallery:theme_item_i18n:55:11:16:en',
    });
  });

  it('moves the two justifications with their nulls, and the National Context one', () => {
    expect(
      Object.fromEntries(
        splitCollectionItemTranslations(
          {
            justifications: {
              eng: { curator: 'A dwelling.', partner: null },
              fra: { curator: null, partner: 'Moment important.' },
            },
            curator_status: 'Y',
          },
          'mwnf3_sharing_history:sh_exhibition_themes:1'
        ).translations
      )
    ).toEqual({
      eng: { curator_justification: 'A dwelling.', partner_justification: null },
      fra: { curator_justification: null, partner_justification: 'Moment important.' },
    });
    expect(
      splitCollectionItemTranslations(
        { justifications: { fra: 'Moment important.' } },
        'mwnf3_sharing_history:sh_national_context_exhibitions:3'
      ).translations.get('fra')
    ).toEqual({ justification: 'Moment important.' });
  });

  it('keeps a justification pair with no text, and one of another shape', () => {
    for (const justifications of [
      { eng: { curator: null, partner: null } },
      { eng: { curator: 'x' } },
      { eng: { curator: 'x', partner: null, extra: 'y' } },
      {},
    ]) {
      const { extra, translations, kept } = splitCollectionItemTranslations(
        { justifications },
        MWNF3_PAGE
      );
      expect(extra).toEqual({ justifications });
      expect(translations.size).toBe(0);
      expect(kept).toHaveLength(1);
    }
  });

  it('keeps a description its collection would give back under the other key', () => {
    const extra = { contextual_descriptions: { eng: 'Text.' } };
    expect(splitCollectionItemTranslations(extra, MWNF3_PAGE)).toEqual({
      extra,
      translations: new Map(),
      kept: [`contextual_descriptions (its collection "${MWNF3_PAGE}" holds detail_justification)`],
    });
    expect(
      splitCollectionItemTranslations({ detail_justification: { eng: 'Text.' } }, THG_THEME).kept
    ).toHaveLength(1);
  });

  it('keeps both descriptions when a placement has the two', () => {
    const extra = {
      contextual_descriptions: { eng: 'One.' },
      detail_justification: { eng: 'Two.' },
    };
    const result = splitCollectionItemTranslations(extra, MWNF3_PAGE);
    expect(result.extra).toEqual(extra);
    expect(result.kept).toHaveLength(2);
  });

  it('keeps a key that is not a map of language to text', () => {
    const extra = { item_name: { eng: 3 }, detail_name: 'The Vision Fountain' };
    const result = splitCollectionItemTranslations(extra, MWNF3_PAGE);
    expect(result.extra).toEqual(extra);
    expect(result.kept).toEqual([
      'detail_name (not a map of language to text)',
      'item_name (not a map of language to text)',
    ]);
  });

  it('covers the C2 keys', () => {
    expect([...COLLECTION_ITEM_TRANSLATION_KEYS].sort()).toEqual(
      [
        'contextual_descriptions',
        'detail_justification',
        'detail_name',
        'image_captions',
        'item_artist',
        'item_date',
        'item_dynasty',
        'item_location',
        'item_material',
        'item_museum',
        'item_name',
        'justifications',
        'source_bc_by_language',
      ].sort()
    );
  });

  it('gives an mwnf3 collection detail_justification, any other contextual_descriptions', () => {
    expect(descriptionKey('mwnf3:artintro_pages:1')).toBe('detail_justification');
    expect(descriptionKey('mwnf3_travels:trail:1')).toBe('contextual_descriptions');
    expect(descriptionKey(null)).toBe('contextual_descriptions');
  });

  it('names a placement translation by its placement and language', () => {
    expect(placementTranslationUuidName('p-1', 'eng')).toBe('collection_item_translation:p-1:eng');
  });
});

describe('CollectionItemTranslationsImporter', () => {
  function run(rows: Awaited<ReturnType<IWriteStrategy['findCollectionItemTextRows']>>) {
    const strategy = {
      findCollectionItemTextRows: vi.fn().mockResolvedValue(rows),
      upsertCollectionItemTranslation: vi.fn().mockResolvedValue('id'),
      setCollectionItemColumnsById: vi.fn().mockResolvedValue(undefined),
    };
    const logger: ILogger = {
      info: vi.fn(),
      warning: vi.fn(),
      skip: vi.fn(),
      error: vi.fn(),
      exception: vi.fn(),
      showProgress: vi.fn(),
      showSkipped: vi.fn(),
      showError: vi.fn(),
      showSummary: vi.fn(),
    };
    const context: ImportContext = {
      legacyDb: { query: vi.fn() } as unknown as ILegacyDatabase,
      strategy: strategy as unknown as IWriteStrategy,
      tracker: new UnifiedTracker(),
      logger,
      dryRun: false,
    };
    const importer = new CollectionItemTranslationsImporter(context);
    return { importer, strategy };
  }

  it('writes each language in order, then the rest of extra', async () => {
    const { importer, strategy } = run([
      {
        id: 'p-1',
        collection_backward_compatibility: MWNF3_PAGE,
        extra: {
          item_name: { ita: 'Fontana', eng: 'Fountain' },
          membership: 'project',
        },
      },
    ]);
    const result = await importer.import();
    expect(result.success).toBe(true);
    expect(result.imported).toBe(1);
    expect(strategy.upsertCollectionItemTranslation.mock.calls).toEqual([
      ['p-1', 'eng', { item_name: 'Fountain' }],
      ['p-1', 'ita', { item_name: 'Fontana' }],
    ]);
    expect(strategy.setCollectionItemColumnsById).toHaveBeenCalledWith(
      'p-1',
      {},
      JSON.stringify({ membership: 'project' })
    );
  });

  it('skips a placement with nothing to move', async () => {
    const { importer, strategy } = run([
      {
        id: 'p-2',
        collection_backward_compatibility: MWNF3_PAGE,
        extra: { contextual_descriptions: { eng: 'Text.' } },
      },
    ]);
    const result = await importer.import();
    expect(result.skipped).toBe(1);
    expect(strategy.upsertCollectionItemTranslation).not.toHaveBeenCalled();
    expect(strategy.setCollectionItemColumnsById).not.toHaveBeenCalled();
  });
});
