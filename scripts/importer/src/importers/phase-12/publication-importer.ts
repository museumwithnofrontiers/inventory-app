/**
 * Publication Importer (M14, #2529)
 *
 * One publication per legacy work (mwnf3.bookbase), with its category from
 * books_books_category (D-P3 for works 48 and 53).
 *
 * - bookbase.name → internal_name; mwnf3:bookbase:{book_id} → backward_compatibility
 * - project_id → mwnf3:projects:{project}; country; display_lang_id → language_id
 * - region, date, category (mwnf / other) → extra, one key per legacy column
 * - status is published: legacy has no work in preparation (`new` is a promotional flag and is
 *   not imported, as on the editions)
 *
 * Dependencies: project, country, language (phase 01)
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';
import { publicationCategory } from '../../domain/transformers/publication-transformer.js';
import { mapCountryCode } from '../../utils/code-mappings.js';

interface LegacyWork {
  book_id: number;
  name: string;
  project_id: string | null;
  country: string | null;
  display_lang_id: string | null;
  category: string | null;
  region: string | null;
  date: string | Date | null;
}

export function publicationExtra(
  work: Pick<LegacyWork, 'region' | 'date' | 'category'>
): Record<string, string> | null {
  const extra: Record<string, string> = {};
  const region = work.region?.trim();
  if (region) extra.region = region;
  if (work.date) {
    const date =
      work.date instanceof Date ? work.date.toISOString().slice(0, 10) : String(work.date);
    if (date && !date.startsWith('0000')) extra.date = date;
  }
  const category = work.category?.trim();
  if (category) extra.legacy_category = category;
  return Object.keys(extra).length > 0 ? extra : null;
}

export class PublicationImporter extends BaseImporter {
  getName(): string {
    return 'PublicationImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      const works = await this.context.legacyDb.query<LegacyWork>(
        `SELECT book_id, name, project_id, country, display_lang_id, category, region, date
           FROM mwnf3.bookbase ORDER BY book_id`
      );
      const categoryRows = await this.context.legacyDb.query<{
        book_id: number;
        category_id: number;
      }>(`SELECT book_id, category_id FROM mwnf3.books_books_category`);
      const categories = new Map<number, number[]>();
      for (const row of categoryRows) {
        const id = Number(row.book_id);
        categories.set(id, [...(categories.get(id) ?? []), Number(row.category_id)]);
      }
      this.logInfo(`Found ${works.length} publications`);

      for (const work of works) {
        const backwardCompat = `mwnf3:bookbase:${work.book_id}`;
        try {
          if (await this.entityExistsAsync(backwardCompat, 'publication')) {
            result.skipped++;
            this.showSkipped();
            continue;
          }
          const category = publicationCategory(
            Number(work.book_id),
            categories.get(Number(work.book_id)) ?? []
          );
          if (!category) {
            throw new Error(
              `no single category (legacy ${JSON.stringify(categories.get(Number(work.book_id)) ?? [])})`
            );
          }
          const languageId = work.display_lang_id
            ? await this.getLanguageIdByLegacyCodeAsync(work.display_lang_id)
            : null;
          if (!languageId) throw new Error(`unknown main language '${work.display_lang_id}'`);

          let projectId: string | null = null;
          if (work.project_id) {
            projectId = await this.getEntityUuidAsync(
              `mwnf3:projects:${work.project_id}`,
              'project'
            );
            if (!projectId)
              this.logWarning(`Project not found for ${backwardCompat}: ${work.project_id}`);
          }
          const extra = publicationExtra(work);

          if (this.isDryRun || this.isSampleOnlyMode) {
            this.registerEntity('', backwardCompat, 'publication');
            result.imported++;
            this.showProgress();
            continue;
          }

          await this.context.strategy.writePublication({
            internal_name: work.name?.trim() || backwardCompat,
            backward_compatibility: backwardCompat,
            category,
            project_id: projectId,
            country_id: work.country ? mapCountryCode(work.country) : null,
            language_id: languageId,
            status: 'published',
            display_order: null,
            extra: extra ? JSON.stringify(extra) : null,
          });
          result.imported++;
          this.showProgress();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.errors.push(`${backwardCompat}: ${message}`);
          this.logError('PublicationImporter', message, { book_id: work.book_id });
          this.showError();
        }
      }
      this.showSummary(result.imported, result.skipped, result.errors.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Error in publication import: ${message}`);
      this.logError('PublicationImporter', message);
    }

    result.success = result.errors.length === 0;
    return result;
  }
}
