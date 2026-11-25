/**
 * THG Root Collections Importer
 *
 * Creates root collections for THG galleries and exhibitions:
 * - "Galleries" - parent for all gallery collections (THG project type)
 * - "Exhibitions" - parent for all exhibition collections (EXH project type)
 *
 * Legacy schema:
 * - No direct equivalent (we create root containers)
 *
 * New schema:
 * - collections (id, context_id, language_id, parent_id, type, internal_name, ...)
 * - collection_translations (collection_id, language_id, context_id, title, description, ...)
 *
 * Dependencies:
 * - DefaultContextImporter (uses default context for root collections)
 * - LanguageImporter (for default language)
 */

import type { CollectionPurpose, CollectionType } from '../../domain/collection-vocabulary.js';
import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';

interface RootCollectionConfig {
  internalName: string;
  backwardCompat: string;
  type: CollectionType;
  purpose: CollectionPurpose;
  title: string;
  description: string;
}

export class ThgRootCollectionsImporter extends BaseImporter {
  private defaultContextId!: string;
  private defaultLanguageId: string = 'eng';

  getName(): string {
    return 'ThgRootCollectionsImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      this.logInfo('Looking up default context...');

      // Get the default context ID using the correct backward compatibility key
      const defaultContextBackwardCompat = '__default_context__';
      const defaultContextId = await this.getEntityUuidAsync(
        defaultContextBackwardCompat,
        'context'
      );

      if (!defaultContextId) {
        throw new Error(
          `Default context not found (${defaultContextBackwardCompat}). Run DefaultContextImporter first.`
        );
      }
      this.defaultContextId = defaultContextId;

      // Get default language ID
      this.defaultLanguageId = await this.getDefaultLanguageIdAsync();

      this.logInfo(`Found default context: ${this.defaultContextId}`);
      this.logInfo('Creating THG root collections...');

      // Define the root collections to create
      const rootCollections: RootCollectionConfig[] = [
        {
          internalName: 'thg_galleries_root',
          backwardCompat: 'mwnf3_thematic_gallery:galleries_root',
          type: 'collection',
          purpose: 'galleries-root',
          title: 'Galleries',
          description:
            'Thematic galleries showcasing curated collections from the Museum With No Frontiers.',
        },
        {
          internalName: 'thg_exhibitions_root',
          backwardCompat: 'mwnf3_thematic_gallery:exhibitions_root',
          type: 'collection',
          purpose: 'exhibitions-root',
          title: 'Exhibitions',
          description:
            'Virtual exhibitions presenting themed selections from the Museum With No Frontiers collections.',
        },
      ];

      for (const config of rootCollections) {
        try {
          await this.createRootCollection(config, result);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.errors.push(`${config.internalName}: ${message}`);
          this.logError(config.internalName, message);
          this.showError();
        }
      }

      this.showSummary(result.imported, result.skipped, result.errors.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.success = false;
      result.errors.push(message);
      this.logError('ThgRootCollectionsImporter', message);
    }

    return result;
  }

  private async createRootCollection(
    config: RootCollectionConfig,
    result: ImportResult
  ): Promise<void> {
    // Check if already exists
    if (await this.entityExistsAsync(config.backwardCompat, 'collection')) {
      this.logInfo(`${config.title} root collection already exists`);
      // Ensure-semantics (#1505): a marker created before the purpose column
      // existed must still end up purposed, without a full re-import.
      const existingId = await this.getEntityUuidAsync(config.backwardCompat, 'collection');
      if (existingId && !this.isDryRun && !this.isSampleOnlyMode) {
        const currentPurpose = await this.context.strategy.getCollectionPurpose(existingId);
        if (currentPurpose === null) {
          await this.context.strategy.updateCollectionPurpose(existingId, config.purpose);
          this.logInfo(`Set purpose '${config.purpose}' on ${config.backwardCompat}`);
          result.imported++;
          this.showProgress();
          return;
        }
      }
      result.skipped++;
      this.showSkipped();
      return;
    }

    // Collect sample
    this.collectSample(
      'thg_root_collection',
      { internal_name: config.internalName, backward_compatibility: config.backwardCompat },
      'foundation',
      `${config.title} root collection`
    );

    if (this.isDryRun || this.isSampleOnlyMode) {
      this.logInfo(
        `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would create root collection: ${config.internalName}`
      );
      this.registerEntity('', config.backwardCompat, 'collection');
      result.imported++;
      this.showProgress();
      return;
    }

    // Write root collection
    const collectionId = await this.context.strategy.writeCollection({
      internal_name: config.internalName,
      backward_compatibility: config.backwardCompat,
      context_id: this.defaultContextId,
      language_id: this.defaultLanguageId,
      parent_id: null,
      type: config.type,
      purpose: config.purpose,
      latitude: null,
      longitude: null,
      map_zoom: null,
      country_id: null,
    });

    this.registerEntity(collectionId, config.backwardCompat, 'collection');

    // Create translation for the root collection
    const translationBackwardCompat = `${config.backwardCompat}:translation:${this.defaultLanguageId}`;

    await this.context.strategy.writeCollectionTranslation({
      collection_id: collectionId,
      language_id: this.defaultLanguageId,
      context_id: this.defaultContextId,
      backward_compatibility: translationBackwardCompat,
      title: config.title,
      description: config.description,
    });

    this.logInfo(`Created ${config.title} root collection: ${collectionId}`);
    result.imported++;
    this.showProgress();
  }
}
