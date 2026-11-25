/**
 * Sharing History General Historical Background Importer
 *
 * Imports the project-level "Historical Background" module of the legacy
 * Sharing History site (#1498) — distinct from the per-country Historical
 * Profiles (sh_countries_historicalbackground, handled by
 * ShBibliographyHbImporter):
 *
 * - sh_project_about_historical_background(_texts): the perspective pages
 *   rendered by historical_background_pages.php?page=N (AWE: Arab /
 *   Ottoman / European Perspective)
 * - sh_project_about_topics(_texts): the "Read more" topics rendered by
 *   historical_background_readmore.php (AWE: 10 topics)
 *
 * Created structure (per eligible project, lowercase key `k`):
 *
 *   {SH_SCHEMA}:sh_project_about_historical_background:root:{k}   (marker)
 *   ├── {SH_SCHEMA}:sh_project_about_historical_background:{k}:{page_id}
 *   ├── ...
 *   └── {SH_SCHEMA}:sh_project_about_topics:root:{k}              (Read more)
 *       ├── {SH_SCHEMA}:sh_project_about_topics:{k}:{topic_id}
 *       └── ...
 *
 * The marker is a child of the project root collection
 * ({SH_SCHEMA}:sh_projects:{k}), so context-scoped exporters pick the whole
 * subtree up without changes. The markers carry purpose
 * 'historical-background-root' / 'topics-root' (#1505, ensured on reruns
 * over older DBs) so viewers resolve them without backward_compatibility.
 *
 * Only projects legacy actually renders are imported (`show='Y' AND
 * category='SP'` — libs/class.project.inc.php:48): in practice AWE. This
 * also keeps the USA test project's stray topic row out.
 *
 * Standalone (`--only sh-hb-general`) and idempotent (collections are
 * skipped when their backward_compatibility already exists); also safe at
 * the end of a full fresh import.
 *
 * Dependencies:
 * - ShProjectImporter (project root collection + context must exist)
 */

import type { CollectionPurpose } from '../../domain/collection-vocabulary.js';
import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';
import { convertHtmlToMarkdown } from '../../utils/html-to-markdown.js';

const SH_SCHEMA = 'mwnf3_sharing_history';

interface ShLegacyProjectRow {
  project_id: string;
}

interface ShLegacyHbPageRow {
  page_id: number;
}

interface ShLegacyHbPageTextRow {
  page_id: number;
  lang: string;
  title: string | null;
  desc: string | null;
}

interface ShLegacyTopicRow {
  topic_id: number;
  sort_order: number;
}

interface ShLegacyTopicTextRow {
  topic_id: number;
  lang: string;
  title: string | null;
  desc: string | null;
}

export class ShHbGeneralImporter extends BaseImporter {
  getName(): string {
    return 'ShHbGeneralImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      this.logInfo('Importing SH general Historical Background (perspectives + Read-more topics)...');

      // Only projects legacy renders: show='Y' AND category='SP' (AWE).
      const projects = await this.context.legacyDb.query<ShLegacyProjectRow>(
        `SELECT project_id FROM ${SH_SCHEMA}.sh_projects WHERE \`show\` = 'Y' AND category = 'SP' ORDER BY project_id`
      );

      this.logInfo(`Found ${projects.length} eligible SH projects`);

      for (const project of projects) {
        try {
          await this.importProjectHbGeneral(project.project_id, result);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.errors.push(`SH project ${project.project_id}: ${message}`);
          this.logError(`SH project ${project.project_id}`, message);
          this.showError();
        }
      }

      this.showSummary(result.imported, result.skipped, result.errors.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Failed to import SH general Historical Background: ${message}`);
      this.logError('ShHbGeneralImporter', message);
      this.showError();
    }

    result.success = result.errors.length === 0;
    return result;
  }

  private async importProjectHbGeneral(projectId: string, result: ImportResult): Promise<void> {
    const key = projectId.toLowerCase();
    const projectRootBackwardCompat = `${SH_SCHEMA}:sh_projects:${key}`;

    const projectRootId = await this.getEntityUuidAsync(projectRootBackwardCompat, 'collection');
    if (!projectRootId) {
      this.logWarning(
        `SH project root collection not found (${projectRootBackwardCompat}), skipping — run ShProjectImporter first`
      );
      result.skipped++;
      this.showSkipped();
      return;
    }

    const contextId = await this.getEntityUuidAsync(projectRootBackwardCompat, 'context');
    if (!contextId) {
      this.logWarning(
        `SH context not found (${projectRootBackwardCompat}), skipping — run ShProjectImporter first`
      );
      result.skipped++;
      this.showSkipped();
      return;
    }

    const defaultLanguageId = await this.getDefaultLanguageIdAsync();

    // ── Marker: the general Historical Background root ─────────────────────
    const hbRootId = await this.ensureCollection(
      {
        backwardCompat: `${SH_SCHEMA}:sh_project_about_historical_background:root:${key}`,
        internalName: `sh_hb_general_root_${key}`,
        parentId: projectRootId,
        contextId,
        defaultLanguageId,
        displayOrder: 1,
        purpose: 'historical-background-root',
        translations: [{ lang: 'en', title: 'Historical Background', description: null, extra: null }],
      },
      result
    );
    if (!hbRootId) return; // creation failed — children would only dangle

    // ── Perspective pages ──────────────────────────────────────────────────
    const pages = await this.context.legacyDb.query<ShLegacyHbPageRow>(
      `SELECT page_id FROM ${SH_SCHEMA}.sh_project_about_historical_background WHERE project_id = '${projectId}' ORDER BY page_id`
    );
    const pageTexts = await this.context.legacyDb.query<ShLegacyHbPageTextRow>(
      `SELECT page_id, lang, title, \`desc\` FROM ${SH_SCHEMA}.sh_project_about_historical_background_texts WHERE project_id = '${projectId}' ORDER BY page_id, lang`
    );
    const pageTextMap = new Map<number, ShLegacyHbPageTextRow[]>();
    for (const t of pageTexts) {
      if (!pageTextMap.has(t.page_id)) pageTextMap.set(t.page_id, []);
      pageTextMap.get(t.page_id)!.push(t);
    }

    this.logInfo(`${projectId}: ${pages.length} perspective pages, ${pageTexts.length} texts`);

    for (const page of pages) {
      const texts = pageTextMap.get(page.page_id) || [];
      const titleEn = texts.find((t) => t.lang === 'en')?.title || texts[0]?.title || `Page ${page.page_id}`;
      await this.ensureCollection(
        {
          backwardCompat: `${SH_SCHEMA}:sh_project_about_historical_background:${key}:${page.page_id}`,
          internalName: `sh_hb_general_${key}_${titleEn.substring(0, 40)}`,
          parentId: hbRootId,
          contextId,
          defaultLanguageId,
          displayOrder: page.page_id,
          translations: texts.map((t) => ({
            lang: t.lang,
            title: t.title || `Page ${page.page_id}`,
            description: t.desc ? convertHtmlToMarkdown(t.desc) : null,
            extra: { hb_general_type: 'perspective' },
          })),
        },
        result
      );
    }

    // ── Read-more topics ───────────────────────────────────────────────────
    const topics = await this.context.legacyDb.query<ShLegacyTopicRow>(
      `SELECT topic_id, sort_order FROM ${SH_SCHEMA}.sh_project_about_topics WHERE project_id = '${projectId}' ORDER BY sort_order, topic_id`
    );
    const topicTexts = await this.context.legacyDb.query<ShLegacyTopicTextRow>(
      `SELECT topic_id, lang, title, \`desc\` FROM ${SH_SCHEMA}.sh_project_about_topics_texts WHERE project_id = '${projectId}' ORDER BY topic_id, lang`
    );
    const topicTextMap = new Map<number, ShLegacyTopicTextRow[]>();
    for (const t of topicTexts) {
      if (!topicTextMap.has(t.topic_id)) topicTextMap.set(t.topic_id, []);
      topicTextMap.get(t.topic_id)!.push(t);
    }

    this.logInfo(`${projectId}: ${topics.length} Read-more topics, ${topicTexts.length} texts`);

    const topicsRootId = await this.ensureCollection(
      {
        backwardCompat: `${SH_SCHEMA}:sh_project_about_topics:root:${key}`,
        internalName: `sh_hb_topics_root_${key}`,
        parentId: hbRootId,
        contextId,
        defaultLanguageId,
        displayOrder: 90,
        purpose: 'topics-root',
        translations: [{ lang: 'en', title: 'Read more', description: null, extra: null }],
      },
      result
    );
    if (!topicsRootId) return;

    for (const topic of topics) {
      const texts = topicTextMap.get(topic.topic_id) || [];
      const titleEn = texts.find((t) => t.lang === 'en')?.title || texts[0]?.title || `Topic ${topic.topic_id}`;
      await this.ensureCollection(
        {
          backwardCompat: `${SH_SCHEMA}:sh_project_about_topics:${key}:${topic.topic_id}`,
          internalName: `sh_hb_topic_${key}_${titleEn.substring(0, 40)}`,
          parentId: topicsRootId,
          contextId,
          defaultLanguageId,
          displayOrder: topic.sort_order,
          translations: texts.map((t) => ({
            lang: t.lang,
            title: t.title || `Topic ${topic.topic_id}`,
            description: t.desc ? convertHtmlToMarkdown(t.desc) : null,
            extra: { hb_general_type: 'topic' },
          })),
        },
        result
      );
    }
  }

  /**
   * Create a collection with translations unless its backward_compatibility
   * already exists. Returns the collection UUID (existing or created), a
   * placeholder id in dry-run/sample mode, or null when creation failed.
   */
  private async ensureCollection(
    spec: {
      backwardCompat: string;
      internalName: string;
      parentId: string;
      contextId: string;
      defaultLanguageId: string;
      displayOrder: number;
      purpose?: CollectionPurpose;
      translations: Array<{
        lang: string;
        title: string;
        description: string | null;
        extra: Record<string, unknown> | null;
      }>;
    },
    result: ImportResult
  ): Promise<string | null> {
    try {
      if (await this.entityExistsAsync(spec.backwardCompat, 'collection')) {
        const existingId = await this.getEntityUuidAsync(spec.backwardCompat, 'collection');
        // Ensure-semantics (#1505): a marker created before the purpose column
        // existed must still end up purposed, without a full re-import.
        if (spec.purpose && existingId && !this.isDryRun && !this.isSampleOnlyMode) {
          const currentPurpose = await this.context.strategy.getCollectionPurpose(existingId);
          if (currentPurpose === null) {
            await this.context.strategy.updateCollectionPurpose(existingId, spec.purpose);
            this.logInfo(`Set purpose '${spec.purpose}' on ${spec.backwardCompat}`);
            result.imported++;
            this.showProgress();
            return existingId;
          }
        }
        result.skipped++;
        this.showSkipped();
        return existingId;
      }

      if (this.isDryRun || this.isSampleOnlyMode) {
        this.logInfo(
          `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would create collection ${spec.backwardCompat} (${spec.translations.length} translations)`
        );
        this.registerEntity('', spec.backwardCompat, 'collection');
        result.imported++;
        this.showProgress();
        // Placeholder id so dry-run still walks the whole subtree.
        return `dry-run:${spec.backwardCompat}`;
      }

      const collectionId = await this.context.strategy.writeCollection({
        internal_name: spec.internalName,
        backward_compatibility: spec.backwardCompat,
        context_id: spec.contextId,
        language_id: spec.defaultLanguageId,
        parent_id: spec.parentId,
        type: 'collection',
        purpose: spec.purpose ?? null,
        display_order: spec.displayOrder,
      });

      this.registerEntity(collectionId, spec.backwardCompat, 'collection');

      for (const t of spec.translations) {
        try {
          const languageId = await this.getLanguageIdByLegacyCodeAsync(t.lang);
          if (!languageId) {
            this.logWarning(`${spec.backwardCompat}: Unknown language '${t.lang}', skipping translation`);
            continue;
          }

          await this.context.strategy.writeCollectionTranslation({
            collection_id: collectionId,
            language_id: languageId,
            context_id: spec.contextId,
            title: t.title,
            description: t.description,
            extra: t.extra ? JSON.stringify(t.extra) : null,
            backward_compatibility: `${spec.backwardCompat}:${t.lang}`,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.warnings = result.warnings || [];
          result.warnings.push(`${spec.backwardCompat} translation ${t.lang}: ${message}`);
          this.logWarning(`${spec.backwardCompat} translation ${t.lang}: ${message}`);
        }
      }

      result.imported++;
      this.showProgress();
      return collectionId;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`${spec.backwardCompat}: ${message}`);
      this.logError(spec.backwardCompat, message);
      this.showError();
      return null;
    }
  }
}
