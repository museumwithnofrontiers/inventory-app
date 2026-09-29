/**
 * Write Strategy Interface - Strategy Pattern for Data Persistence
 *
 * This interface defines the contract for writing data to the target system.
 * Implementations can use different mechanisms (API, SQL, etc.) while
 * maintaining the same interface for the import logic.
 *
 * Following the Dependency Inversion Principle, importers depend on this
 * abstraction rather than concrete implementations.
 */

import type {
  LanguageData,
  LanguageTranslationData,
  CountryData,
  CountryTranslationData,
  ContextData,
  ContextTranslationData,
  CollectionData,
  CollectionTranslationData,
  CollectionItemData,
  ProjectData,
  ProjectTranslationData,
  PartnerData,
  PartnerTranslationData,
  ItemData,
  ItemTranslationData,
  TagData,
  AuthorData,
  AuthorTranslationData,
  ArtistData,
  ItemImageData,
  PartnerImageData,
  PartnerLogoData,
  CollectionImageData,
  GlossaryData,
  GlossaryTranslationData,
  GlossarySpellingData,
  ItemItemLinkData,
  ItemItemLinkTranslationData,
  DynastyData,
  DynastyTranslationData,
  ItemDynastyData,
  TimelineData,
  TimelineEventData,
  TimelineEventTranslationData,
  TimelineEventItemData,
  TimelineEventImageData,
  ItemMediaData,
  CollectionMediaData,
  ItemDocumentData,
  ContributorData,
  ContributorTranslationData,
  ContributorImageData,
  ImageTable,
} from './types.js';

/**
 * Strategy interface for writing entities to the target system
 *
 * Each method returns the UUID of the created/found entity.
 * The strategy handles the specifics of the write mechanism.
 */
export interface IWriteStrategy {
  // =========================================================================
  // Reference Data
  // =========================================================================

  /**
   * Write a language record
   * @returns The language ID (ISO 639-3 code)
   */
  writeLanguage(data: LanguageData): Promise<string>;

  /**
   * Write a language translation record
   */
  writeLanguageTranslation(data: LanguageTranslationData): Promise<void>;

  /**
   * Write a country record
   * @returns The country ID (ISO 3166-1 alpha-3 code)
   */
  writeCountry(data: CountryData): Promise<string>;

  /**
   * Write a country translation record
   */
  writeCountryTranslation(data: CountryTranslationData): Promise<void>;

  // =========================================================================
  // Core Entities
  // =========================================================================

  /**
   * Write a context record
   * @returns The context UUID
   */
  writeContext(data: ContextData): Promise<string>;

  /**
   * Write a context translation record
   */
  writeContextTranslation(data: ContextTranslationData): Promise<void>;

  /**
   * Write a collection record
   * @returns The collection UUID
   */
  writeCollection(data: CollectionData): Promise<string>;

  /**
   * Write a collection translation record
   */
  writeCollectionTranslation(data: CollectionTranslationData): Promise<void>;

  /**
   * Link an item to a collection (many-to-many relationship)
   */
  writeCollectionItem(data: CollectionItemData): Promise<void>;

  /**
   * Write a project record
   * @returns The project UUID
   */
  writeProject(data: ProjectData): Promise<string>;

  /**
   * Write a project translation record
   */
  writeProjectTranslation(data: ProjectTranslationData): Promise<void>;

  /**
   * Delete projects that have no items. If `dryRun` is true the projects are
   * only listed and not removed. Returns array of affected projects.
   */
  deleteProjectsWithoutItems(
    dryRun?: boolean
  ): Promise<
    Array<{ id: string; backward_compatibility: string | null; internal_name: string | null }>
  >;

  // =========================================================================
  // Partners
  // ========================================================================="},{

  /**
   * Write a partner record
   * @returns The partner UUID
   */
  writePartner(data: PartnerData): Promise<string>;

  /**
   * Write a partner translation record
   */
  writePartnerTranslation(data: PartnerTranslationData): Promise<void>;

  /**
   * Update a partner's monument_item_id (deferred linking)
   * @param partnerId The partner UUID to update
   * @param monumentItemId The monument Item UUID to link to
   */
  updatePartnerMonumentItemId(partnerId: string, monumentItemId: string): Promise<void>;

  /**
   * Set a partner's project_id, but only where it is still null — used by the
   * museum→project backfill so a rerun (or a value written by another step,
   * e.g. SchoolImporter) is never overwritten.
   * @returns The number of rows updated (0 or 1).
   */
  setPartnerProjectIdIfUnset(partnerId: string, projectId: string): Promise<number>;

  // =========================================================================
  // Items
  // =========================================================================

  /**
   * Write an item record
   * @returns The item UUID
   */
  writeItem(data: ItemData): Promise<string>;

  /**
   * Write an item translation record
   */
  writeItemTranslation(data: ItemTranslationData): Promise<void>;

  /**
   * Set an item's country_id, but only where it is still null — used by the
   * Explore monument country backfill so a country another importer already
   * established is never overwritten.
   * @returns The number of rows updated (0 or 1).
   */
  setItemCountryIdIfUnset(itemId: string, countryId: string): Promise<number>;

  /**
   * Enumerate items whose OWN backward_compatibility starts with `prefix` and
   * whose country_id is still null.
   *
   * Enumerating by the item's own backward_compatibility — rather than
   * resolving legacy keys through the tracker — is what keeps a backfill
   * confined to natively-created rows: a deduplicated legacy key resolves to
   * an item created by a different importer, whose country is not ours to
   * write.
   */
  findItemsWithoutCountryByBackwardCompatibilityPrefix(
    prefix: string
  ): Promise<Array<{ id: string; backward_compatibility: string }>>;

  /**
   * Attach tags to an item
   * @param itemId The item UUID
   * @param tagIds Array of tag UUIDs
   */
  attachTagsToItem(itemId: string, tagIds: string[]): Promise<void>;

  /**
   * Attach artists to an item
   * @param itemId The item UUID
   * @param artistIds Array of artist UUIDs
   */
  attachArtistsToItem(itemId: string, artistIds: string[]): Promise<void>;

  /**
   * Attach items to a collection via many-to-many relationship
   * @param collectionId The collection UUID
   * @param itemIds Array of item UUIDs
   */
  attachItemsToCollection(collectionId: string, itemIds: string[]): Promise<void>;

  /**
   * Attach partners to a collection via many-to-many relationship
   * @param collectionId The collection UUID
   * @param partnerIds Array of partner UUIDs
   * @param collectionType The collection type (default: 'project')
   */
  attachPartnersToCollection(
    collectionId: string,
    partnerIds: string[],
    collectionType?: string
  ): Promise<void>;

  /**
   * Attach a single partner to a collection with a specific level
   * @param collectionId The collection UUID
   * @param partnerId The partner UUID
   * @param collectionType The collection type (default: 'project')
   * @param level The partner level (e.g., 'partner', 'associated_partner', 'minor_contributor')
   */
  attachPartnerToCollectionWithLevel(
    collectionId: string,
    partnerId: string,
    collectionType: string,
    level: string
  ): Promise<void>;

  // =========================================================================
  // Supporting Entities
  // =========================================================================

  /**
   * Write a tag record
   * @returns The tag UUID
   */
  writeTag(data: TagData): Promise<string>;

  /**
   * Write an author record
   * @returns The author UUID
   */
  writeAuthor(data: AuthorData): Promise<string>;

  /**
   * Find an author by exact name match.
   * Used by AuthorHelper for free-text author references that have no legacy ID.
   * @returns The author UUID or null if not found
   */
  findAuthorByName(name: string): Promise<string | null>;

  /**
   * Write an author translation record
   */
  writeAuthorTranslation(data: AuthorTranslationData): Promise<void>;

  /**
   * Write an artist record
   * @returns The artist UUID
   */
  writeArtist(data: ArtistData): Promise<string>;

  /**
   * Find an artist by exact name match.
   * Used by ArtistHelper for free-text artist references that have no legacy ID.
   * @returns An object with the artist UUID or null if not found
   */
  findArtistByName(name: string): Promise<{ id: string } | null>;

  /**
   * Write an item image record
   * @returns The item image UUID
   */
  writeItemImage(data: ItemImageData): Promise<string>;

  /**
   * Write a partner image record
   * @returns The partner image UUID
   */
  writePartnerImage(data: PartnerImageData): Promise<string>;

  /**
   * Write a partner logo record
   * @returns The partner logo UUID
   */
  writePartnerLogo(data: PartnerLogoData): Promise<string>;

  /**
   * Write a collection image record
   * @returns The collection image UUID
   */
  writeCollectionImage(data: CollectionImageData): Promise<string>;

  // =========================================================================
  // Glossary
  // =========================================================================

  /**
   * Write a glossary (word) record
   * @returns The glossary UUID
   */
  writeGlossary(data: GlossaryData): Promise<string>;

  /**
   * Write a glossary translation (definition) record
   */
  writeGlossaryTranslation(data: GlossaryTranslationData): Promise<void>;

  /**
   * Write a glossary spelling record
   * @returns The glossary spelling UUID
   */
  writeGlossarySpelling(data: GlossarySpellingData): Promise<string>;

  // =========================================================================
  // Item Links
  // =========================================================================

  /**
   * Write an item-item link record
   * @returns The item-item link UUID
   */
  writeItemItemLink(data: ItemItemLinkData): Promise<string>;

  /**
   * Write an item-item link translation record
   */
  writeItemItemLinkTranslation(data: ItemItemLinkTranslationData): Promise<void>;

  // =========================================================================
  // Dynasties
  // =========================================================================

  /**
   * Write a dynasty record
   * @returns The dynasty UUID
   */
  writeDynasty(data: DynastyData): Promise<string>;

  /**
   * Write a dynasty translation record
   */
  writeDynastyTranslation(data: DynastyTranslationData): Promise<void>;

  /**
   * Link an item to a dynasty (many-to-many relationship)
   */
  writeItemDynasty(data: ItemDynastyData): Promise<void>;

  // =========================================================================
  // Timelines
  // =========================================================================

  /**
   * Write a timeline record
   * @returns The timeline UUID
   */
  writeTimeline(data: TimelineData): Promise<string>;

  /**
   * Write a timeline event record
   * @returns The timeline event UUID
   */
  writeTimelineEvent(data: TimelineEventData): Promise<string>;

  /**
   * Write a timeline event translation record
   */
  writeTimelineEventTranslation(data: TimelineEventTranslationData): Promise<void>;

  /**
   * Link a timeline event to an item (many-to-many relationship)
   */
  writeTimelineEventItem(data: TimelineEventItemData): Promise<void>;

  /**
   * Write a timeline event image record
   * @returns The timeline event image UUID
   */
  writeTimelineEventImage(data: TimelineEventImageData): Promise<string>;

  /**
   * Update a timeline's extra JSON field (merge)
   * @param timelineId The timeline UUID
   * @param extra The JSON string to set as extra
   */
  updateTimelineExtra(timelineId: string, extra: string): Promise<void>;

  // =========================================================================
  // Media & Documents
  // =========================================================================

  /**
   * Write an item media record (audio/video URL)
   * @returns The item media UUID
   */
  writeItemMedia(data: ItemMediaData): Promise<string>;

  /**
   * Write a collection media record (audio/video URL)
   * @returns The collection media UUID
   */
  writeCollectionMedia(data: CollectionMediaData): Promise<string>;

  /**
   * Write an item document record (uploaded file)
   * @returns The item document UUID
   */
  writeItemDocument(data: ItemDocumentData): Promise<string>;

  // =========================================================================
  // Contributors
  // =========================================================================

  /**
   * Write a contributor record
   * @returns The contributor UUID
   */
  writeContributor(data: ContributorData): Promise<string>;

  /**
   * Write a contributor translation record
   */
  writeContributorTranslation(data: ContributorTranslationData): Promise<void>;

  /**
   * Write a contributor image record
   * @returns The contributor image UUID
   */
  writeContributorImage(data: ContributorImageData): Promise<string>;

  // =========================================================================
  // Author Assignment Updates
  // =========================================================================

  /**
   * Set an author FK on every item_translations row for an (item, language)
   * pair — one legacy credit covers the item in that language, and
   * inventory-app may hold several context rows for it.
   * @param itemId The item UUID
   * @param languageId The language ID
   * @param fkColumn The FK column name (author_id, text_copy_editor_id, translator_id, translation_copy_editor_id)
   * @param authorId The author UUID to set
   * @param overwrite Replace an existing value. The legacy junction tables are
   *   authoritative over the denormalised free-text credits, so callers
   *   resolving a junction row pass true. Leave false to fill only NULLs.
   */
  updateItemTranslationAuthorFk(
    itemId: string,
    languageId: string,
    fkColumn: string,
    authorId: string,
    overwrite?: boolean
  ): Promise<void>;

  /**
   * Set an author FK on a dynasty_translations row.
   * @param dynastyId The dynasty UUID
   * @param languageId The language ID
   * @param fkColumn The FK column name (author_id, text_copy_editor_id, translator_id, translation_copy_editor_id)
   * @param authorId The author UUID to set
   * @param overwrite Replace an existing value — see updateItemTranslationAuthorFk.
   */
  updateDynastyTranslationAuthorFk(
    dynastyId: string,
    languageId: string,
    fkColumn: string,
    authorId: string,
    overwrite?: boolean
  ): Promise<void>;

  // =========================================================================
  // Lookup Methods
  // =========================================================================

  /**
   * Check if an entity exists by backward_compatibility
   * @param table The table name
   * @param backwardCompatibility The backward_compatibility value
   * @returns True if exists
   */
  exists(table: string, backwardCompatibility: string): Promise<boolean>;

  /**
   * Find entity ID by backward_compatibility
   * @param table The table name
   * @param backwardCompatibility The backward_compatibility value
   * @returns The entity ID or null
   */
  findByBackwardCompatibility(table: string, backwardCompatibility: string): Promise<string | null>;

  /**
   * Check if an image row already exists for a given owner + legacy path.
   * item_images, partner_images, partner_logos, collection_images,
   * contributor_images, and timeline_event_images have no
   * backward_compatibility column, so exists()/findByBackwardCompatibility()
   * cannot be used for them — identity is (owner id, legacy path) instead,
   * the same natural key used to derive the row's deterministic id.
   * @param table One of the six image tables
   * @param ownerId The id of the owning row (item_id, partner_id, etc.)
   * @param path The legacy relative path (not the post-sync UUID filename)
   * @returns The existing row's id, or null if not yet imported
   */
  imageExists(table: ImageTable, ownerId: string, path: string): Promise<string | null>;

  // =========================================================================
  // Extra JSON Read-Modify-Write (for bibliography injection, etc.)
  // =========================================================================

  /**
   * Read the extra JSON from a collection_translations row.
   * Returns null if no matching row or if extra is null.
   */
  getCollectionTranslationExtra(
    collectionId: string,
    languageId: string
  ): Promise<Record<string, unknown> | null>;

  /**
   * Set the extra JSON on a collection_translations row.
   */
  setCollectionTranslationExtra(
    collectionId: string,
    languageId: string,
    extra: string
  ): Promise<void>;

  /**
   * Find a collection_translation row by (collectionId, languageId, contextId).
   * Returns null if not found.
   */
  getCollectionTranslationByKey(
    collectionId: string,
    languageId: string,
    contextId: string
  ): Promise<{ id: string; extra: Record<string, unknown> | null } | null>;

  /**
   * Update the extra JSON on a collection_translations row identified by
   * (collectionId, languageId, contextId).
   */
  setCollectionTranslationExtraByKey(
    collectionId: string,
    languageId: string,
    contextId: string,
    extra: string
  ): Promise<void>;

  /**
   * Update the description on a collection_translations row identified by
   * (collectionId, languageId, contextId): for a text a row written before it
   * was imported still lacks.
   */
  setCollectionTranslationDescriptionByKey(
    collectionId: string,
    languageId: string,
    contextId: string,
    description: string
  ): Promise<void>;

  /**
   * Update the title on a collection_translations row identified by
   * (collectionId, languageId, contextId): for a row written with a title that
   * was not legacy's.
   */
  setCollectionTranslationTitleByKey(
    collectionId: string,
    languageId: string,
    contextId: string,
    title: string
  ): Promise<void>;

  /**
   * Delete the collection_translations rows of a collection in one context — in
   * one language, when given: for rows an importer wrote with texts legacy does
   * not have.
   */
  deleteCollectionTranslations(
    collectionId: string,
    contextId: string,
    languageId?: string
  ): Promise<void>;

  /**
   * Find collection_translations rows whose `extra` holds a serialized Node
   * Buffer (`{"type":"Buffer","data":[…]}`) — the shape an importer leaves
   * behind when it stores a mysql2 `bit(1)` value without normalising it.
   * Used by ExtraBitBufferBackfillImporter.
   */
  findCollectionTranslationsWithSerializedBuffers(): Promise<
    Array<{ id: string; extra: Record<string, unknown> }>
  >;

  /**
   * Set the extra JSON on a collection_translations row identified by its id.
   */
  setCollectionTranslationExtraById(id: string, extra: string): Promise<void>;

  /**
   * Read the extra JSON from an item_translations row.
   * Returns null if no matching row or if extra is null.
   */
  getItemTranslationExtra(
    itemId: string,
    languageId: string
  ): Promise<Record<string, unknown> | null>;

  /**
   * Set the extra JSON on an item_translations row.
   */
  setItemTranslationExtra(itemId: string, languageId: string, extra: string): Promise<void>;

  /**
   * Read the extra JSON from an item_translations row, scoped to one
   * context — unlike getItemTranslationExtra, safe when an item carries more
   * than one context's translation of the same language.
   */
  getItemTranslationExtraByContext(
    itemId: string,
    languageId: string,
    contextId: string
  ): Promise<Record<string, unknown> | null>;

  /**
   * Set the extra JSON on an item_translations row, scoped to one context —
   * unlike setItemTranslationExtra, never touches a sibling context's row.
   */
  setItemTranslationExtraByContext(
    itemId: string,
    languageId: string,
    contextId: string,
    extra: string
  ): Promise<void>;

  /**
   * Set the description on an item_translations row, scoped to one context:
   * for a text a row written before it was imported still lacks.
   */
  setItemTranslationDescriptionByContext(
    itemId: string,
    languageId: string,
    contextId: string,
    description: string
  ): Promise<void>;

  /**
   * Whether an item_translations row already exists for this exact
   * (item, language, context) triple — the database's real uniqueness
   * constraint, independent of any one source record's backward_compatibility.
   */
  itemTranslationExistsForContext(
    itemId: string,
    languageId: string,
    contextId: string
  ): Promise<boolean>;

  /**
   * Read the extra JSON from a collection_item pivot row.
   * Returns null if no matching row or if extra is null.
   */
  getCollectionItemExtra(
    collectionId: string,
    itemId: string
  ): Promise<Record<string, unknown> | null>;

  /**
   * Set the extra JSON on a collection_item pivot row.
   */
  setCollectionItemExtra(collectionId: string, itemId: string, extra: string): Promise<void>;

  /**
   * Check whether a collection_item pivot row exists. Needed to distinguish
   * "no pivot" from "pivot with null extra" (getCollectionItemExtra returns
   * null for both).
   */
  collectionItemPivotExists(collectionId: string, itemId: string): Promise<boolean>;

  /**
   * Read the extra JSON from a collection_images row.
   * Returns null if no matching row or if extra is null.
   */
  getCollectionImageExtra(collectionImageId: string): Promise<Record<string, unknown> | null>;

  /**
   * Set the extra JSON on a collection_images row.
   */
  setCollectionImageExtra(collectionImageId: string, extraJson: string): Promise<void>;

  /**
   * Attach tags to a collection image via collection_image_tag pivot.
   */
  attachTagsToCollectionImage(collectionImageId: string, tagIds: string[]): Promise<void>;

  /**
   * Get all language_ids that have translations for a given collection.
   */
  getCollectionTranslationLanguages(collectionId: string): Promise<string[]>;

  /**
   * Get all language_ids that have translations for a given item.
   */
  getItemTranslationLanguages(itemId: string): Promise<string[]>;

  // =========================================================================
  // Update Methods (for post-processing / re-parenting)
  // =========================================================================

  /**
   * Get a collection's current parent_id (null when it has no parent).
   * Used by re-parenting steps to detect no-op updates on reruns.
   */
  getCollectionParentId(collectionId: string): Promise<string | null>;

  /**
   * Update a collection's parent_id (for re-parenting, e.g., locations under regions)
   */
  updateCollectionParentId(collectionId: string, parentId: string): Promise<void>;

  /**
   * Update a collection's display_order: for an order a collection written
   * before it was imported still lacks.
   */
  updateCollectionDisplayOrder(collectionId: string, displayOrder: number | null): Promise<void>;

  /**
   * Get a collection's current context_id.
   * Used by re-context steps to detect no-op updates on reruns.
   */
  getCollectionContextId(collectionId: string): Promise<string | null>;

  /**
   * Move a collection to another context (for re-context steps, e.g., #1494).
   */
  updateCollectionContextId(collectionId: string, contextId: string): Promise<void>;

  /**
   * Move all of a collection's translations to another context.
   * Rows already in the target context are left untouched, so the call is
   * idempotent and safe to repeat after a partial failure.
   */
  updateCollectionTranslationsContextId(collectionId: string, contextId: string): Promise<void>;

  /**
   * Read the extra JSON from a collections row.
   * Returns null if no matching row or if extra is null.
   */
  getCollectionExtra(collectionId: string): Promise<Record<string, unknown> | null>;

  /**
   * Set the extra JSON on a collections row.
   */
  setCollectionExtra(collectionId: string, extra: string): Promise<void>;

  /**
   * Get a collection's current purpose (null when unset).
   * Used by marker steps' ensure-semantics to detect no-op updates on reruns.
   */
  getCollectionPurpose(collectionId: string): Promise<string | null>;

  /**
   * Set a collection's purpose (functional role within its context, #1505).
   */
  updateCollectionPurpose(collectionId: string, purpose: string): Promise<void>;

  /**
   * Backfill purpose on collections matched by a backward_compatibility
   * pattern (SQL LIKE), only where purpose is still null (#1505).
   * @returns The number of rows updated.
   */
  backfillCollectionPurposeByBackwardCompatibility(
    bcPattern: string,
    purpose: string
  ): Promise<number>;

  /**
   * Update an entity's backward_compatibility value.
   * Used for dedup scenarios where a second BC needs to be appended (semicolon-delimited).
   * @param table The table name (e.g., 'tags')
   * @param id The entity UUID
   * @param backwardCompatibility The new backward_compatibility value
   */
  updateBackwardCompatibility(
    table: string,
    id: string,
    backwardCompatibility: string
  ): Promise<void>;
}
