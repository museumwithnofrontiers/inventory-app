/**
 * Author Importer
 *
 * Imports structured author entities from legacy databases:
 * - Authors with name parts from mwnf3.authors, sh_authors, thg_authors
 * - Author CVs (translations) from authors_cv, sh_authors_cv
 * - Author-item assignments from junction tables (authors_objects, authors_monuments, etc.)
 * - Author-dynasty assignments from authors_dynasties
 *
 * Uses the all_authors bridge tables for cross-schema deduplication.
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';
import {
  transformAuthor,
  transformAuthorCv,
  transformShAuthorCv,
} from '../../domain/transformers/index.js';
import type {
  LegacyAuthor,
  LegacyAuthorCv,
  LegacyShAuthorCv,
  LegacyAllAuthorMapping,
  LegacyAuthorObject,
  LegacyAuthorMonument,
  LegacyShAuthorObject,
  LegacyShAuthorMonument,
  LegacyAuthorDynasty,
} from '../../domain/types/index.js';

/** Maps legacy junction role type to inventory-app FK column on item_translations / dynasty_translations */
const ROLE_FK_MAP: Record<string, string> = {
  writer: 'author_id',
  copyEditor: 'text_copy_editor_id',
  translator: 'translator_id',
  translationCopyEditor: 'translation_copy_editor_id',
};

export class AuthorImporter extends BaseImporter {
  /**
   * (target, language, role) triples already credited from the junction during
   * this step, as `${targetId}|${languageId}|${fkColumn}`.
   *
   * The junction now overwrites whatever a translation row already holds, so
   * the database can no longer act as the first-wins guard the way the old
   * `IS NULL` clause did. Legacy can credit several people for one
   * (item, language, role) and lists them by priority; the queries are
   * ordered to match, and this set keeps the role's FK column on the first.
   */
  private readonly creditedTargets = new Set<string>();

  /**
   * Every person credited per (item, language, role), in legacy's priority
   * order, keyed like {@link creditedTargets}. Legacy prints them all, so the
   * whole list goes to item_translation_author once the junctions are read.
   */
  private readonly creditLists = new Map<
    string,
    { itemId: string; languageId: string; fkColumn: string; authorIds: string[] }
  >();

  getName(): string {
    return 'AuthorImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    await this.runStep('Step 1: Importing authors', result, () => this.importAuthors());
    await this.runStep('Step 2: Importing author CVs', result, () => this.importAuthorCvs());
    await this.runStep('Step 3: Resolving author-item assignments', result, () =>
      this.importAuthorItemAssignments()
    );
    await this.runStep('Step 4: Resolving author-dynasty assignments', result, () =>
      this.importAuthorDynastyAssignments()
    );

    this.showSummary(result.imported, result.skipped, result.errors.length);

    result.success = result.errors.length === 0;
    return result;
  }

  /**
   * Run one step, folding its counters into the overall result.
   *
   * A step that throws before its own loop — a malformed query, say — used to
   * land in a single catch around all four steps, which pushed one unnamed
   * entry onto result.errors and logged nothing. The run then reported "1
   * errors" with no [ERROR] line and no indication of which step died. Failures
   * are now named and logged, and one broken step no longer skips the rest.
   */
  private async runStep(
    label: string,
    result: ImportResult,
    step: () => Promise<ImportResult>
  ): Promise<void> {
    this.logInfo(`--- ${label} ---`);
    try {
      const stepResult = await step();
      result.imported += stepResult.imported;
      result.skipped += stepResult.skipped;
      result.errors.push(...stepResult.errors);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`${label} failed: ${message}`);
      this.logError(label, message);
      this.showError();
    }
  }

  // ===========================================================================
  // Step 1: Import Authors
  // ===========================================================================

  private async importAuthors(): Promise<ImportResult> {
    const result = this.createResult();

    // Load the all_authors bridge tables for cross-schema dedup
    const mwnf3Mappings = await this.context.legacyDb.query<LegacyAllAuthorMapping>(
      'SELECT author_id, all_author_id FROM mwnf3.authors_mwnf3_authors'
    );
    const shMappings = await this.context.legacyDb.query<LegacyAllAuthorMapping>(
      'SELECT author_id, all_author_id FROM mwnf3.authors_sh_authors'
    );
    const thgMappings = await this.context.legacyDb.query<LegacyAllAuthorMapping>(
      'SELECT author_id, all_author_id FROM mwnf3.authors_thg_authors'
    );

    // Build reverse maps: all_author_id → first mwnf3 author_id (canonical)
    const allToMwnf3 = new Map<number, number>();
    for (const m of mwnf3Mappings) {
      if (!allToMwnf3.has(m.all_author_id)) {
        allToMwnf3.set(m.all_author_id, m.author_id);
      }
    }

    // Build SH author_id → all_author_id map
    const shToAll = new Map<number, number>();
    for (const m of shMappings) {
      shToAll.set(m.author_id, m.all_author_id);
    }

    // Build THG author_id → all_author_id map
    const thgToAll = new Map<number, number>();
    for (const m of thgMappings) {
      thgToAll.set(m.author_id, m.all_author_id);
    }

    // 1a. Import mwnf3.authors (primary source)
    const mwnf3Authors = await this.context.legacyDb.query<LegacyAuthor>(
      'SELECT * FROM mwnf3.authors ORDER BY author_id'
    );
    this.logInfo(`Found ${mwnf3Authors.length} mwnf3 authors`);

    for (const legacy of mwnf3Authors) {
      try {
        const transformed = transformAuthor(legacy, 'mwnf3', 'authors');

        if (await this.entityExistsAsync(transformed.backwardCompatibility, 'author')) {
          result.skipped++;
          this.showSkipped();
          continue;
        }

        this.collectSample('author', legacy as unknown as Record<string, unknown>, 'success');

        if (this.isDryRun || this.isSampleOnlyMode) {
          this.registerEntity(
            'sample-author-mwnf3-' + legacy.author_id,
            transformed.backwardCompatibility,
            'author'
          );
          result.imported++;
          this.showProgress();
          continue;
        }

        const authorId = await this.context.strategy.writeAuthor(transformed.data);
        this.registerEntity(authorId, transformed.backwardCompatibility, 'author');
        result.imported++;
        this.showProgress();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`mwnf3 author ${legacy.author_id}: ${message}`);
        this.logError(`mwnf3 author ${legacy.author_id}`, message);
        this.showError();
      }
    }

    // 1b. Import sh_authors (with dedup via all_authors bridge)
    const shAuthors = await this.context.legacyDb.query<LegacyAuthor>(
      'SELECT * FROM mwnf3_sharing_history.sh_authors ORDER BY author_id'
    );
    this.logInfo(`Found ${shAuthors.length} SH authors`);

    for (const legacy of shAuthors) {
      try {
        // Check if this SH author maps to an existing mwnf3 author via bridge
        const allAuthorId = shToAll.get(legacy.author_id);
        if (allAuthorId !== undefined) {
          const mwnf3AuthorId = allToMwnf3.get(allAuthorId);
          if (mwnf3AuthorId !== undefined) {
            // This SH author is the same person as mwnf3 author — register alias
            const mwnf3BackwardCompat = `mwnf3:authors:${mwnf3AuthorId}`;
            const existingUuid = await this.getEntityUuidAsync(mwnf3BackwardCompat, 'author');
            if (existingUuid) {
              // Register the SH backward_compatibility as an alias pointing to the same UUID
              const shBackwardCompat = `mwnf3_sharing_history:sh_authors:${legacy.author_id}`;
              this.registerEntity(existingUuid, shBackwardCompat, 'author');
              result.skipped++;
              this.showSkipped();
              continue;
            }
          }
        }

        const transformed = transformAuthor(legacy, 'mwnf3_sharing_history', 'sh_authors');

        if (await this.entityExistsAsync(transformed.backwardCompatibility, 'author')) {
          result.skipped++;
          this.showSkipped();
          continue;
        }

        this.collectSample('author', legacy as unknown as Record<string, unknown>, 'success');

        if (this.isDryRun || this.isSampleOnlyMode) {
          this.registerEntity(
            'sample-author-sh-' + legacy.author_id,
            transformed.backwardCompatibility,
            'author'
          );
          result.imported++;
          this.showProgress();
          continue;
        }

        const authorId = await this.context.strategy.writeAuthor(transformed.data);
        this.registerEntity(authorId, transformed.backwardCompatibility, 'author');
        result.imported++;
        this.showProgress();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`SH author ${legacy.author_id}: ${message}`);
        this.logError(`SH author ${legacy.author_id}`, message);
        this.showError();
      }
    }

    // 1c. Import thg_authors (with dedup via all_authors bridge)
    const thgAuthors = await this.context.legacyDb.query<LegacyAuthor>(
      'SELECT * FROM mwnf3_thematic_gallery.thg_authors ORDER BY author_id'
    );
    this.logInfo(`Found ${thgAuthors.length} THG authors`);

    for (const legacy of thgAuthors) {
      try {
        const allAuthorId = thgToAll.get(legacy.author_id);
        if (allAuthorId !== undefined) {
          const mwnf3AuthorId = allToMwnf3.get(allAuthorId);
          if (mwnf3AuthorId !== undefined) {
            const mwnf3BackwardCompat = `mwnf3:authors:${mwnf3AuthorId}`;
            const existingUuid = await this.getEntityUuidAsync(mwnf3BackwardCompat, 'author');
            if (existingUuid) {
              const thgBackwardCompat = `mwnf3_thematic_gallery:thg_authors:${legacy.author_id}`;
              this.registerEntity(existingUuid, thgBackwardCompat, 'author');
              result.skipped++;
              this.showSkipped();
              continue;
            }
          }
        }

        const transformed = transformAuthor(legacy, 'mwnf3_thematic_gallery', 'thg_authors');

        if (await this.entityExistsAsync(transformed.backwardCompatibility, 'author')) {
          result.skipped++;
          this.showSkipped();
          continue;
        }

        if (this.isDryRun || this.isSampleOnlyMode) {
          this.registerEntity(
            'sample-author-thg-' + legacy.author_id,
            transformed.backwardCompatibility,
            'author'
          );
          result.imported++;
          this.showProgress();
          continue;
        }

        const authorId = await this.context.strategy.writeAuthor(transformed.data);
        this.registerEntity(authorId, transformed.backwardCompatibility, 'author');
        result.imported++;
        this.showProgress();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`THG author ${legacy.author_id}: ${message}`);
        this.logError(`THG author ${legacy.author_id}`, message);
        this.showError();
      }
    }

    return result;
  }

  // ===========================================================================
  // Step 2: Import Author CVs (Translations)
  // ===========================================================================

  private async importAuthorCvs(): Promise<ImportResult> {
    const result = this.createResult();

    // 2a. Import mwnf3 CVs
    const mwnf3Cvs = await this.context.legacyDb.query<LegacyAuthorCv>(
      'SELECT * FROM mwnf3.authors_cv ORDER BY author_id, project_id, lang_id'
    );
    this.logInfo(`Found ${mwnf3Cvs.length} mwnf3 author CVs`);

    for (const legacy of mwnf3Cvs) {
      try {
        const transformed = transformAuthorCv(legacy, 'mwnf3');

        // Resolve author UUID
        const authorBackwardCompat = `mwnf3:authors:${legacy.author_id}`;
        const authorId = await this.getEntityUuidAsync(authorBackwardCompat, 'author');
        if (!authorId) {
          this.logWarning(`Author not found for backward_compatibility: ${authorBackwardCompat}`);
          result.skipped++;
          this.showSkipped();
          continue;
        }

        // Resolve language
        const languageId = await this.getLanguageIdByLegacyCodeAsync(legacy.lang_id);
        if (!languageId) {
          this.logWarning(
            `Unknown language code '${legacy.lang_id}' for author CV ${legacy.author_id}`
          );
          result.skipped++;
          this.showSkipped();
          continue;
        }

        // Resolve context from project_id
        const projectBackwardCompat = `mwnf3:projects:${legacy.project_id}`;
        const contextId = await this.getContextIdForProjectAsync(projectBackwardCompat);
        if (!contextId) {
          // Fall back to default context
          const defaultContextId = await this.getDefaultContextIdAsync();
          if (!defaultContextId) {
            this.logWarning(
              `No default context available for author CV ${legacy.author_id}:${legacy.project_id}`
            );
            result.skipped++;
            this.showSkipped();
            continue;
          }
          // Use default context
          if (this.isDryRun || this.isSampleOnlyMode) {
            result.imported++;
            this.showProgress();
            continue;
          }

          await this.context.strategy.writeAuthorTranslation({
            ...transformed.data,
            author_id: authorId,
            language_id: languageId,
            context_id: defaultContextId,
          });
          result.imported++;
          this.showProgress();
          continue;
        }

        if (this.isDryRun || this.isSampleOnlyMode) {
          result.imported++;
          this.showProgress();
          continue;
        }

        await this.context.strategy.writeAuthorTranslation({
          ...transformed.data,
          author_id: authorId,
          language_id: languageId,
          context_id: contextId,
        });
        result.imported++;
        this.showProgress();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('Duplicate')) {
          this.logSkip(`mwnf3 author CV ${legacy.author_id}: duplicate, skipping`);
          result.skipped++;
          this.showSkipped();
        } else {
          result.errors.push(
            `mwnf3 author CV ${legacy.author_id}:${legacy.project_id}:${legacy.lang_id}: ${message}`
          );
          this.logError(`mwnf3 author CV ${legacy.author_id}`, message);
          this.showError();
        }
      }
    }

    // 2b. Import SH CVs
    const shCvs = await this.context.legacyDb.query<LegacyShAuthorCv>(
      'SELECT * FROM mwnf3_sharing_history.sh_authors_cv ORDER BY author_id, project_id, lang'
    );
    this.logInfo(`Found ${shCvs.length} SH author CVs`);

    for (const legacy of shCvs) {
      try {
        const transformed = transformShAuthorCv(legacy);

        // Resolve author UUID (try SH backward_compatibility first, then via bridge)
        const shBackwardCompat = `mwnf3_sharing_history:sh_authors:${legacy.author_id}`;
        const authorId = await this.getEntityUuidAsync(shBackwardCompat, 'author');
        if (!authorId) {
          // May have been deduplicated to mwnf3 author
          this.logWarning(`SH Author not found for backward_compatibility: ${shBackwardCompat}`);
          result.skipped++;
          this.showSkipped();
          continue;
        }

        const languageId = await this.getLanguageIdByLegacyCodeAsync(legacy.lang);
        if (!languageId) {
          this.logWarning(
            `Unknown language code '${legacy.lang}' for SH author CV ${legacy.author_id}`
          );
          result.skipped++;
          this.showSkipped();
          continue;
        }

        const projectBackwardCompat = `mwnf3_sharing_history:sh_projects:${legacy.project_id}`;
        let contextId = await this.getContextIdForProjectAsync(projectBackwardCompat);
        if (!contextId) {
          contextId = await this.getDefaultContextIdAsync();
        }
        if (!contextId) {
          result.skipped++;
          this.showSkipped();
          continue;
        }

        if (this.isDryRun || this.isSampleOnlyMode) {
          result.imported++;
          this.showProgress();
          continue;
        }

        await this.context.strategy.writeAuthorTranslation({
          ...transformed.data,
          author_id: authorId,
          language_id: languageId,
          context_id: contextId,
        });
        result.imported++;
        this.showProgress();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('Duplicate')) {
          this.logSkip(`SH author CV ${legacy.author_id}: duplicate, skipping`);
          result.skipped++;
          this.showSkipped();
        } else {
          result.errors.push(`SH author CV ${legacy.author_id}: ${message}`);
          this.logError(`SH author CV ${legacy.author_id}`, message);
          this.showError();
        }
      }
    }

    return result;
  }

  // ===========================================================================
  // Step 3: Author-Item Assignments (junction table resolution)
  // ===========================================================================

  private async importAuthorItemAssignments(): Promise<ImportResult> {
    const result = this.createResult();
    this.creditedTargets.clear();
    this.creditLists.clear();

    // Legacy resolves credits per (item, language, role) ordered by priority
    // (see .legacy-code/dxa-api/app/MWNF/SQL/mwnf3/ObjectsAuthors.blade.php:
    // ORDER BY NVL(priority, 0) ASC) and prints every one of them. The role's
    // FK column on item_translations takes the lowest-priority author; ties
    // break on author_id, which matches the junction PK order legacy falls
    // back to.
    const ORDER_BY_PRIORITY = 'ORDER BY IFNULL(priority, 0) ASC, author_id ASC';

    // 3a. mwnf3.authors_objects
    const authorObjects = await this.context.legacyDb.query<LegacyAuthorObject>(
      `SELECT * FROM mwnf3.authors_objects ${ORDER_BY_PRIORITY}`
    );
    this.logInfo(`Found ${authorObjects.length} mwnf3 author-object assignments`);

    for (const link of authorObjects) {
      try {
        await this.resolveAuthorItemAssignment(
          link.author_id,
          link.type,
          link.lang_id,
          `mwnf3:authors:${link.author_id}`,
          `mwnf3:objects:${link.project_id}:${link.country_id}:${link.museum_id}:${link.object_id}`,
          result
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`author-object ${link.author_id}: ${message}`);
        this.showError();
      }
    }

    // 3b. mwnf3.authors_monuments
    const authorMonuments = await this.context.legacyDb.query<LegacyAuthorMonument>(
      `SELECT * FROM mwnf3.authors_monuments ${ORDER_BY_PRIORITY}`
    );
    this.logInfo(`Found ${authorMonuments.length} mwnf3 author-monument assignments`);

    for (const link of authorMonuments) {
      try {
        await this.resolveAuthorItemAssignment(
          link.author_id,
          link.type,
          link.lang_id,
          `mwnf3:authors:${link.author_id}`,
          `mwnf3:monuments:${link.project_id}:${link.country_id}:${link.institution_id}:${link.monument_id}`,
          result
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`author-monument ${link.author_id}: ${message}`);
        this.showError();
      }
    }

    // 3c. sh_authors_objects
    const shAuthorObjects = await this.context.legacyDb.query<LegacyShAuthorObject>(
      `SELECT * FROM mwnf3_sharing_history.sh_authors_objects ${ORDER_BY_PRIORITY}`
    );
    this.logInfo(`Found ${shAuthorObjects.length} SH author-object assignments`);

    for (const link of shAuthorObjects) {
      try {
        // SH items are keyed project:country:number (no museum segment, unlike
        // mwnf3), with the project id lowercased ('AWE' in legacy → 'awe').
        await this.resolveAuthorItemAssignment(
          link.author_id,
          link.type,
          link.lang,
          `mwnf3_sharing_history:sh_authors:${link.author_id}`,
          `mwnf3_sharing_history:sh_objects:${link.project_id.toLowerCase()}:${link.country.toLowerCase()}:${link.number}`,
          result
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`SH author-object ${link.author_id}: ${message}`);
        this.showError();
      }
    }

    // 3d. sh_authors_monuments
    const shAuthorMonuments = await this.context.legacyDb.query<LegacyShAuthorMonument>(
      `SELECT * FROM mwnf3_sharing_history.sh_authors_monuments ${ORDER_BY_PRIORITY}`
    );
    this.logInfo(`Found ${shAuthorMonuments.length} SH author-monument assignments`);

    for (const link of shAuthorMonuments) {
      try {
        await this.resolveAuthorItemAssignment(
          link.author_id,
          link.type,
          link.lang,
          `mwnf3_sharing_history:sh_authors:${link.author_id}`,
          `mwnf3_sharing_history:sh_monuments:${link.project_id.toLowerCase()}:${link.country.toLowerCase()}:${link.number}`,
          result
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`SH author-monument ${link.author_id}: ${message}`);
        this.showError();
      }
    }

    await this.writeCreditLists(result);

    return result;
  }

  /**
   * Write every (item, language, role) credit list collected from the
   * junctions, replacing the single free-text credit the item importers left.
   */
  private async writeCreditLists(result: ImportResult): Promise<void> {
    if (this.isDryRun || this.isSampleOnlyMode) return;

    for (const credit of this.creditLists.values()) {
      try {
        await this.context.strategy.replaceItemTranslationCredits(
          credit.itemId,
          credit.languageId,
          credit.fkColumn,
          credit.authorIds
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(
          `credits ${credit.fkColumn} for item ${credit.itemId} (${credit.languageId}): ${message}`
        );
        this.showError();
      }
    }
  }

  /**
   * Resolve a single author-item assignment by updating the appropriate FK
   * on the item_translations row.
   */
  private async resolveAuthorItemAssignment(
    legacyAuthorId: number,
    role: string,
    legacyLangCode: string,
    authorBackwardCompat: string,
    itemBackwardCompat: string,
    result: ImportResult
  ): Promise<void> {
    const fkColumn = ROLE_FK_MAP[role];
    if (!fkColumn) {
      this.logWarning(`Unknown author role type '${role}' for author ${legacyAuthorId}`);
      result.skipped++;
      this.showSkipped();
      return;
    }

    const authorId = await this.getEntityUuidAsync(authorBackwardCompat, 'author');
    if (!authorId) {
      result.skipped++;
      this.showSkipped();
      return;
    }

    const itemId = await this.getEntityUuidAsync(itemBackwardCompat, 'item');
    if (!itemId) {
      result.skipped++;
      this.showSkipped();
      return;
    }

    const languageId = await this.getLanguageIdByLegacyCodeAsync(legacyLangCode);
    if (!languageId) {
      result.skipped++;
      this.showSkipped();
      return;
    }

    const target = `${itemId}|${languageId}|${fkColumn}`;
    const credit = this.creditLists.get(target);
    if (!credit) {
      this.creditLists.set(target, { itemId, languageId, fkColumn, authorIds: [authorId] });
    } else if (!credit.authorIds.includes(authorId)) {
      credit.authorIds.push(authorId);
    }

    // The role's FK column holds the first person only; later rows are
    // credited through the list above.
    if (this.creditedTargets.has(target)) {
      result.imported++;
      this.showProgress();
      return;
    }

    if (this.isDryRun || this.isSampleOnlyMode) {
      this.creditedTargets.add(target);
      result.imported++;
      this.showProgress();
      return;
    }

    // Update the item_translations rows to set the author FK. The junction is
    // authoritative, so this replaces any credit derived from the free text.
    try {
      await this.context.strategy.updateItemTranslationAuthorFk(
        itemId,
        languageId,
        fkColumn,
        authorId,
        true
      );
      this.creditedTargets.add(target);
      result.imported++;
      this.showProgress();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logWarning(
        `Failed to update item_translation ${fkColumn} for item ${itemId}: ${message}`
      );
      result.skipped++;
      this.showSkipped();
    }
  }

  // ===========================================================================
  // Step 4: Author-Dynasty Assignments
  // ===========================================================================

  private async importAuthorDynastyAssignments(): Promise<ImportResult> {
    const result = this.createResult();
    this.creditedTargets.clear();

    const authorDynasties = await this.context.legacyDb.query<LegacyAuthorDynasty>(
      // authors_dynasties has no priority column — unlike authors_objects and
      // authors_monuments it is keyed (dynasty_id, lang_id, author_id, type)
      // only, so there is no per-credit ordering to preserve here.
      'SELECT * FROM mwnf3.authors_dynasties ORDER BY dynasty_id, author_id'
    );
    this.logInfo(`Found ${authorDynasties.length} author-dynasty assignments`);

    for (const link of authorDynasties) {
      try {
        const fkColumn = ROLE_FK_MAP[link.type];
        if (!fkColumn) {
          this.logWarning(`Unknown author role type '${link.type}' for dynasty ${link.dynasty_id}`);
          result.skipped++;
          this.showSkipped();
          continue;
        }

        const authorBackwardCompat = `mwnf3:authors:${link.author_id}`;
        const authorId = await this.getEntityUuidAsync(authorBackwardCompat, 'author');
        if (!authorId) {
          result.skipped++;
          this.showSkipped();
          continue;
        }

        const dynastyBackwardCompat = `mwnf3:dynasties:${link.dynasty_id}`;
        const dynastyId = await this.getEntityUuidAsync(dynastyBackwardCompat, 'dynasty');
        if (!dynastyId) {
          result.skipped++;
          this.showSkipped();
          continue;
        }

        const languageId = await this.getLanguageIdByLegacyCodeAsync(link.lang_id);
        if (!languageId) {
          result.skipped++;
          this.showSkipped();
          continue;
        }

        const target = `${dynastyId}|${languageId}|${fkColumn}`;
        if (this.creditedTargets.has(target)) {
          result.skipped++;
          this.showSkipped();
          continue;
        }

        if (this.isDryRun || this.isSampleOnlyMode) {
          this.creditedTargets.add(target);
          result.imported++;
          this.showProgress();
          continue;
        }

        // Update the dynasty_translations rows to set the author FK.
        try {
          await this.context.strategy.updateDynastyTranslationAuthorFk(
            dynastyId,
            languageId,
            fkColumn,
            authorId,
            true
          );
          this.creditedTargets.add(target);
          result.imported++;
          this.showProgress();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logWarning(
            `Failed to update dynasty_translation ${fkColumn} for dynasty ${dynastyId}: ${message}`
          );
          result.skipped++;
          this.showSkipped();
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`author-dynasty ${link.dynasty_id}: ${message}`);
        this.showError();
      }
    }

    return result;
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  /**
   * Resolve a context ID from a project's backward_compatibility.
   * In the importer, project backward_compatibility is shared with context
   * (tracker composite key differentiates by entityType).
   */
  private async getContextIdForProjectAsync(projectBackwardCompat: string): Promise<string | null> {
    return this.getEntityUuidAsync(projectBackwardCompat, 'context');
  }
}
