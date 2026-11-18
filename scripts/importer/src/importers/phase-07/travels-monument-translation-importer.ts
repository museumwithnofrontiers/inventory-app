/**
 * Travels Monument Translation Importer
 *
 * Creates ItemTranslation records for each travel monument in all available languages.
 *
 * Legacy schema:
 * - mwnf3_travels.tr_monuments (project_id, country, itinerary_id, location_id, number, lang, trail_id,
 *   title, description, how_to_reach, info, contact, prepared_by)
 *   - One row per language
 *
 * New schema:
 * - item_translations (item_id, language_id, context_id, name, description, extra, ...)
 *
 * Mapping:
 * - title → name
 * - description → description: the monument's text, which Explore shows on
 *   the sheet of a monument that resolves to it
 * - how_to_reach, info, contact → extra, each only when set
 * - prepared_by → the credit columns (M16 I1, #2657): a plain name is the
 *   author, kept as written; a text with role labels ("Author:", "Translator:",
 *   "Copy-editor (English):") fills each role, as Explore's importer does, and
 *   keeps its raw text in extra, since the columns cannot rebuild it
 *
 * A translation imported before its text was carried keeps its row: the text is
 * filled in on it rather than skipped.
 *
 * Dependencies:
 * - TravelsContextImporter
 * - TravelsMonumentImporter (must run first)
 * - LanguageImporter (for language lookup)
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';
import { AuthorHelper } from '../../helpers/author-helper.js';
import { parseExplorePreparedBy } from '../../helpers/explore-prepared-by-parser.js';

/**
 * Legacy travel monument translation structure
 */
interface LegacyTravelMonumentTranslation {
  project_id: string;
  country: string;
  itinerary_id: string;
  location_id: string;
  number: string;
  lang: string;
  trail_id: number;
  title: string;
  description: string | null;
  how_to_reach: string | null;
  info: string | null;
  contact: string | null;
  prepared_by: string | null;
}

/** The people `prepared_by` credits, one name per role. */
export interface MonumentCredits {
  authorName: string | null;
  textCopyEditorName: string | null;
  translatorName: string | null;
  translationCopyEditorName: string | null;
  /** The text has role labels the columns cannot rebuild: extra keeps it as written. */
  keepRaw: boolean;
}

/**
 * Reads `prepared_by` into the credit roles. A plain name is the author, as
 * written; a text with role labels is split by them.
 */
export function monumentCredits(preparedBy: string | null | undefined): MonumentCredits | null {
  const raw = preparedBy?.trim();
  if (!raw) return null;

  const parsed = parseExplorePreparedBy(raw);
  if (!parsed) {
    return {
      authorName: raw,
      textCopyEditorName: null,
      translatorName: null,
      translationCopyEditorName: null,
      keepRaw: false,
    };
  }

  return {
    authorName: parsed.authorName,
    textCopyEditorName: parsed.textCopyEditorName,
    translatorName: parsed.translatorName,
    translationCopyEditorName: parsed.translationCopyEditorName,
    keepRaw: parsed.preserveRawInExtra,
  };
}

/**
 * The monument's visitor texts, each only when set, and `prepared_by` when its
 * credits need the raw text (see monumentCredits). With `keepPreparedBy`, the
 * author line always stays: a row that is filled in afterwards has no way to
 * write its credit columns.
 */
export function monumentTextExtra(
  legacy: Pick<LegacyTravelMonumentTranslation, 'how_to_reach' | 'info' | 'contact' | 'prepared_by'>,
  keepPreparedBy = false
): Record<string, string> | null {
  const extra: Record<string, string> = {};
  for (const field of ['how_to_reach', 'info', 'contact'] as const) {
    const value = legacy[field]?.trim();
    if (value) extra[field] = value;
  }
  const preparedBy = legacy.prepared_by?.trim();
  if (preparedBy && (keepPreparedBy || monumentCredits(preparedBy)?.keepRaw)) {
    extra.prepared_by = preparedBy;
  }
  return Object.keys(extra).length > 0 ? extra : null;
}

function monumentDescription(legacy: LegacyTravelMonumentTranslation): string | null {
  return legacy.description && legacy.description.trim() ? legacy.description : null;
}

export class TravelsMonumentTranslationImporter extends BaseImporter {
  private travelsContextId!: string;
  private authorHelper!: AuthorHelper;

  getName(): string {
    return 'TravelsMonumentTranslationImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      this.logInfo('Looking up Travels context...');

      // Get the Travels context ID
      const travelsContextBackwardCompat = 'mwnf3_travels:context';
      const travelsContextId = await this.getEntityUuidAsync(
        travelsContextBackwardCompat,
        'context'
      );

      if (!travelsContextId) {
        throw new Error(
          `Travels context not found (${travelsContextBackwardCompat}). Run TravelsContextImporter first.`
        );
      }
      this.travelsContextId = travelsContextId;
      this.authorHelper = new AuthorHelper(
        this.context.strategy,
        this.context.tracker,
        this.logger
      );

      this.logInfo('Importing travel monument translations...');

      // Query all travel monument translations
      const translations = await this.context.legacyDb.query<LegacyTravelMonumentTranslation>(
        `SELECT project_id, country, itinerary_id, location_id, number, lang, trail_id, title,
                description, how_to_reach, info, contact, prepared_by
        FROM mwnf3_travels.tr_monuments
         ORDER BY project_id, country, trail_id, itinerary_id, location_id, number, lang`
      );

      this.logInfo(`Found ${translations.length} monument translations to import`);

      for (const legacy of translations) {
        try {
          const monumentBackwardCompat = `mwnf3_travels:monument:${legacy.project_id}:${legacy.country}:${legacy.trail_id}:${legacy.itinerary_id}:${legacy.location_id}:${legacy.number}`;
          const translationBackwardCompat = `${monumentBackwardCompat}:translation:${legacy.lang}`;

          // Get parent monument item ID
          const monumentId = await this.getEntityUuidAsync(monumentBackwardCompat, 'item');
          if (!monumentId) {
            this.logWarning(`Monument not found for translation: ${monumentBackwardCompat}`, {
              lang: legacy.lang,
            });
            result.skipped++;
            this.showSkipped();
            continue;
          }

          // Get language ID from legacy code
          const languageId = await this.getLanguageIdByLegacyCodeAsync(legacy.lang);
          if (!languageId) {
            this.logWarning(`Language not found: ${legacy.lang}`, { monumentBackwardCompat });
            result.skipped++;
            this.showSkipped();
            continue;
          }

          // Check if translation already exists
          const existsCheck = await this.context.strategy.findByBackwardCompatibility(
            'item_translations',
            translationBackwardCompat
          );
          if (existsCheck) {
            if (!this.isDryRun && !this.isSampleOnlyMode) {
              await this.fillMonumentText(monumentId, languageId, legacy);
            }
            result.skipped++;
            this.showSkipped();
            continue;
          }

          // Collect sample
          this.collectSample(
            'travel_monument_translation',
            legacy as unknown as Record<string, unknown>,
            'success',
            `Travel monument translation ${legacy.project_id}/${legacy.country}/${legacy.trail_id}/${legacy.itinerary_id}/${legacy.location_id}/${legacy.number}:${legacy.lang}`,
            legacy.lang
          );

          if (this.isDryRun || this.isSampleOnlyMode) {
            this.logInfo(
              `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would create monument translation: ${translationBackwardCompat}`
            );
            result.imported++;
            this.showProgress();
            continue;
          }

          const extra = monumentTextExtra(legacy);
          const credits = monumentCredits(legacy.prepared_by);
          await this.context.strategy.writeItemTranslation({
            item_id: monumentId,
            language_id: languageId,
            context_id: this.travelsContextId,
            backward_compatibility: translationBackwardCompat,
            name: legacy.title || '',
            description: monumentDescription(legacy) ?? '',
            author_id: await this.author(credits?.authorName),
            text_copy_editor_id: await this.author(credits?.textCopyEditorName),
            translator_id: await this.author(credits?.translatorName),
            translation_copy_editor_id: await this.author(credits?.translationCopyEditorName),
            extra: extra ? JSON.stringify(extra) : null,
          });

          result.imported++;
          this.showProgress();
        } catch (error) {
          result.success = false;
          const errorMessage = error instanceof Error ? error.message : String(error);
          result.errors.push(
            `Error importing monument translation ${legacy.project_id}/${legacy.country}/${legacy.trail_id}/${legacy.itinerary_id}/${legacy.location_id}/${legacy.number}:${legacy.lang}: ${errorMessage}`
          );
          this.logError('TravelsMonumentTranslationImporter', errorMessage, {
            project_id: legacy.project_id,
            country: legacy.country,
            trail_id: legacy.trail_id,
            itinerary_id: legacy.itinerary_id,
            location_id: legacy.location_id,
            number: legacy.number,
            lang: legacy.lang,
          });
          this.showError();
        }
      }
    } catch (error) {
      result.success = false;
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(`Error in monument translation import: ${errorMessage}`);
      this.logError('TravelsMonumentTranslationImporter', errorMessage);
      this.showError();
    }

    return result;
  }

  private async author(name: string | null | undefined): Promise<string | null> {
    return name ? this.authorHelper.findOrCreate(name) : null;
  }

  /**
   * Brings the text onto a translation written before it was imported. Its
   * `extra` is merged, not replaced, so whatever else it holds stays; the
   * Explore context's row of the same monument is never touched.
   */
  private async fillMonumentText(
    itemId: string,
    languageId: string,
    legacy: LegacyTravelMonumentTranslation
  ): Promise<void> {
    const description = monumentDescription(legacy);
    const text = monumentTextExtra(legacy, true);
    if (description) {
      await this.context.strategy.setItemTranslationDescriptionByContext(
        itemId,
        languageId,
        this.travelsContextId,
        description
      );
    }
    if (text) {
      const current = await this.context.strategy.getItemTranslationExtraByContext(
        itemId,
        languageId,
        this.travelsContextId
      );
      await this.context.strategy.setItemTranslationExtraByContext(
        itemId,
        languageId,
        this.travelsContextId,
        JSON.stringify({ ...(current ?? {}), ...text })
      );
    }
  }
}
