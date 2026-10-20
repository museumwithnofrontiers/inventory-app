/**
 * THG Gallery Importer
 *
 * Imports thg_gallery entries as Collection records (type='gallery' or 'exhibition').
 *
 * Collection type is resolved by joining:
 *   thg_gallery.project_id -> thg_projects.type_id -> thg_project_type.(is_gallery|is_exhibition)
 *
 * Validated against exhibition_i18n presence:
 *   - candidate gallery + exhibition_i18n rows present  → source-keyed error, skip
 *   - candidate exhibition + no exhibition_i18n rows     → source-keyed error, skip
 *
 * Legacy schema:
 * - mwnf3_thematic_gallery.thg_gallery
 * - mwnf3_thematic_gallery.thg_projects
 * - mwnf3_thematic_gallery.thg_project_type
 *
 * New schema:
 * - collections (id, type, context_id, language_id, parent_id, internal_name,
 *                backward_compatibility, extra)
 *
 * The gallery anchor is written to collections.extra.thg_gallery:
 *
 *   { "mwnf3_project_id": "DCA", "slug": "carpets",
 *     "host": "https://carpets.museumwnf.org",
 *     "i18n_group_id": 18, "i18n_common_group_id": 59 }
 *
 * These identify the gallery itself — its source project, its public URL and the
 * legacy UI-string groups a rebuilt site is seeded from — so they belong to the
 * collection, not to one of its language rows.
 *
 * Backward compatibility: mwnf3_thematic_gallery:thg_gallery:{gallery_id}
 *
 * Dependencies:
 * - ThgGalleryContextImporter (must run first)
 * - ThgRootCollectionsImporter (must run first to create parent collections)
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';

/**
 * Legacy thg_gallery structure
 */
interface LegacyThgGallery {
  gallery_id: number;
  project_id: string | null;
  name: string;
  link: string | null;
  sort_order: number;
  mwnf3_project_id: string | null;
  i18n_group_id: number | null;
  i18n_common_group_id: number | null;
}

/**
 * Per-gallery anchor stored on collections.extra.thg_gallery.
 */
interface ThgGalleryAnchor {
  mwnf3_project_id?: string;
  slug?: string;
  host?: string;
  i18n_group_id?: number;
  i18n_common_group_id?: number;
}

/**
 * Joined project type row
 */
interface LegacyProjectType {
  project_id: string;
  type_id: number;
  is_gallery: number;
  is_exhibition: number;
}

export class ThgGalleryImporter extends BaseImporter {
  private galleriesRootId: string | null = null;
  private exhibitionsRootId: string | null = null;
  /** Gallery IDs that have rows in exhibition_i18n */
  private exhibitionGalleryIds: Set<number> = new Set();
  /** project_id -> { is_gallery, is_exhibition } resolved from thg_projects + thg_project_type */
  private projectTypeMap: Map<string, { isGallery: boolean; isExhibition: boolean }> = new Map();
  /** gallery_id -> canonical public host from thg_gallery_url */
  private galleryHosts: Map<number, string> = new Map();

  getName(): string {
    return 'ThgGalleryImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      this.logInfo('Importing thematic galleries as collections...');

      // Get default language ID (use async for database fallback when starting from later phases)
      const defaultLanguageId = await this.getDefaultLanguageIdAsync();

      // Get root collection IDs for parent assignment
      this.galleriesRootId = await this.getEntityUuidAsync(
        'mwnf3_thematic_gallery:galleries_root',
        'collection'
      );
      this.exhibitionsRootId = await this.getEntityUuidAsync(
        'mwnf3_thematic_gallery:exhibitions_root',
        'collection'
      );

      if (!this.galleriesRootId || !this.exhibitionsRootId) {
        this.logWarning(
          'Root collections not found. Run ThgRootCollectionsImporter first for proper hierarchy.'
        );
      } else {
        this.logInfo(`Found Galleries root: ${this.galleriesRootId}`);
        this.logInfo(`Found Exhibitions root: ${this.exhibitionsRootId}`);
      }

      // Load project types via thg_projects JOIN thg_project_type
      await this.loadProjectTypeMap();

      // Load the canonical public host of each gallery
      await this.loadGalleryHosts();

      // Pre-load exhibition gallery IDs from exhibition_i18n presence
      const exhibitionRows = await this.context.legacyDb.query<{ gallery_id: number }>(
        'SELECT DISTINCT gallery_id FROM mwnf3_thematic_gallery.exhibition_i18n'
      );
      this.exhibitionGalleryIds = new Set(exhibitionRows.map((r) => r.gallery_id));
      this.logInfo(
        `Found ${this.exhibitionGalleryIds.size} exhibition gallery IDs from exhibition_i18n`
      );

      // Query galleries from legacy database
      const galleries = await this.context.legacyDb.query<LegacyThgGallery>(
        `SELECT gallery_id, project_id, name, link, sort_order,
                mwnf3_project_id, i18n_group_id, i18n_common_group_id
         FROM mwnf3_thematic_gallery.thg_gallery
         ORDER BY sort_order, gallery_id`
      );

      this.logInfo(`Found ${galleries.length} galleries to import as collections`);

      for (const legacy of galleries) {
        try {
          const backwardCompat = `mwnf3_thematic_gallery:thg_gallery:${legacy.gallery_id}`;

          const anchor = this.buildAnchor(legacy);

          // Check if already exists as collection (use async for database fallback).
          // The anchor is still refreshed so a re-run picks up legacy edits to the
          // slug, host or i18n groups without recreating the collection.
          if (await this.entityExistsAsync(backwardCompat, 'collection')) {
            await this.refreshAnchor(backwardCompat, anchor);
            result.skipped++;
            this.showSkipped();
            continue;
          }

          // Get the corresponding context (created by ThgGalleryContextImporter or already in DB)
          const contextId = await this.getEntityUuidAsync(backwardCompat, 'context');
          if (!contextId) {
            result.errors.push(
              `Gallery ${legacy.gallery_id}: Context not found. Run ThgGalleryContextImporter first.`
            );
            this.showError();
            continue;
          }

          // Resolve collection type from project type flags
          const classificationResult = this.classifyGallery(legacy);
          if (classificationResult.error) {
            result.errors.push(`Gallery ${legacy.gallery_id}: ${classificationResult.error}`);
            this.showError();
            continue;
          }
          const candidateType = classificationResult.type!;

          // Validate candidate type against exhibition_i18n presence
          const hasExhibitionRows = this.exhibitionGalleryIds.has(legacy.gallery_id);
          if (candidateType === 'gallery' && hasExhibitionRows) {
            result.errors.push(
              `Gallery ${legacy.gallery_id}: Project type is gallery (is_gallery=1) but exhibition_i18n rows exist — data conflict, skipping`
            );
            this.showError();
            continue;
          }
          if (candidateType === 'exhibition' && !hasExhibitionRows) {
            result.errors.push(
              `Gallery ${legacy.gallery_id}: Project type is exhibition (is_exhibition=1) but no exhibition_i18n rows exist, skipping`
            );
            this.showError();
            continue;
          }

          const collectionType = candidateType;
          const parentId = collectionType === 'exhibition' ? this.exhibitionsRootId : this.galleriesRootId;

          // Create internal name from link or name (slugified)
          const slug = this.slugify(legacy.link || legacy.name);
          const internalName = `${collectionType}_${slug}`;

          // Collect sample
          this.collectSample(
            'thg_gallery_collection',
            legacy as unknown as Record<string, unknown>,
            'success'
          );

          if (this.isDryRun || this.isSampleOnlyMode) {
            this.logInfo(
              `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would create collection: ${internalName} (${backwardCompat})`
            );
            this.registerEntity('', backwardCompat, 'collection');
            result.imported++;
            this.showProgress();
            continue;
          }

          // Write collection using strategy
          const collectionId = await this.context.strategy.writeCollection({
            internal_name: internalName,
            backward_compatibility: backwardCompat,
            context_id: contextId,
            language_id: defaultLanguageId,
            parent_id: parentId,
            type: collectionType,
            extra: Object.keys(anchor).length > 0 ? JSON.stringify({ thg_gallery: anchor }) : null,
          });

          this.registerEntity(collectionId, backwardCompat, 'collection');

          result.imported++;
          this.showProgress();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.errors.push(`Gallery ${legacy.gallery_id}: ${message}`);
          this.logError(`Gallery ${legacy.gallery_id}`, message);
          this.showError();
        }
      }

      this.showSummary(result.imported, result.skipped, result.errors.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.success = false;
      result.errors.push(message);
      this.logError('ThgGalleryImporter', message);
    }

    return result;
  }

  /**
   * Load project type flags from thg_projects JOIN thg_project_type into projectTypeMap.
   * Keys are project_id strings.
   */
  private async loadProjectTypeMap(): Promise<void> {
    try {
      const rows = await this.context.legacyDb.query<LegacyProjectType>(
        `SELECT p.project_id, p.type_id, pt.is_gallery, pt.is_exhibition
         FROM mwnf3_thematic_gallery.thg_projects p
         JOIN mwnf3_thematic_gallery.thg_project_type pt ON p.type_id = pt.type_id`
      );
      for (const row of rows) {
        this.projectTypeMap.set(row.project_id, {
          isGallery: row.is_gallery === 1,
          isExhibition: row.is_exhibition === 1,
        });
      }
      this.logInfo(`Loaded ${this.projectTypeMap.size} project type mappings`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logWarning(`Failed to load project type mappings: ${msg}`);
    }
  }

  /**
   * Load the canonical public host of each gallery from thg_gallery_url.
   * Galleries have exactly one row; exhibitions have none (they are served as
   * path segments under a shared exhibitions host, identified by their slug).
   */
  private async loadGalleryHosts(): Promise<void> {
    try {
      const rows = await this.context.legacyDb.query<{ gallery_id: number; link: string | null }>(
        `SELECT gallery_id, link FROM mwnf3_thematic_gallery.thg_gallery_url
         WHERE link IS NOT NULL AND link != ''`
      );
      for (const row of rows) {
        this.galleryHosts.set(row.gallery_id, row.link!);
      }
      this.logInfo(`Loaded ${this.galleryHosts.size} gallery hosts`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logWarning(`Failed to load gallery hosts: ${msg}`);
    }
  }

  /**
   * Build the per-gallery anchor: the durable attributes that identify the
   * gallery itself rather than one of its language rows.
   */
  private buildAnchor(legacy: LegacyThgGallery): ThgGalleryAnchor {
    const anchor: ThgGalleryAnchor = {};

    if (legacy.mwnf3_project_id) {
      anchor.mwnf3_project_id = legacy.mwnf3_project_id;
    }
    if (legacy.link) {
      anchor.slug = legacy.link;
    }
    const host = this.galleryHosts.get(legacy.gallery_id);
    if (host) {
      anchor.host = host;
    }
    if (legacy.i18n_group_id !== null && legacy.i18n_group_id !== undefined) {
      anchor.i18n_group_id = legacy.i18n_group_id;
    }
    if (legacy.i18n_common_group_id !== null && legacy.i18n_common_group_id !== undefined) {
      anchor.i18n_common_group_id = legacy.i18n_common_group_id;
    }

    return anchor;
  }

  /**
   * Write the anchor onto an already-imported gallery collection, preserving any
   * other keys previously stored in extra.
   */
  private async refreshAnchor(backwardCompat: string, anchor: ThgGalleryAnchor): Promise<void> {
    if (Object.keys(anchor).length === 0 || this.isDryRun || this.isSampleOnlyMode) {
      return;
    }

    const collectionId = await this.getEntityUuidAsync(backwardCompat, 'collection');
    if (!collectionId) {
      return;
    }

    const existing = (await this.context.strategy.getCollectionExtra(collectionId)) ?? {};
    await this.context.strategy.setCollectionExtra(
      collectionId,
      JSON.stringify({ ...existing, thg_gallery: anchor })
    );
  }

  /**
   * Classify a thg_gallery row as gallery or exhibition using project type flags.
   * Returns { type } on success or { error } on failure.
   * Does NOT use literal project_id comparisons (e.g. 'EXH') as a classifier.
   */
  private classifyGallery(legacy: LegacyThgGallery): { type?: 'gallery' | 'exhibition'; error?: string } {
    if (!legacy.project_id) {
      return { error: 'project_id is null — cannot resolve project type, skipping' };
    }

    const flags = this.projectTypeMap.get(legacy.project_id);
    if (!flags) {
      return {
        error: `project_id '${legacy.project_id}' not found in thg_projects/thg_project_type — cannot resolve type, skipping`,
      };
    }

    if (flags.isGallery && !flags.isExhibition) {
      return { type: 'gallery' };
    }
    if (flags.isExhibition && !flags.isGallery) {
      return { type: 'exhibition' };
    }

    // Ambiguous or unsupported flag combination
    return {
      error: `project_id '${legacy.project_id}' has ambiguous type flags (is_gallery=${flags.isGallery ? 1 : 0}, is_exhibition=${flags.isExhibition ? 1 : 0}) — skipping`,
    };
  }

  /**
   * Convert a string to a URL-friendly slug
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '_')
      .replace(/^-+|-+$/g, '');
  }
}
