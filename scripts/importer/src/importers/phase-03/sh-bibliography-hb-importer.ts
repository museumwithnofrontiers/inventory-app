/**
 * SH Bibliography + Historical Background Importer
 *
 * Story 10.1: Imports SH structured bibliography (denormalized into targets)
 * and the Historical Background hierarchical content.
 *
 * Bibliography:
 * - Shared resolver: sh_bibliography + sh_bibliography_langs → formatted Markdown strings
 * - Exhibition bibliography (126 rows) → inject CollectionTranslation.extra.bibliography
 * - Object bibliography (109 rows) → inject ItemTranslation.extra.structured_bibliography
 * - Monument bibliography (10 rows) → inject ItemTranslation.extra.structured_bibliography
 * - HB bibliography (2 rows) → inject CollectionTranslation.extra.bibliography
 *
 * Historical Background:
 * - 20 HB parent Collections (type=collection, under SH root, with country_id)
 * - 63 HB page Collections (children of parents)
 * - 128 item-reference HB images → collection_item pivot
 * - 12 custom HB images → CollectionImage
 * - 21 HB map images → CollectionImage on parent Collections, tagged with 'map'
 * - 21 image captions → CollectionTranslation.extra.image_captions
 * - 22 map descriptions → CollectionImage.alt_text
 *
 * Legacy schema: mwnf3_sharing_history
 *
 * Dependencies:
 * - ShExhibitionImporter (SH exhibition collections must exist)
 * - ShObjectImporter, ShMonumentImporter (SH items must exist)
 * - CountryImporter, LanguageImporter
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';
import type {
  ShLegacyBibliography,
  ShLegacyBibliographyLang,
  ShLegacyBibliographyExhibition,
  ShLegacyBibliographyObject,
  ShLegacyBibliographyMonument,
  ShLegacyBibliographyHb,
  ShLegacyHistoricalBackground,
  ShLegacyHistoricalBackgroundText,
  ShLegacyHistoricalBackgroundPage,
  ShLegacyHistoricalBackgroundPageText,
  ShLegacyHistoricalBackgroundImage,
  ShLegacyHistoricalBackgroundImageText,
  ShLegacyHistoricalBackgroundMap,
  ShLegacyHistoricalBackgroundMapText,
} from '../../domain/types/index.js';
import { TagHelper } from '../../helpers/tag-helper.js';
import { mapCountryCode } from '../../utils/code-mappings.js';
import { convertHtmlToMarkdown } from '../../utils/html-to-markdown.js';
import { orderLikeLegacy } from '../../utils/legacy-collation.js';

const SH_SCHEMA = 'mwnf3_sharing_history';

/**
 * Resolved bibliography entry: formatted Markdown string per language, separated by active/disabled.
 */
interface ResolvedBibliography {
  active: Map<string, string[]>; // lang → sorted entries
  disabled: Map<string, string[]>; // lang → sorted entries
}

export class ShBibliographyHbImporter extends BaseImporter {
  // Pre-loaded bibliography resolver: biblio_id → { lang, desc, legacy text, status }
  private biblioEntries: Map<
    number,
    Array<{ lang: string; desc: string; text: string; status: string }>
  > | null = null;

  // Per-SH-project scope (project root collection + context), resolved lazily
  // by backward-compatibility key. `null` caches a project whose root/context
  // is missing so we only warn once.
  private projectScopes = new Map<string, { rootId: string; contextId: string } | null>();

  private tagHelper: TagHelper | null = null;

  private getTagHelper(): TagHelper {
    this.tagHelper ??= new TagHelper(
      this.context.strategy,
      this.context.tracker,
      this.context.logger
    );
    return this.tagHelper;
  }

  /**
   * Resolve the root collection + context of an SH project (#1494: HB records
   * carry their own project_id — never assume AWE).
   */
  private async resolveProjectScope(
    projectId: string
  ): Promise<{ rootId: string; contextId: string } | null> {
    const key = projectId.toLowerCase();
    const cached = this.projectScopes.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const projectBackwardCompat = `${SH_SCHEMA}:sh_projects:${key}`;
    const rootId = await this.getEntityUuidAsync(projectBackwardCompat, 'collection');
    const contextId = await this.getEntityUuidAsync(projectBackwardCompat, 'context');

    const scope = rootId && contextId ? { rootId, contextId } : null;
    if (!scope) {
      this.logWarning(
        `SH project ${key}: root collection or context not found (${projectBackwardCompat}) — its HB content will be skipped`
      );
    }
    this.projectScopes.set(key, scope);
    return scope;
  }

  getName(): string {
    return 'ShBibliographyHbImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      this.logInfo('Importing SH Bibliography and Historical Background...');

      // Pre-load bibliography resolver
      await this.loadBibliographyResolver();

      // ========================================================================
      // Part A: Bibliography injection
      // ========================================================================
      await this.injectExhibitionBibliography(result);
      await this.injectObjectBibliography(result);
      await this.injectMonumentBibliography(result);

      // ========================================================================
      // Part B: Historical Background hierarchy
      // ========================================================================
      await this.importHBParentCollections(result);
      await this.importHBPageCollections(result);
      await this.importHBPageImages(result);
      await this.importHBMaps(result);
      await this.importHBImageCaptions(result);
      await this.importHBMapDescriptions(result);

      // HB bibliography injection (2 rows) — done after parent collections exist
      await this.injectHBBibliography(result);

      this.showSummary(result.imported, result.skipped, result.errors.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.success = false;
      result.errors.push(message);
      this.logError('ShBibliographyHbImporter', message);
    }

    return result;
  }

  // ==========================================================================
  // Bibliography resolver
  // ==========================================================================

  private async loadBibliographyResolver(): Promise<void> {
    const entries = await this.context.legacyDb.query<ShLegacyBibliography>(
      `SELECT biblio_id, original_title, lang, status
       FROM ${SH_SCHEMA}.sh_bibliography
       ORDER BY biblio_id`
    );

    const langs = await this.context.legacyDb.query<ShLegacyBibliographyLang>(
      `SELECT biblio_id, lang, \`desc\`
       FROM ${SH_SCHEMA}.sh_bibliography_langs
       WHERE \`desc\` IS NOT NULL AND \`desc\` != ''
       ORDER BY biblio_id, lang`
    );

    // Build status map
    const statusMap = new Map<number, string>();
    for (const e of entries) {
      statusMap.set(e.biblio_id, e.status);
    }

    // Group langs by biblio_id
    this.biblioEntries = new Map();
    for (const l of langs) {
      if (!this.biblioEntries.has(l.biblio_id)) {
        this.biblioEntries.set(l.biblio_id, []);
      }
      this.biblioEntries.get(l.biblio_id)!.push({
        lang: l.lang,
        desc: convertHtmlToMarkdown(l.desc),
        text: l.desc,
        status: statusMap.get(l.biblio_id) || 'A',
      });
    }

    this.logInfo(
      `Loaded bibliography resolver: ${entries.length} entries, ${langs.length} translations`
    );
  }

  /**
   * Resolve a set of bibliography links (with sort_order/sort_status) to formatted strings
   * grouped by language, separated into active/disabled, each list in the order legacy
   * displayed it (modules/bibliography.php through class.br.inc.php): in `sort_order` when
   * the list was ordered by hand (legacy reads `sort_status` off its first relation), else
   * by the text, in each language. Items have no `sort_status`: legacy always sorted them
   * by their text.
   */
  private resolveBibliography(
    links: Array<{ biblio_id: number; sort_order: number; sort_status: string }>
  ): ResolvedBibliography {
    const result: ResolvedBibliography = {
      active: new Map(),
      disabled: new Map(),
    };

    const byHand = links[0]?.sort_status === 'Y';
    const lists = { active: new Map(), disabled: new Map() } as Record<
      'active' | 'disabled',
      Map<string, Array<{ sort_order: number; text: string; desc: string }>>
    >;
    for (const link of links) {
      const entries = this.biblioEntries?.get(link.biblio_id);
      if (!entries) continue;

      for (const entry of entries) {
        const target = entry.status === 'A' ? lists.active : lists.disabled;
        if (!target.has(entry.lang)) {
          target.set(entry.lang, []);
        }
        target
          .get(entry.lang)!
          .push({ sort_order: link.sort_order, text: entry.text, desc: entry.desc });
      }
    }
    for (const kind of ['active', 'disabled'] as const) {
      for (const [lang, list] of lists[kind]) {
        result[kind].set(
          lang,
          orderLikeLegacy(list, byHand).map((entry) => entry.desc)
        );
      }
    }

    return result;
  }

  /**
   * Convert ResolvedBibliography to JSON-serializable object for extra field.
   */
  private bibliographyToExtraFields(resolved: ResolvedBibliography): Record<string, unknown> {
    const extra: Record<string, unknown> = {};
    if (resolved.active.size > 0) {
      extra.bibliography = Object.fromEntries(resolved.active);
    }
    if (resolved.disabled.size > 0) {
      extra.disabled_bibliography = Object.fromEntries(resolved.disabled);
    }
    return extra;
  }

  // ==========================================================================
  // Part A: Bibliography injection
  // ==========================================================================

  private async injectExhibitionBibliography(result: ImportResult): Promise<void> {
    const links = await this.context.legacyDb.query<ShLegacyBibliographyExhibition>(
      `SELECT biblio_id, exhibition_id, sort_order, sort_status
       FROM ${SH_SCHEMA}.rel_sh_bibliography_exhibition
       ORDER BY exhibition_id, sort_order`
    );

    this.logInfo(`Found ${links.length} exhibition bibliography links`);

    // Group by exhibition_id
    const grouped = new Map<number, typeof links>();
    for (const link of links) {
      if (!grouped.has(link.exhibition_id)) {
        grouped.set(link.exhibition_id, []);
      }
      grouped.get(link.exhibition_id)!.push(link);
    }

    for (const [exhibitionId, exhLinks] of grouped.entries()) {
      try {
        const collectionBackwardCompat = `${SH_SCHEMA}:sh_exhibitions:${exhibitionId}`;
        const collectionId = await this.getEntityUuidAsync(collectionBackwardCompat, 'collection');
        if (!collectionId) {
          result.warnings = result.warnings || [];
          result.warnings.push(
            `Bib exh ${exhibitionId}: Collection not found (${collectionBackwardCompat})`
          );
          this.logWarning(
            `Bib exh ${exhibitionId}: Collection not found (${collectionBackwardCompat}), skipping`
          );
          result.skipped++;
          this.showSkipped();
          continue;
        }

        const resolved = this.resolveBibliography(exhLinks);
        const bibFields = this.bibliographyToExtraFields(resolved);
        if (Object.keys(bibFields).length === 0) {
          result.skipped++;
          this.showSkipped();
          continue;
        }

        if (this.isDryRun || this.isSampleOnlyMode) {
          result.imported++;
          this.showProgress();
          continue;
        }

        // Inject into each language's CollectionTranslation.extra
        await this.mergeExtraIntoCollectionTranslations(
          collectionId,
          bibFields,
          result,
          `Bib exh ${exhibitionId}`
        );

        result.imported++;
        this.showProgress();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`Bib exh ${exhibitionId}: ${message}`);
        this.logError(`Bib exh ${exhibitionId}`, message);
        this.showError();
      }
    }
  }

  private async injectObjectBibliography(result: ImportResult): Promise<void> {
    const links = await this.context.legacyDb.query<ShLegacyBibliographyObject>(
      `SELECT project_id, country, number, biblio_id
       FROM ${SH_SCHEMA}.rel_sh_bibliography_objects
       ORDER BY project_id, country, number, biblio_id`
    );

    this.logInfo(`Found ${links.length} object bibliography links`);

    // Group by item key
    const grouped = new Map<string, typeof links>();
    for (const link of links) {
      const key = `${link.project_id}:${link.country}:${link.number}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(link);
    }

    for (const [key, itemLinks] of grouped.entries()) {
      try {
        const [projectId, country, numberStr] = key.split(':');
        const itemBackwardCompat = `${SH_SCHEMA}:sh_objects:${projectId!.toLowerCase()}:${country!.toLowerCase()}:${numberStr}`;
        const itemId = await this.getEntityUuidAsync(itemBackwardCompat, 'item');
        if (!itemId) {
          result.warnings = result.warnings || [];
          result.warnings.push(`Bib obj ${key}: Item not found (${itemBackwardCompat})`);
          this.logWarning(`Bib obj ${key}: Item not found (${itemBackwardCompat}), skipping`);
          result.skipped++;
          this.showSkipped();
          continue;
        }

        const resolved = this.resolveBibliography(
          itemLinks.map((l) => ({ biblio_id: l.biblio_id, sort_order: 0, sort_status: 'N' }))
        );
        if (resolved.active.size === 0 && resolved.disabled.size === 0) {
          result.skipped++;
          this.showSkipped();
          continue;
        }

        const bibFields: Record<string, unknown> = {};
        if (resolved.active.size > 0) {
          bibFields.structured_bibliography = Object.fromEntries(resolved.active);
        }
        if (resolved.disabled.size > 0) {
          bibFields.disabled_structured_bibliography = Object.fromEntries(resolved.disabled);
        }

        if (this.isDryRun || this.isSampleOnlyMode) {
          result.imported++;
          this.showProgress();
          continue;
        }

        await this.mergeExtraIntoItemTranslations(itemId, bibFields, result, `Bib obj ${key}`);

        result.imported++;
        this.showProgress();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`Bib obj ${key}: ${message}`);
        this.logError(`Bib obj ${key}`, message);
        this.showError();
      }
    }
  }

  private async injectMonumentBibliography(result: ImportResult): Promise<void> {
    const links = await this.context.legacyDb.query<ShLegacyBibliographyMonument>(
      `SELECT project_id, country, number, biblio_id
       FROM ${SH_SCHEMA}.rel_sh_bibliography_monuments
       ORDER BY project_id, country, number, biblio_id`
    );

    this.logInfo(`Found ${links.length} monument bibliography links`);

    // Group by item key
    const grouped = new Map<string, typeof links>();
    for (const link of links) {
      const key = `${link.project_id}:${link.country}:${link.number}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(link);
    }

    for (const [key, itemLinks] of grouped.entries()) {
      try {
        const [projectId, country, numberStr] = key.split(':');
        const itemBackwardCompat = `${SH_SCHEMA}:sh_monuments:${projectId!.toLowerCase()}:${country!.toLowerCase()}:${numberStr}`;
        const itemId = await this.getEntityUuidAsync(itemBackwardCompat, 'item');
        if (!itemId) {
          result.warnings = result.warnings || [];
          result.warnings.push(`Bib mon ${key}: Item not found (${itemBackwardCompat})`);
          this.logWarning(`Bib mon ${key}: Item not found (${itemBackwardCompat}), skipping`);
          result.skipped++;
          this.showSkipped();
          continue;
        }

        const resolved = this.resolveBibliography(
          itemLinks.map((l) => ({ biblio_id: l.biblio_id, sort_order: 0, sort_status: 'N' }))
        );
        if (resolved.active.size === 0 && resolved.disabled.size === 0) {
          result.skipped++;
          this.showSkipped();
          continue;
        }

        const bibFields: Record<string, unknown> = {};
        if (resolved.active.size > 0) {
          bibFields.structured_bibliography = Object.fromEntries(resolved.active);
        }
        if (resolved.disabled.size > 0) {
          bibFields.disabled_structured_bibliography = Object.fromEntries(resolved.disabled);
        }

        if (this.isDryRun || this.isSampleOnlyMode) {
          result.imported++;
          this.showProgress();
          continue;
        }

        await this.mergeExtraIntoItemTranslations(itemId, bibFields, result, `Bib mon ${key}`);

        result.imported++;
        this.showProgress();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`Bib mon ${key}: ${message}`);
        this.logError(`Bib mon ${key}`, message);
        this.showError();
      }
    }
  }

  private async injectHBBibliography(result: ImportResult): Promise<void> {
    const links = await this.context.legacyDb.query<ShLegacyBibliographyHb>(
      `SELECT hb_id, biblio_id, sort_order, sort_status
       FROM ${SH_SCHEMA}.rel_sh_bibliography_hb
       ORDER BY hb_id, sort_order`
    );

    this.logInfo(`Found ${links.length} HB bibliography links`);

    // Group by hb_id
    const grouped = new Map<number, typeof links>();
    for (const link of links) {
      if (!grouped.has(link.hb_id)) {
        grouped.set(link.hb_id, []);
      }
      grouped.get(link.hb_id)!.push(link);
    }

    for (const [hbId, hbLinks] of grouped.entries()) {
      try {
        const collectionBackwardCompat = `${SH_SCHEMA}:sh_countries_historicalbackground:${hbId}`;
        const collectionId = await this.getEntityUuidAsync(collectionBackwardCompat, 'collection');
        if (!collectionId) {
          result.warnings = result.warnings || [];
          result.warnings.push(`Bib HB ${hbId}: Collection not found`);
          this.logWarning(`Bib HB ${hbId}: Collection not found, skipping`);
          result.skipped++;
          this.showSkipped();
          continue;
        }

        const resolved = this.resolveBibliography(hbLinks);
        const bibFields = this.bibliographyToExtraFields(resolved);
        if (Object.keys(bibFields).length === 0) {
          result.skipped++;
          this.showSkipped();
          continue;
        }

        if (this.isDryRun || this.isSampleOnlyMode) {
          result.imported++;
          this.showProgress();
          continue;
        }

        await this.mergeExtraIntoCollectionTranslations(
          collectionId,
          bibFields,
          result,
          `Bib HB ${hbId}`
        );

        result.imported++;
        this.showProgress();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`Bib HB ${hbId}: ${message}`);
        this.logError(`Bib HB ${hbId}`, message);
        this.showError();
      }
    }
  }

  // ==========================================================================
  // Part B: Historical Background
  // ==========================================================================

  private async importHBParentCollections(result: ImportResult): Promise<void> {
    const hbs = await this.context.legacyDb.query<ShLegacyHistoricalBackground>(
      `SELECT hb_id, countryId, gn, project_id
       FROM ${SH_SCHEMA}.sh_countries_historicalbackground
       ORDER BY hb_id`
    );

    // Pre-load HB texts for title
    const texts = await this.context.legacyDb.query<ShLegacyHistoricalBackgroundText>(
      `SELECT hb_id, lang, name
       FROM ${SH_SCHEMA}.sh_countries_historicalbackground_texts
       WHERE name IS NOT NULL AND name != ''
       ORDER BY hb_id, lang`
    );
    const textMap = new Map<number, ShLegacyHistoricalBackgroundText[]>();
    for (const t of texts) {
      if (!textMap.has(t.hb_id)) {
        textMap.set(t.hb_id, []);
      }
      textMap.get(t.hb_id)!.push(t);
    }

    this.logInfo(`Found ${hbs.length} HB parent records`);

    const defaultLanguageId = await this.getDefaultLanguageIdAsync();

    for (const hb of hbs) {
      try {
        const backwardCompat = `${SH_SCHEMA}:sh_countries_historicalbackground:${hb.hb_id}`;

        if (await this.entityExistsAsync(backwardCompat, 'collection')) {
          result.skipped++;
          this.showSkipped();
          continue;
        }

        // Each HB record belongs to its own SH project (#1494)
        const scope = await this.resolveProjectScope(hb.project_id);
        if (!scope) {
          result.warnings = result.warnings || [];
          result.warnings.push(
            `HB ${hb.hb_id}: SH project ${hb.project_id} root/context not found, skipping`
          );
          result.skipped++;
          this.showSkipped();
          continue;
        }

        // Resolve country to canonical ISO-3 ID
        let countryId: string | null = null;
        if (hb.countryId && hb.gn !== 'yes') {
          try {
            countryId = mapCountryCode(hb.countryId);
          } catch {
            this.logWarning(`HB ${hb.hb_id}: Unknown country code '${hb.countryId}'`);
          }
        }

        const hbType = hb.gn === 'yes' ? 'general' : 'country';
        const hbTexts = textMap.get(hb.hb_id) || [];
        const titleEn = hbTexts.find((t) => t.lang === 'en')?.name || hbTexts[0]?.name;
        const internalName = `sh_hb_${hb.hb_id}_${(titleEn || hb.countryId || 'general').substring(0, 40)}`;

        if (this.isDryRun || this.isSampleOnlyMode) {
          this.registerEntity('', backwardCompat, 'collection');
          result.imported++;
          this.showProgress();
          continue;
        }

        const collectionId = await this.context.strategy.writeCollection({
          internal_name: internalName,
          backward_compatibility: backwardCompat,
          context_id: scope.contextId,
          language_id: defaultLanguageId,
          parent_id: scope.rootId,
          type: 'collection',
          country_id: countryId,
        });

        this.registerEntity(collectionId, backwardCompat, 'collection');

        // Write translations
        for (const t of hbTexts) {
          try {
            const languageId = await this.getLanguageIdByLegacyCodeAsync(t.lang);
            if (!languageId) {
              this.logWarning(`HB ${hb.hb_id}: Unknown language '${t.lang}', skipping translation`);
              continue;
            }

            const extra: Record<string, unknown> = { hb_type: hbType };

            await this.context.strategy.writeCollectionTranslation({
              collection_id: collectionId,
              language_id: languageId,
              context_id: scope.contextId,
              title: t.name,
              description: null,
              extra: JSON.stringify(extra),
              backward_compatibility: `${SH_SCHEMA}:sh_countries_historicalbackground_texts:${hb.hb_id}:${t.lang}`,
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            result.warnings = result.warnings || [];
            result.warnings.push(`HB ${hb.hb_id} translation ${t.lang}: ${message}`);
            this.logWarning(`HB ${hb.hb_id} translation ${t.lang}: ${message}`);
          }
        }

        result.imported++;
        this.showProgress();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`HB ${hb.hb_id}: ${message}`);
        this.logError(`HB ${hb.hb_id}`, message);
        this.showError();
      }
    }
  }

  private async importHBPageCollections(result: ImportResult): Promise<void> {
    const pages = await this.context.legacyDb.query<ShLegacyHistoricalBackgroundPage>(
      `SELECT page_id, hb_id, sort_order, remark
       FROM ${SH_SCHEMA}.sh_countries_historicalbackground_pages
       ORDER BY hb_id, sort_order, page_id`
    );

    // Pre-load page texts
    const pageTexts = await this.context.legacyDb.query<ShLegacyHistoricalBackgroundPageText>(
      `SELECT page_id, lang, subtitle, text
       FROM ${SH_SCHEMA}.sh_countries_historicalbackground_page_texts
       WHERE (subtitle IS NOT NULL AND subtitle != '') OR (text IS NOT NULL AND text != '')
       ORDER BY page_id, lang`
    );
    const pageTextMap = new Map<number, ShLegacyHistoricalBackgroundPageText[]>();
    for (const t of pageTexts) {
      if (!pageTextMap.has(t.page_id)) {
        pageTextMap.set(t.page_id, []);
      }
      pageTextMap.get(t.page_id)!.push(t);
    }

    this.logInfo(`Found ${pages.length} HB pages, ${pageTexts.length} page texts`);

    // Pages inherit the project of their parent HB record (#1494)
    const hbProjects = await this.context.legacyDb.query<{ hb_id: number; project_id: string }>(
      `SELECT hb_id, project_id
       FROM ${SH_SCHEMA}.sh_countries_historicalbackground
       ORDER BY hb_id`
    );
    const hbProjectMap = new Map(hbProjects.map((r) => [r.hb_id, r.project_id]));

    const defaultLanguageId = await this.getDefaultLanguageIdAsync();

    for (const page of pages) {
      try {
        const backwardCompat = `${SH_SCHEMA}:sh_countries_historicalbackground_pages:${page.page_id}`;

        if (await this.entityExistsAsync(backwardCompat, 'collection')) {
          result.skipped++;
          this.showSkipped();
          continue;
        }

        const parentBackwardCompat = `${SH_SCHEMA}:sh_countries_historicalbackground:${page.hb_id}`;
        const parentId = await this.getEntityUuidAsync(parentBackwardCompat, 'collection');
        if (!parentId) {
          result.warnings = result.warnings || [];
          result.warnings.push(
            `HB page ${page.page_id}: Parent HB not found (${parentBackwardCompat})`
          );
          this.logWarning(`HB page ${page.page_id}: Parent HB not found, skipping`);
          result.skipped++;
          this.showSkipped();
          continue;
        }

        const project = hbProjectMap.get(page.hb_id);
        const scope = project ? await this.resolveProjectScope(project) : null;
        if (!scope) {
          result.warnings = result.warnings || [];
          result.warnings.push(
            `HB page ${page.page_id}: SH project ${project ?? '?'} root/context not found, skipping`
          );
          result.skipped++;
          this.showSkipped();
          continue;
        }

        const pTexts = pageTextMap.get(page.page_id) || [];
        const firstSubtitle = pTexts.find((t) => t.subtitle)?.subtitle;
        const internalName = `sh_hb_page_${page.page_id}_${(firstSubtitle || 'page').substring(0, 40)}`;

        if (this.isDryRun || this.isSampleOnlyMode) {
          this.registerEntity('', backwardCompat, 'collection');
          result.imported++;
          this.showProgress();
          continue;
        }

        const collectionId = await this.context.strategy.writeCollection({
          internal_name: internalName,
          backward_compatibility: backwardCompat,
          context_id: scope.contextId,
          language_id: defaultLanguageId,
          parent_id: parentId,
          type: 'collection',
          display_order: page.sort_order,
        });

        this.registerEntity(collectionId, backwardCompat, 'collection');

        // Write page translations
        for (const t of pTexts) {
          try {
            const languageId = await this.getLanguageIdByLegacyCodeAsync(t.lang);
            if (!languageId) {
              this.logWarning(
                `HB page ${page.page_id}: Unknown language '${t.lang}', skipping translation`
              );
              continue;
            }

            const extra: Record<string, unknown> = {};
            if (page.remark) extra.remark = page.remark;

            await this.context.strategy.writeCollectionTranslation({
              collection_id: collectionId,
              language_id: languageId,
              context_id: scope.contextId,
              title: t.subtitle || `Page ${page.sort_order}`,
              description: t.text ? convertHtmlToMarkdown(t.text) : null,
              extra: Object.keys(extra).length > 0 ? JSON.stringify(extra) : null,
              backward_compatibility: `${SH_SCHEMA}:sh_countries_historicalbackground_page_texts:${page.page_id}:${t.lang}`,
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            result.warnings = result.warnings || [];
            result.warnings.push(`HB page ${page.page_id} translation ${t.lang}: ${message}`);
            this.logWarning(`HB page ${page.page_id} translation ${t.lang}: ${message}`);
          }
        }

        result.imported++;
        this.showProgress();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`HB page ${page.page_id}: ${message}`);
        this.logError(`HB page ${page.page_id}`, message);
        this.showError();
      }
    }
  }

  private async importHBPageImages(result: ImportResult): Promise<void> {
    const images = await this.context.legacyDb.query<ShLegacyHistoricalBackgroundImage>(
      `SELECT hb_img_id, page_id, ref_item, item_type, picture, sort_order
       FROM ${SH_SCHEMA}.sh_countries_historicalbackground_images
       ORDER BY page_id, sort_order`
    );

    this.logInfo(`Found ${images.length} HB page images`);

    let itemRefs = 0;
    let customImages = 0;

    for (const img of images) {
      try {
        const pageBackwardCompat = `${SH_SCHEMA}:sh_countries_historicalbackground_pages:${img.page_id}`;
        const collectionId = await this.getEntityUuidAsync(pageBackwardCompat, 'collection');
        if (!collectionId) {
          result.warnings = result.warnings || [];
          result.warnings.push(`HB image ${img.hb_img_id}: Page collection not found`);
          this.logWarning(`HB image ${img.hb_img_id}: Page collection not found, skipping`);
          result.skipped++;
          this.showSkipped();
          continue;
        }

        if (img.ref_item && img.ref_item.trim()) {
          // Item reference → collection_item pivot
          const itemBackwardCompat = this.resolveImageItemReference(img.ref_item, img.item_type);
          if (!itemBackwardCompat) {
            result.warnings = result.warnings || [];
            result.warnings.push(
              `HB image ${img.hb_img_id}: Could not parse ref_item '${img.ref_item}'`
            );
            this.logWarning(
              `HB image ${img.hb_img_id}: Could not parse ref_item '${img.ref_item}', skipping`
            );
            result.skipped++;
            this.showSkipped();
            continue;
          }

          const itemId = await this.getEntityUuidAsync(itemBackwardCompat, 'item');
          if (!itemId) {
            result.warnings = result.warnings || [];
            result.warnings.push(
              `HB image ${img.hb_img_id}: Item not found (${itemBackwardCompat})`
            );
            this.logWarning(
              `HB image ${img.hb_img_id}: Item not found (${itemBackwardCompat}), skipping`
            );
            result.skipped++;
            this.showSkipped();
            continue;
          }

          if (this.isDryRun || this.isSampleOnlyMode) {
            result.imported++;
            itemRefs++;
            this.showProgress();
            continue;
          }

          await this.context.strategy.writeCollectionItem({
            collection_id: collectionId,
            item_id: itemId,
            display_order: img.sort_order,
            extra: { picture: img.picture },
          });

          itemRefs++;
          result.imported++;
          this.showProgress();
        } else {
          // Custom image → CollectionImage. collection_images has no
          // backward_compatibility column — identity is (owner, legacy path).
          if (await this.imageExistsAsync('collection_images', collectionId, img.picture)) {
            result.skipped++;
            this.showSkipped();
            continue;
          }

          if (this.isDryRun || this.isSampleOnlyMode) {
            result.imported++;
            customImages++;
            this.showProgress();
            continue;
          }

          await this.context.strategy.writeCollectionImage({
            collection_id: collectionId,
            path: img.picture,
            original_name: img.picture.split('/').pop() || img.picture,
            mime_type: 'image/jpeg',
            size: 1,
            alt_text: null,
            display_order: img.sort_order,
          });

          customImages++;
          result.imported++;
          this.showProgress();
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`HB image ${img.hb_img_id}: ${message}`);
        this.logError(`HB image ${img.hb_img_id}`, message);
        this.showError();
      }
    }

    this.logInfo(`HB images: ${itemRefs} item refs, ${customImages} custom images`);
  }

  private async importHBMaps(result: ImportResult): Promise<void> {
    const maps = await this.context.legacyDb.query<ShLegacyHistoricalBackgroundMap>(
      `SELECT map_id, hb_id, map_path, sort_order
       FROM ${SH_SCHEMA}.sh_countries_historicalbackground_maps
       ORDER BY hb_id, sort_order`
    );

    this.logInfo(`Found ${maps.length} HB maps`);
    if (maps.length === 0) {
      return;
    }

    // Resolve the map tag through TagHelper, which owns the tag key format
    // (`mwnf3:tags:{category}:{language}:{name}`) and is self-creating. The
    // previous hand-built lookup for 'mwnf3:tags:image-type:map' had no
    // language segment and matched nothing, so maps were silently never
    // tagged. findOrCreate writes, so it stays behind the dry-run guard.
    let mapTagId: string | null = null;
    if (!this.isDryRun && !this.isSampleOnlyMode) {
      const defaultLanguageId = await this.getDefaultLanguageIdAsync();
      mapTagId = await this.getTagHelper().findOrCreate('map', 'image-type', defaultLanguageId);

      if (!mapTagId) {
        this.logWarning('Map tag not found — maps will not be tagged');
      }
    }

    for (const map of maps) {
      try {
        const parentBackwardCompat = `${SH_SCHEMA}:sh_countries_historicalbackground:${map.hb_id}`;
        const collectionId = await this.getEntityUuidAsync(parentBackwardCompat, 'collection');
        if (!collectionId) {
          result.warnings = result.warnings || [];
          result.warnings.push(`HB map ${map.map_id}: Parent HB not found`);
          this.logWarning(`HB map ${map.map_id}: Parent HB not found, skipping`);
          result.skipped++;
          this.showSkipped();
          continue;
        }

        // collection_images has no backward_compatibility column — identity
        // is (owner, legacy path).
        if (await this.imageExistsAsync('collection_images', collectionId, map.map_path)) {
          result.skipped++;
          this.showSkipped();
          continue;
        }

        if (this.isDryRun || this.isSampleOnlyMode) {
          result.imported++;
          this.showProgress();
          continue;
        }

        const imageId = await this.context.strategy.writeCollectionImage({
          collection_id: collectionId,
          path: map.map_path,
          original_name: map.map_path.split('/').pop() || map.map_path,
          mime_type: 'image/jpeg',
          size: 1,
          alt_text: null,
          display_order: map.sort_order,
        });

        // Tag with 'map'
        if (mapTagId) {
          await this.getTagHelper().attachToCollectionImage(imageId, [mapTagId]);
        }

        result.imported++;
        this.showProgress();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`HB map ${map.map_id}: ${message}`);
        this.logError(`HB map ${map.map_id}`, message);
        this.showError();
      }
    }
  }

  private async importHBImageCaptions(result: ImportResult): Promise<void> {
    const captions = await this.context.legacyDb.query<ShLegacyHistoricalBackgroundImageText>(
      `SELECT hb_img_id, lang, name, sname, name_detail, date, dynasty, museum, location, artist, material
       FROM ${SH_SCHEMA}.sh_countries_historicalbackground_image_texts
       WHERE (name IS NOT NULL AND name != '') OR (sname IS NOT NULL)
       ORDER BY hb_img_id, lang`
    );

    this.logInfo(`Found ${captions.length} HB image captions`);

    // Look up which page each image belongs to
    const imagePages = await this.context.legacyDb.query<{ hb_img_id: number; page_id: number }>(
      `SELECT hb_img_id, page_id
       FROM ${SH_SCHEMA}.sh_countries_historicalbackground_images`
    );
    const imagePageMap = new Map(imagePages.map((r) => [r.hb_img_id, r.page_id]));

    // Group captions by page collection → build image_captions extra per page
    const pageCaptions = new Map<number, Record<string, Record<string, Record<string, string>>>>();
    // Structure: page_id → { image_backward_compat → { lang → caption_fields } }

    for (const caption of captions) {
      try {
        const pageId = imagePageMap.get(caption.hb_img_id);
        if (!pageId) {
          this.logWarning(`HB caption for image ${caption.hb_img_id}: Page not found, skipping`);
          continue;
        }

        // Build caption object
        const captionObj: Record<string, string> = {};
        if (caption.name) captionObj.name = convertHtmlToMarkdown(caption.name);
        if (caption.sname) captionObj.sname = convertHtmlToMarkdown(caption.sname);
        if (caption.name_detail)
          captionObj.name_detail = convertHtmlToMarkdown(caption.name_detail);
        if (caption.date) captionObj.date = caption.date;
        if (caption.dynasty) captionObj.dynasty = caption.dynasty;
        if (caption.museum) captionObj.museum = caption.museum;
        if (caption.location) captionObj.location = caption.location;
        if (caption.artist) captionObj.artist = caption.artist;
        if (caption.material) captionObj.material = caption.material;

        if (Object.keys(captionObj).length === 0) continue;

        const imageKey = `${SH_SCHEMA}:sh_countries_historicalbackground_images:${caption.hb_img_id}`;

        if (!pageCaptions.has(pageId)) {
          pageCaptions.set(pageId, {});
        }
        const pageCap = pageCaptions.get(pageId)!;
        if (!pageCap[imageKey]) {
          pageCap[imageKey] = {};
        }
        pageCap[imageKey]![caption.lang] = captionObj;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logWarning(`HB caption for image ${caption.hb_img_id}: ${message}`);
      }
    }

    // Inject into CollectionTranslation.extra.image_captions for each page
    for (const [pageId, captionData] of pageCaptions.entries()) {
      try {
        const pageBackwardCompat = `${SH_SCHEMA}:sh_countries_historicalbackground_pages:${pageId}`;
        const collectionId = await this.getEntityUuidAsync(pageBackwardCompat, 'collection');
        if (!collectionId) {
          this.logWarning(`HB caption page ${pageId}: Collection not found, skipping`);
          continue;
        }

        if (this.isDryRun || this.isSampleOnlyMode) {
          result.imported++;
          this.showProgress();
          continue;
        }

        await this.mergeExtraIntoCollectionTranslations(
          collectionId,
          { image_captions: captionData },
          result,
          `HB caption page ${pageId}`
        );

        result.imported++;
        this.showProgress();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.warnings = result.warnings || [];
        result.warnings.push(`HB caption page ${pageId}: ${message}`);
        this.logWarning(`HB caption page ${pageId}: ${message}`);
      }
    }
  }

  private async importHBMapDescriptions(result: ImportResult): Promise<void> {
    const mapTexts = await this.context.legacyDb.query<ShLegacyHistoricalBackgroundMapText>(
      `SELECT map_id, hb_id, lang, \`desc\`
       FROM ${SH_SCHEMA}.sh_countries_historicalbackground_maps_texts
       WHERE \`desc\` IS NOT NULL AND \`desc\` != ''
       ORDER BY map_id, lang`
    );

    this.logInfo(`Found ${mapTexts.length} HB map descriptions`);

    // Group by (map_id, hb_id) and pick best language for alt_text
    const grouped = new Map<string, ShLegacyHistoricalBackgroundMapText[]>();
    for (const t of mapTexts) {
      const key = `${t.map_id}:${t.hb_id}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(t);
    }

    this.logInfo(
      `Map descriptions: ${mapTexts.length} texts for ${grouped.size} maps — ` +
        'will store as extra on parent HB collection translations'
    );

    // Inject map descriptions into parent HB CollectionTranslation.extra.map_descriptions
    // Group by hb_id
    const byHb = new Map<number, Array<{ map_id: number; lang: string; desc: string }>>();
    for (const t of mapTexts) {
      if (!byHb.has(t.hb_id)) {
        byHb.set(t.hb_id, []);
      }
      byHb.get(t.hb_id)!.push({
        map_id: t.map_id,
        lang: t.lang,
        desc: convertHtmlToMarkdown(t.desc),
      });
    }

    for (const [hbId, descriptions] of byHb.entries()) {
      try {
        const collectionBackwardCompat = `${SH_SCHEMA}:sh_countries_historicalbackground:${hbId}`;
        const collectionId = await this.getEntityUuidAsync(collectionBackwardCompat, 'collection');
        if (!collectionId) {
          this.logWarning(`HB map desc ${hbId}: Collection not found, skipping`);
          continue;
        }

        // Format as { map_id → { lang → desc } }
        const mapDescs: Record<string, Record<string, string>> = {};
        for (const d of descriptions) {
          const mapKey = `map_${d.map_id}`;
          if (!mapDescs[mapKey]) {
            mapDescs[mapKey] = {};
          }
          mapDescs[mapKey]![d.lang] = d.desc;
        }

        if (this.isDryRun || this.isSampleOnlyMode) {
          result.imported++;
          this.showProgress();
          continue;
        }

        await this.mergeExtraIntoCollectionTranslations(
          collectionId,
          { map_descriptions: mapDescs },
          result,
          `HB map desc ${hbId}`
        );

        result.imported++;
        this.showProgress();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.warnings = result.warnings || [];
        result.warnings.push(`HB map desc ${hbId}: ${message}`);
        this.logWarning(`HB map desc ${hbId}: ${message}`);
      }
    }
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  /**
   * Resolve an image_item reference (SH format: 'project_id;country;number') to backward_compatibility.
   */
  private resolveImageItemReference(imageItem: string, itemType: string): string | null {
    if (!imageItem || !imageItem.trim()) return null;

    const parts = imageItem.split(';').map((s) => s.trim());
    if (parts.length < 3) return null;

    const [projectId, country, numberStr] = parts;
    const number = parseInt(numberStr!, 10);
    if (isNaN(number)) return null;

    const table = itemType === 'mon' ? 'sh_monuments' : 'sh_objects';
    return `${SH_SCHEMA}:${table}:${projectId!.toLowerCase()}:${country!.toLowerCase()}:${number}`;
  }

  /**
   * Merge fields into the extra JSON of ALL existing CollectionTranslation rows
   * for a given collection_id (across all languages).
   */
  private async mergeExtraIntoCollectionTranslations(
    collectionId: string,
    fields: Record<string, unknown>,
    result: ImportResult,
    context: string
  ): Promise<void> {
    // Get all languages for this collection from translations
    const languageIds = await this.context.strategy.getCollectionTranslationLanguages(collectionId);
    if (languageIds.length === 0) {
      this.logWarning(`${context}: No translations found for collection ${collectionId}`);
      return;
    }

    for (const langId of languageIds) {
      try {
        const existing = await this.context.strategy.getCollectionTranslationExtra(
          collectionId,
          langId
        );
        const merged = { ...(existing || {}), ...fields };
        await this.context.strategy.setCollectionTranslationExtra(
          collectionId,
          langId,
          JSON.stringify(merged)
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.warnings = result.warnings || [];
        result.warnings.push(`${context} lang ${langId}: ${message}`);
        this.logWarning(`${context} lang ${langId}: ${message}`);
      }
    }
  }

  /**
   * Merge fields into the extra JSON of ALL existing ItemTranslation rows
   * for a given item_id (across all languages).
   */
  private async mergeExtraIntoItemTranslations(
    itemId: string,
    fields: Record<string, unknown>,
    result: ImportResult,
    context: string
  ): Promise<void> {
    const languageIds = await this.context.strategy.getItemTranslationLanguages(itemId);
    if (languageIds.length === 0) {
      this.logWarning(`${context}: No translations found for item ${itemId}`);
      return;
    }

    for (const langId of languageIds) {
      try {
        const existing = await this.context.strategy.getItemTranslationExtra(itemId, langId);
        const merged = { ...(existing || {}), ...fields };
        await this.context.strategy.setItemTranslationExtra(itemId, langId, JSON.stringify(merged));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.warnings = result.warnings || [];
        result.warnings.push(`${context} lang ${langId}: ${message}`);
        this.logWarning(`${context} lang ${langId}: ${message}`);
      }
    }
  }
}
