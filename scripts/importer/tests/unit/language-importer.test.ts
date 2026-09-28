/**
 * Tests for Language Importer
 *
 * Verifies that the LanguageImporter correctly loads languages from the JSON file
 * instead of querying the legacy database.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  LanguageImporter,
  LanguageTranslationImporter,
} from '../../src/importers/phase-00/language-importer.js';
import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';

// Mock the file system module
vi.mock('fs', () => ({
  readFileSync: vi.fn(() =>
    JSON.stringify([
      { id: 'eng', internal_name: 'English', backward_compatibility: 'en', is_default: true },
      { id: 'fra', internal_name: 'Français', backward_compatibility: 'fr', is_default: false },
      { id: 'ara', internal_name: 'Arabic', backward_compatibility: 'ar', is_default: false },
    ])
  ),
}));

describe('LanguageImporter', () => {
  let mockLegacyDb: ILegacyDatabase;
  let mockStrategy: IWriteStrategy;
  let tracker: UnifiedTracker;
  let context: ImportContext;
  const mockLogger: ILogger = {
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

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create mock legacy database (should NOT be called)
    mockLegacyDb = {
      query: vi.fn(),
      execute: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    };

    // Create mock write strategy
    mockStrategy = {
      writeLanguage: vi.fn().mockResolvedValue(undefined),
      writeCountry: vi.fn().mockResolvedValue(undefined),
      writeContext: vi.fn().mockResolvedValue('context-uuid'),
      writeCollection: vi.fn().mockResolvedValue('collection-uuid'),
      writeCollectionItem: vi.fn().mockResolvedValue(undefined),
      writeProject: vi.fn().mockResolvedValue('project-uuid'),
      writePartner: vi.fn().mockResolvedValue('partner-uuid'),
      writeItem: vi.fn().mockResolvedValue('item-uuid'),
      writeLanguageTranslation: vi.fn().mockResolvedValue(undefined),
      writeCountryTranslation: vi.fn().mockResolvedValue(undefined),
      writeContextTranslation: vi.fn().mockResolvedValue(undefined),
      writeCollectionTranslation: vi.fn().mockResolvedValue(undefined),
      writeProjectTranslation: vi.fn().mockResolvedValue(undefined),
      writePartnerTranslation: vi.fn().mockResolvedValue(undefined),
      updatePartnerMonumentItemId: vi.fn().mockResolvedValue(undefined),
      setPartnerProjectIdIfUnset: vi.fn().mockResolvedValue(1),
      writeItemTranslation: vi.fn().mockResolvedValue(undefined),
      attachTagsToItem: vi.fn().mockResolvedValue(undefined),
      attachArtistsToItem: vi.fn().mockResolvedValue(undefined),
      writeTag: vi.fn().mockResolvedValue('tag-uuid'),
      writeAuthor: vi.fn().mockResolvedValue('author-uuid'),
      findAuthorByName: vi.fn().mockResolvedValue(null),
      writeAuthorTranslation: vi.fn().mockResolvedValue(undefined),
      writeArtist: vi.fn().mockResolvedValue('artist-uuid'),
      writeItemImage: vi.fn().mockResolvedValue('item-image-uuid'),
      writePartnerImage: vi.fn().mockResolvedValue('partner-image-uuid'),
      writePartnerLogo: vi.fn().mockResolvedValue('partner-logo-uuid'),
      writeCollectionImage: vi.fn().mockResolvedValue('collection-image-uuid'),
      writeGlossary: vi.fn().mockResolvedValue('glossary-uuid'),
      writeGlossaryTranslation: vi.fn().mockResolvedValue(undefined),
      writeGlossarySpelling: vi.fn().mockResolvedValue('glossary-spelling-uuid'),
      writeItemItemLink: vi.fn().mockResolvedValue('item-item-link-uuid'),
      writeItemItemLinkTranslation: vi.fn().mockResolvedValue(undefined),
      writeDynasty: vi.fn().mockResolvedValue('dynasty-uuid'),
      writeDynastyTranslation: vi.fn().mockResolvedValue(undefined),
      writeItemDynasty: vi.fn().mockResolvedValue(undefined),
      writeTimeline: vi.fn().mockResolvedValue('timeline-uuid'),
      writeTimelineEvent: vi.fn().mockResolvedValue('timeline-event-uuid'),
      writeTimelineEventTranslation: vi.fn().mockResolvedValue(undefined),
      writeTimelineEventItem: vi.fn().mockResolvedValue(undefined),
      writeTimelineEventImage: vi.fn().mockResolvedValue('timeline-event-image-uuid'),
      updateTimelineExtra: vi.fn().mockResolvedValue(undefined),
      updateItemTranslationAuthorFk: vi.fn().mockResolvedValue(undefined),
      updateDynastyTranslationAuthorFk: vi.fn().mockResolvedValue(undefined),
      writeItemMedia: vi.fn().mockResolvedValue('item-media-uuid'),
      writeCollectionMedia: vi.fn().mockResolvedValue('collection-media-uuid'),
      writeItemDocument: vi.fn().mockResolvedValue('item-document-uuid'),
      writeContributor: vi.fn().mockResolvedValue('contributor-uuid'),
      writeContributorTranslation: vi.fn().mockResolvedValue(undefined),
      writeContributorImage: vi.fn().mockResolvedValue('contributor-image-uuid'),
      attachItemsToCollection: vi.fn().mockResolvedValue(undefined),
      attachPartnersToCollection: vi.fn().mockResolvedValue(undefined),
      attachPartnerToCollectionWithLevel: vi.fn().mockResolvedValue(undefined),
      deleteProjectsWithoutItems: vi.fn().mockResolvedValue([]),
      exists: vi.fn().mockResolvedValue(false),
      findByBackwardCompatibility: vi.fn().mockResolvedValue(null),
      imageExists: vi.fn().mockResolvedValue(null),
      getCollectionTranslationExtra: vi.fn().mockResolvedValue(null),
      setCollectionTranslationExtra: vi.fn().mockResolvedValue(undefined),
      getItemTranslationExtra: vi.fn().mockResolvedValue(null),
      setItemTranslationExtra: vi.fn().mockResolvedValue(undefined),
      getItemTranslationExtraByContext: vi.fn().mockResolvedValue(null),
      setItemTranslationExtraByContext: vi.fn().mockResolvedValue(undefined),
      itemTranslationExistsForContext: vi.fn().mockResolvedValue(false),
      getCollectionItemExtra: vi.fn().mockResolvedValue(null),
      setCollectionItemExtra: vi.fn().mockResolvedValue(undefined),
      collectionItemPivotExists: vi.fn().mockResolvedValue(true),
      attachTagsToCollectionImage: vi.fn().mockResolvedValue(undefined),
      getCollectionTranslationLanguages: vi.fn().mockResolvedValue([]),
      getItemTranslationLanguages: vi.fn().mockResolvedValue([]),
      getCollectionParentId: vi.fn().mockResolvedValue(null),
      updateCollectionParentId: vi.fn().mockResolvedValue(undefined),
      getCollectionContextId: vi.fn().mockResolvedValue(null),
      updateCollectionContextId: vi.fn().mockResolvedValue(undefined),
      updateCollectionTranslationsContextId: vi.fn().mockResolvedValue(undefined),
      updateBackwardCompatibility: vi.fn().mockResolvedValue(undefined),
      findArtistByName: vi.fn().mockResolvedValue(null),
      getCollectionTranslationByKey: vi.fn().mockResolvedValue(null),
      setCollectionTranslationExtraByKey: vi.fn().mockResolvedValue(undefined),
      setCollectionTranslationDescriptionByKey: vi.fn().mockResolvedValue(undefined),
      setItemTranslationDescriptionByContext: vi.fn().mockResolvedValue(undefined),
      getCollectionExtra: vi.fn().mockResolvedValue(null),
      setCollectionExtra: vi.fn().mockResolvedValue(undefined),
      getCollectionPurpose: vi.fn().mockResolvedValue(null),
      updateCollectionPurpose: vi.fn().mockResolvedValue(undefined),
      backfillCollectionPurposeByBackwardCompatibility: vi.fn().mockResolvedValue(0),
      findCollectionTranslationsWithSerializedBuffers: vi.fn().mockResolvedValue([]),
      setCollectionTranslationExtraById: vi.fn(),
      setItemCountryIdIfUnset: vi.fn().mockResolvedValue(0),
      findItemsWithoutCountryByBackwardCompatibilityPrefix: vi.fn().mockResolvedValue([]),
      getCollectionImageExtra: vi.fn().mockResolvedValue(null),
      setCollectionImageExtra: vi.fn(),
    };

    // Create tracker
    tracker = new UnifiedTracker();

    // Create import context
    context = {
      legacyDb: mockLegacyDb,
      strategy: mockStrategy,
      tracker,
      logger: mockLogger,
      dryRun: false,
    };
  });

  it('should have the correct name', () => {
    const importer = new LanguageImporter(context);
    expect(importer.getName()).toBe('LanguageImporter');
  });

  it('should import languages from JSON file without querying legacy database', async () => {
    const importer = new LanguageImporter(context);
    const result = await importer.import();

    // Should not query the legacy database
    expect(mockLegacyDb.query).not.toHaveBeenCalled();

    // Should write languages through the strategy
    expect(mockStrategy.writeLanguage).toHaveBeenCalledTimes(3);

    // Verify that it imported successfully
    expect(result.success).toBe(true);
    expect(result.imported).toBe(3);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it('should pass correct data to writeLanguage', async () => {
    const importer = new LanguageImporter(context);
    await importer.import();

    // Check that writeLanguage was called with correct data
    // Note: is_enabled is not passed because the languages table doesn't have that column
    expect(mockStrategy.writeLanguage).toHaveBeenCalledWith({
      id: 'eng',
      internal_name: 'English',
      backward_compatibility: 'en',
      is_default: true,
    });

    expect(mockStrategy.writeLanguage).toHaveBeenCalledWith({
      id: 'fra',
      internal_name: 'Français',
      backward_compatibility: 'fr',
      is_default: false,
    });
  });

  it('should register languages in tracker', async () => {
    const importer = new LanguageImporter(context);
    await importer.import();

    // Check that tracker has the languages registered
    expect(tracker.exists('en', 'language')).toBe(true);
    expect(tracker.exists('fr', 'language')).toBe(true);
    expect(tracker.exists('ar', 'language')).toBe(true);

    // Check that the tracker returns correct UUIDs
    expect(tracker.getUuid('en', 'language')).toBe('eng');
    expect(tracker.getUuid('fr', 'language')).toBe('fra');
    expect(tracker.getUuid('ar', 'language')).toBe('ara');
  });

  it('should skip languages that already exist in tracker', async () => {
    // Pre-register a language
    tracker.register({
      uuid: 'eng',
      backwardCompatibility: 'en',
      entityType: 'language',
      createdAt: new Date(),
    });

    const importer = new LanguageImporter(context);
    const result = await importer.import();

    // Should skip the pre-registered language
    expect(result.imported).toBe(2);
    expect(result.skipped).toBe(1);
    expect(mockStrategy.writeLanguage).toHaveBeenCalledTimes(2);
  });

  it('should work in dry-run mode without writing', async () => {
    context.dryRun = true;
    const importer = new LanguageImporter(context);
    const result = await importer.import();

    // Should not write to strategy in dry-run
    expect(mockStrategy.writeLanguage).not.toHaveBeenCalled();

    // But should still register in tracker
    expect(tracker.exists('en', 'language')).toBe(true);
    expect(tracker.exists('fr', 'language')).toBe(true);

    // And report as imported
    expect(result.imported).toBe(3);
    expect(result.success).toBe(true);
  });
});

describe('LanguageTranslationImporter', () => {
  let mockLegacyDb: ILegacyDatabase;
  let mockStrategy: IWriteStrategy;
  let tracker: UnifiedTracker;
  let context: ImportContext;
  let translationQueryMock: ReturnType<typeof vi.fn>;
  const mockLogger: ILogger = {
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

  beforeEach(() => {
    vi.clearAllMocks();

    translationQueryMock = vi.fn();

    mockLegacyDb = {
      query: translationQueryMock as ILegacyDatabase['query'],
      execute: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    };

    mockStrategy = {
      writeLanguage: vi.fn().mockResolvedValue(undefined),
      writeCountry: vi.fn().mockResolvedValue(undefined),
      writeContext: vi.fn().mockResolvedValue('context-uuid'),
      writeCollection: vi.fn().mockResolvedValue('collection-uuid'),
      writeCollectionItem: vi.fn().mockResolvedValue(undefined),
      writeProject: vi.fn().mockResolvedValue('project-uuid'),
      writePartner: vi.fn().mockResolvedValue('partner-uuid'),
      writeItem: vi.fn().mockResolvedValue('item-uuid'),
      writeLanguageTranslation: vi.fn().mockResolvedValue(undefined),
      writeCountryTranslation: vi.fn().mockResolvedValue(undefined),
      writeContextTranslation: vi.fn().mockResolvedValue(undefined),
      writeCollectionTranslation: vi.fn().mockResolvedValue(undefined),
      writeProjectTranslation: vi.fn().mockResolvedValue(undefined),
      writePartnerTranslation: vi.fn().mockResolvedValue(undefined),
      updatePartnerMonumentItemId: vi.fn().mockResolvedValue(undefined),
      setPartnerProjectIdIfUnset: vi.fn().mockResolvedValue(1),
      writeItemTranslation: vi.fn().mockResolvedValue(undefined),
      attachTagsToItem: vi.fn().mockResolvedValue(undefined),
      attachArtistsToItem: vi.fn().mockResolvedValue(undefined),
      writeTag: vi.fn().mockResolvedValue('tag-uuid'),
      writeAuthor: vi.fn().mockResolvedValue('author-uuid'),
      findAuthorByName: vi.fn().mockResolvedValue(null),
      writeAuthorTranslation: vi.fn().mockResolvedValue(undefined),
      writeArtist: vi.fn().mockResolvedValue('artist-uuid'),
      writeItemImage: vi.fn().mockResolvedValue('item-image-uuid'),
      writePartnerImage: vi.fn().mockResolvedValue('partner-image-uuid'),
      writePartnerLogo: vi.fn().mockResolvedValue('partner-logo-uuid'),
      writeCollectionImage: vi.fn().mockResolvedValue('collection-image-uuid'),
      writeGlossary: vi.fn().mockResolvedValue('glossary-uuid'),
      writeGlossaryTranslation: vi.fn().mockResolvedValue(undefined),
      writeGlossarySpelling: vi.fn().mockResolvedValue('glossary-spelling-uuid'),
      writeItemItemLink: vi.fn().mockResolvedValue('item-item-link-uuid'),
      writeItemItemLinkTranslation: vi.fn().mockResolvedValue(undefined),
      writeDynasty: vi.fn().mockResolvedValue('dynasty-uuid'),
      writeDynastyTranslation: vi.fn().mockResolvedValue(undefined),
      writeItemDynasty: vi.fn().mockResolvedValue(undefined),
      writeTimeline: vi.fn().mockResolvedValue('timeline-uuid'),
      writeTimelineEvent: vi.fn().mockResolvedValue('timeline-event-uuid'),
      writeTimelineEventTranslation: vi.fn().mockResolvedValue(undefined),
      writeTimelineEventItem: vi.fn().mockResolvedValue(undefined),
      writeTimelineEventImage: vi.fn().mockResolvedValue('timeline-event-image-uuid'),
      updateTimelineExtra: vi.fn().mockResolvedValue(undefined),
      updateItemTranslationAuthorFk: vi.fn().mockResolvedValue(undefined),
      updateDynastyTranslationAuthorFk: vi.fn().mockResolvedValue(undefined),
      writeItemMedia: vi.fn().mockResolvedValue('item-media-uuid'),
      writeCollectionMedia: vi.fn().mockResolvedValue('collection-media-uuid'),
      writeItemDocument: vi.fn().mockResolvedValue('item-document-uuid'),
      writeContributor: vi.fn().mockResolvedValue('contributor-uuid'),
      writeContributorTranslation: vi.fn().mockResolvedValue(undefined),
      writeContributorImage: vi.fn().mockResolvedValue('contributor-image-uuid'),
      attachItemsToCollection: vi.fn().mockResolvedValue(undefined),
      attachPartnersToCollection: vi.fn().mockResolvedValue(undefined),
      attachPartnerToCollectionWithLevel: vi.fn().mockResolvedValue(undefined),
      deleteProjectsWithoutItems: vi.fn().mockResolvedValue([]),
      exists: vi.fn().mockResolvedValue(false),
      findByBackwardCompatibility: vi.fn().mockResolvedValue(null),
      imageExists: vi.fn().mockResolvedValue(null),
      getCollectionTranslationExtra: vi.fn().mockResolvedValue(null),
      setCollectionTranslationExtra: vi.fn().mockResolvedValue(undefined),
      getItemTranslationExtra: vi.fn().mockResolvedValue(null),
      setItemTranslationExtra: vi.fn().mockResolvedValue(undefined),
      getItemTranslationExtraByContext: vi.fn().mockResolvedValue(null),
      setItemTranslationExtraByContext: vi.fn().mockResolvedValue(undefined),
      itemTranslationExistsForContext: vi.fn().mockResolvedValue(false),
      getCollectionItemExtra: vi.fn().mockResolvedValue(null),
      setCollectionItemExtra: vi.fn().mockResolvedValue(undefined),
      collectionItemPivotExists: vi.fn().mockResolvedValue(true),
      attachTagsToCollectionImage: vi.fn().mockResolvedValue(undefined),
      getCollectionTranslationLanguages: vi.fn().mockResolvedValue([]),
      getItemTranslationLanguages: vi.fn().mockResolvedValue([]),
      getCollectionParentId: vi.fn().mockResolvedValue(null),
      updateCollectionParentId: vi.fn().mockResolvedValue(undefined),
      getCollectionContextId: vi.fn().mockResolvedValue(null),
      updateCollectionContextId: vi.fn().mockResolvedValue(undefined),
      updateCollectionTranslationsContextId: vi.fn().mockResolvedValue(undefined),
      updateBackwardCompatibility: vi.fn().mockResolvedValue(undefined),
      findArtistByName: vi.fn().mockResolvedValue(null),
      getCollectionTranslationByKey: vi.fn().mockResolvedValue(null),
      setCollectionTranslationExtraByKey: vi.fn().mockResolvedValue(undefined),
      setCollectionTranslationDescriptionByKey: vi.fn().mockResolvedValue(undefined),
      setItemTranslationDescriptionByContext: vi.fn().mockResolvedValue(undefined),
      getCollectionExtra: vi.fn().mockResolvedValue(null),
      setCollectionExtra: vi.fn().mockResolvedValue(undefined),
      getCollectionPurpose: vi.fn().mockResolvedValue(null),
      updateCollectionPurpose: vi.fn().mockResolvedValue(undefined),
      backfillCollectionPurposeByBackwardCompatibility: vi.fn().mockResolvedValue(0),
      findCollectionTranslationsWithSerializedBuffers: vi.fn().mockResolvedValue([]),
      setCollectionTranslationExtraById: vi.fn(),
      setItemCountryIdIfUnset: vi.fn().mockResolvedValue(0),
      findItemsWithoutCountryByBackwardCompatibilityPrefix: vi.fn().mockResolvedValue([]),
      getCollectionImageExtra: vi.fn().mockResolvedValue(null),
      setCollectionImageExtra: vi.fn(),
    };

    tracker = new UnifiedTracker();

    context = {
      legacyDb: mockLegacyDb,
      strategy: mockStrategy,
      tracker,
      logger: mockLogger,
      dryRun: false,
    };
  });

  it('should have the correct name', () => {
    const importer = new LanguageTranslationImporter(context);
    expect(importer.getName()).toBe('LanguageTranslationImporter');
  });

  it('should query legacy database even if no translations exist', async () => {
    translationQueryMock.mockResolvedValue([]);
    const importer = new LanguageTranslationImporter(context);
    const result = await importer.import();

    expect(translationQueryMock).toHaveBeenCalledWith(
      'SELECT lang_id, lang, name FROM mwnf3.langnames ORDER BY lang_id, lang'
    );

    expect(mockStrategy.writeLanguageTranslation).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);
  });
});
