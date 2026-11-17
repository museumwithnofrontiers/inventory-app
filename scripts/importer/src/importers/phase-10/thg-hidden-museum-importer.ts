/**
 * THG Hidden Museum Importer
 *
 * Imports the partners an exhibition's curators explicitly suppressed from its
 * partner pages: museums and, since MWNF-655, the monument institutions.
 *
 * Partner lists are not stored: the exporter derives them from the exhibition's
 * membership (the partners of the items it shows). Legacy does the same and then
 * subtracts these tables, so without them a rebuilt site would display partners
 * the curators deliberately hid.
 *
 * Legacy schema:
 * - mwnf3_thematic_gallery.exhibition_hidden_mwnf3_museums (gallery_id, museum_id, country_id)
 * - mwnf3_thematic_gallery.exhibition_hidden_mwnf3_institutions (gallery_id, institution_id, country_id)
 *   - newer than the museums table: a legacy copy without it hides no institution
 * - the sibling exhibition_hidden_sh_museums table is empty and is not imported
 *
 * New schema:
 * - collections.extra.thg_gallery.hidden_partners on the exhibition collection:
 *     [ { "backward_compatibility": "mwnf3:museums:Mus52:uk", "partner_id": "<uuid>" },
 *       { "backward_compatibility": "mwnf3:institutions:Mon01:es", "partner_id": "<uuid>" }, … ]
 *
 * Both the key and the resolved id are stored: the key keeps the entry readable
 * and diffable against legacy, the id spares the exporter a lookup. A partner
 * that never resolved is kept with a null partner_id rather than dropped — an
 * unresolvable exclusion still has to be honoured.
 *
 * Both tables are written in one pass, because the list is replaced as a whole
 * per exhibition: a second step writing the institutions would erase the museums.
 *
 * Dependencies:
 * - ThgGalleryImporter (exhibition collections)
 * - PartnerImporter (museums and institutions as partners)
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';
import { formatBackwardCompatibility } from '../../utils/backward-compatibility.js';

interface LegacyHiddenRow {
  gallery_id: number;
  partner_id: string;
  country_id: string;
}

interface HiddenRow extends LegacyHiddenRow {
  table: 'museums' | 'institutions';
}

interface HiddenPartner {
  backward_compatibility: string;
  partner_id: string | null;
}

export class ThgHiddenMuseumImporter extends BaseImporter {
  getName(): string {
    return 'ThgHiddenMuseumImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      this.logInfo('Importing hidden-partner exclusions for exhibitions...');

      const museums = await this.readTable(
        result,
        'exhibition_hidden_mwnf3_museums',
        'museum_id',
        'museums'
      );
      if (museums === null) return result;
      const institutions =
        (await this.readTable(
          result,
          'exhibition_hidden_mwnf3_institutions',
          'institution_id',
          'institutions'
        )) ?? [];

      this.logInfo(
        `Found ${museums.length} hidden-museum and ${institutions.length} hidden-institution rows to process`
      );

      // One write per gallery, so the exclusion list is replaced as a whole
      const byGallery = new Map<number, HiddenRow[]>();
      for (const row of [...museums, ...institutions]) {
        const existing = byGallery.get(row.gallery_id);
        if (existing) {
          existing.push(row);
        } else {
          byGallery.set(row.gallery_id, [row]);
        }
      }

      for (const [galleryId, rows] of byGallery) {
        try {
          const galleryBackwardCompat = `mwnf3_thematic_gallery:thg_gallery:${galleryId}`;
          const collectionId = await this.getEntityUuidAsync(galleryBackwardCompat, 'collection');
          if (!collectionId) {
            result.warnings = result.warnings || [];
            result.warnings.push(
              `Hidden partners for gallery ${galleryId}: collection not found (${galleryBackwardCompat}), skipping`
            );
            result.skipped += rows.length;
            this.showSkipped();
            continue;
          }

          const hiddenPartners: HiddenPartner[] = [];
          for (const row of rows) {
            const partnerBackwardCompat = formatBackwardCompatibility({
              schema: 'mwnf3',
              table: row.table,
              pkValues: [row.partner_id, row.country_id],
            });

            const partnerId = await this.getEntityUuidAsync(partnerBackwardCompat, 'partner');
            if (!partnerId) {
              result.warnings = result.warnings || [];
              result.warnings.push(
                `Hidden partner ${partnerBackwardCompat} (gallery ${galleryId}): partner not found, kept as an unresolved exclusion`
              );
            }

            hiddenPartners.push({
              backward_compatibility: partnerBackwardCompat,
              partner_id: partnerId ?? null,
            });

            this.collectSample(
              row.table === 'museums'
                ? 'thg_exhibition_hidden_museum'
                : 'thg_exhibition_hidden_institution',
              { ...row, resolved_partner_backward_compat: partnerBackwardCompat },
              'success'
            );

            result.imported++;
            this.showProgress();
          }

          if (this.isDryRun || this.isSampleOnlyMode) {
            this.logInfo(
              `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would store ${hiddenPartners.length} hidden partners on ${galleryBackwardCompat}`
            );
            continue;
          }

          const existingExtra =
            (await this.context.strategy.getCollectionExtra(collectionId)) ?? {};
          const galleryExtra = {
            ...((existingExtra.thg_gallery as Record<string, unknown> | undefined) ?? {}),
            hidden_partners: hiddenPartners,
          };

          await this.context.strategy.setCollectionExtra(
            collectionId,
            JSON.stringify({ ...existingExtra, thg_gallery: galleryExtra })
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.errors.push(`Hidden partners for gallery ${galleryId}: ${message}`);
          this.logError(`Hidden partners for gallery ${galleryId}`, message);
          this.showError();
        }
      }

      this.showSummary(result.imported, result.skipped, result.errors.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.success = false;
      result.errors.push(message);
      this.logError('ThgHiddenMuseumImporter', message);
    }

    return result;
  }

  /**
   * One hidden-partner table, or null when the legacy copy lacks it (with a
   * warning). Rows come in gallery, country, partner order, so two imports of
   * one legacy database write the same list.
   */
  private async readTable(
    result: ImportResult,
    tableName: string,
    idColumn: 'museum_id' | 'institution_id',
    partnerTable: HiddenRow['table']
  ): Promise<HiddenRow[] | null> {
    try {
      const rows = await this.context.legacyDb.query<LegacyHiddenRow>(
        `SELECT gallery_id, ${idColumn} AS partner_id, country_id
         FROM mwnf3_thematic_gallery.${tableName}
         ORDER BY gallery_id, country_id, ${idColumn}`
      );
      return rows.map((row) => ({ ...row, table: partnerTable }));
    } catch (queryError) {
      const message = queryError instanceof Error ? queryError.message : String(queryError);
      if (message.includes("doesn't exist") || message.includes('Unknown column')) {
        this.logInfo(`⚠️ Skipping: Legacy ${tableName} table not available (${message})`);
        result.warnings = result.warnings || [];
        result.warnings.push(`Legacy ${tableName} table not available: ${message}`);
        return null;
      }
      throw queryError;
    }
  }
}
