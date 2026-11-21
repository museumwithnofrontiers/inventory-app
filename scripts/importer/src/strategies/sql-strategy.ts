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
import { ITEM_TRANSLATION_COLUMNS } from '../utils/item-translation-columns.js';
import { COLLECTION_TRANSLATION_COLUMNS } from '../utils/collection-translation-columns.js';
import type {
  ImageRightsRow,
  LegacyTypeRow,
  PictureCreditRow,
  PictureParentImageRow,
} from '../utils/picture-credits.js';
import type { CatalogueRow, LinkData, PartnerUrlRow, ShopLinkRow } from '../utils/links.js';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { ImageTextData, ImageTextRow } from '../utils/image-texts.js';
import type { IWriteStrategy, ProjectShellCleanup } from '../core/strategy.js';
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
  PublicationData,
  PublicationTranslationData,
  PublicationEditionData,
  PublicationImageData,
  PublicationRelationData,
  PublicationRelationTable,
  PublicationDocumentData,
} from '../core/types.js';
import { sanitizeAllStrings, sanitizeJsonField } from '../utils/html-to-markdown.js';
import type { CollectionItemColumns } from '../utils/collection-item-columns.js';
import { placementUuidName } from '../utils/collection-item-columns.js';
import {
  VISIT_INFORMATION_FIELDS,
  type VisitInformationFields,
  type VisitOwner,
} from '../utils/visit-information.js';
import type { CollectionItemTranslationColumns } from '../utils/collection-item-translations.js';
import {
  COLLECTION_ITEM_TRANSLATION_COLUMNS,
  placementTranslationUuidName,
} from '../utils/collection-item-translations.js';
import type { ExploreMonumentPlan } from '../utils/explore-monuments.js';
import { exploreMonumentUuidName } from '../utils/explore-monuments.js';

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
  item_documents: 'item_document',
  contributors: 'contributor',
  contributor_translations: 'contributor_translation',
  publications: 'publication',
  publication_translations: 'publication_translation',
  publication_editions: 'publication_edition',
};

function mapTableToEntityType(table: string): EntityType | null {
  return tableEntityMap[table] ?? null;
}

// item_translation_author roles, keyed by the item_translations FK column
// each role also fills with its first person (inventory-app CreditRole).
const CREDIT_ROLE_BY_FK_COLUMN: Record<string, string> = {
  author_id: 'author',
  text_copy_editor_id: 'text_copy_editor',
  translator_id: 'translator',
  translation_copy_editor_id: 'translation_copy_editor',
};

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
/** The translation table each visit information owner's keys come from (M16 D1). */
const VISIT_SOURCE_TABLES: Readonly<Record<VisitOwner, { table: string; column: string }>> = {
  item: { table: 'item_translations', column: 'item_id' },
  collection: { table: 'collection_translations', column: 'collection_id' },
  partner: { table: 'partner_translations', column: 'partner_id' },
};

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
      `INSERT INTO collection_item (id, collection_id, item_id, display_order, extra, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         display_order = VALUES(display_order),
         extra = VALUES(extra),
         updated_at = VALUES(updated_at)`,
      [
        deterministicUuid(placementUuidName(sanitized.collection_id, sanitized.item_id)),
        sanitized.collection_id,
        sanitized.item_id,
        displayOrder,
        extra,
        this.now,
        this.now,
      ]
    );
  }

  async writeProject(data: ProjectData): Promise<string> {
    const sanitized = sanitizeAllStrings(data);
    const id = deterministicUuid(`project:${sanitized.backward_compatibility.toLowerCase()}`);
    await this.db.execute(
      `INSERT INTO projects (id, internal_name, context_id, language_id, launch_date, is_launched, is_enabled, site_url, related_database_url, artistic_introduction_url, copyright, backward_compatibility, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        sanitized.copyright ?? null,
        sanitized.backward_compatibility,
        this.now,
        this.now,
      ]
    );

    this.tracker.set(sanitized.backward_compatibility, id, 'project');
    return id;
  }

  async writeProjectTranslation(data: ProjectTranslationData): Promise<void> {
    // A project's name in one language, as written (legacy `projectnames`).
    // A project's name doesn't depend on a context, so `context_id` is not
    // stored, and legacy has no description to keep.
    const sanitized = sanitizeAllStrings(data);
    const id = deterministicUuid(
      `project_translation:${sanitized.project_id}:${sanitized.language_id}`
    );
    await this.db.execute(
      `INSERT INTO project_translations (id, project_id, language_id, name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, sanitized.project_id, sanitized.language_id, sanitized.name, this.now, this.now]
    );
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
        // A project is kept while an item or a publication refers to it: a
        // publication's project (AMA) may have no item at all (M14, #2532).
        `SELECT p.id, p.backward_compatibility, p.internal_name
         FROM projects p
         LEFT JOIN items i ON i.project_id = p.id
         WHERE i.id IS NULL
           AND NOT EXISTS (SELECT 1 FROM publications pu WHERE pu.project_id = p.id)`
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

  /**
   * The columns whose foreign key points at `table` (information_schema), so a
   * reference check covers every table, including the ones added later.
   */
  private async referencingColumns(
    table: string
  ): Promise<Array<{ table: string; column: string }>> {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name
       FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME = ?
       ORDER BY TABLE_NAME, COLUMN_NAME`,
      [table]
    );
    return (rows as RowDataPacket[]).map((r) => ({
      table: String(r.table_name),
      column: String(r.column_name),
    }));
  }

  /** The `table.column` names among `columns` that hold `id`. */
  private async referencesTo(
    id: string,
    columns: Array<{ table: string; column: string }>
  ): Promise<string[]> {
    const found: string[] = [];
    for (const { table, column } of columns) {
      const [rows] = await this.db.execute<RowDataPacket[]>(
        `SELECT 1 FROM \`${table}\` WHERE \`${column}\` = ? LIMIT 1`,
        [id]
      );
      if ((rows as RowDataPacket[]).length > 0) found.push(`${table}.${column}`);
    }
    return found;
  }

  async deleteProjectShells(dryRun = false): Promise<ProjectShellCleanup> {
    const collectionRefs = (await this.referencingColumns('collections')).filter(
      // A shell's own translations go with it.
      (c) => !(c.table === 'collection_translations' && c.column === 'collection_id')
    );
    const contextRefs = await this.referencingColumns('contexts');

    await this.db.beginTransaction();
    try {
      // A legacy project's root collection shares its key with the project's
      // context (ProjectImporter, ShProjectImporter).
      const [rows] = await this.db.execute<RowDataPacket[]>(
        `SELECT c.id, c.backward_compatibility, c.context_id
         FROM collections c
         JOIN contexts x ON x.id = c.context_id AND x.backward_compatibility = c.backward_compatibility
         WHERE c.parent_id IS NULL
           AND (c.backward_compatibility LIKE 'mwnf3:projects:%'
                OR c.backward_compatibility LIKE 'mwnf3_sharing_history:sh_projects:%')
           AND NOT EXISTS (
             SELECT 1 FROM projects p WHERE p.backward_compatibility = c.backward_compatibility
           )
         ORDER BY c.backward_compatibility`
      );

      const result: ProjectShellCleanup = { collections: [], contexts: [], kept: [] };
      for (const row of rows as RowDataPacket[]) {
        const shell = {
          id: String(row.id),
          backward_compatibility: String(row.backward_compatibility),
          context_id: String(row.context_id),
        };
        const referencedBy = await this.referencesTo(shell.id, collectionRefs);
        const [links] = await this.db.execute<RowDataPacket[]>(
          `SELECT 1 FROM links WHERE linkable_type = 'collection' AND linkable_id = ? LIMIT 1`,
          [shell.id]
        );
        if ((links as RowDataPacket[]).length > 0) referencedBy.push('links.linkable_id');
        if (referencedBy.length > 0) {
          result.kept.push({
            kind: 'collection',
            id: shell.id,
            backward_compatibility: shell.backward_compatibility,
            referencedBy,
          });
          continue;
        }

        await this.db.execute(`DELETE FROM collections WHERE id = ?`, [shell.id]);
        result.collections.push({
          id: shell.id,
          backward_compatibility: shell.backward_compatibility,
        });

        const contextReferencedBy = await this.referencesTo(shell.context_id, contextRefs);
        if (contextReferencedBy.length > 0) {
          result.kept.push({
            kind: 'context',
            id: shell.context_id,
            backward_compatibility: shell.backward_compatibility,
            referencedBy: contextReferencedBy,
          });
          continue;
        }
        await this.db.execute(`DELETE FROM contexts WHERE id = ?`, [shell.context_id]);
        result.contexts.push({
          id: shell.context_id,
          backward_compatibility: shell.backward_compatibility,
        });
      }

      if (dryRun) {
        await this.db.rollback();
      } else {
        await this.db.commit();
      }
      return result;
    } catch (err) {
      await this.db.rollback();
      throw err;
    }
  }

  async deleteOrphanFreeTextAuthors(dryRun = false): Promise<Array<{ id: string; name: string }>> {
    const authorRefs = await this.referencingColumns('authors');

    await this.db.beginTransaction();
    try {
      // AuthorHelper writes the authors it makes from credit text with no
      // legacy key; every legacy author has one.
      const [rows] = await this.db.execute<RowDataPacket[]>(
        `SELECT id, name FROM authors
         WHERE backward_compatibility IS NULL OR backward_compatibility = ''
         ORDER BY name, id`
      );

      const deleted: Array<{ id: string; name: string }> = [];
      for (const row of rows as RowDataPacket[]) {
        const id = String(row.id);
        if ((await this.referencesTo(id, authorRefs)).length > 0) continue;
        await this.db.execute(`DELETE FROM authors WHERE id = ?`, [id]);
        deleted.push({ id, name: String(row.name) });
      }

      if (dryRun) {
        await this.db.rollback();
      } else {
        await this.db.commit();
      }
      return deleted;
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
      `INSERT INTO partner_translations (id, partner_id, language_id, context_id, name, description, city_display, address_notes, contact_website, contact_phone, contact_fax, contact_email_general, extra, backward_compatibility, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        sanitized.partner_id,
        sanitized.language_id,
        sanitized.context_id,
        sanitized.name,
        sanitized.description ?? null,
        // The optional fields default to null: mysql2 refuses undefined, which
        // lost the exhibition partners' translations (M16 G3 #2699).
        sanitized.city_display ?? null,
        sanitized.address ?? null,
        sanitized.contact_website ?? null,
        sanitized.contact_phone ?? null,
        sanitized.contact_fax ?? null,
        sanitized.contact_email_general ?? null,
        sanitized.extra ?? null,
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
    // item_translation_author holds legacy's credit tables only, written by
    // the junction step (replaceItemTranslationCredits). The row's own credit
    // text stays in its FK columns and, as written, in extra.credits_as_written:
    // seeding the list with it made a role legacy's table has nobody for print
    // that text on sites whose legacy sheet never did.
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
          `INSERT IGNORE INTO collection_item (id, collection_id, item_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`,
          [
            deterministicUuid(placementUuidName(collectionId, itemId)),
            collectionId,
            itemId,
            this.now,
            this.now,
          ]
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

  async setProjectPartnerParent(
    collectionId: string,
    partnerId: string,
    parentPartnerId: string
  ): Promise<void> {
    await this.db.execute(
      `UPDATE collection_partner SET parent_partner_id = ?, updated_at = ?
       WHERE collection_id = ? AND collection_type = 'project' AND partner_id = ?`,
      [parentPartnerId, this.now, collectionId, partnerId]
    );
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
    // A free-text author (no legacy ID) is keyed by its name: AuthorHelper
    // dedupes those by name, so the name gives the same id at every import
    // (a random one changed every credit pointing at it in the packages).
    const id = bc
      ? deterministicUuid(`author:${bc.toLowerCase()}`)
      : deterministicUuid(`author:name:${sanitized.name.trim().toLowerCase()}`);
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
          // Update the existing record with the proper BC so future lookups work.
          // A record made from a free-text credit holds only the name, so the
          // legacy author's own spellings fill what it lacks: the sites print
          // `originalname` on Arabic pages. What the record already holds stays.
          await this.db.execute(
            `UPDATE authors SET backward_compatibility = ?,
               firstname = COALESCE(NULLIF(firstname, ''), ?),
               lastname = COALESCE(NULLIF(lastname, ''), ?),
               givenname = COALESCE(NULLIF(givenname, ''), ?),
               originalname = COALESCE(NULLIF(originalname, ''), ?)
             WHERE id = ?`,
            [
              bc,
              sanitized.firstname || null,
              sanitized.lastname || null,
              sanitized.givenname || null,
              sanitized.originalname || null,
              byName,
            ]
          );
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

  async findAuthorByName(name: string, exact = false): Promise<string | null> {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      exact
        ? 'SELECT id FROM authors WHERE BINARY name = ? LIMIT 1'
        : 'SELECT id FROM authors WHERE name = ? LIMIT 1',
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
        `INSERT INTO collection_images (id, collection_id, path, original_name, mime_type, size, alt_text, copyright, display_order, extra, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          sanitized.collection_id,
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
    // An item's media are Links since M16 F3 (#2653); the id formula is kept.
    await this.db.execute(
      `INSERT INTO links (id, linkable_type, linkable_id, language_id, type, title, description,
                          url, display_order, extra, backward_compatibility,
                          created_at, updated_at)
       VALUES (?, 'item', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    // A collection's media are Links since M16 F3 (#2653); the id formula is kept.
    await this.db.execute(
      `INSERT INTO links (id, linkable_type, linkable_id, language_id, type, title, description,
                          authors, category, resource_type, location, country_code, further_reading,
                          url, display_order, extra, backward_compatibility, created_at, updated_at)
       VALUES (?, 'collection', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        sanitized.collection_id,
        sanitized.language_id ?? null,
        sanitized.type,
        sanitized.title,
        sanitized.description ?? null,
        sanitized.authors ?? null,
        data.category ?? null,
        sanitized.resource_type ?? null,
        sanitized.location ?? null,
        sanitized.country_code ?? null,
        sanitized.further_reading ?? null,
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

  // =========================================================================
  // Publications
  // =========================================================================

  async writePublication(data: PublicationData): Promise<string> {
    const sanitized = sanitizeAllStrings(data);
    const id = deterministicUuid(`publication:${sanitized.backward_compatibility.toLowerCase()}`);
    await this.db.execute(
      `INSERT INTO publications (id, internal_name, backward_compatibility, category, project_id, country_id, language_id, status, display_order, extra, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        sanitized.internal_name,
        sanitized.backward_compatibility,
        sanitized.category,
        sanitized.project_id ?? null,
        sanitized.country_id ?? null,
        sanitized.language_id,
        sanitized.status,
        data.display_order ?? null,
        sanitized.extra ?? null,
        this.now,
        this.now,
      ]
    );
    this.tracker.set(sanitized.backward_compatibility, id, 'publication');
    return id;
  }

  async writePublicationTranslation(data: PublicationTranslationData): Promise<void> {
    const sanitized = sanitizeAllStrings(data);
    const id = deterministicUuid(
      `publication_translation:${sanitized.backward_compatibility.toLowerCase()}:${sanitized.context_id}`
    );
    await this.db.execute(
      `INSERT INTO publication_translations (id, publication_id, language_id, context_id, title, subtitle, description, introduction, author_credit, photography_credit, coordination_credit, backward_compatibility, extra, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        sanitized.publication_id,
        sanitized.language_id,
        sanitized.context_id,
        sanitized.title,
        sanitized.subtitle ?? null,
        sanitized.description ?? null,
        sanitized.introduction ?? null,
        sanitized.author_credit ?? null,
        sanitized.photography_credit ?? null,
        sanitized.coordination_credit ?? null,
        sanitized.backward_compatibility,
        sanitized.extra ?? null,
        this.now,
        this.now,
      ]
    );
    this.tracker.set(sanitized.backward_compatibility, id, 'publication_translation');
  }

  async writePublicationEdition(data: PublicationEditionData): Promise<string> {
    const sanitized = sanitizeAllStrings(data);
    const id = deterministicUuid(
      `publication_edition:${sanitized.backward_compatibility.toLowerCase()}`
    );
    await this.db.execute(
      `INSERT INTO publication_editions (id, publication_id, language_id, format, edition, publish_year, isbn, publisher, page_count, image_count, plan_count, dimensions, binding, visible, display_order, backward_compatibility, extra, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        sanitized.publication_id,
        sanitized.language_id,
        sanitized.format,
        data.edition ?? null,
        data.publish_year ?? null,
        sanitized.isbn ?? null,
        sanitized.publisher ?? null,
        data.page_count ?? null,
        data.image_count ?? null,
        data.plan_count ?? null,
        sanitized.dimensions ?? null,
        sanitized.binding ?? null,
        data.visible ? 1 : 0,
        data.display_order ?? null,
        sanitized.backward_compatibility,
        sanitized.extra ?? null,
        this.now,
        this.now,
      ]
    );
    this.tracker.set(sanitized.backward_compatibility, id, 'publication_edition');
    return id;
  }

  async writePublicationImage(data: PublicationImageData): Promise<string> {
    const sanitized = sanitizeAllStrings(data);
    const id =
      sanitized.id ||
      this.computeImageId('publication_images', sanitized.publication_id, sanitized.path);
    try {
      await this.db.execute(
        `INSERT INTO publication_images (id, publication_id, publication_edition_id, kind, path, original_name, mime_type, size, alt_text, copyright, photographer, display_order, extra, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          sanitized.publication_id,
          sanitized.publication_edition_id ?? null,
          sanitized.kind,
          sanitized.path,
          sanitized.original_name,
          sanitized.mime_type,
          data.size,
          sanitized.alt_text ?? null,
          sanitized.copyright ?? null,
          sanitized.photographer ?? null,
          data.display_order,
          sanitized.extra ?? null,
          this.now,
          this.now,
        ]
      );
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
    }
    this.tracker.set(`${sanitized.publication_id}:${sanitized.path.toLowerCase()}`, id, 'image');
    return id;
  }

  async writePublicationDocument(data: PublicationDocumentData): Promise<string> {
    const sanitized = sanitizeAllStrings(data);
    const id = deterministicUuid(
      `publication_document:${sanitized.backward_compatibility.toLowerCase()}`
    );
    await this.db.execute(
      `INSERT INTO publication_documents (id, publication_id, publication_edition_id, language_id, kind, path, original_name, mime_type, size, display_order, backward_compatibility, extra, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        sanitized.publication_id,
        sanitized.publication_edition_id ?? null,
        sanitized.language_id ?? null,
        sanitized.kind,
        sanitized.path,
        sanitized.original_name,
        sanitized.mime_type,
        data.size,
        data.display_order,
        sanitized.backward_compatibility,
        sanitized.extra ?? null,
        this.now,
        this.now,
      ]
    );
    return id;
  }

  async writePublicationRelation(
    table: PublicationRelationTable,
    data: PublicationRelationData
  ): Promise<void> {
    const column =
      table === 'publication_collection'
        ? 'collection_id'
        : table === 'publication_item'
          ? 'item_id'
          : 'tag_id';
    if (table === 'publication_tag') {
      await this.db.execute(
        `INSERT IGNORE INTO publication_tag (publication_id, tag_id, created_at, updated_at)
         VALUES (?, ?, ?, ?)`,
        [data.publication_id, data.related_id, this.now, this.now]
      );
      return;
    }
    const sanitized = sanitizeAllStrings(data);
    const extra = sanitized.extra ? JSON.stringify(sanitized.extra) : null;
    await this.db.execute(
      `INSERT INTO ${table} (publication_id, ${column}, display_order, extra, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE display_order = VALUES(display_order), extra = VALUES(extra), updated_at = VALUES(updated_at)`,
      [data.publication_id, data.related_id, data.display_order ?? null, extra, this.now, this.now]
    );
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

  async replaceItemTranslationCredits(
    itemId: string,
    languageId: string,
    fkColumn: string,
    authorIds: string[]
  ): Promise<void> {
    const role = CREDIT_ROLE_BY_FK_COLUMN[fkColumn];
    if (!role) {
      throw new Error(`Invalid FK column: ${fkColumn}`);
    }
    await this.db.execute(
      `DELETE FROM item_translation_author WHERE role = ? AND item_translation_id IN
         (SELECT id FROM item_translations WHERE item_id = ? AND language_id = ?)`,
      [role, itemId, languageId]
    );
    for (const [displayOrder, authorId] of authorIds.entries()) {
      await this.db.execute(
        `INSERT IGNORE INTO item_translation_author (item_translation_id, role, author_id, display_order, created_at, updated_at)
         SELECT id, ?, ?, ?, ?, ? FROM item_translations WHERE item_id = ? AND language_id = ?`,
        [role, authorId, displayOrder, this.now, this.now, itemId, languageId]
      );
    }
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
    'publication_images',
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

  async setCollectionTranslationDescriptionByKey(
    collectionId: string,
    languageId: string,
    contextId: string,
    description: string
  ): Promise<void> {
    const sanitized = sanitizeAllStrings({ description });
    await this.db.execute(
      `UPDATE collection_translations SET description = ?, updated_at = ? WHERE collection_id = ? AND language_id = ? AND context_id = ?`,
      [sanitized.description, this.now, collectionId, languageId, contextId]
    );
  }

  async setCollectionTranslationTitleByKey(
    collectionId: string,
    languageId: string,
    contextId: string,
    title: string
  ): Promise<void> {
    const sanitized = sanitizeAllStrings({ title });
    await this.db.execute(
      `UPDATE collection_translations SET title = ?, updated_at = ? WHERE collection_id = ? AND language_id = ? AND context_id = ?`,
      [sanitized.title, this.now, collectionId, languageId, contextId]
    );
  }

  async deleteCollectionTranslations(
    collectionId: string,
    contextId: string,
    languageId?: string
  ): Promise<void> {
    if (languageId !== undefined) {
      await this.db.execute(
        `DELETE FROM collection_translations WHERE collection_id = ? AND context_id = ? AND language_id = ?`,
        [collectionId, contextId, languageId]
      );
      return;
    }
    await this.db.execute(
      `DELETE FROM collection_translations WHERE collection_id = ? AND context_id = ?`,
      [collectionId, contextId]
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

  async findCollectionTranslationsWithExtraKeys(keys: readonly string[]): Promise<
    Array<{
      id: string;
      collection_id: string;
      collection_backward_compatibility: string | null;
      collection_context_id: string | null;
      language_id: string;
      context_id: string;
      extra: Record<string, unknown>;
    }>
  > {
    if (keys.length === 0) return [];
    const paths = keys.map(() => '?').join(', ');
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT ct.id, ct.collection_id, c.backward_compatibility AS collection_backward_compatibility,
              c.context_id AS collection_context_id,
              ct.language_id, ct.context_id, ct.extra
       FROM collection_translations ct
       JOIN collections c ON c.id = ct.collection_id
       WHERE ct.extra IS NOT NULL AND JSON_CONTAINS_PATH(ct.extra, 'one', ${paths})
       ORDER BY ct.collection_id, ct.language_id, ct.context_id`,
      keys.map((key) => `$.${key}`)
    );
    return rows.map((row) => {
      const raw = row.extra;
      return {
        id: row.id as string,
        collection_id: row.collection_id as string,
        collection_backward_compatibility:
          (row.collection_backward_compatibility as string | null) ?? null,
        collection_context_id: (row.collection_context_id as string | null) ?? null,
        language_id: row.language_id as string,
        context_id: row.context_id as string,
        extra: (typeof raw === 'string' ? JSON.parse(raw) : raw) as Record<string, unknown>,
      };
    });
  }

  async setCollectionTranslationExtraAsStoredById(id: string, extra: string | null): Promise<void> {
    await this.db.execute(
      `UPDATE collection_translations SET extra = ?, updated_at = ? WHERE id = ?`,
      [extra, this.now, id]
    );
  }

  async findImageTextRows(): Promise<ImageTextRow[]> {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT ct.id, ct.collection_id, c.backward_compatibility AS collection_key, ct.extra
       FROM collection_translations ct JOIN collections c ON c.id = ct.collection_id
       WHERE ct.extra IS NOT NULL
         AND JSON_CONTAINS_PATH(ct.extra, 'one', '$.image_captions', '$.map_descriptions')
       ORDER BY ct.collection_id, ct.id`
    );
    return rows.map((row) => ({
      id: row.id as string,
      collection_id: row.collection_id as string,
      collection_key: (row.collection_key as string | null) ?? null,
      extra: (typeof row.extra === 'string' ? JSON.parse(row.extra) : row.extra) as Record<
        string,
        unknown
      >,
    }));
  }

  async findCollectionImagePaths(
    collectionIds: readonly string[]
  ): Promise<
    Array<{ id: string; collection_id: string; path: string; original_name: string | null }>
  > {
    if (collectionIds.length === 0) return [];
    const marks = collectionIds.map(() => '?').join(', ');
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT id, collection_id, path, original_name FROM collection_images
       WHERE collection_id IN (${marks}) ORDER BY collection_id, id`,
      [...collectionIds]
    );
    return rows.map((row) => ({
      id: row.id as string,
      collection_id: row.collection_id as string,
      path: row.path as string,
      original_name: (row.original_name as string | null) ?? null,
    }));
  }

  async upsertImageTranslation(data: ImageTextData & { image_type: string }): Promise<string> {
    // The texts were sanitized when they were first written: copied as stored.
    const id = deterministicUuid(
      `image_translation:${data.backward_compatibility.toLowerCase()}:${data.language_id}`
    );
    await this.db.execute(
      `INSERT INTO image_translations (id, image_type, image_id, language_id, caption, name, date,
                                       museum, location, backward_compatibility, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE caption = VALUES(caption), name = VALUES(name), date = VALUES(date),
         museum = VALUES(museum), location = VALUES(location),
         backward_compatibility = VALUES(backward_compatibility), updated_at = VALUES(updated_at)`,
      [
        id,
        data.image_type,
        data.image_id,
        data.language_id,
        data.caption,
        data.name,
        data.date,
        data.museum,
        data.location,
        data.backward_compatibility,
        this.now,
        this.now,
      ]
    );
    return id;
  }

  async findItemTranslationsWithExtraKeys(
    keys: readonly string[]
  ): Promise<Array<{ id: string; extra: Record<string, unknown> }>> {
    if (keys.length === 0) return [];
    const paths = keys.map(() => '?').join(', ');
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT id, extra FROM item_translations
       WHERE extra IS NOT NULL AND JSON_CONTAINS_PATH(extra, 'one', ${paths})
       ORDER BY id`,
      keys.map((key) => `$.${key}`)
    );
    return rows.map((row) => {
      const raw = row.extra;
      return {
        id: row.id as string,
        extra: (typeof raw === 'string' ? JSON.parse(raw) : raw) as Record<string, unknown>,
      };
    });
  }

  async setItemTranslationColumnsAsStoredById(
    id: string,
    columns: Record<string, string>,
    extra: string | null
  ): Promise<void> {
    const allowed = new Set(ITEM_TRANSLATION_COLUMNS.map((entry) => entry.column));
    const names = Object.keys(columns);
    const unknown = names.filter((name) => !allowed.has(name));
    if (unknown.length > 0) {
      throw new Error(`Not an item translation column of ADR 006: ${unknown.join(', ')}`);
    }
    const sets = names.map((name) => `\`${name}\` = ?`).join(', ');
    await this.db.execute(
      `UPDATE item_translations SET ${sets}${sets ? ', ' : ''}extra = ?, updated_at = ? WHERE id = ?`,
      [...names.map((name) => columns[name]!), extra, this.now, id]
    );
  }

  async setCollectionTranslationColumnsAsStoredById(
    id: string,
    columns: Record<string, string>,
    extra: string | null
  ): Promise<void> {
    const allowed = new Set(COLLECTION_TRANSLATION_COLUMNS.map((entry) => entry.column));
    const names = Object.keys(columns);
    const unknown = names.filter((name) => !allowed.has(name));
    if (unknown.length > 0) {
      throw new Error(`Not a collection translation column of ADR 006: ${unknown.join(', ')}`);
    }
    const sets = names.map((name) => `\`${name}\` = ?`).join(', ');
    await this.db.execute(
      `UPDATE collection_translations SET ${sets}${sets ? ', ' : ''}extra = ?, updated_at = ? WHERE id = ?`,
      [...names.map((name) => columns[name]!), extra, this.now, id]
    );
  }

  async findPictureCreditRows(): Promise<PictureCreditRow[]> {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT it.id, it.item_id, it.language_id, it.extra,
              ii.id AS image_id, ii.copyright AS image_copyright,
              ii.photographer AS image_photographer, ii.credit AS image_credit,
              p.backward_compatibility AS project_key
       FROM item_translations it
       JOIN items i ON i.id = it.item_id AND i.type = 'picture'
       JOIN item_images ii ON ii.item_id = i.id
       LEFT JOIN projects p ON p.id = i.project_id
       WHERE it.item_id IN (
         SELECT t.item_id FROM item_translations t
         WHERE t.extra IS NOT NULL
           AND JSON_CONTAINS_PATH(t.extra, 'one', '$.photographer', '$.copyright')
       )
       ORDER BY it.item_id, it.language_id, it.id, ii.id`
    );
    return rows.map((row) => {
      const raw = row.extra;
      return {
        id: row.id as string,
        item_id: row.item_id as string,
        language_id: row.language_id as string,
        extra: (raw === null ? null : typeof raw === 'string' ? JSON.parse(raw) : raw) as Record<
          string,
          unknown
        > | null,
        image_id: row.image_id as string,
        image_copyright: (row.image_copyright as string | null) ?? null,
        image_photographer: (row.image_photographer as string | null) ?? null,
        image_credit: (row.image_credit as string | null) ?? null,
        project_key: (row.project_key as string | null) ?? null,
      };
    });
  }

  async findImageRightsRows(): Promise<ImageRightsRow[]> {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT it.id, it.extra FROM item_translations it
       JOIN items i ON i.id = it.item_id AND i.type <> 'picture'
       WHERE it.extra IS NOT NULL AND JSON_CONTAINS_PATH(it.extra, 'one', '$.copyright')
       ORDER BY it.id`
    );
    return rows.map((row) => {
      const raw = row.extra;
      return {
        id: row.id as string,
        extra: (typeof raw === 'string' ? JSON.parse(raw) : raw) as Record<string, unknown>,
      };
    });
  }

  async setItemTranslationImageRights(
    id: string,
    imageRights: string,
    extra: string | null
  ): Promise<void> {
    await this.db.execute(
      'UPDATE item_translations SET image_rights = ?, extra = ?, updated_at = ? WHERE id = ?',
      [imageRights, extra, this.now, id]
    );
  }

  private static parseExtra(raw: unknown): Record<string, unknown> {
    return (typeof raw === 'string' ? JSON.parse(raw) : raw) as Record<string, unknown>;
  }

  async findCatalogueLinkRows(): Promise<CatalogueRow[]> {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT id, item_id, language_id, backward_compatibility, extra FROM item_translations
       WHERE extra IS NOT NULL AND JSON_CONTAINS_PATH(extra, 'one', '$.catalogue_holding_link')
       ORDER BY item_id, language_id, id`
    );
    return rows.map((row) => ({
      id: row.id as string,
      item_id: row.item_id as string,
      language_id: row.language_id as string,
      backward_compatibility: (row.backward_compatibility as string | null) ?? null,
      extra: SqlWriteStrategy.parseExtra(row.extra),
    }));
  }

  async findPartnerUrlRows(): Promise<PartnerUrlRow[]> {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT pt.id, pt.partner_id, p.backward_compatibility AS partner_key, pt.extra
       FROM partner_translations pt JOIN partners p ON p.id = pt.partner_id
       WHERE pt.extra IS NOT NULL AND JSON_CONTAINS_PATH(pt.extra, 'one', '$.urls')
       ORDER BY pt.partner_id, pt.id`
    );
    return rows.map((row) => ({
      id: row.id as string,
      partner_id: row.partner_id as string,
      partner_key: (row.partner_key as string | null) ?? null,
      extra: SqlWriteStrategy.parseExtra(row.extra),
    }));
  }

  async findShopLinkRows(): Promise<ShopLinkRow[]> {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT id, backward_compatibility, extra FROM publication_editions
       WHERE extra IS NOT NULL AND JSON_CONTAINS_PATH(extra, 'one', '$.shop_links')
       ORDER BY id`
    );
    return rows.map((row) => ({
      id: row.id as string,
      backward_compatibility: (row.backward_compatibility as string | null) ?? null,
      extra: SqlWriteStrategy.parseExtra(row.extra),
    }));
  }

  async writeLink(data: LinkData): Promise<string> {
    // The texts were sanitized when they were first written: copied as stored.
    const id = deterministicUuid(`link:${data.backward_compatibility.toLowerCase()}`);
    await this.db.execute(
      `INSERT INTO links (id, linkable_type, linkable_id, language_id, type, title, url,
                          display_order, backward_compatibility, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE linkable_type = VALUES(linkable_type), linkable_id = VALUES(linkable_id),
         language_id = VALUES(language_id), type = VALUES(type), title = VALUES(title), url = VALUES(url),
         display_order = VALUES(display_order), updated_at = VALUES(updated_at)`,
      [
        id,
        data.linkable_type,
        data.linkable_id,
        data.language_id,
        data.type,
        data.title,
        data.url,
        data.display_order,
        data.backward_compatibility,
        this.now,
        this.now,
      ]
    );
    return id;
  }

  async setExtraAsStoredById(
    table: 'partner_translations' | 'publication_editions',
    id: string,
    extra: string | null
  ): Promise<void> {
    const allowed = new Set(['partner_translations', 'publication_editions']);
    if (!allowed.has(table)) throw new Error(`Not a table this step writes: ${table}`);
    await this.db.execute(`UPDATE ${table} SET extra = ?, updated_at = ? WHERE id = ?`, [
      extra,
      this.now,
      id,
    ]);
  }

  async setItemImageTranslationCredit(
    imageId: string,
    languageId: string,
    key: 'photographer' | 'copyright',
    text: string
  ): Promise<void> {
    const column = key === 'photographer' ? 'photographer' : 'copyright';
    await this.db.execute(
      `INSERT INTO image_translations (id, image_type, image_id, language_id, ${column}, created_at, updated_at)
       VALUES (?, 'item_image', ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE ${column} = VALUES(${column}), updated_at = VALUES(updated_at)`,
      [
        deterministicUuid(`image_translation:item_image:${imageId}:${languageId}`),
        imageId,
        languageId,
        text,
        this.now,
        this.now,
      ]
    );
  }

  async findLegacyTypeRows(): Promise<LegacyTypeRow[]> {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT it.id, it.extra,
              (SELECT JSON_ARRAYAGG(t.internal_name) FROM item_tag x JOIN tags t ON t.id = x.tag_id
               WHERE x.item_id = it.item_id AND t.category = 'image-type') AS image_type_tags
       FROM item_translations it
       WHERE it.extra IS NOT NULL AND JSON_CONTAINS_PATH(it.extra, 'one', '$.legacy_type')
       ORDER BY it.id`
    );
    return rows.map((row) => {
      const extra = typeof row.extra === 'string' ? JSON.parse(row.extra) : row.extra;
      const tags = typeof row.image_type_tags === 'string' ? JSON.parse(row.image_type_tags) : row.image_type_tags;
      return {
        id: row.id as string,
        extra: extra as Record<string, unknown>,
        image_type_tags: Array.isArray(tags) ? (tags as string[]) : [],
      };
    });
  }

  async setItemImagePictureCredit(
    id: string,
    photographer: string | null,
    credit: string | null,
    clearCopyright: boolean
  ): Promise<void> {
    await this.db.execute(
      `UPDATE item_images SET photographer = ?, credit = ?${clearCopyright ? ', copyright = NULL' : ''}, updated_at = ? WHERE id = ?`,
      [photographer, credit, this.now, id]
    );
  }

  async findPictureParentImages(): Promise<PictureParentImageRow[]> {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT pi.id AS parent_image_id, pi.photographer AS parent_photographer,
              pi.credit AS parent_credit, pi.copyright AS parent_copyright,
              MIN(ii.photographer) AS photographer, MIN(ii.credit) AS credit,
              MIN(p.backward_compatibility) AS project_key
       FROM item_images pi
       JOIN items par ON par.id = pi.item_id AND par.type <> 'picture'
       JOIN items pic ON pic.parent_id = par.id AND pic.type = 'picture'
       -- The legacy source path: image-sync gives each row its own file name.
       JOIN item_images ii ON ii.item_id = pic.id AND ii.original_name = pi.original_name
       LEFT JOIN projects p ON p.id = pic.project_id
       WHERE ii.photographer IS NOT NULL OR ii.credit IS NOT NULL
          OR pi.photographer IS NOT NULL OR pi.credit IS NOT NULL
       GROUP BY pi.id, pi.photographer, pi.credit, pi.copyright
       ORDER BY pi.id`
    );
    return rows.map((row) => ({
      parent_image_id: row.parent_image_id as string,
      parent_photographer: (row.parent_photographer as string | null) ?? null,
      parent_credit: (row.parent_credit as string | null) ?? null,
      parent_copyright: (row.parent_copyright as string | null) ?? null,
      photographer: (row.photographer as string | null) ?? null,
      credit: (row.credit as string | null) ?? null,
      project_key: (row.project_key as string | null) ?? null,
    }));
  }

  async findPartnerImagesWithPhotographer(): Promise<
    Array<{ id: string; extra: Record<string, unknown> }>
  > {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT id, extra FROM partner_images
       WHERE extra IS NOT NULL AND JSON_CONTAINS_PATH(extra, 'one', '$.photographer')
       ORDER BY id`
    );
    return rows.map((row) => {
      const raw = row.extra;
      return {
        id: row.id as string,
        extra: (typeof raw === 'string' ? JSON.parse(raw) : raw) as Record<string, unknown>,
      };
    });
  }

  async setPartnerImagePhotographer(
    id: string,
    photographer: string,
    extra: string | null
  ): Promise<void> {
    await this.db.execute(
      'UPDATE partner_images SET photographer = ?, extra = ?, updated_at = ? WHERE id = ?',
      [photographer, extra, this.now, id]
    );
  }

  async upsertContributorTranslationAsStored(data: {
    id: string;
    contributor_id: string;
    language_id: string;
    context_id: string;
    name: string | null;
    description: string | null;
    backward_compatibility: string | null;
  }): Promise<void> {
    await this.db.execute(
      `INSERT INTO contributor_translations (id, contributor_id, language_id, context_id, name, description, backward_compatibility, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), updated_at = VALUES(updated_at)`,
      [
        data.id,
        data.contributor_id,
        data.language_id,
        data.context_id,
        data.name,
        data.description,
        data.backward_compatibility,
        this.now,
        this.now,
      ]
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

  async setItemTranslationDescriptionByContext(
    itemId: string,
    languageId: string,
    contextId: string,
    description: string
  ): Promise<void> {
    const sanitized = sanitizeAllStrings({ description });
    await this.db.execute(
      `UPDATE item_translations SET description = ?, updated_at = ? WHERE item_id = ? AND language_id = ? AND context_id = ?`,
      [sanitized.description, this.now, itemId, languageId, contextId]
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

  async findCollectionItemsWithExtraKeys(keys: readonly string[]): Promise<
    Array<{
      id: string;
      collection_id: string;
      item_id: string;
      display_order: number | null;
      extra: Record<string, unknown>;
    }>
  > {
    if (keys.length === 0) return [];
    const paths = keys.map(() => '?').join(', ');
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT id, collection_id, item_id, display_order, extra
       FROM collection_item
       WHERE extra IS NOT NULL AND JSON_CONTAINS_PATH(extra, 'one', ${paths})
       ORDER BY collection_id, item_id`,
      keys.map((key) => `$.${key}`)
    );
    return rows.map((row) => {
      const raw = row.extra;
      return {
        id: row.id as string,
        collection_id: row.collection_id as string,
        item_id: row.item_id as string,
        display_order: (row.display_order as number | null) ?? null,
        extra: (typeof raw === 'string' ? JSON.parse(raw) : raw) as Record<string, unknown>,
      };
    });
  }

  async findPictureItemIdsByOriginalName(
    parentItemId: string,
    originalName: string
  ): Promise<string[]> {
    // The legacy path is in `path` until image-sync copies the file, and in
    // `original_name` after it (the importer writes only the base name there),
    // so a placement resolves in a full stage as well as on a synced copy.
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT DISTINCT pic.id
       FROM items pic
       JOIN item_images ii ON ii.item_id = pic.id
       WHERE pic.parent_id = ? AND pic.type = 'picture' AND (ii.path = ? OR ii.original_name = ?)
       ORDER BY pic.id`,
      [parentItemId, originalName, originalName]
    );
    return rows.map((row) => row.id as string);
  }

  async setCollectionItemColumnsById(
    id: string,
    columns: CollectionItemColumns,
    extra: string | null
  ): Promise<void> {
    const allowed = [
      'variant_order',
      'parent_variant_order',
      'curator_selected',
      'picture_item_id',
    ] as const;
    const names = allowed.filter((name) => Object.prototype.hasOwnProperty.call(columns, name));
    const assignments = [...names.map((name) => `${name} = ?`), 'extra = ?', 'updated_at = ?'];
    await this.db.execute(`UPDATE collection_item SET ${assignments.join(', ')} WHERE id = ?`, [
      ...names.map((name) => columns[name] ?? null),
      extra,
      this.now,
      id,
    ]);
  }

  async findVisitInformationSources(
    owner: VisitOwner,
    keys: readonly string[]
  ): Promise<
    Array<{
      id: string;
      owner_id: string;
      language_id: string;
      context_id: string;
      backward_compatibility: string | null;
      extra: Record<string, unknown>;
    }>
  > {
    if (keys.length === 0) return [];
    const { table, column } = VISIT_SOURCE_TABLES[owner];
    const paths = keys.map(() => '?').join(', ');
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT id, ${column} AS owner_id, language_id, context_id, backward_compatibility, extra
       FROM ${table}
       WHERE extra IS NOT NULL AND JSON_CONTAINS_PATH(extra, 'one', ${paths})
       ORDER BY ${column}, language_id, context_id`,
      keys.map((key) => `$.${key}`)
    );
    return rows.map((row) => {
      const raw = row.extra;
      return {
        id: row.id as string,
        owner_id: row.owner_id as string,
        language_id: row.language_id as string,
        context_id: row.context_id as string,
        backward_compatibility: (row.backward_compatibility as string | null) ?? null,
        extra: (typeof raw === 'string' ? JSON.parse(raw) : raw) as Record<string, unknown>,
      };
    });
  }

  async upsertVisitInformationAsStored(data: {
    id: string;
    owner: VisitOwner;
    ownerId: string;
    languageId: string;
    contextId: string;
    fields: VisitInformationFields;
    backwardCompatibility: string | null;
  }): Promise<void> {
    const ownerColumn = VISIT_SOURCE_TABLES[data.owner].column;
    const texts = VISIT_INFORMATION_FIELDS.map((field) => data.fields[field] ?? null);
    await this.db.execute(
      `INSERT INTO visit_information
         (id, ${ownerColumn}, language_id, context_id, ${VISIT_INFORMATION_FIELDS.join(', ')},
          backward_compatibility, created_at, updated_at)
       VALUES (?, ?, ?, ?, ${VISIT_INFORMATION_FIELDS.map(() => '?').join(', ')}, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         ${VISIT_INFORMATION_FIELDS.map((field) => `${field} = VALUES(${field})`).join(', ')},
         backward_compatibility = VALUES(backward_compatibility),
         updated_at = VALUES(updated_at)`,
      [
        data.id,
        data.ownerId,
        data.languageId,
        data.contextId,
        ...texts,
        data.backwardCompatibility,
        this.now,
        this.now,
      ]
    );
  }

  async setVisitInformationSourceExtraAsStored(
    owner: VisitOwner,
    id: string,
    extra: string | null
  ): Promise<void> {
    const { table } = VISIT_SOURCE_TABLES[owner];
    await this.db.execute(`UPDATE ${table} SET extra = ?, updated_at = ? WHERE id = ?`, [
      extra,
      this.now,
      id,
    ]);
  }

  async findCollectionItemTextRows(keys: readonly string[]): Promise<
    Array<{
      id: string;
      collection_backward_compatibility: string | null;
      extra: Record<string, unknown>;
    }>
  > {
    if (keys.length === 0) return [];
    const paths = keys.map(() => '?').join(', ');
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT ci.id, c.backward_compatibility AS collection_backward_compatibility, ci.extra
       FROM collection_item ci
       JOIN collections c ON c.id = ci.collection_id
       WHERE ci.extra IS NOT NULL AND JSON_CONTAINS_PATH(ci.extra, 'one', ${paths})
       ORDER BY ci.collection_id, ci.item_id`,
      keys.map((key) => `$.${key}`)
    );
    return rows.map((row) => {
      const raw = row.extra;
      return {
        id: row.id as string,
        collection_backward_compatibility: (row.collection_backward_compatibility as string | null) ?? null,
        extra: (typeof raw === 'string' ? JSON.parse(raw) : raw) as Record<string, unknown>,
      };
    });
  }

  async upsertCollectionItemTranslation(
    placementId: string,
    languageId: string,
    columns: CollectionItemTranslationColumns
  ): Promise<string> {
    const id = deterministicUuid(placementTranslationUuidName(placementId, languageId));
    const names = COLLECTION_ITEM_TRANSLATION_COLUMNS.filter((name) =>
      Object.prototype.hasOwnProperty.call(columns, name)
    );
    const updates = [...names.map((name) => `${name} = VALUES(${name})`), 'updated_at = VALUES(updated_at)'];
    await this.db.execute(
      `INSERT INTO collection_item_translations
         (id, collection_item_id, language_id, ${names.map((name) => `${name}, `).join('')}created_at, updated_at)
       VALUES (?, ?, ?, ${names.map(() => '?, ').join('')}?, ?)
       ON DUPLICATE KEY UPDATE ${updates.join(', ')}`,
      [
        id,
        placementId,
        languageId,
        ...names.map((name) => columns[name] ?? null),
        this.now,
        this.now,
      ]
    );
    return id;
  }

  async findPartnerTranslationsWithExtraKeys(
    keys: readonly string[]
  ): Promise<Array<{ id: string; partner_id: string; extra: Record<string, unknown> }>> {
    if (keys.length === 0) return [];
    const paths = keys.map(() => '?').join(', ');
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT id, partner_id, extra
       FROM partner_translations
       WHERE extra IS NOT NULL AND JSON_CONTAINS_PATH(extra, 'one', ${paths})
       ORDER BY partner_id, language_id, context_id`,
      keys.map((key) => `$.${key}`)
    );
    return rows.map((row) => {
      const raw = row.extra;
      return {
        id: row.id as string,
        partner_id: row.partner_id as string,
        extra: (typeof raw === 'string' ? JSON.parse(raw) : raw) as Record<string, unknown>,
      };
    });
  }

  async setPartnerColumns(
    partnerId: string,
    columns: { category?: string; featured?: boolean; city?: string }
  ): Promise<void> {
    const names = (['category', 'featured', 'city'] as const).filter(
      (name) => columns[name] !== undefined
    );
    if (names.length === 0) return;
    await this.db.execute(
      `UPDATE partners SET ${names.map((name) => `${name} = ?`).join(', ')}, updated_at = ? WHERE id = ?`,
      [...names.map((name) => columns[name] as string | boolean), this.now, partnerId]
    );
  }

  async upsertPartnerContactAsStored(data: {
    id: string;
    partnerId: string;
    displayOrder: number;
    fields: Partial<Record<'name' | 'title' | 'email' | 'phone' | 'fax', string>>;
  }): Promise<void> {
    const fields = ['name', 'title', 'email', 'phone', 'fax'] as const;
    await this.db.execute(
      `INSERT INTO partner_contacts (id, partner_id, display_order, ${fields.join(', ')}, created_at, updated_at)
       VALUES (?, ?, ?, ${fields.map(() => '?').join(', ')}, ?, ?)
       ON DUPLICATE KEY UPDATE
         ${fields.map((field) => `${field} = VALUES(${field})`).join(', ')},
         updated_at = VALUES(updated_at)`,
      [
        data.id,
        data.partnerId,
        data.displayOrder,
        ...fields.map((field) => data.fields[field] ?? null),
        this.now,
        this.now,
      ]
    );
  }

  async setPartnerTranslationColumnsAsStored(
    id: string,
    alsoKnownAs: string | null,
    extra: string | null
  ): Promise<void> {
    await this.db.execute(
      `UPDATE partner_translations SET also_known_as = COALESCE(?, also_known_as), extra = ?, updated_at = ? WHERE id = ?`,
      [alsoKnownAs, extra, this.now, id]
    );
  }

  async replaceCollectionItemExploreMonuments(
    placementId: string,
    monuments: Array<
      ExploreMonumentPlan & { location_collection_id: string | null; partner_ids: string[] }
    >
  ): Promise<void> {
    // The values were sanitized when they were first written: copied as stored.
    await this.db.execute('DELETE FROM collection_item_explore_monuments WHERE collection_item_id = ?', [
      placementId,
    ]);
    for (const monument of monuments) {
      const id = deterministicUuid(exploreMonumentUuidName(placementId, monument.position));
      await this.db.execute(
        `INSERT INTO collection_item_explore_monuments
           (id, collection_item_id, position, backward_compatibility, latitude, longitude, map_zoom,
            location_collection_id, description_types, travels_description_ref, explore_description_ref,
            virtual_museum_description_ref, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          placementId,
          monument.position,
          monument.backward_compatibility,
          monument.latitude,
          monument.longitude,
          monument.map_zoom,
          monument.location_collection_id,
          monument.description_types,
          monument.travels_description_ref,
          monument.explore_description_ref,
          monument.virtual_museum_description_ref,
          this.now,
          this.now,
        ]
      );
      for (const [index, partnerId] of monument.partner_ids.entries()) {
        await this.db.execute(
          `INSERT INTO collection_item_explore_monument_partner
             (collection_item_explore_monument_id, partner_id, display_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`,
          [id, partnerId, index + 1, this.now, this.now]
        );
      }
    }
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

  async getCollectionImageExtra(
    collectionImageId: string
  ): Promise<Record<string, unknown> | null> {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT extra FROM collection_images WHERE id = ? LIMIT 1`,
      [collectionImageId]
    );
    if (rows.length === 0 || !rows[0]?.extra) return null;
    const raw = rows[0].extra;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  }

  async setCollectionImageExtra(collectionImageId: string, extraJson: string): Promise<void> {
    await this.db.execute(`UPDATE collection_images SET extra = ?, updated_at = ? WHERE id = ?`, [
      sanitizeJsonField(extraJson),
      this.now,
      collectionImageId,
    ]);
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

  async updateCollectionDisplayOrder(
    collectionId: string,
    displayOrder: number | null
  ): Promise<void> {
    await this.db.execute(`UPDATE collections SET display_order = ?, updated_at = ? WHERE id = ?`, [
      displayOrder,
      this.now,
      collectionId,
    ]);
  }

  async updateCollectionGeo(
    collectionId: string,
    latitude: number | null,
    longitude: number | null,
    mapZoom: number | null
  ): Promise<void> {
    await this.db.execute(
      `UPDATE collections SET latitude = ?, longitude = ?, map_zoom = ?, updated_at = ? WHERE id = ?`,
      [latitude, longitude, mapZoom, this.now, collectionId]
    );
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

  async findCollectionsWithExtraKeys(
    keys: readonly string[]
  ): Promise<Array<{ id: string; extra: Record<string, unknown> }>> {
    if (keys.length === 0) return [];
    const paths = keys.map(() => '?').join(', ');
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT id, extra FROM collections
       WHERE extra IS NOT NULL AND JSON_CONTAINS_PATH(extra, 'one', ${paths})
       ORDER BY id`,
      keys.map((key) => `$.${key}`)
    );
    return rows.map((row) => {
      const raw = row.extra;
      return {
        id: row.id as string,
        extra: (typeof raw === 'string' ? JSON.parse(raw) : raw) as Record<string, unknown>,
      };
    });
  }

  async replaceCollectionCountries(
    collectionId: string,
    countryIds: readonly string[]
  ): Promise<void> {
    await this.db.execute(`DELETE FROM collection_country WHERE collection_id = ?`, [collectionId]);
    for (const [index, countryId] of countryIds.entries()) {
      await this.db.execute(
        `INSERT INTO collection_country (collection_id, country_id, display_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [collectionId, countryId, index + 1, this.now, this.now]
      );
    }
  }

  async replaceCollectionLinks(
    collectionId: string,
    kind: string,
    relatedCollectionIds: readonly string[]
  ): Promise<void> {
    await this.db.execute(
      `DELETE FROM collection_collection WHERE collection_id = ? AND kind = ?`,
      [collectionId, kind]
    );
    for (const [index, relatedId] of relatedCollectionIds.entries()) {
      await this.db.execute(
        `INSERT INTO collection_collection (collection_id, related_collection_id, kind, display_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [collectionId, relatedId, kind, index + 1, this.now, this.now]
      );
    }
  }

  async setCollectionRelationColumnsAsStored(
    collectionId: string,
    columns: { cover_item_id?: string; days?: number },
    extra: string | null
  ): Promise<void> {
    const sets: string[] = [];
    const values: Array<string | number> = [];
    if (columns.cover_item_id !== undefined) {
      sets.push('cover_item_id = ?');
      values.push(columns.cover_item_id);
    }
    if (columns.days !== undefined) {
      sets.push('days = ?');
      values.push(columns.days);
    }
    await this.db.execute(
      `UPDATE collections SET ${[...sets, 'extra = ?', 'updated_at = ?'].join(', ')} WHERE id = ?`,
      [...values, extra, this.now, collectionId]
    );
  }

  async setCollectionFlags(
    collectionId: string,
    flags: { visible?: boolean; featured?: boolean; published_at?: string }
  ): Promise<void> {
    const sets: string[] = [];
    const values: Array<string | number> = [];
    if (flags.visible !== undefined) {
      sets.push('visible = ?');
      values.push(flags.visible ? 1 : 0);
    }
    if (flags.featured !== undefined) {
      sets.push('featured = ?');
      values.push(flags.featured ? 1 : 0);
    }
    if (flags.published_at !== undefined) {
      sets.push('published_at = ?');
      values.push(flags.published_at);
    }
    if (sets.length === 0) return;
    await this.db.execute(
      `UPDATE collections SET ${[...sets, 'updated_at = ?'].join(', ')} WHERE id = ?`,
      [...values, this.now, collectionId]
    );
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
