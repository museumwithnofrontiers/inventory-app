/**
 * Project Shell Cleanup Importer (M16 J1, #2708)
 *
 * ProjectImporter and ShProjectImporter create a context, a root collection
 * and a project for every legacy project. `project-cleanup` then deletes the
 * projects with neither items nor publications, but only their `projects`
 * row: the root collection and the context stayed, as empty roots in the
 * panel, twins of the THG gallery or exhibition the sites use.
 *
 * This step removes such a root collection (with its translations) when no
 * row refers to it, then its context when no row refers to that either.
 * A root that still has children (Sharing History rus and usa) or a context
 * that still holds a row (CLO's author CVs) is kept and reported.
 *
 * It runs last, after every step that could still write to a project's
 * collection or context. It reads nothing from the legacy database, and is
 * idempotent.
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';

export class ProjectShellCleanupImporter extends BaseImporter {
  getName(): string {
    return 'ProjectShellCleanupImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();
    const dry = this.isDryRun || this.isSampleOnlyMode;
    const prefix = dry
      ? `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would remove`
      : 'Removed';

    try {
      this.logInfo('Removing the root collections and contexts of deleted projects...');
      const cleanup = await this.context.strategy.deleteProjectShells(dry);

      for (const c of cleanup.collections) {
        this.logInfo(`${prefix} project collection ${c.backward_compatibility}`);
        result.imported++;
        this.showProgress();
      }
      for (const c of cleanup.contexts) {
        this.logInfo(`${prefix} project context ${c.backward_compatibility}`);
      }
      for (const k of cleanup.kept) {
        this.logInfo(
          `Kept project ${k.kind} ${k.backward_compatibility}: referenced by ${k.referencedBy.join(', ')}`
        );
        result.skipped++;
      }

      this.logInfo(
        `  Collections removed: ${cleanup.collections.length}, contexts removed: ${cleanup.contexts.length}, kept: ${cleanup.kept.length}`
      );
      this.showSummary(result.imported, result.skipped, result.errors.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Project shell cleanup failed: ${message}`);
      this.logError('ProjectShellCleanupImporter', message);
    }

    result.success = result.errors.length === 0;
    return result;
  }
}
