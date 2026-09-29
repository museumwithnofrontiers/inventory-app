/**
 * Explore Thematic Cycle Translation Importer (Story 11.3)
 *
 * Enhances existing thematic cycle collections with:
 * 1. Multilingual translations from thematiccycletranslated (25 rows), whose
 *    description is the cycle's introduction, English included
 * 2. Country associations from thematiccyclecountries (25 rows) → extra.country_ids
 * 3. Country-specific texts from thematiccycle_country_texts (19 rows) → extra.country_texts
 * 4. Country-specific pictures from thematiccycle_country_pictures (3 rows) → CollectionImage
 *
 * Dependencies:
 * - ExploreThematicCycleImporter (thematic cycles must exist)
 * - ExploreContextImporter
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';

interface LegacyCycleTranslation {
  cycleId: number;
  langId: string;
  spelling: string;
  description: string | null;
}

interface LegacyCycleCountry {
  cycleId: number;
  countryId: string;
}

interface LegacyCycleCountryText {
  cycleId: number;
  countryId: string;
  langId: string;
  text: string | null;
}

interface LegacyCycleCountryPicture {
  cycleId: number;
  country_id: string;
  path: string;
}

export class ExploreThematicCycleTranslationImporter extends BaseImporter {
  private exploreContextId!: string;

  getName(): string {
    return 'ExploreThematicCycleTranslationImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      // Resolve Explore context
      const exploreContextBC = 'mwnf3_explore:context';
      const exploreContextId = await this.getEntityUuidAsync(exploreContextBC, 'context');
      if (!exploreContextId) {
        throw new Error(`Explore context not found (${exploreContextBC}).`);
      }
      this.exploreContextId = exploreContextId;

      this.logInfo('Importing thematic cycle translations...');

      // 1. Multilingual translations
      const translations = await this.context.legacyDb.query<LegacyCycleTranslation>(
        `SELECT cycleId, langId, spelling, description FROM mwnf3_explore.thematiccycletranslated`
      );
      this.logInfo(`Found ${translations.length} thematic cycle translations`);

      for (const trans of translations) {
        try {
          const cycleBC = `mwnf3_explore:thematiccycle:${trans.cycleId}`;
          const collectionId = await this.getEntityUuidAsync(cycleBC, 'collection');
          if (!collectionId) {
            this.logWarning(`Thematic cycle not found: ${cycleBC}, skipping translation`);
            result.skipped++;
            this.showSkipped();
            continue;
          }

          const languageId = await this.getLanguageIdByLegacyCodeAsync(trans.langId);
          if (!languageId) {
            this.logWarning(
              `Unknown language code '${trans.langId}' for cycle ${trans.cycleId}, skipping`
            );
            result.skipped++;
            this.showSkipped();
            continue;
          }

          if (!trans.spelling || !trans.spelling.trim()) {
            result.skipped++;
            this.showSkipped();
            continue;
          }

          const translationBC = `${cycleBC}:translation:${languageId}`;

          // Already written: the English row ExploreThematicCycleImporter creates
          // carries the cycle's name as its description, so the introduction
          // legacy shows still has to reach it.
          if (await this.entityExistsAsync(translationBC, 'collection_translation')) {
            const description = trans.description ?? '';
            if (description.trim() && !this.isDryRun && !this.isSampleOnlyMode) {
              await this.context.strategy.setCollectionTranslationDescriptionByKey(
                collectionId,
                languageId,
                this.exploreContextId,
                description
              );
            }
            result.skipped++;
            this.showSkipped();
            continue;
          }

          if (this.isDryRun || this.isSampleOnlyMode) {
            this.logInfo(
              `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would create cycle translation: cycle ${trans.cycleId} / ${languageId}`
            );
            result.imported++;
            this.showProgress();
            continue;
          }

          await this.context.strategy.writeCollectionTranslation({
            collection_id: collectionId,
            language_id: languageId,
            context_id: this.exploreContextId,
            backward_compatibility: translationBC,
            title: trans.spelling,
            description: trans.description ?? '',
          });

          result.imported++;
          this.showProgress();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logWarning(`Failed cycle translation ${trans.cycleId}/${trans.langId}: ${message}`);
        }
      }

      // 2. Country associations → extra.country_ids
      const countries = await this.context.legacyDb.query<LegacyCycleCountry>(
        `SELECT cycleId, countryId FROM mwnf3_explore.thematiccyclecountries`
      );
      this.logInfo(`Found ${countries.length} thematic cycle country associations`);

      const countriesByCycle = new Map<number, string[]>();
      for (const c of countries) {
        const list = countriesByCycle.get(c.cycleId) ?? [];
        list.push(c.countryId);
        countriesByCycle.set(c.cycleId, list);
      }

      // 3. Country texts → extra.country_texts
      // DDL columns: cycleId, country_id, langId, description
      const countryTexts = await this.context.legacyDb.query<LegacyCycleCountryText>(
        `SELECT cycleId, country_id AS countryId, langId, description AS text
         FROM mwnf3_explore.thematiccycle_country_texts
         WHERE description IS NOT NULL AND description != ''`
      );
      this.logInfo(`Found ${countryTexts.length} thematic cycle country texts`);

      const textsByCycle = new Map<
        number,
        Array<{ countryId: string; langId: string; text: string }>
      >();
      for (const t of countryTexts) {
        if (!t.text) continue;
        const list = textsByCycle.get(t.cycleId) ?? [];
        list.push({ countryId: t.countryId, langId: t.langId, text: t.text });
        textsByCycle.set(t.cycleId, list);
      }

      // Write country_ids and country_texts into English translation extra
      const allCycleIds = new Set([...countriesByCycle.keys(), ...textsByCycle.keys()]);
      for (const cycleId of allCycleIds) {
        try {
          const cycleBC = `mwnf3_explore:thematiccycle:${cycleId}`;
          const collectionId = await this.getEntityUuidAsync(cycleBC, 'collection');
          if (!collectionId) continue;

          if (this.isDryRun || this.isSampleOnlyMode) continue;

          const existingExtra = await this.context.strategy.getCollectionTranslationExtra(
            collectionId,
            'eng'
          );
          const extra = existingExtra ?? {};

          const cycleCountries = countriesByCycle.get(cycleId);
          if (cycleCountries) {
            extra.country_ids = cycleCountries;
          }

          const cycleTexts = textsByCycle.get(cycleId);
          if (cycleTexts) {
            extra.country_texts = cycleTexts;
          }

          await this.context.strategy.setCollectionTranslationExtra(
            collectionId,
            'eng',
            JSON.stringify(extra)
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logWarning(`Failed to update extra for cycle ${cycleId}: ${message}`);
        }
      }

      // 4. Country pictures → CollectionImage
      const pictures = await this.context.legacyDb.query<LegacyCycleCountryPicture>(
        `SELECT cycleId, country_id, path FROM mwnf3_explore.thematiccycle_country_pictures WHERE path IS NOT NULL AND path != ''`
      );
      this.logInfo(`Found ${pictures.length} thematic cycle country pictures`);

      for (const pic of pictures) {
        try {
          const cycleBC = `mwnf3_explore:thematiccycle:${pic.cycleId}`;
          const collectionId = await this.getEntityUuidAsync(cycleBC, 'collection');
          if (!collectionId) {
            this.logWarning(`Thematic cycle not found: ${cycleBC}, skipping picture`);
            continue;
          }

          // collection_images has no backward_compatibility column —
          // identity is (owner, legacy path).
          if (await this.imageExistsAsync('collection_images', collectionId, pic.path)) {
            continue;
          }

          if (this.isDryRun || this.isSampleOnlyMode) continue;

          await this.context.strategy.writeCollectionImage({
            collection_id: collectionId,
            path: pic.path,
            original_name: pic.path.split('/').pop() ?? pic.path,
            mime_type: 'image/jpeg',
            size: 1, // placeholder
            alt_text: `${pic.country_id} country picture`,
            display_order: 0,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logWarning(
            `Failed country picture for cycle ${pic.cycleId}/${pic.country_id}: ${message}`
          );
        }
      }
    } catch (error) {
      result.success = false;
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(`Error in thematic cycle translation import: ${errorMessage}`);
      this.logError('ExploreThematicCycleTranslationImporter', errorMessage);
      this.showError();
    }

    return result;
  }
}
