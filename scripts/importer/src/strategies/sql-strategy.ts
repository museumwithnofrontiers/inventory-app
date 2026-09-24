/**
 * SQL Write Strategy
 *
 * Implements IWriteStrategy using direct SQL queries.
 * This is the fast-path for bulk imports.
 *
 * IMPORTANT: All string fields are automatically sanitized by converting
 * HTML to Markdown before being written to the database. This ensures
 * legacy HTML content is properly converted regardless of which importer
 * is used. See sanitizeAllStrings() in utils/html-to-markdown.ts.
 */

import { v4 as uuidv4 } from 'uuid';
import { deterministicUuid } from '../utils/deterministic-uuid.js';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { IWriteStrategy } from '../core/strategy.js';
import type {
  EntityType,
  LanguageData,
  LanguageTranslationData,
  CountryData,
  CountryTranslationData,
  ContextData,
  ContextTranslationData,
  CollectionData,
  CollectionTranslationData,
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
  CollectionItemData,
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
} from '../core/types.js';
import { sanitizeAllStrings, sanitizeJsonField } from '../utils/html-to-markdown.js';

const tableEntityMap: Record<string, EntityType> = {
  languages: 'language',
  countries: 'country',
  contexts: 'context',
  collections: 'collection',
  projects: 'project',
  partners: 'partner',
  items: 'item',
  tags: 'tag',
  authors: 'author',
  author_translations: 'author_translation',
  artists: 'artist',
  language_translations: 'language_translation',
  country_translations: 'country_translation',
  glossaries: 'glossary',
  glossary_translations: 'glossary_translation',
  glossary_spellings: 'glossary_spelling',
  item_item_links: 'item_item_link',
  item_item_link_translations: 'item_item_link_translation',
  dynasties: 'dynasty',
  dynasty_translations: 'dynasty_translation',
  timelines: 'timeline',
  timeline_events: 'timeline_event',
  timeline_event_translations: 'timeline_event_translation',
  item_media: 'item_media',
  collection_media: 'collection_media',
  item_documents: 'item_document',
  contributors: 'contributor',
  contributor_translations: 'contributor_translation',
};

function mapTableToEntityType(table: string): EntityType | null {
  return tableEntityMap[table] ?? null;
}

/**
 * True if `error` is a MySQL duplicate-key error (ER_DUP_ENTRY / errno 1062).
 *
 * Used by the six image-table writers (item_images, partner_images,
 * partner_logos, collection_images, contributor_images,
 * timeline_event_images) to make image writes idempotent across process
 * restarts. Those tables have no `backward_compatibility` column, so
 * `SqlWriteStrategy.exists()`/`findByBackwardCompatibility()` cannot detect
 * "already imported" for them (see TABLES_WITHOUT_BC below) — the row's id
 * is deterministic (UUIDv5 derived from owner + legacy path), so re-running
 * the importer against a non-wiped DB re-derives the SAME id and a
 * duplicate-key hit here means, unambiguously, "this exact image row
 * already exists". None of these six tables has any other unique
 * constraint, so any ER_DUP_ENTRY on their INSERT can only be the primary
 * key — safe to treat as "found", not "failed".
 */
function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ER_DUP_ENTRY'
  );
}
import type { ITracker } from '../core/tracker.js';

// Type for resilient connection wrapper
type DatabaseConnection = {
  execute<
    T extends
      | RowDataPacket[]
      | RowDataPacket[][]
      | import('mysql2').OkPacket
      | import('mysql2').OkPacket[]
      | import('mysql2').ResultSetHeader,
  >(
    sql: string,
    values?: unknown
  ): Promise<[T, import('mysql2').FieldPacket[]]>;
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  end(): Promise<void>;
};

export class SqlWriteStrategy implements IWriteStrategy {
  private db: DatabaseConnection;
  private tracker: ITracker;
  private now: string;

  constructor(db: DatabaseConnection, tracker: ITracker) {
    this.db = db;
    this.tracker = tracker;
    this.now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  }

  // =========================================================================
  // Reference Data
  // =========================================================================

  async writeLanguage(data: LanguageData): Promise<string> {
    const sanitized = sanitizeAllStrings(data);
    // Note: Match the old importer which uses: id, internal_name, backward_compatibility, is_default
    // The languages table does NOT have an is_enabled column
    await this.db.execute(
      `INSERT INTO languages (id, internal_name, backward_compatibility, is_default, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        sanitized.id,
        sanitized.internal_name,
        sanitized.backward_compatibility,
        sanitized.is_default ? 1 : 0,
        this.now,
        this.now,
      ]
    );

    // Track by BC for legacy languages (enables lookup by legacy code),
    // by id for non-legacy languages (dedup only)
    const trackingKey =
      sanitized.backward_compatibility !== null ? sanitized.backward_compatibility : sanitized.id;
    this.tracker.set(trackingKey, sanitized.id, 'language');
    return sanitized.id;
  }

  async writeLanguageTranslation(data: LanguageTranslationData): Promise<void> {
    const sanitized = sanitizeAllStrings(data);
    const id = deterministicUuid(
      `language_translation:${sanitized.backward_compatibility.toLowerCase()}:${sanitized.language_id}:${sanitized.display_language_id}`
    );
    await this.db.execute(
      `INSERT INTO language_translations (id, language_id, display_language_id, name, backward_compatibility, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        sanitized.language_id,
        sanitized.display_language_id,
        sanitized.name,
        sanitized.backward_compatibility,
        this.now,
        this.now,
      ]
    );
  }

  async writeCountry(data: CountryData): Promise<string> {
    const sanitized = sanitizeAllStrings(data);
    // Note: Match the old importer which uses: id, internal_name, backward_compatibility
    // The countries table does NOT have is_default or is_enabled columns
    await this.db.execute(
      `INSERT INTO countries (id, internal_name, backward_compatibility, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [sanitized.id, sanitized.internal_name, sanitized.backward_compatibility, this.now, this.now]
    );

    // Track by BC for legacy countries (enables lookup by legacy code),
    // by id for non-legacy countries (dedup only)
    const trackingKey =
      sanitized.backward_compatibility !== null ? sanitized.backward_compatibility : sanitized.id;
    this.tracker.set(trackingKey, sanitized.id, 'country');
    return sanitized.id;
  }

  async writeCountryTranslation(data: CountryTranslationData): Promise<void> {
    const sanitized = sanitizeAllStrings(data);
    const id = deterministicUuid(
      `country_translation:${sanitized.backward_compatibility.toLowerCase()}:${sanitized.language_id}`
    );
    await this.db.execute(
      `INSERT INTO country_translations (id, country_id, language_id, name, backward_compatibility, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        sanitized.country_id,
        sanitized.language_id,
        sanitized.name,
        sanitized.backward_compatibility,
        this.now,
        this.now,
      ]
    );
  }

  // =========================================================================
  // Core Entities
  // =========================================================================

  async writeContext(data: ContextData): Promise<string> {
    const sanitized = sanitizeAllStrings(data);
    const id = deterministicUuid(`context:${sanitized.backward_compatibility.toLowerCase()}`);
    await this.db.execute(
      `INSERT INTO contexts (id, internal_name, is_default, backward_compatibility, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        sanitized.internal_name,
        sanitized.is_default ? 1 : 0,
        sanitized.backward_compatibility,
        this.now,
        this.now,
      ]
    );

    this.tracker.set(sanitized.backward_compatibility, id, 'context');
    return id;
  }

  async writeContextTranslation(_data: ContextTranslationData): Promise<void> {
    // No-op: context_translations table does not exist in current schema
    // The old importer does not create context translations
  }

  async writeCollection(data: CollectionData): Promise<string> {
    const sanitized = sanitizeAllStrings(data);
    const id = deterministicUuid(`collection:${sanitized.backward_compatibility.toLowerCase()}`);
    await this.db.execute(
      `INSERT INTO collections (id, context_id, language_id, parent_id, type, purpose, extra, display_order, internal_name, backward_compatibility, latitude, longitude, map_zoom, country_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        sanitized.context_id,
        sanitized.language_id,
        sanitized.parent_id ?? null,
        sanitized.type ?? 'collection',
        sanitized.purpose ?? null,
        sanitized.extra ?? null,
        data.display_order ?? null,
        sanitized.internal_name,
        sanitized.backward_compatibility,
        data.latitude ?? null,
        data.longitude ?? null,
        data.map_zoom ?? null,
        sanitized.country_id ?? null,
        this.now,
        this.now,
      ]
    );

    this.tracker.set(sanitized.backward_compatibility, id, 'collection');
    return id;
  }

  async writeCollectionTranslation(data: CollectionTranslationData): Promise<void> {
    const sanitized = sanitizeAllStrings(data);
    // backward_compatibility is shared across all language rows of the same
    // collection (it identifies the collection, not the translation row), so
    // language_id/context_id must be folded in to keep rows distinct.
    const id = deterministicUuid(
      `collection_translation:${sanitized.backward_compatibility.toLowerCase()}:${sanitized.language_id}:${sanitized.context_id}`
    );
    const extra = sanitized.extra ?? null;
    await this.db.execute(
      `INSERT INTO collection_translations (id, collection_id, language_id, context_id, title, description, quote, extra, backward_compatibility, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        sanitized.collection_id,
        sanitized.language_id,
        sanitized.context_id,
        sanitized.title,
        sanitized.description ?? null,
        sanitized.quote ?? null,
        extra,
        sanitized.backward_compatibility,
        this.now,
        this.now,
      ]
    );
  }

  async writeCollectionItem(data: CollectionItemData): Promise<void> {
    const sanitized = sanitizeAllStrings(data);
    const displayOrder = data.display_order ?? null;
    // `sanitized`, not `data` — the whole point of the sanitiser is that the
    // converted copy is what reaches the database. Reading `data.extra` here
    // put the raw legacy HTML back, and that is how the Sharing History
    // curator justifications kept their `<i>` tags through a reimport.
    const extra = sanitized.extra ? JSON.stringify(sanitized.extra) : null;
    await this.db.execute(
      `INSERT INTO collection_item (collection_id, item_id, display_order, extra, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         display_order = VALUES(display_order),
         extra = VALUES(extra),
         updated_at = VALUES(updated_at)`,
      [sanitized.collection_id, sanitized.item_id, displayOrder, extra, this.now, this.now]
    );
  }

  async writeProject(data: ProjectData): Promise<string> {
    const sanitized = sanitizeAllStrings(data);
    const id = deterministicUuid(`project:${sanitized.backward_compatibility.toLowerCase()}`);
    await this.db.execute(
      `INSERT INTO projects (id, internal_name, context_id, language_id, launch_date, is_launched, is_enabled, site_url, related_database_url, artistic_introduction_url, backward_compatibility, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        sanitized.internal_name,
        sanitized.context_id,
        sanitized.language_id,
        sanitized.launch_date,
        sanitized.is_launched ? 1 : 0,
        sanitized.is_enabled !== false ? 1 : 0, // Default to true
        sanitized.site_url ?? null,
        sanitized.related_database_url ?? null,
        sanitized.artistic_introduction_url ?? null,
        sanitized.backward_compatibility,
        this.now,
        this.now,
      ]
    );

    this.tracker.set(sanitized.backward_compatibility, id, 'project');
    return id;
  }

  async writeProjectTranslation(_data: ProjectTranslationData): Promise<void> {
    // No-op: project_translations table does not exist in current schema
    // The old importer does not create project translations
  }

  async deleteProjectsWithoutItems(
    dryRun = false
  ): Promise<
    Array<{ id: string; backward_compatibility: string | null; internal_name: string | null }>
  > {
    // Start transaction to ensure a consistent snapshot + atomic deletes
    await this.db.beginTransaction();
    try {
      const [rows] = await this.db.execute<import('mysql2').RowDataPacket[]>(
        `SELECT p.id, p.backward_compatibility, p.internal_name
         FROM projects p
         LEFT JOIN items i ON i.project_id = p.id
         WHERE i.id IS NULL`
      );

      const projects = (rows as RowDataPacket[]).map((r) => ({
        id: String(r.id),
        backward_compatibility: r.backward_compatibility ?? null,
        internal_name: r.internal_name ?? null,
      }));

      if (!dryRun && projects.length > 0) {
        for (const p of projects) {
          await this.db.execute(`DELETE FROM projects WHERE id = ?`, [p.id]);
        }
      }

      await this.db.commit();
      return projects;
    } catch (err) {
      await this.db.rollback();
      throw err;
    }
  }

  // =========================================================================
  // Partners
  // ========================================================================="},{

  async writePartner(data: PartnerData): Promise<string> {
    const sanitized = sanitizeAllStrings(data);
    const id = deterministicUuid(`partner:${sanitized.backward_compatibility.toLowerCase()}`);
    await this.db.execute(
      `INSERT INTO partners (id, type, internal_name, backward_compatibility, country_id, latitude, longitude, map_zoom, project_id, monument_item_id, visible, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        sanitized.type,
        sanitized.internal_name,
        sanitized.backward_compatibility,
        sanitized.country_id ?? null,
        sanitized.latitude ?? null,
        sanitized.longitude ?? null,
        sanitized.map_zoom ?? 16, // default
        sanitized.project_id ?? null,
        sanitized.monument_item_id ?? null,
        sanitized.visible ?? false, // default
        this.now,
        this.now,
      ]
    );

    this.tracker.set(sanitized.backward_compatibility, id, 'partner');
    return id;
  }

  async writePartnerTranslation(data: PartnerTranslationData): Promise<void> {
    const sanitized = sanitizeAllStrings(data);
    // backward_compatibility identifies the partner, not the translation row —
    // fold in language_id/context_id to keep per-language rows distinct.
    const id = deterministicUuid(
      `partner_translation:${sanitized.backward_compatibility.toLowerCase()}:${sanitized.language_id}:${sanitized.context_id}`
    );
    await this.db.execute(
      `INSERT INTO partner_translations (id, partner_id, language_id, context_id, name, description, city_display, address_notes, contact_website, contact_phone, contact_email_general, extra, backward_compatibility, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        sanitized.partner_id,
        sanitized.language_id,
        sanitized.context_id,
        sanitized.name,
        sanitized.description,
        sanitized.city_display,
        sanitized.address,
        sanitized.contact_website,
        sanitized.contact_phone,
        sanitized.contact_email_general,
        sanitized.extra,
        sanitized.backward_compatibility,
        this.now,
        this.now,
      ]
    );
  }

  async updatePartnerMonumentItemId(partnerId: string, monumentItemId: string): Promise<void> {
    await this.db.execute(`UPDATE partners SET monument_item_id = ?, updated_at = ? WHERE id = ?`, [
      monumentItemId,
      this.now,
      partnerId,
    ]);
  }

  async setPartnerProjectIdIfUnset(partnerId: string, projectId: string): Promise<number> {
    const [result] = await this.db.execute<ResultSetHeader>(
      `UPDATE partners SET project_id = ?, updated_at = ? WHERE id = ? AND project_id IS NULL`,
      [projectId, this.now, partnerId]
    );
    return result.affectedRows;
  }

  // =========================================================================
  // Items
  // =========================================================================

  async writeItem(data: ItemData): Promise<string> {
    const sanitized = sanitizeAllStrings(data);
    const id = deterministicUuid(`item:${sanitized.backward_compatibility.toLowerCase()}`);
    await this.db.execute(
      `INSERT INTO items (id, partner_id, collection_id, parent_id, internal_name, type, country_id, project_id, owner_reference, mwnf_reference, start_date, end_date, display_order, latitude, longitude, map_zoom, backward_compatibility, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        sanitized.partner_id,
        sanitized.collection_id,
        sanitized.parent_id ?? null,
        sanitized.internal_name,
        sanitized.type,
        sanitized.country_id,
        sanitized.project_id,
        sanitized.owner_reference,
        sanitized.mwnf_reference,
        data.start_date ?? null,
        data.end_date ?? null,
        data.display_order ?? null,
        data.latitude ?? null,
        data.longitude ?? null,
        data.map_zoom ?? null,
        sanitized.backward_compatibility,
        this.now,
        this.now,
      ]
    );

    this.tracker.set(sanitized.backward_compatibility, id, 'item');
    return id;
  }

  async setItemCountryIdIfUnset(itemId: string, countryId: string): Promise<number> {
    const [result] = await this.db.execute<ResultSetHeader>(
      `UPDATE items SET country_id = ?, updated_at = ? WHERE id = ? AND country_id IS NULL`,
      [countryId, this.now, itemId]
    );
    return result.affectedRows;
  }

  async findItemsWithoutCountryByBackwardCompatibilityPrefix(
    prefix: string
  ): Promise<Array<{ id: string; backward_compatibility: string }>> {
    // Backward-compatibility keys are full of underscores ('mwnf3_explore:…'),
    // and `_` is a LIKE wildcard — escape the prefix so it matches literally.
    const escapedPrefix = prefix.replace(/[\\%_]/g, '\\$&');
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT id, backward_compatibility FROM items
       WHERE country_id IS NULL
         AND backward_compatibility LIKE ?
       ORDER BY backward_compatibility`,
      [`${escapedPrefix}%`]
    );
    return rows.map((row) => ({
      id: row.id as string,
      backward_compatibility: row.backward_compatibility as string,
    }));
  }

  async writeItemTranslation(data: ItemTranslationData): Promise<void> {
    const sanitized = sanitizeAllStrings(data);
    // backward_compatibility identifies the item, not the translation row (and
    // is sometimes shared by two rows in the same language via the EPM second
    // context) — fold in language_id/context_id to keep rows distinct.
    const id = deterministicUuid(
      `item_translation:${sanitized.backward_compatibility.toLowerCase()}:${sanitized.language_id}:${sanitized.context_id}`
    );
    // Convert undefined values to null for SQL compatibility
    const safeNull = (val: string | null | undefined): string | null => val ?? null;
    await this.db.execute(
      `INSERT INTO item_translations (id, item_id, language_id, context_id, name, alternate_name, description, type, holder, owner, initial_owner, dates, location, dimensions, place_of_production, method_for_datation, method_for_provenance, provenance, obtention, bibliography, author_id, text_copy_editor_id, translator_id, translation_copy_editor_id, extra, backward_compatibility, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        sanitized.item_id,
        sanitized.language_id,
        sanitized.context_id,
        sanitized.name,
        safeNull(sanitized.alternate_name),
        safeNull(sanitized.description),
        safeNull(sanitized.type),
        safeNull(sanitized.holder),
        safeNull(sanitized.owner),
        safeNull(sanitized.initial_owner),
        safeNull(sanitized.dates),
        safeNull(sanitized.location),
        safeNull(sanitized.dimensions),
        safeNull(sanitized.place_of_production),
        safeNull(sanitized.method_for_datation),
        safeNull(sanitized.method_for_provenance),
        safeNull(sanitized.provenance),
        safeNull(sanitized.obtention),
        safeNull(sanitized.bibliography),
        safeNull(sanitized.author_id),
        safeNull(sanitized.text_copy_editor_id),
        safeNull(sanitized.translator_id),
        safeNull(sanitized.translation_copy_editor_id),
        safeNull(sanitized.extra),
        sanitized.backward_compatibility,
        this.now,
        this.now,
      ]
    );
  }

  async attachTagsToItem(itemId: string, tagIds: string[]): Promise<void> {
    for (const tagId of tagIds) {
      try {
        await this.db.execute(
          `INSERT IGNORE INTO item_tag (item_id, tag_id, created_at, updated_at)
           VALUES (?, ?, ?, ?)`,
          [itemId, tagId, this.now, this.now]
        );
      } catch {
        // Ignore duplicates
      }
    }
  }

  async attachArtistsToItem(itemId: string, artistIds: string[]): Promise<void> {
    for (const artistId of artistIds) {
      try {
        await this.db.execute(
          `INSERT IGNORE INTO artist_item (item_id, artist_id, created_at, updated_at)
           VALUES (?, ?, ?, ?)`,
          [itemId, artistId, this.now, this.now]
        );
      } catch {
        // Ignore duplicates
      }
    }
  }

  async attachItemsToCollection(collectionId: string, itemIds: string[]): Promise<void> {
    for (const itemId of itemIds) {
      try {
        await this.db.execute(
          `INSERT IGNORE INTO collection_item (collection_id, item_id, created_at, updated_at)
           VALUES (?, ?, ?, ?)`,
          [collectionId, itemId, this.now, this.now]
        );
      } catch {
        // Ignore duplicates
      }
    }
  }

  async attachPartnersToCollection(
    collectionId: string,
    partnerIds: string[],
    collectionType: string = 'project'
  ): Promise<void> {
    for (const partnerId of partnerIds) {
      try {
        await this.db.execute(
          `INSERT IGNORE INTO collection_partner (collection_id, collection_type, partner_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`,
          [collectionId, collectionType, partnerId, this.now, this.now]
        );
      } catch {
        // Ignore duplicates - this is expected when multiple items share the same partner
      }
    }
  }

  async attachPartnerToCollectionWithLevel(
    collectionId: string,
    partnerId: string,
    collectionType: string,
    level: string
  ): Promise<void> {
    try {
      await this.db.execute(
        `INSERT INTO collection_partner (collection_id, collection_type, partner_id, level, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE level = VALUES(level)`,
        [collectionId, collectionType, partnerId, level, this.now, this.now]
      );
    } catch (error) {
      // Log and rethrow non-duplicate errors
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('Duplicate')) {
        throw error;
      }
    }
  }

  // =========================================================================
  // Supporting Entities
  // =========================================================================

  async writeTag(data: TagData): Promise<string> {
    const sanitized = sanitizeAllStrings(data);
    const id = deterministicUuid(`tag:${sanitized.backward_compatibility.toLowerCase()}`);
    try {
      await this.db.execute(
        `INSERT INTO tags (id, internal_name, category, language_id, description, backward_compatibility, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          sanitized.internal_name,
          sanitized.category,
          sanitized.language_id,
          sanitized.description,
          sanitized.backward_compatibility,
          this.now,
          this.now,
        ]
      );
      this.tracker.set(sanitized.backward_compatibility, id, 'tag');
      return id;
    } catch (error) {
      // Duplicate entry - try to find existing record
      // This is expected when the same tag is imported multiple times
      const existing = await this.findByBackwardCompatibility(
        'tags',
        sanitized.backward_compatibility
      );
      if (existing) {
        return existing;
      }
      // If we can't find it after the error, re-throw with context
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to create or find tag: ${sanitized.backward_compatibility}. Original error: ${message}`,
        { cause: error }
      );
    }
  }

  async writeAuthor(data: AuthorData): Promise<string> {
    const sanitized = sanitizeAllStrings(data);
    const bc = sanitized.backward_compatibility || null;
    // Free-text authors (no legacy ID) have no natural key — keep them
    // random; AuthorHelper dedupes those by name lookup instead.
    const id = bc ? deterministicUuid(`author:${bc.toLowerCase()}`) : uuidv4();
    try {
      await this.db.execute(
        `INSERT INTO authors (id, name, firstname, lastname, givenname, originalname, internal_name, backward_compatibility, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          sanitized.name,
          sanitized.firstname ?? null,
          sanitized.lastname ?? null,
          sanitized.givenname ?? null,
          sanitized.originalname ?? null,
          sanitized.internal_name,
          bc,
          this.now,
          this.now,
        ]
      );
      if (bc) {
        this.tracker.set(bc, id, 'author');
      }
      return id;
    } catch (error) {
      // Duplicate entry - try to find existing record by BC
      if (bc) {
        const existing = await this.findByBackwardCompatibility('authors', bc);
        if (existing) {
          return existing;
        }
        // BC lookup failed — the existing record may have been created without BC
        // (e.g., by AuthorHelper from free-text fields). Find by name and adopt.
        const byName = await this.findAuthorByName(sanitized.name);
        if (byName) {
          // Update the existing record with the proper BC so future lookups work
          await this.db.execute('UPDATE authors SET backward_compatibility = ? WHERE id = ?', [
            bc,
            byName,
          ]);
          this.tracker.set(bc, byName, 'author');
          return byName;
        }
      }
      // If we can't find it after the error, re-throw with context
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to create or find author: ${bc || sanitized.name}. Original error: ${message}`,
        { cause: error }
      );
    }
  }

  async findAuthorByName(name: string): Promise<string | null> {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      'SELECT id FROM authors WHERE name = ? LIMIT 1',
      [name]
    );
    return rows.length > 0 ? (rows[0].id as string) : null;
  }

  async findArtistByName(name: string): Promise<{ id: string } | null> {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      'SELECT id FROM artists WHERE name = ? LIMIT 1',
      [name]
    );
    return rows.length > 0 ? { id: rows[0].id as string } : null;
  }

  async writeAuthorTranslation(data: AuthorTranslationData): Promise<void> {
    const sanitized = sanitizeAllStrings(data);
    const bc = sanitized.backward_compatibility ?? null;
    const id = bc
      ? deterministicUuid(
          `author_translation:${bc.toLowerCase()}:${sanitized.language_id}:${sanitized.context_id}`
        )
      : uuidv4();
    await this.db.execute(
      `INSERT INTO author_translations (id, author_id, language_id, context_id, curriculum, backward_compatibility, extra, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        sanitized.author_id,
        sanitized.language_id,
        sanitized.context_id,
        sanitized.curriculum ?? null,
        sanitized.backward_compatibility ?? null,
        sanitized.extra ?? null,
        this.now,
        this.now,
      ]
    );
  }

  async writeArtist(data: ArtistData): Promise<string> {
    const sanitized = sanitizeAllStrings(data);
    const id = deterministicUuid(`artist:${sanitized.backward_compatibility.toLowerCase()}`);
    try {
      await this.db.execute(
        `INSERT INTO artists (id, name, internal_name, place_of_birth, place_of_death, date_of_birth, date_of_death, period_of_activity, backward_compatibility, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          sanitized.name,
          sanitized.internal_name,
          sanitized.place_of_birth,
          sanitized.place_of_death,
          sanitized.date_of_birth,
          sanitized.date_of_death,
          sanitized.period_of_activity,
          sanitized.backward_compatibility,
          this.now,
          this.now,
        ]
      );
      this.tracker.set(sanitized.backward_compatibility, id, 'artist');
      return id;
    } catch (error) {
      // Duplicate entry - try to find existing record
      // This is expected when the same artist is imported multiple times
      const existing = await this.findByBackwardCompatibility(
        'artists',
        sanitized.backward_compatibility
      );
      if (existing) {
        return existing;
      }
      // Retry by name in case backward_compatibility doesn't match
      const byName = await this.findArtistByName(sanitized.name ?? '');
      if (byName) {
        return byName.id;
      }
      // If we can't find it after the error, re-throw with context
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to create or find artist: ${sanitized.backward_compatibility}. Original error: ${message}`,
        { cause: error }
      );
    }
  }

  /**
   * Recompute the deterministic id for an image row from its owner + legacy
   * path — the same formula each write*Image method uses to derive `id`.
   * Shared so the write path and the imageExists() lookup can never drift
   * apart. Deliberately independent of the row's CURRENT state (path may
   * have been overwritten with a UUID filename by image-sync, size may no
   * longer be the 1-byte placeholder) — identity is always derived from the
   * legacy path the importer reads fresh from the source DB, never from
   * whatever's currently stored on the target row.
   */
  private computeImageId(table: ImageTable, ownerId: string, path: string): string {
    const name =
      table === 'partner_logos'
        ? `image:logo:${ownerId}:${path.toLowerCase()}`
        : `image:${ownerId}:${path.toLowerCase()}`;
    return deterministicUuid(name);
  }

  async writeItemImage(data: ItemImageData): Promise<string> {
    const sanitized = sanitizeAllStrings(data);
    // Legacy relative path stands in for backward_compatibility (item_images
    // has no such column). The owner (item_id) must be folded in too: the
    // same legacy path is deliberately written twice for a "first image"
    // (once on the picture Item, once on its parent Item) and path alone
    // would collide on the UUID primary key.
    const id =
      sanitized.id || this.computeImageId('item_images', sanitized.item_id, sanitized.path);
    const trackerKey = `${sanitized.item_id}:${sanitized.path.toLowerCase()}`;
    try {
      await this.db.execute(
        `INSERT INTO item_images (id, item_id, path, original_name, mime_type, size, alt_text, copyright, display_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          sanitized.item_id,
          sanitized.path,
          sanitized.original_name,
          sanitized.mime_type,
          sanitized.size,
          sanitized.alt_text,
          sanitized.copyright ?? null,
          sanitized.display_order,
          this.now,
          this.now,
        ]
      );
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
    }
    this.tracker.set(trackerKey, id, 'image');
    return id;
  }

  async writePartnerImage(data: PartnerImageData): Promise<string> {
    const sanitized = sanitizeAllStrings(data);
    const id =
      sanitized.id || this.computeImageId('partner_images', sanitized.partner_id, sanitized.path);
    const trackerKey = `${sanitized.partner_id}:${sanitized.path.toLowerCase()}`;
    try {
      await this.db.execute(
        `INSERT INTO partner_images (id, partner_id, path, original_name, mime_type, size, alt_text, copyright, display_order, extra, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          sanitized.partner_id,
          sanitized.path,
          sanitized.original_name,
          sanitized.mime_type,
          sanitized.size,
          sanitized.alt_text,
          sanitized.copyright ?? null,
          sanitized.display_order,
          sanitized.extra ?? null,
          this.now,
          this.now,
        ]
      );
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
    }
    this.tracker.set(trackerKey, id, 'image');
    return id;
  }

  async writePartnerLogo(data: PartnerLogoData): Promise<string> {
    const sanitized = sanitizeAllStrings(data);
    const id =
      sanitized.id || this.computeImageId('partner_logos', sanitized.partner_id, sanitized.path);
    const trackerKey = `logo:${sanitized.partner_id}:${sanitized.path.toLowerCase()}`;
    try {
      await this.db.execute(
        `INSERT INTO partner_logos (id, partner_id, path, original_name, mime_type, size, logo_type, alt_text, display_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          sanitized.partner_id,
          sanitized.path,
          sanitized.original_name,
          sanitized.mime_type,
          sanitized.size,
          sanitized.logo_type ?? 'primary',
          sanitized.alt_text,
          sanitized.display_order,
          this.now,
          this.now,
        ]
      );
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
    }
    // Tracked prefixed with "logo:" to avoid collision with non-logo images
    this.tracker.set(trackerKey, id, 'image');
    return id;
  }

  async writeCollectionImage(data: CollectionImageData): Promise<string> {
    const sanitized = sanitizeAllStrings(data);
    const id =
      sanitized.id ||
      this.computeImageId('collection_images', sanitized.collection_id, sanitized.path);
    const trackerKey = `${sanitized.collection_id}:${sanitized.path.toLowerCase()}`;
    try {
      await this.db.execute(
        `INSERT INTO collection_images (id, collection_id, path, original_name, mime_type, size, alt_text, display_order, extra, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          sanitized.collection_id,
          sanitized.path,
          sanitized.original_name,
          sanitized.mime_type,
          sanitized.size,
          sanitized.alt_text,
          sanitized.display_order,
          sanitized.extra ?? null,
          this.now,
          this.now,
        ]
      );
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
    }
    this.tracker.set(trackerKey, id, 'image');
    return id;
  }

  // =========================================================================
  // Glossary
  // =========================================================================

  async writeGlossary(data: GlossaryData): Promise<string> {
    const sanitized = sanitizeAllStrings(data);
    const id = deterministicUuid(`glossary:${sanitized.backward_compatibility.toLowerCase()}`);
    await this.db.execute(
      `INSERT INTO glossaries (id, internal_name, backward_compatibility, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, sanitized.internal_name, sanitized.backward_compatibility, this.now, this.now]
    );

    this.tracker.set(sanitized.backward_compatibility, id, 'glossary');
    return id;
  }

  async writeGlossaryTranslation(data: GlossaryTranslationData): Promise<void> {
    const sanitized = sanitizeAllStrings(data);
    const id = uuidv4();
    await this.db.execute(
      `INSERT INTO glossary_translations (id, glossary_id, language_id, definition, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, sanitized.glossary_id, sanitized.language_id, sanitized.definition, this.now, this.now]
    );
  }

  async writeGlossarySpelling(data: GlossarySpellingData): Promise<string> {
    const sanitized = sanitizeAllStrings(data);
    const id = uuidv4();
    await this.db.execute(
      `INSERT INTO glossary_spellings (id, glossary_id, language_id, spelling, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, sanitized.glossary_id, sanitized.language_id, sanitized.spelling, this.now, this.now]
    );
    return id;
  }

  // =========================================================================
  // Item Links
  // =========================================================================

  async writeItemItemLink(data: ItemItemLinkData): Promise<string> {
    const sanitized = sanitizeAllStrings(data);
    const backwardCompat = sanitized.backward_compatibility ?? null;
    const id = backwardCompat
      ? deterministicUuid(`item_item_link:${backwardCompat.toLowerCase()}`)
      : uuidv4();
    await this.db.execute(
      `INSERT INTO item_item_links (id, source_id, target_id, context_id, backward_compatibility, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        sanitized.source_id,
        sanitized.target_id,
        sanitized.context_id,
        backwardCompat,
        this.now,
        this.now,
      ]
    );

    // Track with provided backward_compatibility if available, otherwise use composite key
    if (backwardCompat) {
      this.tracker.set(backwardCompat, id, 'item_item_link');
    }
    return id;
  }

  async writeItemItemLinkTranslation(data: ItemItemLinkTranslationData): Promise<void> {
    const sanitized = sanitizeAllStrings(data);
    const bc = sanitized.backward_compatibility ?? null;
    const id = bc
      ? deterministicUuid(`item_item_link_translation:${bc.toLowerCase()}:${sanitized.language_id}`)
      : uuidv4();
    await this.db.execute(
      `INSERT INTO item_item_link_translations (id, item_item_link_id, language_id, description, reciprocal_description, backward_compatibility, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        sanitized.item_item_link_id,
        sanitized.language_id,
        sanitized.description ?? null,
        sanitized.reciprocal_description ?? null,
        sanitized.backward_compatibility ?? null,
        this.now,
        this.now,
      ]
    );
  }

  // =========================================================================
  // Dynasties
  // =========================================================================

  async writeDynasty(data: DynastyData): Promise<string> {
    const sanitized = sanitizeAllStrings(data);
    const id = deterministicUuid(`dynasty:${sanitized.backward_compatibility.toLowerCase()}`);
    await this.db.execute(
      `INSERT INTO dynasties (id, from_ah, to_ah, from_ad, to_ad, backward_compatibility, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.from_ah ?? null,
        data.to_ah ?? null,
        data.from_ad ?? null,
        data.to_ad ?? null,
        sanitized.backward_compatibility,
        this.now,
        this.now,
      ]
    );

    this.tracker.set(sanitized.backward_compatibility, id, 'dynasty');
    return id;
  }

  async writeDynastyTranslation(data: DynastyTranslationData): Promise<void> {
    const sanitized = sanitizeAllStrings(data);
    const bc = sanitized.backward_compatibility ?? null;
    const id = bc
      ? deterministicUuid(`dynasty_translation:${bc.toLowerCase()}:${sanitized.language_id}`)
      : uuidv4();
    await this.db.execute(
      `INSERT INTO dynasty_translations (id, dynasty_id, language_id, name, also_known_as, area, history, date_description_ah, date_description_ad, backward_compatibility, extra, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        sanitized.dynasty_id,
        sanitized.language_id,
        sanitized.name ?? null,
        sanitized.also_known_as ?? null,
        sanitized.area ?? null,
        sanitized.history ?? null,
        sanitized.date_description_ah ?? null,
        sanitized.date_description_ad ?? null,
        sanitized.backward_compatibility ?? null,
        sanitized.extra ?? null,
        this.now,
        this.now,
      ]
    );
  }

  async writeItemDynasty(data: ItemDynastyData): Promise<void> {
    await this.db.execute(
      `INSERT IGNORE INTO item_dynasty (item_id, dynasty_id, created_at, updated_at)
       VALUES (?, ?, ?, ?)`,
      [data.item_id, data.dynasty_id, this.now, this.now]
    );
  }

  // =========================================================================
  // Timelines
  // =========================================================================

  async writeTimeline(data: TimelineData): Promise<string> {
    const sanitized = sanitizeAllStrings(data);
    const id = deterministicUuid(`timeline:${sanitized.backward_compatibility.toLowerCase()}`);
    await this.db.execute(
      `INSERT INTO timelines (id, internal_name, country_id, collection_id, backward_compatibility, extra, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        sanitized.internal_name,
        sanitized.country_id ?? null,
        sanitized.collection_id ?? null,
        sanitized.backward_compatibility,
        sanitized.extra ?? null,
        this.now,
        this.now,
      ]
    );

    this.tracker.set(sanitized.backward_compatibility, id, 'timeline');
    return id;
  }

  async writeTimelineEvent(data: TimelineEventData): Promise<string> {
    const sanitized = sanitizeAllStrings(data);
    const id = deterministicUuid(
      `timeline_event:${sanitized.backward_compatibility.toLowerCase()}`
    );
    await this.db.execute(
      `INSERT INTO timeline_events (id, timeline_id, internal_name, year_from, year_to, year_from_ah, year_to_ah, date_from, date_to, display_order, backward_compatibility, extra, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        sanitized.timeline_id,
        sanitized.internal_name,
        data.year_from,
        data.year_to,
        data.year_from_ah ?? null,
        data.year_to_ah ?? null,
        data.date_from ?? null,
        data.date_to ?? null,
        data.display_order,
        sanitized.backward_compatibility,
        sanitized.extra ?? null,
        this.now,
        this.now,
      ]
    );

    this.tracker.set(sanitized.backward_compatibility, id, 'timeline_event');
    return id;
  }

  async writeTimelineEventTranslation(data: TimelineEventTranslationData): Promise<void> {
    const sanitized = sanitizeAllStrings(data);
    const bc = sanitized.backward_compatibility ?? null;
    const id = bc
      ? deterministicUuid(`timeline_event_translation:${bc.toLowerCase()}:${sanitized.language_id}`)
      : uuidv4();
    await this.db.execute(
      `INSERT INTO timeline_event_translations (id, timeline_event_id, language_id, name, description, date_from_description, date_to_description, date_from_ah_description, backward_compatibility, extra, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        sanitized.timeline_event_id,
        sanitized.language_id,
        sanitized.name ?? null,
        sanitized.description ?? null,
        sanitized.date_from_description ?? null,
        sanitized.date_to_description ?? null,
        sanitized.date_from_ah_description ?? null,
        sanitized.backward_compatibility ?? null,
        sanitized.extra ?? null,
        this.now,
        this.now,
      ]
    );
  }

  async writeTimelineEventItem(data: TimelineEventItemData): Promise<void> {
    const sanitized = sanitizeAllStrings(data);
    await this.db.execute(
      `INSERT IGNORE INTO timeline_event_item (timeline_event_id, item_id, display_order, backward_compatibility, extra, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        sanitized.timeline_event_id,
        sanitized.item_id,
        data.display_order,
        sanitized.backward_compatibility ?? null,
        sanitized.extra ?? null,
        this.now,
        this.now,
      ]
    );
  }

  async writeTimelineEventImage(data: TimelineEventImageData): Promise<string> {
    const id =
      data.id || this.computeImageId('timeline_event_images', data.timeline_event_id, data.path);
    const trackerKey = `${data.timeline_event_id}:${data.path.toLowerCase()}`;
    try {
      await this.db.execute(
        `INSERT INTO timeline_event_images (id, timeline_event_id, path, original_name, mime_type, size, alt_text, display_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          data.timeline_event_id,
          data.path,
          data.original_name,
          data.mime_type,
          data.size,
          data.alt_text ?? null,
          data.display_order,
          this.now,
          this.now,
        ]
      );
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
    }
    this.tracker.set(trackerKey, id, 'image');
    return id;
  }

  // Writes `extra` on its own, so it does not pass through a `sanitizeAllStrings`
  // on the way in like every other write does. It has to convert its own.
  async updateTimelineExtra(timelineId: string, extra: string): Promise<void> {
    await this.db.execute(`UPDATE timelines SET extra = ?, updated_at = ? WHERE id = ?`, [
      sanitizeJsonField(extra),
      this.now,
      timelineId,
    ]);
  }

  // =========================================================================
  // Media & Documents
  // =========================================================================

  async writeItemMedia(data: ItemMediaData): Promise<string> {
    const sanitized = sanitizeAllStrings(data);
    const id = sanitized.backward_compatibility
      ? deterministicUuid(`item_media:${sanitized.backward_compatibility.toLowerCase()}`)
      : uuidv4();
    await this.db.execute(
      `INSERT INTO item_media (id, item_id, language_id, type, title, description,
                               url, display_order, extra, backward_compatibility,
                               created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        sanitized.item_id,
        sanitized.language_id ?? null,
        sanitized.type,
        sanitized.title,
        sanitized.description ?? null,
        sanitized.url,
        data.display_order,
        sanitized.extra ?? null,
        sanitized.backward_compatibility ?? null,
        this.now,
        this.now,
      ]
    );
    if (sanitized.backward_compatibility) {
      this.tracker.set(sanitized.backward_compatibility, id, 'item_media');
    }
    return id;
  }

  async writeCollectionMedia(data: CollectionMediaData): Promise<string> {
    const sanitized = sanitizeAllStrings(data);
    const id = sanitized.backward_compatibility
      ? deterministicUuid(`collection_media:${sanitized.backward_compatibility.toLowerCase()}`)
      : uuidv4();
    await this.db.execute(
      `INSERT INTO collection_media (id, collection_id, language_id, type, title, description,
                                     url, display_order, extra, backward_compatibility,
                                     created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        sanitized.collection_id,
        sanitized.language_id ?? null,
        sanitized.type,
        sanitized.title,
        sanitized.description ?? null,
        sanitized.url,
        data.display_order,
        sanitized.extra ?? null,
        sanitized.backward_compatibility ?? null,
        this.now,
        this.now,
      ]
    );
    if (sanitized.backward_compatibility) {
      this.tracker.set(sanitized.backward_compatibility, id, 'collection_media');
    }
    return id;
  }

  async writeItemDocument(data: ItemDocumentData): Promise<string> {
    const sanitized = sanitizeAllStrings(data);
    const id = sanitized.backward_compatibility
      ? deterministicUuid(`item_document:${sanitized.backward_compatibility.toLowerCase()}`)
      : uuidv4();
    await this.db.execute(
      `INSERT INTO item_documents (id, item_id, language_id, path, original_name,
                                   mime_type, size, title, display_order, extra,
                                   backward_compatibility, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        sanitized.item_id,
        sanitized.language_id ?? null,
        sanitized.path,
        sanitized.original_name,
        sanitized.mime_type,
        data.size,
        sanitized.title ?? null,
        data.display_order,
        sanitized.extra ?? null,
        sanitized.backward_compatibility ?? null,
        this.now,
        this.now,
      ]
    );
    if (sanitized.backward_compatibility) {
      this.tracker.set(sanitized.backward_compatibility, id, 'item_document');
    }
    return id;
  }

  // Fills every translation row for the (item, language) pair — one legacy
  // credit covers the object in that language, and inventory-app may hold
  // several context rows for it.
  //
  // With overwrite, an existing value is replaced: the junction tables are the
  // authoritative source and the objects.preparedby free text is a
  // denormalised leftover. Callers keep first-wins across several junction
  // rows for the same (item, language, role) themselves, in legacy priority
  // order — this method cannot, since every call looks the same to it.
  async updateItemTranslationAuthorFk(
    itemId: string,
    languageId: string,
    fkColumn: string,
    authorId: string,
    overwrite = false
  ): Promise<void> {
    const allowedColumns = [
      'author_id',
      'text_copy_editor_id',
      'translator_id',
      'translation_copy_editor_id',
    ];
    if (!allowedColumns.includes(fkColumn)) {
      throw new Error(`Invalid FK column: ${fkColumn}`);
    }
    const guard = overwrite ? '' : ` AND ${fkColumn} IS NULL`;
    await this.db.execute(
      `UPDATE item_translations SET ${fkColumn} = ? WHERE item_id = ? AND language_id = ?${guard}`,
      [authorId, itemId, languageId]
    );
  }

  // Same all-context and overwrite semantics as updateItemTranslationAuthorFk.
  async updateDynastyTranslationAuthorFk(
    dynastyId: string,
    languageId: string,
    fkColumn: string,
    authorId: string,
    overwrite = false
  ): Promise<void> {
    const allowedColumns = [
      'author_id',
      'text_copy_editor_id',
      'translator_id',
      'translation_copy_editor_id',
    ];
    if (!allowedColumns.includes(fkColumn)) {
      throw new Error(`Invalid FK column: ${fkColumn}`);
    }
    const guard = overwrite ? '' : ` AND ${fkColumn} IS NULL`;
    await this.db.execute(
      `UPDATE dynasty_translations SET ${fkColumn} = ? WHERE dynasty_id = ? AND language_id = ?${guard}`,
      [authorId, dynastyId, languageId]
    );
  }

  // =========================================================================
  // Lookup Methods
  // =========================================================================

  /**
   * Tables that do not have a backward_compatibility column.
   * For these tables, DB fallback lookups are skipped — only the in-memory
   * tracker is consulted.
   */
  private static readonly TABLES_WITHOUT_BC = new Set([
    'item_images',
    'partner_images',
    'partner_logos',
    'collection_images',
    'contributor_images',
    'timeline_event_images',
  ]);

  /**
   * Check if an image row already exists for the given owner + legacy path.
   * This is the counterpart to exists()/findByBackwardCompatibility() for
   * the six TABLES_WITHOUT_BC tables, which have no backward_compatibility
   * column to query by. Recomputes the same deterministic id the
   * corresponding write*Image method would derive and does a primary-key
   * lookup — cheap (indexed by definition), and correct regardless of
   * whether image-sync has since overwritten the row's `path` with a UUID
   * filename: identity is derived from the legacy path passed in here
   * (which the importer always reads fresh from the source DB), never from
   * the target row's current, possibly-already-synced state.
   *
   * @returns The existing row's id, or null if no such image exists yet.
   */
  async imageExists(table: ImageTable, ownerId: string, path: string): Promise<string | null> {
    const id = this.computeImageId(table, ownerId, path);
    const [rows] = await this.db.execute<RowDataPacket[]>(`SELECT id FROM ${table} WHERE id = ?`, [
      id,
    ]);
    return rows.length > 0 ? id : null;
  }

  async exists(table: string, backwardCompatibility: string): Promise<boolean> {
    const entityType = mapTableToEntityType(table);
    if (entityType && this.tracker.exists(backwardCompatibility, entityType)) {
      return true;
    }

    // Image tables lack backward_compatibility column — tracker-only lookup
    if (SqlWriteStrategy.TABLES_WITHOUT_BC.has(table)) {
      return false;
    }

    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT id FROM ${table} WHERE backward_compatibility = ?`,
      [backwardCompatibility]
    );
    return rows.length > 0;
  }

  async findByBackwardCompatibility(
    table: string,
    backwardCompatibility: string
  ): Promise<string | null> {
    const entityType = mapTableToEntityType(table);
    // Check tracker first
    const cached = entityType
      ? this.tracker.getUuid(backwardCompatibility, entityType)
      : this.tracker.getUuid(backwardCompatibility);
    if (cached) {
      return cached;
    }

    // Image tables lack backward_compatibility column — tracker-only lookup
    if (SqlWriteStrategy.TABLES_WITHOUT_BC.has(table)) {
      return null;
    }

    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT id FROM ${table} WHERE backward_compatibility = ?`,
      [backwardCompatibility]
    );

    if (rows.length > 0 && rows[0]) {
      const id = rows[0].id as string;
      if (entityType) {
        this.tracker.set(backwardCompatibility, id, entityType);
      }
      return id;
    }

    return null;
  }

  // =========================================================================
  // Contributors
  // =========================================================================

  async writeContributor(data: ContributorData): Promise<string> {
    const sanitized = sanitizeAllStrings(data);
    const id =
      sanitized.id ||
      (sanitized.backward_compatibility
        ? deterministicUuid(`contributor:${sanitized.backward_compatibility.toLowerCase()}`)
        : uuidv4());
    await this.db.execute(
      `INSERT INTO contributors (id, collection_id, category, display_order, visible, backward_compatibility, internal_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        sanitized.collection_id,
        sanitized.category,
        data.display_order,
        data.visible ? 1 : 0,
        sanitized.backward_compatibility ?? null,
        sanitized.internal_name,
        this.now,
        this.now,
      ]
    );
    if (sanitized.backward_compatibility) {
      this.tracker.set(sanitized.backward_compatibility, id, 'contributor');
    }
    return id;
  }

  async writeContributorTranslation(data: ContributorTranslationData): Promise<void> {
    const sanitized = sanitizeAllStrings(data);
    const id =
      sanitized.id ||
      (sanitized.backward_compatibility
        ? deterministicUuid(
            `contributor_translation:${sanitized.backward_compatibility.toLowerCase()}:${sanitized.language_id}:${sanitized.context_id}`
          )
        : uuidv4());
    await this.db.execute(
      `INSERT INTO contributor_translations (id, contributor_id, language_id, context_id, name, description, link, alt_text, extra, backward_compatibility, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        sanitized.contributor_id,
        sanitized.language_id,
        sanitized.context_id,
        sanitized.name ?? null,
        sanitized.description ?? null,
        sanitized.link ?? null,
        sanitized.alt_text ?? null,
        sanitized.extra ?? null,
        sanitized.backward_compatibility ?? null,
        this.now,
        this.now,
      ]
    );
  }

  async writeContributorImage(data: ContributorImageData): Promise<string> {
    const sanitized = sanitizeAllStrings(data);
    const id =
      sanitized.id ||
      this.computeImageId('contributor_images', sanitized.contributor_id, sanitized.path);
    const trackerKey = `${sanitized.contributor_id}:${sanitized.path.toLowerCase()}`;
    try {
      await this.db.execute(
        `INSERT INTO contributor_images (id, contributor_id, path, original_name, mime_type, size, alt_text, display_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          sanitized.contributor_id,
          sanitized.path,
          sanitized.original_name,
          sanitized.mime_type,
          sanitized.size,
          sanitized.alt_text,
          sanitized.display_order,
          this.now,
          this.now,
        ]
      );
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
    }
    // Track using owner-scoped, lowercase path as unique identifier
    this.tracker.set(trackerKey, id, 'image');
    return id;
  }

  // =========================================================================
  // Extra JSON Read-Modify-Write
  // =========================================================================

  async getCollectionTranslationExtra(
    collectionId: string,
    languageId: string
  ): Promise<Record<string, unknown> | null> {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT extra FROM collection_translations WHERE collection_id = ? AND language_id = ? LIMIT 1`,
      [collectionId, languageId]
    );
    if (rows.length === 0 || !rows[0]?.extra) return null;
    const raw = rows[0].extra;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  }

  async setCollectionTranslationExtra(
    collectionId: string,
    languageId: string,
    extra: string
  ): Promise<void> {
    await this.db.execute(
      `UPDATE collection_translations SET extra = ?, updated_at = ? WHERE collection_id = ? AND language_id = ?`,
      [sanitizeJsonField(extra), this.now, collectionId, languageId]
    );
  }

  async getCollectionTranslationByKey(
    collectionId: string,
    languageId: string,
    contextId: string
  ): Promise<{ id: string; extra: Record<string, unknown> | null } | null> {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT id, extra FROM collection_translations WHERE collection_id = ? AND language_id = ? AND context_id = ? LIMIT 1`,
      [collectionId, languageId, contextId]
    );
    if (rows.length === 0) return null;
    const row = rows[0]!;
    const raw = row.extra;
    const extra = raw
      ? typeof raw === 'string'
        ? (JSON.parse(raw) as Record<string, unknown>)
        : (raw as Record<string, unknown>)
      : null;
    return { id: row.id as string, extra };
  }

  async setCollectionTranslationExtraByKey(
    collectionId: string,
    languageId: string,
    contextId: string,
    extra: string
  ): Promise<void> {
    await this.db.execute(
      `UPDATE collection_translations SET extra = ?, updated_at = ? WHERE collection_id = ? AND language_id = ? AND context_id = ?`,
      [sanitizeJsonField(extra), this.now, collectionId, languageId, contextId]
    );
  }

  async findCollectionTranslationsWithSerializedBuffers(): Promise<
    Array<{ id: string; extra: Record<string, unknown> }>
  > {
    // JSON_SEARCH matches the `"Buffer"` marker string anywhere in the
    // document. It is a candidate filter only — the caller re-checks the full
    // `{type,data}` shape before rewriting anything.
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT id, extra FROM collection_translations
       WHERE extra IS NOT NULL AND JSON_SEARCH(extra, 'one', 'Buffer') IS NOT NULL`
    );
    return rows.map((row) => {
      const raw = row.extra;
      return {
        id: row.id as string,
        extra: (typeof raw === 'string' ? JSON.parse(raw) : raw) as Record<string, unknown>,
      };
    });
  }

  async setCollectionTranslationExtraById(id: string, extra: string): Promise<void> {
    await this.db.execute(
      `UPDATE collection_translations SET extra = ?, updated_at = ? WHERE id = ?`,
      [sanitizeJsonField(extra), this.now, id]
    );
  }

  async getItemTranslationExtra(
    itemId: string,
    languageId: string
  ): Promise<Record<string, unknown> | null> {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT extra FROM item_translations WHERE item_id = ? AND language_id = ? LIMIT 1`,
      [itemId, languageId]
    );
    if (rows.length === 0 || !rows[0]?.extra) return null;
    const raw = rows[0].extra;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  }

  async setItemTranslationExtra(itemId: string, languageId: string, extra: string): Promise<void> {
    await this.db.execute(
      `UPDATE item_translations SET extra = ?, updated_at = ? WHERE item_id = ? AND language_id = ?`,
      [sanitizeJsonField(extra), this.now, itemId, languageId]
    );
  }

  // item_id + language_id alone is ambiguous whenever an item carries more
  // than one context's translation of the same language (e.g. a monument's
  // own project context and its EPM context) — unlike
  // setItemTranslationExtra, these two never touch a sibling context's row.
  async getItemTranslationExtraByContext(
    itemId: string,
    languageId: string,
    contextId: string
  ): Promise<Record<string, unknown> | null> {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT extra FROM item_translations WHERE item_id = ? AND language_id = ? AND context_id = ? LIMIT 1`,
      [itemId, languageId, contextId]
    );
    if (rows.length === 0 || !rows[0]?.extra) return null;
    const raw = rows[0].extra;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  }

  async setItemTranslationExtraByContext(
    itemId: string,
    languageId: string,
    contextId: string,
    extra: string
  ): Promise<void> {
    await this.db.execute(
      `UPDATE item_translations SET extra = ?, updated_at = ? WHERE item_id = ? AND language_id = ? AND context_id = ?`,
      [sanitizeJsonField(extra), this.now, itemId, languageId, contextId]
    );
  }

  // The database's actual uniqueness constraint — distinct from checking
  // existence by backward_compatibility, which is per-source-record and
  // says nothing when a different source record already claimed the same
  // (item, language, context) triple (e.g. two legacy Explore monument ids
  // that both resolve, via cross-reference, to the same canonical item).
  async itemTranslationExistsForContext(
    itemId: string,
    languageId: string,
    contextId: string
  ): Promise<boolean> {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT 1 FROM item_translations WHERE item_id = ? AND language_id = ? AND context_id = ? LIMIT 1`,
      [itemId, languageId, contextId]
    );
    return rows.length > 0;
  }

  async getCollectionItemExtra(
    collectionId: string,
    itemId: string
  ): Promise<Record<string, unknown> | null> {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT extra FROM collection_item WHERE collection_id = ? AND item_id = ? LIMIT 1`,
      [collectionId, itemId]
    );
    if (rows.length === 0 || !rows[0]?.extra) return null;
    const raw = rows[0].extra;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  }

  async setCollectionItemExtra(collectionId: string, itemId: string, extra: string): Promise<void> {
    await this.db.execute(
      `UPDATE collection_item SET extra = ?, updated_at = ? WHERE collection_id = ? AND item_id = ?`,
      [sanitizeJsonField(extra), this.now, collectionId, itemId]
    );
  }

  async collectionItemPivotExists(collectionId: string, itemId: string): Promise<boolean> {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT 1 FROM collection_item WHERE collection_id = ? AND item_id = ? LIMIT 1`,
      [collectionId, itemId]
    );
    return rows.length > 0;
  }

  async getCollectionImageExtra(collectionImageId: string): Promise<Record<string, unknown> | null> {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT extra FROM collection_images WHERE id = ? LIMIT 1`,
      [collectionImageId]
    );
    if (rows.length === 0 || !rows[0]?.extra) return null;
    const raw = rows[0].extra;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  }

  async setCollectionImageExtra(collectionImageId: string, extraJson: string): Promise<void> {
    await this.db.execute(
      `UPDATE collection_images SET extra = ?, updated_at = ? WHERE id = ?`,
      [sanitizeJsonField(extraJson), this.now, collectionImageId]
    );
  }

  async attachTagsToCollectionImage(collectionImageId: string, tagIds: string[]): Promise<void> {
    for (const tagId of tagIds) {
      try {
        await this.db.execute(
          `INSERT IGNORE INTO collection_image_tag (collection_image_id, tag_id, created_at, updated_at)
           VALUES (?, ?, ?, ?)`,
          [collectionImageId, tagId, this.now, this.now]
        );
      } catch {
        // Ignore duplicates
      }
    }
  }

  async getCollectionTranslationLanguages(collectionId: string): Promise<string[]> {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT DISTINCT language_id FROM collection_translations WHERE collection_id = ?`,
      [collectionId]
    );
    return rows.map((r) => r.language_id as string);
  }

  async getItemTranslationLanguages(itemId: string): Promise<string[]> {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT DISTINCT language_id FROM item_translations WHERE item_id = ?`,
      [itemId]
    );
    return rows.map((r) => r.language_id as string);
  }

  // =========================================================================
  // Update Methods (for post-processing / re-parenting)
  // =========================================================================

  async getCollectionParentId(collectionId: string): Promise<string | null> {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT parent_id FROM collections WHERE id = ?`,
      [collectionId]
    );
    if (rows.length === 0) {
      return null;
    }
    return (rows[0].parent_id as string | null) ?? null;
  }

  async updateCollectionParentId(collectionId: string, parentId: string): Promise<void> {
    await this.db.execute(`UPDATE collections SET parent_id = ?, updated_at = ? WHERE id = ?`, [
      parentId,
      this.now,
      collectionId,
    ]);
  }

  async getCollectionContextId(collectionId: string): Promise<string | null> {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT context_id FROM collections WHERE id = ?`,
      [collectionId]
    );
    if (rows.length === 0) {
      return null;
    }
    return (rows[0].context_id as string | null) ?? null;
  }

  async updateCollectionContextId(collectionId: string, contextId: string): Promise<void> {
    await this.db.execute(`UPDATE collections SET context_id = ?, updated_at = ? WHERE id = ?`, [
      contextId,
      this.now,
      collectionId,
    ]);
  }

  async updateCollectionTranslationsContextId(
    collectionId: string,
    contextId: string
  ): Promise<void> {
    await this.db.execute(
      `UPDATE collection_translations SET context_id = ?, updated_at = ?
       WHERE collection_id = ? AND context_id != ?`,
      [contextId, this.now, collectionId, contextId]
    );
  }

  async getCollectionExtra(collectionId: string): Promise<Record<string, unknown> | null> {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT extra FROM collections WHERE id = ? LIMIT 1`,
      [collectionId]
    );
    if (rows.length === 0 || !rows[0]?.extra) return null;
    const raw = rows[0].extra;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  }

  async setCollectionExtra(collectionId: string, extra: string): Promise<void> {
    await this.db.execute(`UPDATE collections SET extra = ?, updated_at = ? WHERE id = ?`, [
      sanitizeJsonField(extra),
      this.now,
      collectionId,
    ]);
  }

  async getCollectionPurpose(collectionId: string): Promise<string | null> {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT purpose FROM collections WHERE id = ?`,
      [collectionId]
    );
    if (rows.length === 0) {
      return null;
    }
    return (rows[0].purpose as string | null) ?? null;
  }

  async updateCollectionPurpose(collectionId: string, purpose: string): Promise<void> {
    await this.db.execute(`UPDATE collections SET purpose = ?, updated_at = ? WHERE id = ?`, [
      purpose,
      this.now,
      collectionId,
    ]);
  }

  async backfillCollectionPurposeByBackwardCompatibility(
    bcPattern: string,
    purpose: string
  ): Promise<number> {
    const [result] = await this.db.execute<ResultSetHeader>(
      `UPDATE collections SET purpose = ?, updated_at = ?
       WHERE backward_compatibility LIKE ? AND purpose IS NULL`,
      [purpose, this.now, bcPattern]
    );
    return result.affectedRows;
  }

  async updateBackwardCompatibility(
    table: string,
    id: string,
    backwardCompatibility: string
  ): Promise<void> {
    await this.db.execute(
      `UPDATE ${table} SET backward_compatibility = ?, updated_at = ? WHERE id = ?`,
      [backwardCompatibility, this.now, id]
    );
  }
}
