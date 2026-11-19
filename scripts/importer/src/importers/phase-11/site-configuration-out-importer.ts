/**
 * Site Configuration Out Importer (M16 E4b, #2673; decision 6)
 *
 * The sites' configuration (a gallery's settings, an exhibition's list
 * metadata and texts, Explore's home and itinerary records, the logos) lives
 * in the instance files, written by the `site-config` command; the importers
 * no longer write it. This step takes it out of an inventory imported before
 * that: the keys of site-config/types.ts, from `collections.extra` and
 * `collection_translations.extra`. On a fresh import it finds nothing.
 *
 * It runs after CollectionFlagsImporter (`runsLast`, registered after it), so
 * the flags an older import left in these blocks have reached their columns.
 * It reads nothing from the legacy database and is idempotent.
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';
import { SITE_COLLECTION_KEYS, SITE_TRANSLATION_KEYS } from '../../site-config/types.js';

/** The extra without these keys, or null when nothing else is left. */
export function withoutSiteKeys(
  extra: Record<string, unknown>,
  keys: readonly string[]
): Record<string, unknown> | null {
  const rest = Object.fromEntries(Object.entries(extra).filter(([key]) => !keys.includes(key)));
  return Object.keys(rest).length > 0 ? rest : null;
}

export class SiteConfigurationOutImporter extends BaseImporter {
  getName(): string {
    return 'SiteConfigurationOutImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();
    const writes = !this.isDryRun && !this.isSampleOnlyMode;

    try {
      const collections = await this.context.strategy.findCollectionsWithExtraKeys(SITE_COLLECTION_KEYS);
      this.logInfo(`Found ${collections.length} collection(s) holding site configuration`);
      for (const row of collections) {
        if (writes) {
          const extra = withoutSiteKeys(row.extra, SITE_COLLECTION_KEYS);
          await this.context.strategy.setCollectionRelationColumnsAsStored(
            row.id,
            {},
            extra === null ? null : JSON.stringify(extra)
          );
        }
        result.imported++;
        this.showProgress();
      }

      const translations =
        await this.context.strategy.findCollectionTranslationsWithExtraKeys(SITE_TRANSLATION_KEYS);
      this.logInfo(`Found ${translations.length} collection text(s) holding site configuration`);
      for (const row of translations) {
        if (writes) {
          const extra = withoutSiteKeys(row.extra, SITE_TRANSLATION_KEYS);
          await this.context.strategy.setCollectionTranslationExtraAsStoredById(
            row.id,
            extra === null ? null : JSON.stringify(extra)
          );
        }
        result.imported++;
        this.showProgress();
      }

      this.showSummary(result.imported, result.skipped, result.errors.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Failed to take the site configuration out: ${message}`);
      this.logError('SiteConfigurationOutImporter', message);
    }

    result.success = result.errors.length === 0;
    return result;
  }
}
