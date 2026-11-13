/**
 * Publication Image Importer (M14, #2531)
 *
 * Covers and sample pages (D-P6: both now) from mwnf3.books_pictures, as
 * publication_images rows with the size placeholder 1: image-sync then takes each
 * file through the upload pipeline like every other legacy picture, and logs a
 * file the legacy share lacks as "legacy image not found".
 *
 * - type cover: books/{book}/{lang}/{publisher}/{booktype}/{n}.jpg; n is the
 *   edition whose cover it is, so publication_edition_id is that edition.
 * - type page: books/{book}/{lang}/{publisher}/{booktype}/pages/{n}.jpg; n is the
 *   page number. Pages carry no edition number, so they are linked to the
 *   edition only when exactly one edition has that language, publisher and format.
 * - caption → alt_text; the copyright as legacy has it (empty: ResolvesCopyright
 *   then resolves the project); the photographer → extra.photographer.
 *
 * Dependencies: publication-edition
 */

import path from 'path';
import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';
import { convertHtmlToMarkdown } from '../../utils/html-to-markdown.js';
import { editionBackwardCompat } from '../../domain/transformers/publication-transformer.js';
import { deterministicUuid } from '../../utils/deterministic-uuid.js';

interface LegacyPicture {
  book_id: number;
  lang_id: string;
  booktype: string;
  image_number: number;
  path: string;
  caption: string | null;
  photographer: string | null;
  copyright: string | null;
  type: 'cover' | 'page';
  publisher_id: number | null;
}

interface LegacyEditionKey {
  book_id: number;
  lang_id: string;
  type: string;
  edition: string | null;
  publisher_id: number | null;
}

/** The edition a picture belongs to, or null when legacy does not say. */
export function pictureEditionKey(
  picture: LegacyPicture,
  editions: LegacyEditionKey[]
): string | null {
  const same = editions.filter(
    (e) =>
      Number(e.book_id) === Number(picture.book_id) &&
      e.lang_id === picture.lang_id &&
      e.type === picture.booktype &&
      Number(e.publisher_id) === Number(picture.publisher_id)
  );
  if (picture.type === 'cover') {
    const edition = same.find((e) => Number(e.edition) === Number(picture.image_number));
    return edition ? editionBackwardCompat(edition) : null;
  }
  return same.length === 1 ? editionBackwardCompat(same[0]!) : null;
}

function mimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : 'image/jpeg';
}

export class PublicationImageImporter extends BaseImporter {
  getName(): string {
    return 'PublicationImageImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();
    try {
      const pictures = await this.context.legacyDb.query<LegacyPicture>(
        `SELECT book_id, lang_id, booktype, image_number, path, caption, photographer, copyright, type, publisher_id
           FROM mwnf3.books_pictures
          WHERE path IS NOT NULL AND TRIM(path) <> ''
          ORDER BY book_id, type, lang_id, booktype, image_number`
      );
      const editions = await this.context.legacyDb.query<LegacyEditionKey>(
        `SELECT book_id, lang_id, type, edition, publisher_id FROM mwnf3.books`
      );
      this.logInfo(`Found ${pictures.length} publication pictures`);

      // Legacy gives two versions one file (a print-on-demand version shows its print
      // version's cover, book/2.jpg): each version gets its own row, so neither loses
      // its picture. A row that names no version is left out when a version shows its file.
      const plan = pictures.map((picture) => ({
        picture,
        editionKey: pictureEditionKey(picture, editions),
      }));
      const fileOf = (picture: LegacyPicture) => `${picture.book_id}|${picture.path.trim()}`;
      const shownByVersion = new Set(
        plan.filter((p) => p.editionKey).map((p) => fileOf(p.picture))
      );
      const filesWritten = new Set<string>();
      const rowsWritten = new Set<string>();

      const orderByPublication = new Map<string, number>();
      for (const { picture, editionKey } of plan) {
        const label = `${picture.book_id}/${picture.lang_id}/${picture.booktype}/${picture.type}/${picture.image_number}`;
        try {
          const publicationId = await this.getEntityUuidAsync(
            `mwnf3:bookbase:${picture.book_id}`,
            'publication'
          );
          if (!publicationId) throw new Error('publication not found');
          const legacyPath = picture.path.trim();
          const file = fileOf(picture);
          const row = `${file}|${editionKey ?? ''}`;
          // The file's first row keeps the id its path gives (the /pub URLs the packages
          // carry); another version's row of the same file gets an id of its own.
          const another = filesWritten.has(file);
          // A row no version shows writes nothing, so it claims no file: the version
          // that shows the file still takes the path's id.
          const skip =
            (!editionKey && shownByVersion.has(file)) ||
            rowsWritten.has(row) ||
            (!another &&
              (await this.imageExistsAsync('publication_images', publicationId, legacyPath)) &&
              (filesWritten.add(file), true));
          if (skip) {
            rowsWritten.add(row);
            result.skipped++;
            this.showSkipped();
            continue;
          }
          rowsWritten.add(row);
          filesWritten.add(file);
          const id = another
            ? deterministicUuid(
                `image:${publicationId}:${legacyPath.toLowerCase()}#${editionKey ?? ''}`
              )
            : undefined;
          const editionId = editionKey
            ? await this.getEntityUuidAsync(editionKey, 'publication_edition')
            : null;
          if (picture.type === 'cover' && !editionId) {
            this.logWarning(`Cover without its edition: ${label}`);
          }

          const order = (orderByPublication.get(publicationId) ?? 0) + 1;
          orderByPublication.set(publicationId, order);
          const photographer = picture.photographer?.trim();

          if (this.isDryRun || this.isSampleOnlyMode) {
            result.imported++;
            this.showProgress();
            continue;
          }
          await this.context.strategy.writePublicationImage({
            ...(id ? { id } : {}),
            publication_id: publicationId,
            publication_edition_id: editionId,
            kind: picture.type,
            path: legacyPath,
            original_name: path.basename(legacyPath),
            mime_type: mimeType(legacyPath),
            size: 1, // Placeholder: image-sync fetches the file
            alt_text: picture.caption?.trim() ? convertHtmlToMarkdown(picture.caption) : null,
            copyright: picture.copyright?.trim() || null,
            display_order: order,
            extra: photographer ? JSON.stringify({ photographer }) : null,
          });
          result.imported++;
          this.showProgress();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.errors.push(`${label}: ${message}`);
          this.logError('PublicationImageImporter', message, { label });
          this.showError();
        }
      }
      this.showSummary(result.imported, result.skipped, result.errors.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Error in publication image import: ${message}`);
      this.logError('PublicationImageImporter', message);
    }
    result.success = result.errors.length === 0;
    return result;
  }
}
