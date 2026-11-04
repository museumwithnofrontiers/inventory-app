import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ThgGalleryContentImporter } from '../../src/importers/phase-10/thg-gallery-content-importer.js';
import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';

describe('ThgGalleryContentImporter', () => {
  let tracker: UnifiedTracker;
  let legacyDb: ILegacyDatabase;
  let strategy: IWriteStrategy;
  let context: ImportContext;
  let queryMock: ReturnType<typeof vi.fn>;
  let writeCollectionImageMock: ReturnType<typeof vi.fn>;
  let writeCollectionMediaMock: ReturnType<typeof vi.fn>;
  let writePartnerMock: ReturnType<typeof vi.fn>;
  let writePartnerTranslationMock: ReturnType<typeof vi.fn>;
  let writePartnerLogoMock: ReturnType<typeof vi.fn>;
  let writeContributorMock: ReturnType<typeof vi.fn>;
  let attachPartnerToCollectionWithLevelMock: ReturnType<typeof vi.fn>;
  let setCollectionExtraMock: ReturnType<typeof vi.fn>;

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

  /** The `logos` the n-th setCollectionExtra call wrote. */
  const writtenLogos = (call = 0): Array<Record<string, unknown>> =>
    (
      JSON.parse(setCollectionExtraMock.mock.calls[call]![1] as string) as {
        logos: Array<Record<string, unknown>>;
      }
    ).logos;

  beforeEach(() => {
    vi.clearAllMocks();

    tracker = new UnifiedTracker();
    tracker.set('en', 'eng', 'language');
    tracker.set('us', 'usa', 'country');
    tracker.setMetadata('default_context_id', 'default-context-uuid');
    tracker.setMetadata('default_language_id', 'eng');
    tracker.set('mwnf3_thematic_gallery:thg_gallery:5', 'collection-uuid-5', 'collection');

    queryMock = vi.fn(async (sql: string) => {
      if (sql.includes('INNER JOIN mwnf3_thematic_gallery.thg_projects')) {
        return [
          {
            gallery_id: 5,
            is_gallery: 0,
            is_exhibition: 1,
          },
        ];
      }
      if (sql.includes('FROM mwnf3_thematic_gallery.exhibition_logo_i18n')) {
        return [
          {
            logo_id: 1,
            language_id: 'en',
            label: 'United Nations Alliance of Civilizations',
            alt: 'The UNAOC emblem',
            further_reading: null,
          },
        ];
      }
      if (sql.includes('FROM mwnf3_thematic_gallery.exhibition_logo_category')) {
        return [
          { category_id: 0, name: 'Header', description: null },
          { category_id: 1, name: 'Footer 1', description: null },
          { category_id: 2, name: 'Footer 2', description: null },
        ];
      }
      if (sql.includes('FROM mwnf3_thematic_gallery.exhibition_logo')) {
        return [
          {
            logo_id: 1,
            gallery_id: 5,
            category_id: 1,
            logo: 'logos/gallery5_header.png',
            label: 'UNAOC',
            alt: null,
            link: 'https://www.unaoc.org/',
            visible: 'Y',
            further_reading: null,
            display_order: 1,
          },
        ];
      }
      if (sql.includes('FROM mwnf3_thematic_gallery.exhibition_partner_i18n')) {
        return [];
      }
      if (sql.includes('FROM mwnf3_thematic_gallery.exhibition_partner')) {
        return [];
      }
      if (sql.includes('FROM mwnf3_thematic_gallery.exhibition_related_content_i18n')) {
        return [
          {
            related_content_id: 20,
            language_id: 'en',
            title: 'A Bibliography Entry',
            description: null,
            link: null,
            uploaded_document: 'thematic_gallery/thg_galleries/5/related_content/20/en/1.pdf',
            type_resource: 'document',
            further_reading: null,
            entity_name: null,
            entity_location: null,
            entity_country: null,
            authors: null,
          },
        ];
      }
      if (sql.includes('FROM mwnf3_thematic_gallery.exhibition_related_content')) {
        return [
          {
            related_content_id: 20,
            gallery_id: 5,
            category_id: 3,
            type_resource: 'video',
            link: 'https://example.com/video',
            uploaded_document: null,
            title: 'Base Video',
            description: null,
            further_reading: 'Further notes',
            entity_name: null,
            entity_location: null,
            entity_country: null,
            authors: null,
            display_order: 1,
          },
        ];
      }
      return [];
    });

    legacyDb = {
      query: queryMock as ILegacyDatabase['query'],
      execute: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    };

    writeCollectionImageMock = vi.fn().mockResolvedValue('collection-image-uuid');
    setCollectionExtraMock = vi.fn().mockResolvedValue(undefined);
    writeCollectionMediaMock = vi.fn().mockResolvedValue(undefined);
    writePartnerMock = vi.fn().mockResolvedValue('partner-uuid');
    writePartnerTranslationMock = vi.fn().mockResolvedValue(undefined);
    writePartnerLogoMock = vi.fn().mockResolvedValue('partner-logo-uuid');
    writeContributorMock = vi.fn().mockResolvedValue('contributor-uuid');
    attachPartnerToCollectionWithLevelMock = vi.fn().mockResolvedValue(undefined);

    strategy = {
      exists: vi.fn().mockResolvedValue(false),
      findByBackwardCompatibility: vi.fn().mockResolvedValue(null),
      imageExists: vi.fn().mockResolvedValue(null),
      writeCollectionImage: writeCollectionImageMock,
      writeCollectionMedia: writeCollectionMediaMock,
      writePartner: writePartnerMock,
      writePartnerTranslation: writePartnerTranslationMock,
      writePartnerLogo: writePartnerLogoMock,
      writeContributor: writeContributorMock,
      attachPartnerToCollectionWithLevel: attachPartnerToCollectionWithLevelMock,
      getCollectionExtra: vi.fn().mockResolvedValue({ subtitle: 'kept' }),
      setCollectionExtra: setCollectionExtraMock,
    } as unknown as IWriteStrategy;

    context = {
      legacyDb,
      strategy,
      tracker,
      logger,
      dryRun: false,
    };
  });

  describe('exhibition logos', () => {
    it('logo query selects logo column — not path', async () => {
      const importer = new ThgGalleryContentImporter(context);
      await importer.import();

      const logoCall = queryMock.mock.calls.find((args: unknown[]) =>
        (args[0] as string).includes('FROM mwnf3_thematic_gallery.exhibition_logo')
      );
      expect(logoCall).toBeDefined();
      const sql: string = logoCall![0] as string;
      expect(sql).toContain('logo');
      expect(sql).not.toContain('path');
    });

    it("keeps the logo in its collection's extra, beside what is there, not as an image", async () => {
      const importer = new ThgGalleryContentImporter(context);
      const result = await importer.import();

      expect(writeCollectionImageMock).not.toHaveBeenCalled();
      expect(setCollectionExtraMock).toHaveBeenCalledWith(
        'collection-uuid-5',
        JSON.stringify({
          subtitle: 'kept',
          logos: [
            {
              file: 'logos/gallery5_header.png',
              link: 'https://www.unaoc.org/',
              category_id: 1,
              category_name: 'Footer 1',
              visible: true,
              labels: { eng: 'United Nations Alliance of Civilizations' },
              alts: { eng: 'The UNAOC emblem' },
              display_order: 1,
            },
          ],
        })
      );
      expect(result.errors).toHaveLength(0);
    });

    /**
     * The base row carries a short internal label ("UNAOC"); the i18n row
     * carries the display string the live API actually serves. Keeping the
     * base row's value would put an acronym on the exhibition banner.
     */
    it('lets the i18n caption win over the base-row label', async () => {
      await new ThgGalleryContentImporter(context).import();

      expect(writtenLogos()[0]!['labels']).toEqual({
        eng: 'United Nations Alliance of Civilizations',
      });
    });

    /**
     * Legacy hides a logo with visible='N'. The inventory is the system of
     * record — the row is imported anyway and the flag rides along, so
     * filtering stays the viewer's job.
     */
    it('keeps a hidden logo, carrying visible: false', async () => {
      queryMock.mockImplementation(async (sql: string) => {
        if (sql.includes('INNER JOIN mwnf3_thematic_gallery.thg_projects')) {
          return [{ gallery_id: 5, is_gallery: 0, is_exhibition: 1 }];
        }
        if (sql.includes('FROM mwnf3_thematic_gallery.exhibition_logo_i18n')) return [];
        if (sql.includes('FROM mwnf3_thematic_gallery.exhibition_logo_category')) return [];
        if (sql.includes('FROM mwnf3_thematic_gallery.exhibition_logo')) {
          return [
            {
              logo_id: 9,
              gallery_id: 5,
              category_id: null,
              logo: 'logos/hidden.png',
              label: null,
              alt: null,
              link: null,
              visible: 'N',
              further_reading: null,
              display_order: null,
            },
          ];
        }
        return [];
      });

      const result = await new ThgGalleryContentImporter(context).import();

      // Every empty key is omitted; `visible: false` is a value and stays.
      expect(writtenLogos()).toEqual([
        { file: 'logos/hidden.png', visible: false, display_order: 0 },
      ]);
      expect(result.errors).toHaveLength(0);
    });

    /**
     * The legacy schema drifts. Losing the caption tables must degrade the
     * payload, not lose the logos.
     */
    it('still imports logos when the i18n and category tables are missing', async () => {
      queryMock.mockImplementation(async (sql: string) => {
        if (sql.includes('INNER JOIN mwnf3_thematic_gallery.thg_projects')) {
          return [{ gallery_id: 5, is_gallery: 0, is_exhibition: 1 }];
        }
        if (
          sql.includes('FROM mwnf3_thematic_gallery.exhibition_logo_i18n') ||
          sql.includes('FROM mwnf3_thematic_gallery.exhibition_logo_category')
        ) {
          throw new Error("Table 'exhibition_logo_i18n' doesn't exist");
        }
        if (sql.includes('FROM mwnf3_thematic_gallery.exhibition_logo')) {
          return [
            {
              logo_id: 1,
              gallery_id: 5,
              category_id: 2,
              logo: 'logos/gallery5_header.png',
              label: 'UNAOC',
              alt: null,
              link: 'https://www.unaoc.org/',
              visible: 'Y',
              further_reading: null,
              display_order: 1,
            },
          ];
        }
        return [];
      });

      const result = await new ThgGalleryContentImporter(context).import();

      const [extra] = writtenLogos();
      expect(extra!['category_id']).toBe(2);
      expect(extra).not.toHaveProperty('category_name');
      // The base row still seeds the default language.
      expect(extra!['labels']).toEqual({ eng: 'UNAOC' });
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('exhibition related content', () => {
    it('related content query uses related_content_id, type_resource, link — not content_id, type, url', async () => {
      const importer = new ThgGalleryContentImporter(context);
      await importer.import();

      const contentCall = queryMock.mock.calls.find(
        (args: unknown[]) =>
          (args[0] as string).includes('FROM mwnf3_thematic_gallery.exhibition_related_content') &&
          !(args[0] as string).includes('_i18n')
      );
      expect(contentCall).toBeDefined();
      const sql: string = contentCall![0] as string;
      expect(sql).toContain('related_content_id');
      expect(sql).toContain('type_resource');
      expect(sql).toContain('link');
      expect(sql).not.toMatch(/\bcontent_id\b/);
      expect(sql).not.toMatch(/\btype\b/);
      expect(sql).not.toMatch(/\burl\b/);
    });

    it('i18n query uses related_content_id and language_id — not content_id and lang', async () => {
      const importer = new ThgGalleryContentImporter(context);
      await importer.import();

      const i18nCall = queryMock.mock.calls.find((args: unknown[]) =>
        (args[0] as string).includes('FROM mwnf3_thematic_gallery.exhibition_related_content_i18n')
      );
      expect(i18nCall).toBeDefined();
      const sql: string = i18nCall![0] as string;
      expect(sql).toContain('related_content_id');
      expect(sql).toContain('language_id');
      expect(sql).not.toMatch(/\bcontent_id\b/);
      expect(sql).not.toMatch(/\blang\b(?!uage_id)/);
    });

    it('writes language-neutral collection media from base link and type_resource', async () => {
      const importer = new ThgGalleryContentImporter(context);
      const result = await importer.import();

      expect(writeCollectionMediaMock).toHaveBeenCalledWith(
        expect.objectContaining({
          collection_id: 'collection-uuid-5',
          language_id: null,
          type: 'video',
          title: 'Base Video',
          url: 'https://example.com/video',
          backward_compatibility: 'mwnf3_thematic_gallery:exhibition_related_content:20:link',
        })
      );
      expect(result.errors).toHaveLength(0);
    });

    it('writes language-specific document media from uploaded_document exactly', async () => {
      const importer = new ThgGalleryContentImporter(context);
      const result = await importer.import();

      expect(writeCollectionMediaMock).toHaveBeenCalledWith(
        expect.objectContaining({
          collection_id: 'collection-uuid-5',
          language_id: 'eng',
          type: 'document',
          title: 'A Bibliography Entry',
          url: 'thematic_gallery/thg_galleries/5/related_content/20/en/1.pdf',
          backward_compatibility:
            'mwnf3_thematic_gallery:exhibition_related_content_i18n:20:en:document',
        })
      );
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('exhibition partners', () => {
    it('imports exhibition partners as partners and collection links, not contributors', async () => {
      queryMock.mockImplementation(async (sql: string) => {
        if (sql.includes('INNER JOIN mwnf3_thematic_gallery.thg_projects')) {
          return [{ gallery_id: 5, is_gallery: 0, is_exhibition: 1 }];
        }
        if (sql.includes('FROM mwnf3_thematic_gallery.exhibition_logo')) {
          return [];
        }
        if (sql.includes('FROM mwnf3_thematic_gallery.exhibition_partner_i18n')) {
          return [
            {
              partner_id: 2,
              language_id: 'en',
              entity_name: 'UN Alliance of Civilisations',
              entity_location: null,
              entity_country: 'us',
              title: null,
              link: 'https://www.unaoc.org/',
              description: 'Partner description',
              logo: 'thematic_gallery/thg_galleries/47/partners/2/en/logo.jpg',
              contact_title: null,
              contact_name: null,
              contact_email: 'info@example.com',
              contact_phone: null,
              contact_fax: null,
              further_reading: null,
            },
          ];
        }
        if (sql.includes('FROM mwnf3_thematic_gallery.exhibition_partner')) {
          return [
            {
              partner_id: 2,
              gallery_id: 5,
              category_id: 1,
              display_order: 3,
              entity_name: 'UN Alliance of Civilisations',
              entity_location: null,
              entity_country: 'us',
              title: null,
              link: 'https://www.unaoc.org/',
              description: null,
              logo: 'thematic_gallery/thg_galleries/47/partners/2/logo.jpg',
              visible: 'N',
              contact_title: null,
              contact_name: null,
              contact_email: null,
              contact_phone: null,
              contact_fax: null,
              further_reading: null,
            },
          ];
        }
        if (sql.includes('FROM mwnf3_thematic_gallery.exhibition_related_content')) {
          return [];
        }
        return [];
      });

      const importer = new ThgGalleryContentImporter(context);
      const result = await importer.import();

      expect(writePartnerMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'institution',
          internal_name: 'UN Alliance of Civilisations',
          backward_compatibility: 'mwnf3_thematic_gallery:exhibition_partner:2',
          country_id: 'usa',
          visible: false,
        })
      );
      expect(attachPartnerToCollectionWithLevelMock).toHaveBeenCalledWith(
        'collection-uuid-5',
        'partner-uuid',
        'exhibition',
        'full_partner'
      );
      expect(writePartnerLogoMock).toHaveBeenCalledWith(
        expect.objectContaining({
          partner_id: 'partner-uuid',
          path: 'thematic_gallery/thg_galleries/47/partners/2/logo.jpg',
          alt_text: null,
        })
      );
      expect(writePartnerTranslationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          partner_id: 'partner-uuid',
          language_id: 'eng',
          name: 'UN Alliance of Civilisations',
        })
      );
      expect(writeContributorMock).not.toHaveBeenCalled();
      expect(result.errors).toHaveLength(0);
    });
  });
});
