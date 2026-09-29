/**
 * Explore Root Collections Importer
 *
 * Creates the Explore website's root and, under it, the three Collections for
 * Explore navigation:
 * 0. "Explore" - the site itself (purpose `explore-root`); its `extra` holds the
 *    site's own records, which ExploreHomeImporter writes
 * 1. "Explore by Theme" - Navigation by thematic cycles
 * 2. "Explore by Country" - Navigation by country
 * 3. "Explore by Itinerary" - Navigation by curated itineraries
 *
 * A section root created before the site root existed is filed under it.
 *
 * Texts: dictionary or nothing (Pascal, 2026-09-29). The site root's title is
 * legacy's dictionary word `explore_mwnf`, in every language the dictionary
 * has it; it has no description, because legacy's is the home page's
 * `Home-Description`, a site text site-i18n carries. The section roots have no
 * translation: their only legacy texts are the home page's `Home-Explore-by-*`
 * words and the live client's labels, both site texts. Rows written before
 * this rule are replaced.
 *
 * Dependencies:
 * - ExploreContextImporter (must run first to create the Explore context)
 *
 * New schema:
 * - collections (id, context_id, language_id, parent_id, type, internal_name, backward_compatibility, ...)
 *
 * Collection types:
 * - "Explore by Theme" → type: 'collection'
 * - "Explore by Country" → type: 'collection'
 * - "Explore by Itinerary" → type: 'itinerary'
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';

/**
 * Root collection configuration
 */
interface RootCollectionConfig {
  internal_name: string;
  backward_compatibility: string;
  type: 'collection' | 'itinerary';
  purpose: string;
  /** The dictionary word that titles it, or null for no translation at all. */
  titleWord: string | null;
  /** The site root has none; each section root sits under the site root. */
  parent: 'site' | null;
}

interface DictionaryWord {
  lang_id: string;
  value: string | null;
}

export const EXPLORE_ROOT_KEY = 'mwnf3_explore:root';

/** Explore's group in legacy's dictionary, `mwnf3_explore.translation`. */
export const EXPLORE_DICTIONARY_GROUP = 12;

export class ExploreRootCollectionsImporter extends BaseImporter {
  private exploreContextId: string | null = null;
  private defaultLanguageId: string = 'eng';

  getName(): string {
    return 'ExploreRootCollectionsImporter';
  }

  /**
   * Define the three root collections
   */
  private getRootCollections(): RootCollectionConfig[] {
    return [
      {
        internal_name: 'explore',
        backward_compatibility: EXPLORE_ROOT_KEY,
        type: 'collection',
        purpose: 'explore-root',
        titleWord: 'explore_mwnf',
        parent: null,
      },
      {
        internal_name: 'explore_by_theme',
        backward_compatibility: 'mwnf3_explore:root:explore_by_theme',
        type: 'collection',
        purpose: 'explore-themes-root',
        titleWord: null,
        parent: 'site',
      },
      {
        internal_name: 'explore_by_country',
        backward_compatibility: 'mwnf3_explore:root:explore_by_country',
        type: 'collection',
        purpose: 'explore-countries-root',
        titleWord: null,
        parent: 'site',
      },
      {
        internal_name: 'explore_by_itinerary',
        backward_compatibility: 'mwnf3_explore:root:explore_by_itinerary',
        type: 'itinerary',
        purpose: 'explore-itineraries-root',
        titleWord: null,
        parent: 'site',
      },
    ];
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      this.logInfo('Looking up Explore context...');

      // Get the Explore context ID
      const exploreContextBackwardCompat = 'mwnf3_explore:context';
      this.exploreContextId = await this.getEntityUuidAsync(
        exploreContextBackwardCompat,
        'context'
      );

      if (!this.exploreContextId) {
        throw new Error(
          `Explore context not found (${exploreContextBackwardCompat}). Run ExploreContextImporter first.`
        );
      }

      this.logInfo(`Found Explore context: ${this.exploreContextId}`);

      this.defaultLanguageId = await this.getDefaultLanguageIdAsync();

      this.logInfo(`Using default language: ${this.defaultLanguageId}`);
      this.logInfo('Creating root collections for Explore...');

      const rootCollections = this.getRootCollections();

      for (const config of rootCollections) {
        try {
          const parentId =
            config.parent === 'site'
              ? await this.getEntityUuidAsync(EXPLORE_ROOT_KEY, 'collection')
              : null;

          // Check if already exists
          if (await this.entityExistsAsync(config.backward_compatibility, 'collection')) {
            this.logInfo(`Collection ${config.internal_name} already exists`);
            // Ensure-semantics (#1505): a marker created before the purpose
            // column existed must still end up purposed, and one created before
            // the site root existed must end up under it, without a re-import.
            const existingId = await this.getEntityUuidAsync(
              config.backward_compatibility,
              'collection'
            );
            if (existingId && !this.isDryRun && !this.isSampleOnlyMode) {
              let changed = false;
              const currentPurpose = await this.context.strategy.getCollectionPurpose(existingId);
              if (currentPurpose === null) {
                await this.context.strategy.updateCollectionPurpose(existingId, config.purpose);
                this.logInfo(`Set purpose '${config.purpose}' on ${config.backward_compatibility}`);
                changed = true;
              }
              if (
                parentId &&
                (await this.context.strategy.getCollectionParentId(existingId)) !== parentId
              ) {
                await this.context.strategy.updateCollectionParentId(existingId, parentId);
                this.logInfo(`Filed ${config.backward_compatibility} under ${EXPLORE_ROOT_KEY}`);
                changed = true;
              }
              await this.writeTranslations(existingId, config);
              if (changed) {
                result.imported++;
                this.showProgress();
                continue;
              }
            }
            result.skipped++;
            this.showSkipped();
            continue;
          }

          // Collect sample
          this.collectSample(
            'explore_root_collection',
            {
              internal_name: config.internal_name,
              type: config.type,
              backward_compatibility: config.backward_compatibility,
              context_id: this.exploreContextId,
              language_id: this.defaultLanguageId,
              title_word: config.titleWord,
            } as Record<string, unknown>,
            'success'
          );

          if (this.isDryRun || this.isSampleOnlyMode) {
            this.logInfo(
              `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would create collection: ${config.internal_name}`
            );
            this.registerEntity('', config.backward_compatibility, 'collection');
            result.imported++;
            this.showProgress();
            continue;
          }

          // Write collection using strategy
          const collectionId = await this.context.strategy.writeCollection({
            internal_name: config.internal_name,
            backward_compatibility: config.backward_compatibility,
            context_id: this.exploreContextId,
            language_id: this.defaultLanguageId,
            parent_id: parentId,
            type: config.type,
            purpose: config.purpose,
            latitude: null,
            longitude: null,
            map_zoom: null,
            country_id: null,
          });

          this.registerEntity(collectionId, config.backward_compatibility, 'collection');
          this.logInfo(`Created collection: ${config.internal_name} (${collectionId})`);

          await this.writeTranslations(collectionId, config);

          result.imported++;
          this.showProgress();
        } catch (error) {
          result.success = false;
          const errorMessage = error instanceof Error ? error.message : String(error);
          result.errors.push(`Error creating collection ${config.internal_name}: ${errorMessage}`);
          this.logError('ExploreRootCollectionsImporter', errorMessage, {
            collection: config.internal_name,
          });
          this.showError();
        }
      }
    } catch (error) {
      result.success = false;
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(`Error in root collections import: ${errorMessage}`);
      this.logError('ExploreRootCollectionsImporter', errorMessage);
      this.showError();
    }

    return result;
  }

  /**
   * Replaces the collection's Explore translations with its dictionary word, one
   * row per language the dictionary has it in, titled and never described; a
   * collection with no word keeps none. Deterministic ids make a re-run write
   * the same rows.
   */
  private async writeTranslations(
    collectionId: string,
    config: RootCollectionConfig
  ): Promise<void> {
    const words = config.titleWord
      ? await this.context.legacyDb.query<DictionaryWord>(
          `SELECT lang_id, value
           FROM mwnf3_explore.translation
           WHERE group_id = ? AND word_id = ?
           ORDER BY lang_id`,
          [EXPLORE_DICTIONARY_GROUP, config.titleWord]
        )
      : [];

    const rows: Array<{ languageId: string; title: string }> = [];
    for (const word of words) {
      const title = word.value?.trim() ?? '';
      if (title === '') continue;
      const languageId = await this.getLanguageIdByLegacyCodeAsync(word.lang_id);
      if (!languageId) {
        this.logWarning(
          `Unknown language code '${word.lang_id}' for dictionary word ${config.titleWord}, skipping`
        );
        continue;
      }
      rows.push({ languageId, title });
    }

    await this.context.strategy.deleteCollectionTranslations(collectionId, this.exploreContextId!);
    for (const row of rows) {
      await this.context.strategy.writeCollectionTranslation({
        collection_id: collectionId,
        language_id: row.languageId,
        context_id: this.exploreContextId!,
        backward_compatibility: `${config.backward_compatibility}:translation:${row.languageId}`,
        title: row.title,
        description: null,
      });
    }
  }
}
