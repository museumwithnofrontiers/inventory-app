/**
 * SH Exhibition Item Importer
 *
 * Links items to SH exhibition/theme/subtheme collections via the collection_item pivot.
 * Imports both formal item assignments (rel_* tables) and slideshow image references.
 *
 * Formal item assignments (with optional justification texts):
 * - rel_objects_exhibitions + rel_objects_exhibitions_justification
 * - rel_monuments_exhibitions + rel_monuments_exhibitions_justification
 * - rel_objects_themes
 * - rel_monuments_themes
 * - rel_objects_subthemes
 * - rel_monuments_subthemes
 *
 * Exhibition image references (item references used as slideshow images):
 * - sh_exhibition_images (exhibition level)
 * - sh_exhibition_theme_images (theme level)
 * - sh_exhibition_subtheme_images (subtheme level)
 *
 * Note: Image tables encode item references as 'project_id;country;number' with item_type
 * ('obj' or 'mon'). A theme or subtheme image row places the picture item of the picture it
 * shows (its `picture` path), with display_order from sort_order and extra `n` (sort_order)
 * and, for a subtheme, `n2` (rel_sort_order: the views sharing a position).
 *
 * For rel_* tables at the exhibition level, justification texts (partner + curator, per language)
 * are merged into pivot extra.justifications.
 *
 * Dependencies:
 * - ShExhibitionImporter (must run first to create exhibition/theme/subtheme collections)
 * - ShObjectImporter, ShMonumentImporter (must run first to create items)
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';
import type {
  ShLegacyRelObjectsExhibitions,
  ShLegacyRelObjectsExhibitionsJustification,
  ShLegacyRelMonumentsExhibitions,
  ShLegacyRelMonumentsExhibitionsJustification,
  ShLegacyRelObjectsThemes,
  ShLegacyRelMonumentsThemes,
  ShLegacyRelObjectsSubthemes,
  ShLegacyRelMonumentsSubthemes,
  ShLegacyExhibitionImage,
  ShLegacyExhibitionThemeImage,
  ShLegacyExhibitionSubthemeImage,
} from '../../domain/types/index.js';
import { formatShBackwardCompatibility } from '../../domain/transformers/index.js';

const SH_SCHEMA = 'mwnf3_sharing_history';

export class ShExhibitionItemImporter extends BaseImporter {
  getName(): string {
    return 'ShExhibitionItemImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      this.logInfo('Importing SH exhibition item assignments and images...');

      // ========================================================================
      // Step 1: Import rel_objects_exhibitions + justifications
      // ========================================================================
      await this.importRelObjectsExhibitions(result);

      // ========================================================================
      // Step 2: Import rel_monuments_exhibitions + justifications
      // ========================================================================
      await this.importRelMonumentsExhibitions(result);

      // ========================================================================
      // Step 3: Import rel_objects_themes
      // ========================================================================
      await this.importRelObjectsThemes(result);

      // ========================================================================
      // Step 4: Import rel_monuments_themes
      // ========================================================================
      await this.importRelMonumentsThemes(result);

      // ========================================================================
      // Step 5: Import rel_objects_subthemes
      // ========================================================================
      await this.importRelObjectsSubthemes(result);

      // ========================================================================
      // Step 6: Import rel_monuments_subthemes
      // ========================================================================
      await this.importRelMonumentsSubthemes(result);

      // ========================================================================
      // Step 7: Import exhibition images (item references)
      // ========================================================================
      await this.importExhibitionImages(result);

      // ========================================================================
      // Step 8: Import theme images (item references)
      // ========================================================================
      await this.importThemeImages(result);

      // ========================================================================
      // Step 9: Import subtheme images (item references)
      // ========================================================================
      await this.importSubthemeImages(result);

      this.showSummary(result.imported, result.skipped, result.errors.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.success = false;
      result.errors.push(message);
      this.logError('ShExhibitionItemImporter', message);
    }

    return result;
  }

  // --------------------------------------------------------------------------
  // rel_objects_exhibitions + justifications
  // --------------------------------------------------------------------------
  private async importRelObjectsExhibitions(result: ImportResult): Promise<void> {
    const rows = await this.context.legacyDb.query<ShLegacyRelObjectsExhibitions>(
      `SELECT id, project_id, country, number, exhibition_id, curator_status
       FROM ${SH_SCHEMA}.rel_objects_exhibitions
       ORDER BY exhibition_id, id`
    );

    // Load justifications and group by relation_id
    const justRows = await this.context.legacyDb.query<ShLegacyRelObjectsExhibitionsJustification>(
      `SELECT relation_id, lang, justification_partner, justification_curator
       FROM ${SH_SCHEMA}.rel_objects_exhibitions_justification
       ORDER BY relation_id, lang`
    );
    const justMap = this.groupJustifications(justRows);

    this.logInfo(
      `Found ${rows.length} object-exhibition assignments (${justRows.length} justifications)`
    );

    for (const legacy of rows) {
      try {
        const itemBackwardCompat = `${SH_SCHEMA}:sh_objects:${legacy.project_id.toLowerCase()}:${legacy.country.toLowerCase()}:${legacy.number}`;
        const collectionBackwardCompat = `${SH_SCHEMA}:sh_exhibitions:${legacy.exhibition_id}`;

        const written = await this.writeCollectionItemPivot(
          result,
          collectionBackwardCompat,
          itemBackwardCompat,
          `rel_objects_exhibitions ${legacy.id}`,
          null,
          this.buildJustificationExtra(justMap.get(legacy.id))
        );

        if (written) {
          this.collectSample(
            'sh_rel_objects_exhibitions',
            legacy as unknown as Record<string, unknown>,
            'success'
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`rel_objects_exhibitions ${legacy.id}: ${message}`);
        this.logError(`rel_objects_exhibitions ${legacy.id}`, message);
        this.showError();
      }
    }
  }

  // --------------------------------------------------------------------------
  // rel_monuments_exhibitions + justifications
  // --------------------------------------------------------------------------
  private async importRelMonumentsExhibitions(result: ImportResult): Promise<void> {
    const rows = await this.context.legacyDb.query<ShLegacyRelMonumentsExhibitions>(
      `SELECT id, project_id, country, number, exhibition_id, curator_status
       FROM ${SH_SCHEMA}.rel_monuments_exhibitions
       ORDER BY exhibition_id, id`
    );

    const justRows =
      await this.context.legacyDb.query<ShLegacyRelMonumentsExhibitionsJustification>(
        `SELECT relation_id, lang, justification_partner, justification_curator
         FROM ${SH_SCHEMA}.rel_monuments_exhibitions_justification
         ORDER BY relation_id, lang`
      );
    const justMap = this.groupJustifications(justRows);

    this.logInfo(
      `Found ${rows.length} monument-exhibition assignments (${justRows.length} justifications)`
    );

    for (const legacy of rows) {
      try {
        const itemBackwardCompat = `${SH_SCHEMA}:sh_monuments:${legacy.project_id.toLowerCase()}:${legacy.country.toLowerCase()}:${legacy.number}`;
        const collectionBackwardCompat = `${SH_SCHEMA}:sh_exhibitions:${legacy.exhibition_id}`;

        const written = await this.writeCollectionItemPivot(
          result,
          collectionBackwardCompat,
          itemBackwardCompat,
          `rel_monuments_exhibitions ${legacy.id}`,
          null,
          this.buildJustificationExtra(justMap.get(legacy.id))
        );

        if (written) {
          this.collectSample(
            'sh_rel_monuments_exhibitions',
            legacy as unknown as Record<string, unknown>,
            'success'
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`rel_monuments_exhibitions ${legacy.id}: ${message}`);
        this.logError(`rel_monuments_exhibitions ${legacy.id}`, message);
        this.showError();
      }
    }
  }

  // --------------------------------------------------------------------------
  // rel_objects_themes
  // --------------------------------------------------------------------------
  private async importRelObjectsThemes(result: ImportResult): Promise<void> {
    const rows = await this.context.legacyDb.query<ShLegacyRelObjectsThemes>(
      `SELECT id, project_id, country, number, theme_id, curator_status
       FROM ${SH_SCHEMA}.rel_objects_themes
       ORDER BY theme_id, id`
    );

    this.logInfo(`Found ${rows.length} object-theme assignments`);

    for (const legacy of rows) {
      try {
        const itemBackwardCompat = `${SH_SCHEMA}:sh_objects:${legacy.project_id.toLowerCase()}:${legacy.country.toLowerCase()}:${legacy.number}`;
        const collectionBackwardCompat = `${SH_SCHEMA}:sh_exhibition_themes:${legacy.theme_id}`;

        const written = await this.writeCollectionItemPivot(
          result,
          collectionBackwardCompat,
          itemBackwardCompat,
          `rel_objects_themes ${legacy.id}`,
          null,
          null
        );

        if (written) {
          this.collectSample(
            'sh_rel_objects_themes',
            legacy as unknown as Record<string, unknown>,
            'success'
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`rel_objects_themes ${legacy.id}: ${message}`);
        this.logError(`rel_objects_themes ${legacy.id}`, message);
        this.showError();
      }
    }
  }

  // --------------------------------------------------------------------------
  // rel_monuments_themes
  // --------------------------------------------------------------------------
  private async importRelMonumentsThemes(result: ImportResult): Promise<void> {
    const rows = await this.context.legacyDb.query<ShLegacyRelMonumentsThemes>(
      `SELECT id, project_id, country, number, theme_id, curator_status
       FROM ${SH_SCHEMA}.rel_monuments_themes
       ORDER BY theme_id, id`
    );

    this.logInfo(`Found ${rows.length} monument-theme assignments`);

    for (const legacy of rows) {
      try {
        const itemBackwardCompat = `${SH_SCHEMA}:sh_monuments:${legacy.project_id.toLowerCase()}:${legacy.country.toLowerCase()}:${legacy.number}`;
        const collectionBackwardCompat = `${SH_SCHEMA}:sh_exhibition_themes:${legacy.theme_id}`;

        const written = await this.writeCollectionItemPivot(
          result,
          collectionBackwardCompat,
          itemBackwardCompat,
          `rel_monuments_themes ${legacy.id}`,
          null,
          null
        );

        if (written) {
          this.collectSample(
            'sh_rel_monuments_themes',
            legacy as unknown as Record<string, unknown>,
            'success'
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`rel_monuments_themes ${legacy.id}: ${message}`);
        this.logError(`rel_monuments_themes ${legacy.id}`, message);
        this.showError();
      }
    }
  }

  // --------------------------------------------------------------------------
  // rel_objects_subthemes
  // --------------------------------------------------------------------------
  private async importRelObjectsSubthemes(result: ImportResult): Promise<void> {
    const rows = await this.context.legacyDb.query<ShLegacyRelObjectsSubthemes>(
      `SELECT id, project_id, country, number, subtheme_id, curator_status, sort_order, rel_sort_order
       FROM ${SH_SCHEMA}.rel_objects_subthemes
       ORDER BY subtheme_id, sort_order, id`
    );

    this.logInfo(`Found ${rows.length} object-subtheme assignments`);

    for (const legacy of rows) {
      try {
        const itemBackwardCompat = `${SH_SCHEMA}:sh_objects:${legacy.project_id.toLowerCase()}:${legacy.country.toLowerCase()}:${legacy.number}`;
        const collectionBackwardCompat = `${SH_SCHEMA}:sh_exhibition_subthemes:${legacy.subtheme_id}`;

        const written = await this.writeCollectionItemPivot(
          result,
          collectionBackwardCompat,
          itemBackwardCompat,
          `rel_objects_subthemes ${legacy.id}`,
          legacy.sort_order,
          null
        );

        if (written) {
          this.collectSample(
            'sh_rel_objects_subthemes',
            legacy as unknown as Record<string, unknown>,
            'success'
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`rel_objects_subthemes ${legacy.id}: ${message}`);
        this.logError(`rel_objects_subthemes ${legacy.id}`, message);
        this.showError();
      }
    }
  }

  // --------------------------------------------------------------------------
  // rel_monuments_subthemes
  // --------------------------------------------------------------------------
  private async importRelMonumentsSubthemes(result: ImportResult): Promise<void> {
    const rows = await this.context.legacyDb.query<ShLegacyRelMonumentsSubthemes>(
      `SELECT id, project_id, country, number, subtheme_id, curator_status, sort_order, rel_sort_order
       FROM ${SH_SCHEMA}.rel_monuments_subthemes
       ORDER BY subtheme_id, sort_order, id`
    );

    this.logInfo(`Found ${rows.length} monument-subtheme assignments`);

    for (const legacy of rows) {
      try {
        const itemBackwardCompat = `${SH_SCHEMA}:sh_monuments:${legacy.project_id.toLowerCase()}:${legacy.country.toLowerCase()}:${legacy.number}`;
        const collectionBackwardCompat = `${SH_SCHEMA}:sh_exhibition_subthemes:${legacy.subtheme_id}`;

        const written = await this.writeCollectionItemPivot(
          result,
          collectionBackwardCompat,
          itemBackwardCompat,
          `rel_monuments_subthemes ${legacy.id}`,
          legacy.sort_order,
          null
        );

        if (written) {
          this.collectSample(
            'sh_rel_monuments_subthemes',
            legacy as unknown as Record<string, unknown>,
            'success'
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`rel_monuments_subthemes ${legacy.id}: ${message}`);
        this.logError(`rel_monuments_subthemes ${legacy.id}`, message);
        this.showError();
      }
    }
  }

  // --------------------------------------------------------------------------
  // Exhibition images (item references at exhibition level)
  // --------------------------------------------------------------------------
  private async importExhibitionImages(result: ImportResult): Promise<void> {
    const rows = await this.context.legacyDb.query<ShLegacyExhibitionImage>(
      `SELECT image_id, exhibition_id, image_item, item_type, sort_order
       FROM ${SH_SCHEMA}.sh_exhibition_images
       ORDER BY exhibition_id, sort_order, image_id`
    );

    this.logInfo(`Found ${rows.length} exhibition image references`);

    for (const legacy of rows) {
      try {
        const collectionBackwardCompat = `${SH_SCHEMA}:sh_exhibitions:${legacy.exhibition_id}`;
        const itemBackwardCompat = this.resolveImageItemReference(
          legacy.image_item,
          legacy.item_type
        );
        if (!itemBackwardCompat) {
          result.warnings = result.warnings || [];
          result.warnings.push(
            `Exhibition image ${legacy.image_id}: Could not parse image_item '${legacy.image_item}'`
          );
          this.logWarning(
            `Exhibition image ${legacy.image_id}: Could not parse image_item '${legacy.image_item}', skipping`
          );
          result.skipped++;
          this.showSkipped();
          continue;
        }

        const written = await this.writeCollectionItemPivot(
          result,
          collectionBackwardCompat,
          itemBackwardCompat,
          `sh_exhibition_images ${legacy.image_id}`,
          legacy.sort_order,
          null
        );

        if (written) {
          this.collectSample(
            'sh_exhibition_image',
            legacy as unknown as Record<string, unknown>,
            'success'
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`Exhibition image ${legacy.image_id}: ${message}`);
        this.logError(`Exhibition image ${legacy.image_id}`, message);
        this.showError();
      }
    }
  }

  // --------------------------------------------------------------------------
  // Theme images (item references at theme level)
  // --------------------------------------------------------------------------
  private async importThemeImages(result: ImportResult): Promise<void> {
    const rows = await this.context.legacyDb.query<ShLegacyExhibitionThemeImage>(
      `SELECT image_id, theme_id, image_item, picture, item_type, sort_order
       FROM ${SH_SCHEMA}.sh_exhibition_theme_images
       ORDER BY theme_id, sort_order, image_id`
    );

    this.logInfo(`Found ${rows.length} theme image references`);

    for (const legacy of rows) {
      try {
        const collectionBackwardCompat = `${SH_SCHEMA}:sh_exhibition_themes:${legacy.theme_id}`;
        const itemBackwardCompat = this.resolveImageItemReference(
          legacy.image_item,
          legacy.item_type
        );
        if (!itemBackwardCompat) {
          result.warnings = result.warnings || [];
          result.warnings.push(
            `Theme image ${legacy.image_id}: Could not parse image_item '${legacy.image_item}'`
          );
          this.logWarning(
            `Theme image ${legacy.image_id}: Could not parse image_item '${legacy.image_item}', skipping`
          );
          result.skipped++;
          this.showSkipped();
          continue;
        }

        const written = await this.writeCollectionItemPivot(
          result,
          collectionBackwardCompat,
          await this.placedItemReference(
            legacy.picture,
            legacy.item_type,
            itemBackwardCompat,
            result,
            `Theme image ${legacy.image_id}`
          ),
          `sh_exhibition_theme_images ${legacy.image_id}`,
          legacy.sort_order,
          { n: legacy.sort_order }
        );

        if (written) {
          this.collectSample(
            'sh_exhibition_theme_image',
            legacy as unknown as Record<string, unknown>,
            'success'
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`Theme image ${legacy.image_id}: ${message}`);
        this.logError(`Theme image ${legacy.image_id}`, message);
        this.showError();
      }
    }
  }

  // --------------------------------------------------------------------------
  // Subtheme images (item references at subtheme level)
  // --------------------------------------------------------------------------
  private async importSubthemeImages(result: ImportResult): Promise<void> {
    const rows = await this.context.legacyDb.query<ShLegacyExhibitionSubthemeImage>(
      `SELECT image_id, subtheme_id, image_item, picture, item_type, sort_order, rel_sort_order
       FROM ${SH_SCHEMA}.sh_exhibition_subtheme_images
       ORDER BY subtheme_id, sort_order, image_id`
    );

    this.logInfo(`Found ${rows.length} subtheme image references`);

    for (const legacy of rows) {
      try {
        const collectionBackwardCompat = `${SH_SCHEMA}:sh_exhibition_subthemes:${legacy.subtheme_id}`;
        const itemBackwardCompat = this.resolveImageItemReference(
          legacy.image_item,
          legacy.item_type
        );
        if (!itemBackwardCompat) {
          result.warnings = result.warnings || [];
          result.warnings.push(
            `Subtheme image ${legacy.image_id}: Could not parse image_item '${legacy.image_item}'`
          );
          this.logWarning(
            `Subtheme image ${legacy.image_id}: Could not parse image_item '${legacy.image_item}', skipping`
          );
          result.skipped++;
          this.showSkipped();
          continue;
        }

        const written = await this.writeCollectionItemPivot(
          result,
          collectionBackwardCompat,
          await this.placedItemReference(
            legacy.picture,
            legacy.item_type,
            itemBackwardCompat,
            result,
            `Subtheme image ${legacy.image_id}`
          ),
          `sh_exhibition_subtheme_images ${legacy.image_id}`,
          legacy.sort_order,
          // The pictures sharing a position are its views, in rel_sort_order:
          // the first is the thumbnail, the others the item panel's "Related".
          { n: legacy.sort_order, n2: legacy.rel_sort_order ?? 1 }
        );

        if (written) {
          this.collectSample(
            'sh_exhibition_subtheme_image',
            legacy as unknown as Record<string, unknown>,
            'success'
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`Subtheme image ${legacy.image_id}: ${message}`);
        this.logError(`Subtheme image ${legacy.image_id}`, message);
        this.showError();
      }
    }
  }

  // ==========================================================================
  // Shared helpers
  // ==========================================================================

  /**
   * Resolve an image_item reference (format: 'project_id;country;number') to a backward_compatibility key.
   * Returns null if the reference cannot be parsed.
   */
  /** Legacy picture path (lowercase) → the backward_compatibility of its picture item. */
  private pictureItems: Map<string, string> | null = null;

  /**
   * The item a theme or subtheme image row places: the picture item of the
   * picture legacy shows (its `picture` path), as the mwnf3 exhibitions place
   * theirs; the record itself where no picture item has that path.
   */
  private async placedItemReference(
    picture: string | null,
    itemType: string,
    itemBackwardCompat: string,
    result: ImportResult,
    label: string
  ): Promise<string> {
    if (!this.pictureItems) {
      this.pictureItems = new Map();
      for (const [table, kind] of [
        ['sh_object_images', 'obj'],
        ['sh_monument_images', 'mon'],
      ] as const) {
        const rows = await this.context.legacyDb.query<{
          project_id: string;
          country: string;
          number: number;
          type: string | null;
          image_number: number;
          path: string;
        }>(
          `SELECT project_id, country, number, type, image_number, path FROM ${SH_SCHEMA}.${table}`
        );
        for (const row of rows) {
          if (!row.path) continue;
          this.pictureItems.set(
            `${kind} ${row.path.trim().toLowerCase()}`,
            formatShBackwardCompatibility(
              table,
              row.project_id,
              row.country,
              row.number,
              row.type || '_',
              row.image_number
            )
          );
        }
      }
    }
    const kind = itemType === 'mon' ? 'mon' : 'obj';
    const pictureBackwardCompat = picture
      ? this.pictureItems.get(`${kind} ${picture.trim().toLowerCase()}`)
      : undefined;
    if (pictureBackwardCompat && (await this.getEntityUuidAsync(pictureBackwardCompat, 'item'))) {
      return pictureBackwardCompat;
    }
    if (picture) {
      result.warnings = result.warnings || [];
      result.warnings.push(`${label}: no picture item for '${picture}', the record placed instead`);
    }
    return itemBackwardCompat;
  }

  private resolveImageItemReference(imageItem: string, itemType: string): string | null {
    if (!imageItem || !imageItem.trim()) return null;

    const parts = imageItem.split(';').map((s) => s.trim());
    if (parts.length < 3) return null;

    const [projectId, country, numberStr] = parts;
    const number = parseInt(numberStr, 10);
    if (isNaN(number)) return null;

    const table = itemType === 'mon' ? 'sh_monuments' : 'sh_objects';
    return `${SH_SCHEMA}:${table}:${projectId.toLowerCase()}:${country.toLowerCase()}:${number}`;
  }

  /**
   * Write a collection_item pivot entry. Handles resolution, duplicate checks, and dry-run mode.
   * Returns true if the pivot was written (or would be in dry-run), false if skipped.
   */
  private async writeCollectionItemPivot(
    result: ImportResult,
    collectionBackwardCompat: string,
    itemBackwardCompat: string,
    context: string,
    displayOrder: number | null,
    extra: Record<string, unknown> | null
  ): Promise<boolean> {
    const collectionId = await this.getEntityUuidAsync(collectionBackwardCompat, 'collection');
    if (!collectionId) {
      result.warnings = result.warnings || [];
      result.warnings.push(`${context}: Collection not found (${collectionBackwardCompat})`);
      this.logWarning(`${context}: Collection not found (${collectionBackwardCompat}), skipping`);
      result.skipped++;
      this.showSkipped();
      return false;
    }

    const itemId = await this.getEntityUuidAsync(itemBackwardCompat, 'item');
    if (!itemId) {
      result.warnings = result.warnings || [];
      result.warnings.push(`${context}: Item not found (${itemBackwardCompat})`);
      this.logWarning(`${context}: Item not found (${itemBackwardCompat}), skipping`);
      result.skipped++;
      this.showSkipped();
      return false;
    }

    if (this.isDryRun || this.isSampleOnlyMode) {
      this.logInfo(
        `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would link item to collection: ${context}`
      );
      result.imported++;
      this.showProgress();
      return true;
    }

    try {
      await this.context.strategy.writeCollectionItem({
        collection_id: collectionId,
        item_id: itemId,
        display_order: displayOrder,
        extra: extra,
      });
    } catch (error) {
      // Duplicate pivots are expected when an item appears in both rel_* and image tables
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('Duplicate') || message.includes('duplicate')) {
        this.logSkip(`${context}: Duplicate pivot entry (item already linked), skipping`);
        result.skipped++;
        return false;
      }
      throw error;
    }

    result.imported++;
    this.showProgress();
    return true;
  }

  /**
   * Group justification rows by relation_id, producing a Map for efficient lookup.
   */
  private groupJustifications(
    rows: Array<{
      relation_id: number;
      lang: string;
      justification_partner: string | null;
      justification_curator: string | null;
    }>
  ): Map<number, Array<{ lang: string; partner: string | null; curator: string | null }>> {
    const map = new Map<
      number,
      Array<{ lang: string; partner: string | null; curator: string | null }>
    >();
    for (const row of rows) {
      if (!map.has(row.relation_id)) {
        map.set(row.relation_id, []);
      }
      map.get(row.relation_id)!.push({
        lang: row.lang,
        partner: row.justification_partner,
        curator: row.justification_curator,
      });
    }
    return map;
  }

  /**
   * Build an `extra` object containing justification texts, or null if no justifications.
   */
  private buildJustificationExtra(
    justifications:
      Array<{ lang: string; partner: string | null; curator: string | null }> | undefined
  ): Record<string, unknown> | null {
    if (!justifications || justifications.length === 0) return null;

    // Filter out rows where both fields are empty
    const meaningful = justifications.filter((j) => j.partner || j.curator);
    if (meaningful.length === 0) return null;

    const justificationsByLang: Record<string, { partner: string | null; curator: string | null }> =
      {};
    for (const j of meaningful) {
      justificationsByLang[j.lang] = {
        partner: j.partner || null,
        curator: j.curator || null,
      };
    }

    return { justifications: justificationsByLang };
  }
}
