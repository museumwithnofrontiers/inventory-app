/**
 * Links Importer (M16 F3, #2653)
 *
 * Moves the links that sit in `extra` to the Link model (see utils/links.ts):
 * the objects' catalogue pages, the partners' websites and the publication
 * editions' shop links. The audio, video and document media are written as
 * links by their own importers.
 *
 * The object, partner and edition importers of every legacy database write
 * these keys, and later steps move translations between contexts, so the move
 * runs once, after every one of them (`runsLast`). It reads nothing from the
 * legacy database; values are copied as stored.
 *
 * Idempotent: a moved key is gone, and a link's id comes from its legacy key.
 * Run it again with `--only links` after re-running one of the writers.
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';
import {
  planCatalogueLinks,
  planPartnerUrlLinks,
  planShopLinks,
  type LinkPlan,
} from '../../utils/links.js';

export class LinksImporter extends BaseImporter {
  getName(): string {
    return 'LinksImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      const strategy = this.context.strategy;

      this.logInfo('Moving catalogue_holding_link from item_translations.extra to links...');
      await this.apply(
        result,
        'Item translation',
        planCatalogueLinks(await strategy.findCatalogueLinkRows()),
        (id, extra) => strategy.setItemTranslationColumnsAsStoredById(id, {}, extra)
      );

      this.logInfo('Moving urls from partner_translations.extra to links...');
      await this.apply(
        result,
        'Partner translation',
        planPartnerUrlLinks(await strategy.findPartnerUrlRows()),
        (id, extra) => strategy.setExtraAsStoredById('partner_translations', id, extra)
      );

      this.logInfo('Moving shop_links from publication_editions.extra to links...');
      await this.apply(
        result,
        'Publication edition',
        planShopLinks(await strategy.findShopLinkRows()),
        (id, extra) => strategy.setExtraAsStoredById('publication_editions', id, extra)
      );

      this.showSummary(result.imported, result.skipped, result.errors.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Failed to move links: ${message}`);
    }

    result.success = result.errors.length === 0;
    return result;
  }

  private async apply(
    result: ImportResult,
    label: string,
    plan: LinkPlan,
    setExtra: (id: string, extra: string | null) => Promise<void>
  ): Promise<void> {
    for (const kept of plan.kept) {
      this.logWarning(`${label} ${kept.id}: ${kept.reason}, left in extra`);
      result.skipped++;
    }
    this.logInfo(`${plan.links.length} link(s) from ${plan.updates.length} row(s)`);

    // Two links with one legacy key would share an id, and the second would
    // overwrite the first: refuse the whole plan rather than lose one.
    const keys = plan.links.map((link) => link.backward_compatibility.toLowerCase());
    const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);
    if (duplicates.length > 0) {
      result.errors.push(
        `${label}: ${duplicates.length} link key(s) repeat, e.g. ${duplicates[0]}; nothing moved`
      );
      this.logError(label, `link keys repeat: ${duplicates.slice(0, 3).join(', ')}`);
      return;
    }

    if (this.isDryRun || this.isSampleOnlyMode) {
      this.logInfo(
        `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would write ${plan.links.length} link(s)`
      );
      result.imported += plan.links.length;
      return;
    }

    // The links first: the rows lose their keys only once every link exists.
    let failed = 0;
    for (const link of plan.links) {
      try {
        await this.context.strategy.writeLink(link);
        result.imported++;
        this.showProgress();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failed++;
        result.errors.push(`Link ${link.backward_compatibility}: ${message}`);
        this.logError(`Link ${link.backward_compatibility}`, message);
        this.showError();
      }
    }
    if (failed > 0) {
      this.logWarning(
        `${label}: ${failed} link(s) failed, so every key stays in extra; run the step again`
      );
      return;
    }
    for (const update of plan.updates) {
      try {
        await setExtra(update.id, update.extra === null ? null : JSON.stringify(update.extra));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`${label} ${update.id}: ${message}`);
        this.logError(`${label} ${update.id}`, message);
      }
    }
  }
}
