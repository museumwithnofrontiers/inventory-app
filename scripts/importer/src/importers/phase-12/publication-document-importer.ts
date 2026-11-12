/**
 * Publication Document Importer (M14, #2548; ADR 004)
 *
 * Each edition's sample PDF (books.path_catalogue) and credits PDF
 * (books.path_credits) as a publication_documents row with the size
 * placeholder 1, linked to its edition. `document-sync` then copies the file
 * from the legacy share into the documents volume, which `ship` pushes to the
 * private document-originals disk; `/doc/{filename}` serves it to the sites.
 *
 * Two editions can name the same file (an e-book's two editions share one
 * sample): each edition gets its own document.
 *
 * Dependencies: publication-edition
 */

import path from 'path';
import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';
import { editionBackwardCompat } from '../../domain/transformers/publication-transformer.js';

interface LegacyEditionDocuments {
  book_id: number;
  lang_id: string;
  type: string;
  edition: string | null;
  publisher_id: number | null;
  path_catalogue: string | null;
  path_credits: string | null;
}

/** The documents one edition names: sample first, then credits. */
export function editionDocuments(
  row: LegacyEditionDocuments
): Array<{ kind: 'sample' | 'credits'; path: string; backwardCompat: string }> {
  const edition = editionBackwardCompat(row);
  const out: Array<{ kind: 'sample' | 'credits'; path: string; backwardCompat: string }> = [];
  const sample = row.path_catalogue?.trim();
  const credits = row.path_credits?.trim();
  if (sample) out.push({ kind: 'sample', path: sample, backwardCompat: `${edition}:sample` });
  if (credits) out.push({ kind: 'credits', path: credits, backwardCompat: `${edition}:credits` });
  return out;
}

export class PublicationDocumentImporter extends BaseImporter {
  getName(): string {
    return 'PublicationDocumentImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();
    try {
      const rows = await this.context.legacyDb.query<LegacyEditionDocuments>(
        `SELECT book_id, lang_id, type, edition, publisher_id, path_catalogue, path_credits
           FROM mwnf3.books
          WHERE (path_catalogue IS NOT NULL AND TRIM(path_catalogue) <> '')
             OR (path_credits IS NOT NULL AND TRIM(path_credits) <> '')
          ORDER BY book_id, lang_id, type, edition`
      );
      this.logInfo(`Found ${rows.length} editions with a sample or credits PDF`);

      const orderByPublication = new Map<string, number>();
      for (const row of rows) {
        for (const document of editionDocuments(row)) {
          try {
            const publicationId = await this.getEntityUuidAsync(
              `mwnf3:bookbase:${row.book_id}`,
              'publication'
            );
            if (!publicationId) throw new Error(`publication not found: ${row.book_id}`);
            const editionId = await this.getEntityUuidAsync(
              editionBackwardCompat(row),
              'publication_edition'
            );
            const languageId = await this.getLanguageIdByLegacyCodeAsync(row.lang_id);
            const order = (orderByPublication.get(publicationId) ?? 0) + 1;
            orderByPublication.set(publicationId, order);
            if (this.isDryRun || this.isSampleOnlyMode) {
              result.imported++;
              continue;
            }
            await this.context.strategy.writePublicationDocument({
              publication_id: publicationId,
              publication_edition_id: editionId,
              language_id: languageId,
              kind: document.kind,
              path: document.path,
              original_name: path.basename(document.path),
              mime_type: 'application/pdf',
              size: 1, // Placeholder: document-sync copies the file
              display_order: order,
              backward_compatibility: document.backwardCompat,
            });
            result.imported++;
            this.showProgress();
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            result.errors.push(`${document.backwardCompat}: ${message}`);
            this.logError('PublicationDocumentImporter', message);
            this.showError();
          }
        }
      }
      this.showSummary(result.imported, result.skipped, result.errors.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Error in publication document import: ${message}`);
      this.logError('PublicationDocumentImporter', message);
    }
    result.success = result.errors.length === 0;
    return result;
  }
}
