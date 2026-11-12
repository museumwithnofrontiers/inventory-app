/**
 * Travels Trail Entry Importer
 *
 * Makes the Islamic Art objects and monuments of an exhibition trail members of
 * the trail collection: legacy lists them as the trail's entries ("Related
 * exhibition trails" on the item sheet).
 *
 * Legacy schema:
 * - mwnf3.objects_trails (id, o1_project_id, o1_country_id, o1_museum_id, o1_number,
 *   t1_project_id, t1_country_id, t1_number)
 * - mwnf3.monuments_trails (id, m1_project_id, m1_country_id, m1_institution_id, m1_number,
 *   t1_project_id, t1_country_id, t1_number)
 * - mwnf3.objects_trails_justification (relation_id → objects_trails.id, lang_id, justification)
 *
 * New schema:
 * - collection_item (collection_id = the trail, item_id = the object or monument, extra)
 *   The justification goes into extra.contextual_descriptions { language id: text },
 *   as the thematic galleries' and Sharing History's memberships carry theirs.
 *
 * Travels trails have no direct members otherwise (their monuments hang on the
 * locations), so a trail's direct members are exactly these entries.
 *
 * Dependencies:
 * - object, monument (phase 01)
 * - travels-trail
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';

interface LegacyObjectTrail {
  id: number;
  o1_project_id: string;
  o1_country_id: string;
  o1_museum_id: string;
  o1_number: number;
  t1_project_id: string;
  t1_country_id: string;
  t1_number: number;
}

interface LegacyMonumentTrail {
  id: number;
  m1_project_id: string;
  m1_country_id: string;
  m1_institution_id: string;
  m1_number: number;
  t1_project_id: string;
  t1_country_id: string;
  t1_number: number;
}

interface LegacyJustification {
  relation_id: number;
  lang_id: string;
  justification: string | null;
}

/** One trail entry, whichever table it came from. */
export interface TrailEntry {
  trailBackwardCompat: string;
  itemBackwardCompat: string;
  /** objects_trails.id, the key of its justifications; null for monuments. */
  objectRelationId: number | null;
}

export function trailBackwardCompat(project: string, country: string, number: number): string {
  return `mwnf3_travels:trail:${project}:${country}:${number}`;
}

export function objectTrailEntry(row: LegacyObjectTrail): TrailEntry {
  return {
    trailBackwardCompat: trailBackwardCompat(row.t1_project_id, row.t1_country_id, row.t1_number),
    itemBackwardCompat: `mwnf3:objects:${row.o1_project_id}:${row.o1_country_id}:${row.o1_museum_id}:${row.o1_number}`,
    objectRelationId: row.id,
  };
}

export function monumentTrailEntry(row: LegacyMonumentTrail): TrailEntry {
  return {
    trailBackwardCompat: trailBackwardCompat(row.t1_project_id, row.t1_country_id, row.t1_number),
    itemBackwardCompat: `mwnf3:monuments:${row.m1_project_id}:${row.m1_country_id}:${row.m1_institution_id}:${row.m1_number}`,
    objectRelationId: null,
  };
}

export class TravelsTrailEntryImporter extends BaseImporter {
  getName(): string {
    return 'TravelsTrailEntryImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      const objects = await this.context.legacyDb.query<LegacyObjectTrail>(
        `SELECT id, o1_project_id, o1_country_id, o1_museum_id, o1_number,
                t1_project_id, t1_country_id, t1_number
           FROM mwnf3.objects_trails ORDER BY id`
      );
      const monuments = await this.context.legacyDb.query<LegacyMonumentTrail>(
        `SELECT id, m1_project_id, m1_country_id, m1_institution_id, m1_number,
                t1_project_id, t1_country_id, t1_number
           FROM mwnf3.monuments_trails ORDER BY id`
      );
      const justifications = await this.context.legacyDb.query<LegacyJustification>(
        `SELECT relation_id, lang_id, justification FROM mwnf3.objects_trails_justification`
      );

      const byRelation = new Map<number, LegacyJustification[]>();
      for (const j of justifications) {
        if (!j.justification || !j.justification.trim()) continue;
        const list = byRelation.get(j.relation_id) ?? [];
        list.push(j);
        byRelation.set(j.relation_id, list);
      }

      const entries = [...objects.map(objectTrailEntry), ...monuments.map(monumentTrailEntry)];
      this.logInfo(
        `Found ${entries.length} trail entries (${objects.length} objects, ${monuments.length} monuments)`
      );

      // display_order follows the legacy row order within each trail
      const orderByTrail = new Map<string, number>();

      for (const entry of entries) {
        try {
          const trailId = await this.getEntityUuidAsync(entry.trailBackwardCompat, 'collection');
          if (!trailId) {
            this.logWarning(`Trail not found for entry: ${entry.trailBackwardCompat}`, {
              item: entry.itemBackwardCompat,
            });
            result.skipped++;
            this.showSkipped();
            continue;
          }
          const itemId = await this.getEntityUuidAsync(entry.itemBackwardCompat, 'item');
          if (!itemId) {
            this.logWarning(`Item not found for trail entry: ${entry.itemBackwardCompat}`, {
              trail: entry.trailBackwardCompat,
            });
            result.skipped++;
            this.showSkipped();
            continue;
          }

          const order = (orderByTrail.get(trailId) ?? 0) + 1;
          orderByTrail.set(trailId, order);

          let extra: Record<string, unknown> | null = null;
          const texts =
            entry.objectRelationId !== null ? byRelation.get(entry.objectRelationId) : undefined;
          if (texts && texts.length > 0) {
            const contextual: Record<string, string> = {};
            for (const t of texts) {
              const languageId = await this.getLanguageIdByLegacyCodeAsync(t.lang_id);
              if (!languageId) {
                this.logWarning(`Language not found for justification: ${t.lang_id}`, {
                  relation_id: t.relation_id,
                });
                continue;
              }
              contextual[languageId] = t.justification!.trim();
            }
            if (Object.keys(contextual).length > 0) extra = { contextual_descriptions: contextual };
          }

          if (this.isDryRun || this.isSampleOnlyMode) {
            result.imported++;
            this.showProgress();
            continue;
          }

          await this.context.strategy.writeCollectionItem({
            collection_id: trailId,
            item_id: itemId,
            display_order: order,
            extra,
          });
          result.imported++;
          this.showProgress();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.errors.push(
            `${entry.trailBackwardCompat} ← ${entry.itemBackwardCompat}: ${message}`
          );
          this.logError('TravelsTrailEntryImporter', message, { ...entry });
          this.showError();
        }
      }

      this.showSummary(result.imported, result.skipped, result.errors.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Error in trail entry import: ${message}`);
      this.logError('TravelsTrailEntryImporter', message);
      this.showError();
    }

    result.success = result.errors.length === 0;
    return result;
  }
}
