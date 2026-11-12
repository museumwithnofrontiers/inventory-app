import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';

export class ProjectCleanupImporter extends BaseImporter {
  getName(): string {
    return 'ProjectCleanupImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      this.logInfo('Removing projects that have neither items nor publications...');

      const dry = this.isDryRun || this.isSampleOnlyMode;

      // Request strategy to perform the transactional select+delete (strategy handles dry-run)
      const projects = await this.context.strategy.deleteProjectsWithoutItems(dry);

      if (!projects || projects.length === 0) {
        this.logInfo('No empty projects found');
        return result;
      }

      this.logInfo(`Found ${projects.length} project(s) with neither items nor publications`);

      let deletedCount = 0;

      for (const p of projects) {
        const bc = p.backward_compatibility ?? p.id;
        const name = p.internal_name ?? '<no-name>';

        if (dry) {
          this.logInfo(
            `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would delete project ${bc} — ${name}`
          );
          result.imported++;
          this.showProgress();
          continue;
        }

        this.logInfo(`Deleting project ${bc} — ${name}`);
        deletedCount++;
        result.imported++;
        this.showProgress();
      }

      this.logInfo(`  Projects removed: ${deletedCount}`);
      this.showSummary(result.imported, result.skipped, result.errors.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Project cleanup failed: ${message}`);
      result.success = false;
      this.logError('ProjectCleanupImporter', message);
    }

    result.success = result.errors.length === 0;
    return result;
  }
}
