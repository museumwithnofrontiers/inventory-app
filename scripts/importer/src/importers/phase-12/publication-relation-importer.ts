/**
 * Publication relations (M14, #2529, #2530, #2533)
 *
 * - PublicationTagImporter: bookbase.theme_id (category theme), bookbase.target_id
 *   (category audience) and books_books_subjects (category subject) as English tags,
 *   found or created through TagHelper like every other importer's tags.
 * - PublicationCollectionImporter: bookbase.ref_trail "IAM;pt;1" → the Travels
 *   exhibition trail the publication accompanies (11 of 11).
 * - PublicationItemImporter: the objects and monuments whose `linkcatalogs` cite a
 *   trail book they are not an entry of. An item that is an entry of the cited trail
 *   reaches the publication through the trail, so nothing derivable is stored twice.
 *   The codes, as legacy wrote them, go to extra.linkcatalogs.
 * - PublicationExploreLinkImporter: Explore's Travel Book records
 *   (extra.explore_travel.books, written in phase 06) gain the publication_id
 *   their read_more link names.
 *
 * Dependencies: publication; travels-trail; travels-trail-entry; explore-travel
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';
import { TagHelper } from '../../helpers/tag-helper.js';
import {
  parseCatalogueCodes,
  refTrailBackwardCompat,
} from '../../domain/transformers/publication-transformer.js';
import { booksId } from '../phase-06/explore-travel-importer.js';
import { EXPLORE_ROOT_KEY } from '../phase-06/explore-root-collections-importer.js';

export class PublicationTagImporter extends BaseImporter {
  getName(): string {
    return 'PublicationTagImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();
    try {
      const helper = new TagHelper(
        this.context.strategy,
        this.context.tracker,
        this.context.logger
      );
      const links = await this.context.legacyDb.query<{
        book_id: number;
        name: string;
        category: string;
      }>(
        `SELECT b.book_id, t.name, 'theme' AS category
           FROM mwnf3.bookbase b JOIN mwnf3.books_themes t ON t.theme_id = b.theme_id
         UNION ALL
         -- Legacy prints a target reader's English name (books_targetreaders_names),
         -- "Scholars" where its type says "Teachers & Scholars".
         SELECT b.book_id, COALESCE(NULLIF(TRIM(rn.name), ''), r.type) AS name, 'audience' AS category
           FROM mwnf3.bookbase b JOIN mwnf3.books_targetreaders r ON r.target_id = b.target_id
           LEFT JOIN mwnf3.books_targetreaders_names rn ON rn.target_id = r.target_id AND rn.lang_id = 'en'
         UNION ALL
         SELECT s.book_id, n.name, 'subject' AS category
           FROM mwnf3.books_books_subjects s JOIN mwnf3.books_subjects n ON n.subject_id = s.subject_id
         ORDER BY book_id, category, name`
      );
      this.logInfo(`Found ${links.length} publication tag links`);

      for (const link of links) {
        try {
          const publicationId = await this.getEntityUuidAsync(
            `mwnf3:bookbase:${link.book_id}`,
            'publication'
          );
          if (!publicationId) {
            result.skipped++;
            this.showSkipped();
            continue;
          }
          if (this.isDryRun || this.isSampleOnlyMode) {
            result.imported++;
            continue;
          }
          const tagId = await helper.findOrCreate(link.name, link.category, 'eng');
          if (!tagId) {
            result.skipped++;
            this.showSkipped();
            continue;
          }
          await this.context.strategy.writePublicationRelation('publication_tag', {
            publication_id: publicationId,
            related_id: tagId,
          });
          result.imported++;
          this.showProgress();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.errors.push(
            `publication ${link.book_id} tag ${link.category}/${link.name}: ${message}`
          );
          this.logError('PublicationTagImporter', message);
          this.showError();
        }
      }
      this.showSummary(result.imported, result.skipped, result.errors.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Error in publication tag import: ${message}`);
      this.logError('PublicationTagImporter', message);
    }
    result.success = result.errors.length === 0;
    return result;
  }
}

export class PublicationCollectionImporter extends BaseImporter {
  getName(): string {
    return 'PublicationCollectionImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();
    try {
      const works = await this.context.legacyDb.query<{
        book_id: number;
        ref_trail: string | null;
      }>(
        `SELECT book_id, ref_trail FROM mwnf3.bookbase
          WHERE ref_trail IS NOT NULL AND TRIM(ref_trail) <> '' ORDER BY book_id`
      );
      this.logInfo(`Found ${works.length} publications of an exhibition trail`);
      for (const work of works) {
        const trailKey = refTrailBackwardCompat(work.ref_trail);
        try {
          if (!trailKey) throw new Error(`unreadable ref_trail '${work.ref_trail}'`);
          const publicationId = await this.getEntityUuidAsync(
            `mwnf3:bookbase:${work.book_id}`,
            'publication'
          );
          const trailId = await this.getEntityUuidAsync(trailKey, 'collection');
          if (!publicationId || !trailId) {
            throw new Error(`${publicationId ? 'trail' : 'publication'} not found (${trailKey})`);
          }
          if (!this.isDryRun && !this.isSampleOnlyMode) {
            await this.context.strategy.writePublicationRelation('publication_collection', {
              publication_id: publicationId,
              related_id: trailId,
              display_order: 1,
            });
          }
          result.imported++;
          this.showProgress();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.errors.push(`publication ${work.book_id}: ${message}`);
          this.logError('PublicationCollectionImporter', message);
          this.showError();
        }
      }
      this.showSummary(result.imported, result.skipped, result.errors.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Error in publication collection import: ${message}`);
      this.logError('PublicationCollectionImporter', message);
    }
    result.success = result.errors.length === 0;
    return result;
  }
}

interface CodedRow {
  item_key: string;
  linkcatalogs: string;
}

/** One cited trail book per (item, trail), with the codes that cite it. */
export function citations(rows: CodedRow[]): {
  cited: Map<string, { itemKey: string; trailKey: string; codes: string[] }>;
  unparsed: string[];
} {
  const cited = new Map<string, { itemKey: string; trailKey: string; codes: string[] }>();
  const unparsed: string[] = [];
  for (const row of rows) {
    const parsed = parseCatalogueCodes(row.linkcatalogs);
    unparsed.push(...parsed.unparsed.map((u) => `${row.item_key}: ${u}`));
    for (const code of parsed.codes) {
      const key = `${row.item_key}|${code.trailBackwardCompat}`;
      const entry = cited.get(key) ?? {
        itemKey: row.item_key,
        trailKey: code.trailBackwardCompat,
        codes: [],
      };
      if (!entry.codes.includes(code.code)) entry.codes.push(code.code);
      cited.set(key, entry);
    }
  }
  return { cited, unparsed };
}

export class PublicationItemImporter extends BaseImporter {
  getName(): string {
    return 'PublicationItemImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();
    try {
      const rows = await this.context.legacyDb.query<CodedRow>(
        `SELECT CONCAT('mwnf3:objects:', project_id, ':', country, ':', museum_id, ':', number) AS item_key, linkcatalogs
           FROM mwnf3.objects WHERE linkcatalogs IS NOT NULL AND linkcatalogs <> ''
         UNION ALL
         SELECT CONCAT('mwnf3:monuments:', project_id, ':', country, ':', institution_id, ':', number) AS item_key, linkcatalogs
           FROM mwnf3.monuments WHERE linkcatalogs IS NOT NULL AND linkcatalogs <> ''`
      );
      const entries = await this.context.legacyDb.query<{ item_key: string; trail_key: string }>(
        `SELECT CONCAT('mwnf3:objects:', o1_project_id, ':', o1_country_id, ':', o1_museum_id, ':', o1_number) AS item_key,
                CONCAT('mwnf3_travels:trail:', t1_project_id, ':', LOWER(t1_country_id), ':', t1_number) AS trail_key
           FROM mwnf3.objects_trails
         UNION ALL
         SELECT CONCAT('mwnf3:monuments:', m1_project_id, ':', m1_country_id, ':', m1_institution_id, ':', m1_number),
                CONCAT('mwnf3_travels:trail:', t1_project_id, ':', LOWER(t1_country_id), ':', t1_number)
           FROM mwnf3.monuments_trails`
      );
      const works = await this.context.legacyDb.query<{
        book_id: number;
        ref_trail: string | null;
      }>(
        `SELECT book_id, ref_trail FROM mwnf3.bookbase WHERE ref_trail IS NOT NULL AND TRIM(ref_trail) <> ''`
      );
      const publicationByTrail = new Map<string, number>();
      for (const work of works) {
        const key = refTrailBackwardCompat(work.ref_trail);
        if (key) publicationByTrail.set(key, Number(work.book_id));
      }
      const entrySet = new Set(entries.map((e) => `${e.item_key}|${e.trail_key}`));

      const { cited, unparsed } = citations(rows);
      for (const u of unparsed) this.logWarning(`Unreadable catalogue code ${u}`);

      const orderByPublication = new Map<string, number>();
      for (const [key, citation] of cited) {
        if (entrySet.has(key)) continue; // reached through the trail
        try {
          const bookId = publicationByTrail.get(citation.trailKey);
          if (bookId === undefined) {
            this.logWarning(`No publication for the cited trail ${citation.trailKey}`, {
              item: citation.itemKey,
            });
            result.skipped++;
            this.showSkipped();
            continue;
          }
          const publicationId = await this.getEntityUuidAsync(
            `mwnf3:bookbase:${bookId}`,
            'publication'
          );
          const itemId = await this.getEntityUuidAsync(citation.itemKey, 'item');
          if (!publicationId || !itemId) {
            this.logWarning(`Citation not linked: ${citation.itemKey} → ${citation.trailKey}`, {
              publication: publicationId ? 'found' : 'missing',
              item: itemId ? 'found' : 'missing',
            });
            result.skipped++;
            this.showSkipped();
            continue;
          }
          const order = (orderByPublication.get(publicationId) ?? 0) + 1;
          orderByPublication.set(publicationId, order);
          if (!this.isDryRun && !this.isSampleOnlyMode) {
            await this.context.strategy.writePublicationRelation('publication_item', {
              publication_id: publicationId,
              related_id: itemId,
              display_order: order,
              extra: { linkcatalogs: citation.codes },
            });
          }
          result.imported++;
          this.showProgress();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.errors.push(`${key}: ${message}`);
          this.logError('PublicationItemImporter', message);
          this.showError();
        }
      }
      this.showSummary(result.imported, result.skipped, result.errors.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Error in publication item import: ${message}`);
      this.logError('PublicationItemImporter', message);
    }
    result.success = result.errors.length === 0;
    return result;
  }
}

interface ExploreBookRecord {
  id: number;
  texts?: Record<string, { read_more?: string | null }>;
  publication_id?: string | null;
  [key: string]: unknown;
}

/** The legacy books id a Travel Book record's links name: the first language's that has one. */
export function recordBooksId(record: ExploreBookRecord): number | null {
  for (const texts of Object.values(record.texts ?? {})) {
    const id = booksId(texts?.read_more ?? null);
    if (id !== null) return id;
  }
  return null;
}

export class PublicationExploreLinkImporter extends BaseImporter {
  getName(): string {
    return 'PublicationExploreLinkImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();
    try {
      const rootId = await this.getEntityUuidAsync(EXPLORE_ROOT_KEY, 'collection');
      if (!rootId) throw new Error(`Explore root not found (${EXPLORE_ROOT_KEY})`);
      const extra = (await this.context.strategy.getCollectionExtra(rootId)) ?? {};
      const travel = (extra as { explore_travel?: { books?: ExploreBookRecord[] } }).explore_travel;
      const books = travel?.books ?? [];
      for (const record of books) {
        const id = recordBooksId(record);
        const publicationId =
          id === null ? null : await this.getEntityUuidAsync(`mwnf3:bookbase:${id}`, 'publication');
        if (publicationId) {
          record.publication_id = publicationId;
          result.imported++;
        } else {
          this.logWarning(`Explore Travel Book ${record.id} names no imported publication`, {
            books_id: id,
          });
          result.skipped++;
        }
      }
      if (books.length > 0 && !this.isDryRun && !this.isSampleOnlyMode) {
        await this.context.strategy.setCollectionExtra(rootId, JSON.stringify(extra));
      }
      this.showSummary(result.imported, result.skipped, result.errors.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Error in Explore Travel Book link: ${message}`);
      this.logError('PublicationExploreLinkImporter', message);
    }
    result.success = result.errors.length === 0;
    return result;
  }
}
