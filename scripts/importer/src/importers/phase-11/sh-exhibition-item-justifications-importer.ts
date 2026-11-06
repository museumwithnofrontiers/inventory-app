/**
 * Sharing History Exhibition-Item Justifications Importer (theme/subtheme)
 *
 * Merges the legacy theme- and subtheme-level justification texts — 2,310
 * rows across rel_{objects,monuments}_{themes,subthemes}_justification —
 * plus the relation's `curator_status` into the `extra` JSON of the matching
 * `collection_item` pivot rows.
 *
 * Why: ShExhibitionItemImporter imports justifications at the EXHIBITION
 * level only (a documented scope limit); the theme/subtheme pivots were
 * created without them. Legacy renders these texts as the curator-vs-partner
 * hover cards in the Permanent Collection browser
 * (`modules/pclist_all.php:564-725`).
 *
 * The written shape extends the exhibition-level pattern
 * (`extra.justifications = { lang: { partner, curator } }`) and adds
 * `extra.curator_status` when the relation carries one.
 *
 * Standalone (`--only sh-exhibition-item-justifications`) and idempotent;
 * also safe at the end of a full fresh import. Does NOT modify
 * ShExhibitionItemImporter — both the standalone-enrichment path (production
 * today) and the fresh-full-import path converge on the same end state.
 *
 * Dependencies:
 * - ShExhibitionImporter (theme/subtheme collections must exist)
 * - ShExhibitionItemImporter (collection_item pivots must exist)
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';
import { keyByLanguageId } from '../../utils/code-mappings.js';
import { sanitizeJsonField } from '../../utils/html-to-markdown.js';
import { jsonValuesEqual } from '../../utils/json-equal.js';

const SH_SCHEMA = 'mwnf3_sharing_history';

interface ShLegacyRelationRow {
  id: number;
  project_id: string;
  country: string;
  number: number;
  container_id: number;
  curator_status: string | null;
}

interface ShLegacyJustificationRow {
  relation_id: number;
  lang: string;
  justification_partner: string | null;
  justification_curator: string | null;
}

interface RelationSource {
  relationTable: string;
  justificationTable: string;
  itemTable: 'sh_objects' | 'sh_monuments';
  containerColumn: 'theme_id' | 'subtheme_id';
  containerBcTable: 'sh_exhibition_themes' | 'sh_exhibition_subthemes';
}

const SOURCES: RelationSource[] = [
  {
    relationTable: 'rel_objects_themes',
    justificationTable: 'rel_objects_themes_justification',
    itemTable: 'sh_objects',
    containerColumn: 'theme_id',
    containerBcTable: 'sh_exhibition_themes',
  },
  {
    relationTable: 'rel_objects_subthemes',
    justificationTable: 'rel_objects_subthemes_justification',
    itemTable: 'sh_objects',
    containerColumn: 'subtheme_id',
    containerBcTable: 'sh_exhibition_subthemes',
  },
  {
    relationTable: 'rel_monuments_themes',
    justificationTable: 'rel_monuments_themes_justification',
    itemTable: 'sh_monuments',
    containerColumn: 'theme_id',
    containerBcTable: 'sh_exhibition_themes',
  },
  {
    relationTable: 'rel_monuments_subthemes',
    justificationTable: 'rel_monuments_subthemes_justification',
    itemTable: 'sh_monuments',
    containerColumn: 'subtheme_id',
    containerBcTable: 'sh_exhibition_subthemes',
  },
];

export class ShExhibitionItemJustificationsImporter extends BaseImporter {
  getName(): string {
    return 'ShExhibitionItemJustificationsImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      this.logInfo('Merging SH theme/subtheme justifications into collection_item pivots...');

      for (const source of SOURCES) {
        await this.importSource(source, result);
      }

      this.showSummary(result.imported, result.skipped, result.errors.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Failed to merge SH justifications: ${message}`);
      this.logError('ShExhibitionItemJustificationsImporter', message);
      this.showError();
    }

    result.success = result.errors.length === 0;
    return result;
  }

  private async importSource(source: RelationSource, result: ImportResult): Promise<void> {
    const relations = await this.context.legacyDb.query<ShLegacyRelationRow>(
      `SELECT id, project_id, country, number, ${source.containerColumn} AS container_id, curator_status ` +
        `FROM ${SH_SCHEMA}.${source.relationTable} ORDER BY id`
    );

    const justifications = await this.context.legacyDb.query<ShLegacyJustificationRow>(
      `SELECT relation_id, lang, justification_partner, justification_curator ` +
        `FROM ${SH_SCHEMA}.${source.justificationTable} ORDER BY relation_id, lang`
    );

    const justByRelation = new Map<number, ShLegacyJustificationRow[]>();
    for (const row of justifications) {
      const list = justByRelation.get(row.relation_id) ?? [];
      list.push(row);
      justByRelation.set(row.relation_id, list);
    }

    this.logInfo(
      `${source.relationTable}: ${relations.length} relations, ${justifications.length} justification rows`
    );

    for (const relation of relations) {
      try {
        await this.mergeRelation(source, relation, justByRelation.get(relation.id), result);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`${source.relationTable} ${relation.id}: ${message}`);
        this.logError(`${source.relationTable} ${relation.id}`, message);
        this.showError();
      }
    }
  }

  private async mergeRelation(
    source: RelationSource,
    relation: ShLegacyRelationRow,
    justifications: ShLegacyJustificationRow[] | undefined,
    result: ImportResult
  ): Promise<void> {
    // Fields this relation contributes to the pivot's extra.
    const fields: Record<string, unknown> = {};

    const meaningful = (justifications ?? []).filter(
      (j) => j.justification_partner || j.justification_curator
    );
    if (meaningful.length > 0) {
      const byLang: Record<string, { partner: string | null; curator: string | null }> = {};
      for (const j of meaningful) {
        byLang[j.lang] = {
          partner: j.justification_partner || null,
          curator: j.justification_curator || null,
        };
      }
      // Keyed by language id in `extra` (#2394).
      fields.justifications = keyByLanguageId(byLang, (code) =>
        this.logWarning(
          `${source.relationTable} ${relation.id}: justification in unknown language '${code}', skipped`
        )
      );
    }

    const curatorStatus = relation.curator_status?.trim();
    if (curatorStatus === 'Y' || curatorStatus === 'N') {
      fields.curator_status = curatorStatus;
    }

    if (Object.keys(fields).length === 0) {
      result.skipped++;
      this.showSkipped();
      return;
    }

    const collectionBackwardCompat = `${SH_SCHEMA}:${source.containerBcTable}:${relation.container_id}`;
    const itemBackwardCompat = `${SH_SCHEMA}:${source.itemTable}:${relation.project_id.toLowerCase()}:${relation.country.toLowerCase()}:${relation.number}`;

    const collectionId = await this.getEntityUuidAsync(collectionBackwardCompat, 'collection');
    if (!collectionId) {
      this.logWarning(`Collection not found (${collectionBackwardCompat}), skipping`);
      result.skipped++;
      this.showSkipped();
      return;
    }

    const itemId = await this.getEntityUuidAsync(itemBackwardCompat, 'item');
    if (!itemId) {
      this.logWarning(`Item not found (${itemBackwardCompat}), skipping`);
      result.skipped++;
      this.showSkipped();
      return;
    }

    if (this.isDryRun || this.isSampleOnlyMode) {
      this.logInfo(
        `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would merge justifications into pivot ${collectionBackwardCompat} × ${itemBackwardCompat}`
      );
      result.imported++;
      this.showProgress();
      return;
    }

    const existing = await this.context.strategy.getCollectionItemExtra(collectionId, itemId);
    if (existing === null && !(await this.pivotExists(collectionId, itemId))) {
      this.logWarning(
        `Pivot not found (${collectionBackwardCompat} × ${itemBackwardCompat}), skipping — run ShExhibitionItemImporter first`
      );
      result.skipped++;
      this.showSkipped();
      return;
    }

    // `raw` is what's actually sent to setCollectionItemExtra, which
    // sanitises its own argument as every set*Extra* strategy method does;
    // sanitising here too, before the call, would double-convert `fields`
    // and re-convert `existing`'s already-converted content on every write.
    // `merged` sanitises separately, only to know what the write will
    // persist, so it can be compared against what's already there — compared
    // with a key-order-independent check, because comparing the raw legacy
    // text against the stored text made this skip every row that needed
    // *only* conversion (the legacy `<br/>` matched the stored `<br/>`, so
    // "nothing would change" was true of the comparison and false of the
    // write), and MySQL's JSON column doesn't preserve insertion order either
    // way, so a plain JSON.stringify comparison rarely converges even once
    // conversion is accounted for.
    const raw = { ...(existing || {}), ...fields };
    const merged = sanitizeJsonField(raw);

    // Idempotency: skip the write when nothing would change.
    if (jsonValuesEqual(existing || {}, merged)) {
      result.skipped++;
      this.showSkipped();
      return;
    }

    await this.context.strategy.setCollectionItemExtra(collectionId, itemId, JSON.stringify(raw));
    result.imported++;
    this.showProgress();
  }

  /**
   * getCollectionItemExtra returns null both for "no pivot row" and for
   * "pivot row with null extra" — disambiguate through the strategy's
   * pivot-existence check so a missing pivot is skipped with a warning
   * instead of silently updating nothing.
   */
  private async pivotExists(collectionId: string, itemId: string): Promise<boolean> {
    return this.context.strategy.collectionItemPivotExists(collectionId, itemId);
  }
}
