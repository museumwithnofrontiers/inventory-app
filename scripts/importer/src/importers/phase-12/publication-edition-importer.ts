/**
 * Publication Translation and Edition Importers (M14, #2529)
 *
 * Legacy mwnf3.books holds one row per language × publisher × format × edition.
 *
 * - PublicationTranslationImporter: one translation per (work, language), in the
 *   project's context (the default context for a work without a project: D-P7).
 *   Its texts come from the reference edition (pickReferenceEdition).
 * - PublicationEditionImporter: one edition per books row, all 202 of them; the 7
 *   versions legacy hides keep visible = false (D-P2). Each edition's texts that
 *   differ from the reference edition go to extra.legacy_texts (D-P9), and its
 *   shop links to extra.shop_links (D-P8). Prices, discounts, distributors and
 *   availability are not imported.
 *
 * Dependencies: publication
 */

import { BaseImporter, type ILegacyDatabase } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';
import {
  FORMAT_BY_LEGACY_TYPE,
  editionBackwardCompat,
  legacyTexts,
  pickReferenceEdition,
  shopLinks,
  toInt,
  translationExtra,
  translationTexts,
  type LegacyEdition,
} from '../../domain/transformers/publication-transformer.js';

const SHOP_COLUMNS = Array.from({ length: 10 }, (_, i) => {
  const n = String(i + 1).padStart(2, '0');
  return `get_from_name_${n}, get_from_url_${n}`;
}).join(', ');

export interface LegacyEditionRow extends LegacyEdition {
  publisher_isbn: string | null;
  count_pages: string | null;
  count_images: string | null;
  count_plans: string | null;
  size: string | null;
  format: string | null;
  display: string | null;
  publisher_name: string | null;
  project_id: string | null;
}

async function readEditions(legacyDb: ILegacyDatabase): Promise<LegacyEditionRow[]> {
  return legacyDb.query<LegacyEditionRow>(
    `SELECT b.book_id, b.lang_id, b.type, b.edition, b.publisher_id, b.publish_year,
            b.title, b.subtitle, b.description1, b.description2, b.author, b.photographer,
            b.local_coordinator, b.remarks1, b.remarks2, b.publisher_isbn, b.count_pages,
            b.count_images, b.count_plans, b.size, b.format, b.display, ${SHOP_COLUMNS},
            p.name AS publisher_name, bb.project_id
       FROM mwnf3.books b
       JOIN mwnf3.bookbase bb ON bb.book_id = b.book_id
       LEFT JOIN mwnf3.publishers p ON p.publisher_id = b.publisher_id
      ORDER BY b.book_id, b.lang_id, b.type, b.edition`
  );
}

/** Editions grouped by (work, language), in legacy order. */
export function groupByWorkLanguage<T extends { book_id: number; lang_id: string }>(
  rows: T[]
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = `${row.book_id}:${row.lang_id}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return groups;
}

export class PublicationTranslationImporter extends BaseImporter {
  getName(): string {
    return 'PublicationTranslationImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();
    try {
      const groups = groupByWorkLanguage(await readEditions(this.context.legacyDb));
      this.logInfo(`Found ${groups.size} publication translations`);

      for (const [key, rows] of groups) {
        const reference = pickReferenceEdition(rows)!;
        const backwardCompat = `mwnf3:bookbase:${reference.book_id}:${reference.lang_id}`;
        try {
          const publicationId = await this.getEntityUuidAsync(
            `mwnf3:bookbase:${reference.book_id}`,
            'publication'
          );
          if (!publicationId) throw new Error(`publication not found for ${key}`);
          const languageId = await this.getLanguageIdByLegacyCodeAsync(reference.lang_id);
          if (!languageId) throw new Error(`unknown language '${reference.lang_id}'`);

          const contextId = reference.project_id
            ? await this.getEntityUuidAsync(`mwnf3:projects:${reference.project_id}`, 'context')
            : await this.getDefaultContextIdAsync();
          if (!contextId) throw new Error(`context not found for project ${reference.project_id}`);

          const texts = translationTexts(reference);
          const extra = translationExtra(reference);
          if (this.isDryRun || this.isSampleOnlyMode) {
            result.imported++;
            this.showProgress();
            continue;
          }
          await this.context.strategy.writePublicationTranslation({
            publication_id: publicationId,
            language_id: languageId,
            context_id: contextId,
            backward_compatibility: backwardCompat,
            title: texts.title ?? '',
            subtitle: texts.subtitle,
            description: texts.description,
            introduction: texts.introduction,
            author_credit: texts.author_credit,
            photography_credit: texts.photography_credit,
            coordination_credit: texts.coordination_credit,
            extra: extra ? JSON.stringify(extra) : null,
          });
          result.imported++;
          this.showProgress();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.errors.push(`${backwardCompat}: ${message}`);
          this.logError('PublicationTranslationImporter', message, { key });
          this.showError();
        }
      }
      this.showSummary(result.imported, result.skipped, result.errors.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Error in publication translation import: ${message}`);
      this.logError('PublicationTranslationImporter', message);
    }
    result.success = result.errors.length === 0;
    return result;
  }
}

export class PublicationEditionImporter extends BaseImporter {
  getName(): string {
    return 'PublicationEditionImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();
    try {
      const groups = groupByWorkLanguage(await readEditions(this.context.legacyDb));
      let order = 0;
      for (const rows of groups.values()) {
        const reference = pickReferenceEdition(rows)!;
        for (const row of rows) {
          order++;
          const backwardCompat = editionBackwardCompat(row);
          try {
            if (await this.entityExistsAsync(backwardCompat, 'publication_edition')) {
              result.skipped++;
              this.showSkipped();
              continue;
            }
            const publicationId = await this.getEntityUuidAsync(
              `mwnf3:bookbase:${row.book_id}`,
              'publication'
            );
            if (!publicationId) throw new Error(`publication not found: ${row.book_id}`);
            const languageId = await this.getLanguageIdByLegacyCodeAsync(row.lang_id);
            if (!languageId) throw new Error(`unknown language '${row.lang_id}'`);
            const format = FORMAT_BY_LEGACY_TYPE[row.type];
            if (!format) throw new Error(`unknown format '${row.type}'`);

            const extra: Record<string, unknown> = {};
            const texts = legacyTexts(row, reference);
            if (texts) extra.legacy_texts = texts;
            const links = shopLinks(row);
            if (links) extra.shop_links = links;

            if (this.isDryRun || this.isSampleOnlyMode) {
              this.registerEntity('', backwardCompat, 'publication_edition');
              result.imported++;
              this.showProgress();
              continue;
            }
            await this.context.strategy.writePublicationEdition({
              publication_id: publicationId,
              language_id: languageId,
              backward_compatibility: backwardCompat,
              format,
              edition: toInt(row.edition),
              publish_year: toInt(row.publish_year),
              isbn: row.publisher_isbn?.trim() || null,
              publisher: row.publisher_name?.trim() || null,
              page_count: toInt(row.count_pages),
              image_count: toInt(row.count_images),
              plan_count: toInt(row.count_plans),
              dimensions: row.size?.trim() || null,
              binding: row.format?.trim() || null,
              visible: row.display !== 'n',
              display_order: order,
              extra: Object.keys(extra).length > 0 ? JSON.stringify(extra) : null,
            });
            result.imported++;
            this.showProgress();
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            result.errors.push(`${backwardCompat}: ${message}`);
            this.logError('PublicationEditionImporter', message);
            this.showError();
          }
        }
      }
      this.showSummary(result.imported, result.skipped, result.errors.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Error in publication edition import: ${message}`);
      this.logError('PublicationEditionImporter', message);
    }
    result.success = result.errors.length === 0;
    return result;
  }
}
