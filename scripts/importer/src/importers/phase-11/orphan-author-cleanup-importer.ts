/**
 * Orphan Author Cleanup Importer (M16 J4, #2711)
 *
 * AuthorHelper.findOrCreate makes an Author from the free credit text of
 * objects, monuments, and Explore and Travels translations. The credit
 * junction later points the translation at legacy's own credit-table author,
 * so many of these rows end up with nothing referring to them. The credit
 * text itself stays as written in `item_translations.author_credit`.
 *
 * This step deletes the authors with no legacy key (`backward_compatibility`)
 * that no row of any table refers to. Legacy authors are never touched.
 *
 * It runs last, after every step that could still point at an author. It
 * reads nothing from the legacy database, and is idempotent.
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';

export class OrphanAuthorCleanupImporter extends BaseImporter {
  getName(): string {
    return 'OrphanAuthorCleanupImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();
    const dry = this.isDryRun || this.isSampleOnlyMode;

    try {
      this.logInfo('Removing the free-text authors nothing refers to...');
      const deleted = await this.context.strategy.deleteOrphanFreeTextAuthors(dry);

      for (const a of deleted) {
        if (dry) {
          this.logInfo(
            `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would remove author "${a.name}"`
          );
        }
        result.imported++;
        this.showProgress();
      }

      this.logInfo(`  Authors removed: ${deleted.length}`);
      this.showSummary(result.imported, result.skipped, result.errors.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Orphan author cleanup failed: ${message}`);
      this.logError('OrphanAuthorCleanupImporter', message);
    }

    result.success = result.errors.length === 0;
    return result;
  }
}
