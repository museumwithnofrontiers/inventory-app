/**
 * THG Hidden Museum Importer
 *
 * The partners an exhibition's curators explicitly suppressed from its
 * partner pages: museums and, since MWNF-655, the monument institutions.
 *
 * Partner lists are not stored: the exporter derives them from the exhibition's
 * membership (the partners of the items it shows). Legacy does the same and then
 * subtracts these tables, so without them a rebuilt site would display partners
 * the curators deliberately hid.
 *
 * Site configuration (M16 E4b, decision 6): nothing is written to the
 * inventory. `siteConfiguration()` builds the list for the `site-config`
 * command, which keeps it in the exhibition's instance file as
 * `extra.thg_gallery.hidden_partners`:
 *     [ { "backward_compatibility": "mwnf3:museums:Mus52:uk", "partner_id": "<uuid>" },
 *       { "backward_compatibility": "mwnf3:institutions:Mon01:es", "partner_id": "<uuid>" }, … ]
 *
 * Both the key and the partner's id are kept: the key keeps the entry readable
 * and diffable against legacy, the id spares the exporter a lookup.
 *
 * Legacy schema:
 * - mwnf3_thematic_gallery.exhibition_hidden_mwnf3_museums (gallery_id, museum_id, country_id)
 * - mwnf3_thematic_gallery.exhibition_hidden_mwnf3_institutions (gallery_id, institution_id, country_id)
 *   - newer than the museums table: a legacy copy without it hides no institution
 * - the sibling exhibition_hidden_sh_museums table is empty and is not read
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';
import { formatBackwardCompatibility } from '../../utils/backward-compatibility.js';
import type { SiteConfigBuilder, SiteConfigEntry } from '../../site-config/types.js';

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

export class ThgHiddenMuseumImporter extends BaseImporter implements SiteConfigBuilder {
  getName(): string {
    return 'ThgHiddenMuseumImporter';
  }

  /** The import writes nothing: the lists are site configuration (see siteConfiguration). */
  async import(): Promise<ImportResult> {
    const result = this.createResult();
    this.logInfo('Hidden partners are site configuration: run the site-config command');
    return result;
  }

  /** Each exhibition's hidden partners, for its instance file. */
  async siteConfiguration(): Promise<SiteConfigEntry[]> {
    const museums = (await this.readTable('exhibition_hidden_mwnf3_museums', 'museum_id', 'museums')) ?? [];
    const institutions =
      (await this.readTable('exhibition_hidden_mwnf3_institutions', 'institution_id', 'institutions')) ?? [];

    // One list per gallery, museums first, each in gallery, country, partner order
    const byGallery = new Map<number, HiddenRow[]>();
    for (const row of [...museums, ...institutions]) {
      byGallery.set(row.gallery_id, [...(byGallery.get(row.gallery_id) ?? []), row]);
    }

    const entries: SiteConfigEntry[] = [];
    for (const [galleryId, rows] of byGallery) {
      const hiddenPartners: HiddenPartner[] = [];
      for (const row of rows) {
        const partnerBackwardCompat = formatBackwardCompatibility({
          schema: 'mwnf3',
          table: row.table,
          pkValues: [row.partner_id, row.country_id],
        });
        const partnerId = await this.getEntityUuidAsync(partnerBackwardCompat, 'partner');
        hiddenPartners.push({ backward_compatibility: partnerBackwardCompat, partner_id: partnerId ?? null });
      }
      entries.push({
        collection: `mwnf3_thematic_gallery:thg_gallery:${galleryId}`,
        extra: { thg_gallery: { hidden_partners: hiddenPartners } },
      });
    }
    return entries;
  }

  /**
   * One hidden-partner table, or null when the legacy copy lacks it. Rows come
   * in gallery, country, partner order, so two runs on one legacy database
   * build the same list.
   */
  private async readTable(
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
        this.logWarning(`Legacy ${tableName} table not available (${message})`);
        return null;
      }
      throw queryError;
    }
  }
}
