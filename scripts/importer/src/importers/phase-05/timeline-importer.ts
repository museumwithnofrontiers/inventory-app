/**
 * HCR Timeline Importer
 *
 * Imports Heritage Conservation Resources (HCR) timeline data from
 * mwnf3 and Sharing History legacy databases.
 *
 * Creates:
 * - 179 Timelines (18 mwnf3 + 161 SH)
 * - 2,584 TimelineEvents (1,075 mwnf3 + 1,509 SH)
 * - 5,931 TimelineEventTranslations (4,299 mwnf3 + 1,632 SH)
 * - 656 timeline_event_item pivots (from sh_hcr_images, item-linked)
 * - 16 standalone TimelineEventImages (from sh_hcr_images)
 * - Bibliography injected into Timeline.extra (from rel_sh_bibliography_hcr_country)
 * - 32 sh_hcr_image_texts → timeline_event_item.extra
 * - BAR-specific per-country timelines bound to the Baroque Art collection
 * - BAR timeline_event_item pivots (country + strict date containment rule)
 *
 * Source tables:
 * - mwnf3.hcr (1,075 rows) → TimelineEvent (18 Timelines from country groups)
 * - mwnf3.hcr_events (4,299 rows) → TimelineEventTranslation
 * - mwnf3_sharing_history.sh_hcr (1,509 rows) → TimelineEvent (161 Timelines from country×exhibition groups)
 * - mwnf3_sharing_history.sh_hcr_events (1,632 rows) → TimelineEventTranslation
 * - mwnf3_sharing_history.sh_hcr_images (656 item-linked + 16 standalone + 1 garbage)
 * - mwnf3_sharing_history.sh_hcr_image_texts (32 rows)
 * - mwnf3_sharing_history.rel_sh_bibliography_hcr_country (103 rows)
 * - mwnf3_sharing_history.sh_bibliography + sh_bibliography_langs
 * - mwnf3.objects + mwnf3.monuments (project_id='BAR') → BAR timeline_event_item pivots
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';
import {
  transformHcrEvent,
  transformHcrEventTranslation,
  transformShHcrEvent,
  transformShHcrEventTranslation,
} from '../../domain/transformers/index.js';
import type {
  LegacyHcr,
  LegacyHcrEvent,
  ShLegacyHcr,
  ShLegacyHcrEvent,
  ShLegacyHcrImage,
  ShLegacyHcrImageText,
  ShLegacyBibliographyHcrCountry,
  ShLegacyBibliography,
  ShLegacyBibliographyLang,
} from '../../domain/types/index.js';
import { mapCountryCode } from '../../utils/code-mappings.js';
import { formatBackwardCompatibility } from '../../utils/backward-compatibility.js';
import { compareGeneralCi } from '../../utils/legacy-collation.js';

// ---------------------------------------------------------------------------
// BAR-specific internal types (not exported — private to this importer)
// ---------------------------------------------------------------------------

/** Minimal BAR object row (denormalized — queried from mwnf3.objects per-language) */
interface BarLegacyObjectRow {
  project_id: string;
  country: string;
  museum_id: string;
  number: string;
  start_date: string | null;
  end_date: string | null;
}

/** Minimal BAR monument row (denormalized — queried from mwnf3.monuments per-language) */
interface BarLegacyMonumentRow {
  project_id: string;
  country: string;
  institution_id: string;
  number: string;
  start_date: string | null;
  end_date: string | null;
}

/** Deduplicated BAR item entry (one per unique PK) */
export interface BarDedupItem {
  backwardCompatibility: string;
  country: string;
  startDate: number | null;
  endDate: number | null;
}

const IMAGE_MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

export class TimelineImporter extends BaseImporter {
  getName(): string {
    return 'TimelineImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      // Step 1: Import mwnf3 HCR timelines and events
      this.logInfo('Importing mwnf3 HCR timelines and events...');
      const mwnf3Result = await this.importMwnf3Hcr();
      result.imported += mwnf3Result.imported;
      result.skipped += mwnf3Result.skipped;
      result.errors.push(...mwnf3Result.errors);

      // Step 2: Import SH HCR timelines and events
      this.logInfo('Importing Sharing History HCR timelines and events...');
      const shResult = await this.importShHcr();
      result.imported += shResult.imported;
      result.skipped += shResult.skipped;
      result.errors.push(...shResult.errors);

      // Step 3: Import SH HCR images (item pivots + standalone images)
      this.logInfo('Importing SH HCR images (event↔item pivots and standalone images)...');
      const imageResult = await this.importShHcrImages();
      result.imported += imageResult.imported;
      result.skipped += imageResult.skipped;
      result.errors.push(...imageResult.errors);

      // Step 4: Import bibliography into Timeline.extra
      this.logInfo('Importing SH HCR bibliography...');
      const biblioResult = await this.importShBibliography();
      result.imported += biblioResult.imported;
      result.skipped += biblioResult.skipped;
      result.errors.push(...biblioResult.errors);

      // Step 5: Import Baroque Art HCR timelines (BAR-specific, collection-bound)
      this.logInfo('Importing Baroque Art HCR timelines (BAR-specific)...');
      const barResult = await this.importBarHcr();
      result.imported += barResult.imported;
      result.skipped += barResult.skipped;
      result.errors.push(...barResult.errors);

      this.showSummary(result.imported, result.skipped, result.errors.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Failed to import timelines: ${message}`);
      result.success = false;
    }

    result.success = result.errors.length === 0;
    return result;
  }

  // ===========================================================================
  // Step 1: mwnf3 HCR
  // ===========================================================================

  private async importMwnf3Hcr(): Promise<ImportResult> {
    const result = this.createResult();

    // Query all mwnf3 HCR rows
    const hcrRows = await this.context.legacyDb.query<LegacyHcr>(
      'SELECT * FROM mwnf3.hcr ORDER BY country_id, from_ad, hcr_id'
    );

    // Query all mwnf3 HCR translations
    const hcrEvents = await this.context.legacyDb.query<LegacyHcrEvent>(
      'SELECT * FROM mwnf3.hcr_events ORDER BY hcr_id, lang_id'
    );

    this.logInfo(`Found ${hcrRows.length} mwnf3 HCR rows, ${hcrEvents.length} translations`);

    // Group translations by hcr_id
    const eventsByHcrId = new Map<number, LegacyHcrEvent[]>();
    for (const evt of hcrEvents) {
      const existing = eventsByHcrId.get(evt.hcr_id) || [];
      existing.push(evt);
      eventsByHcrId.set(evt.hcr_id, existing);
    }

    // Group HCR rows by country_id → implicit timeline
    const byCountry = new Map<string, LegacyHcr[]>();
    for (const row of hcrRows) {
      const existing = byCountry.get(row.country_id) || [];
      existing.push(row);
      byCountry.set(row.country_id, existing);
    }

    this.logInfo(`Found ${byCountry.size} mwnf3 implicit timelines (by country)`);

    // Create timelines and events
    for (const [legacyCountryCode, events] of byCountry) {
      try {
        const timelineBC = `mwnf3:hcr:country:${legacyCountryCode}`;

        // Check if timeline already exists
        if (await this.entityExistsAsync(timelineBC, 'timeline')) {
          result.skipped += 1 + events.length;
          this.showSkipped();
          continue;
        }

        // Resolve country code (2-char → ISO-3)
        let countryId: string;
        try {
          countryId = mapCountryCode(legacyCountryCode);
        } catch {
          this.logWarning(
            `Unknown country code '${legacyCountryCode}' for mwnf3 HCR timeline, skipping`
          );
          result.skipped += 1 + events.length;
          continue;
        }

        // Build internal_name using the country code
        const internalName = `${legacyCountryCode} — Discover Islamic Art`;

        this.collectSample(
          'timeline',
          { country: legacyCountryCode, events: events.length } as unknown as Record<
            string,
            unknown
          >,
          'success'
        );

        if (this.isDryRun || this.isSampleOnlyMode) {
          this.logInfo(
            `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would import mwnf3 timeline: ${internalName} (${events.length} events)`
          );
          this.registerEntity('sample-timeline-' + legacyCountryCode, timelineBC, 'timeline');
          result.imported += 1 + events.length;
          this.showProgress();
          continue;
        }

        // Create timeline
        const timelineId = await this.context.strategy.writeTimeline({
          internal_name: internalName,
          country_id: countryId,
          collection_id: null, // mwnf3 timelines have no collection
          backward_compatibility: timelineBC,
        });
        this.registerEntity(timelineId, timelineBC, 'timeline');
        result.imported++;
        this.showProgress();

        // Create events within this timeline
        let displayOrder = 1;
        for (const hcr of events) {
          try {
            const transformed = transformHcrEvent(hcr);

            // Check if event already exists
            if (await this.entityExistsAsync(transformed.backwardCompatibility, 'timeline_event')) {
              result.skipped++;
              this.showSkipped();
              continue;
            }

            const eventId = await this.context.strategy.writeTimelineEvent({
              ...transformed.data,
              timeline_id: timelineId,
              display_order: displayOrder++,
            });
            this.registerEntity(eventId, transformed.backwardCompatibility, 'timeline_event');
            result.imported++;

            // Create translations for this event
            const translations = eventsByHcrId.get(hcr.hcr_id) || [];
            for (const trans of translations) {
              try {
                const languageId = await this.getLanguageIdByLegacyCodeAsync(trans.lang_id);
                if (!languageId) {
                  this.logWarning(
                    `Unknown language code '${trans.lang_id}' for HCR event ${hcr.hcr_id}, skipping translation`
                  );
                  continue;
                }

                const transData = transformHcrEventTranslation(trans);
                await this.context.strategy.writeTimelineEventTranslation({
                  ...transData.data,
                  timeline_event_id: eventId,
                  language_id: languageId,
                });
                result.imported++;
              } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                this.logWarning(
                  `Failed to create translation for HCR event ${hcr.hcr_id}:${trans.lang_id}: ${message}`
                );
              }
            }

            this.showProgress();
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            result.errors.push(`mwnf3 HCR event ${hcr.hcr_id}: ${message}`);
            this.logError(`mwnf3 HCR event ${hcr.hcr_id}`, message);
            this.showError();
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`mwnf3 HCR timeline country=${legacyCountryCode}: ${message}`);
        this.logError(`mwnf3 HCR timeline country=${legacyCountryCode}`, message);
        this.showError();
      }
    }

    return result;
  }

  // ===========================================================================
  // Step 2: Sharing History HCR
  // ===========================================================================

  private async importShHcr(): Promise<ImportResult> {
    const result = this.createResult();

    // Query all SH HCR rows
    const shHcrRows = await this.context.legacyDb.query<ShLegacyHcr>(
      'SELECT * FROM mwnf3_sharing_history.sh_hcr ORDER BY country, exhibition_id, date_from_year, hcr_id'
    );

    // Query all SH HCR translations
    const shHcrEvents = await this.context.legacyDb.query<ShLegacyHcrEvent>(
      'SELECT * FROM mwnf3_sharing_history.sh_hcr_events ORDER BY hcr_id, lang'
    );

    this.logInfo(`Found ${shHcrRows.length} SH HCR rows, ${shHcrEvents.length} translations`);

    // Group translations by hcr_id
    const eventsByHcrId = new Map<number, ShLegacyHcrEvent[]>();
    for (const evt of shHcrEvents) {
      const existing = eventsByHcrId.get(evt.hcr_id) || [];
      existing.push(evt);
      eventsByHcrId.set(evt.hcr_id, existing);
    }

    // Group HCR rows by (country, exhibition_id) → implicit timeline
    const groupKey = (row: ShLegacyHcr) => `${row.country}:${row.exhibition_id}`;
    const byGroup = new Map<string, ShLegacyHcr[]>();
    for (const row of shHcrRows) {
      const key = groupKey(row);
      const existing = byGroup.get(key) || [];
      existing.push(row);
      byGroup.set(key, existing);
    }

    this.logInfo(`Found ${byGroup.size} SH implicit timelines (by country×exhibition)`);

    // Resolve SH exhibition → Collection mapping
    // SH exhibitions map to collections via backward_compatibility: mwnf3_sharing_history:sh_exhibitions:{exhibition_id}
    for (const [key, events] of byGroup) {
      const [legacyCountryCode, exhibitionIdStr] = key.split(':');
      if (!legacyCountryCode || !exhibitionIdStr) continue;

      try {
        const timelineBC = `mwnf3_sharing_history:sh_hcr:country:${legacyCountryCode}:exhibition:${exhibitionIdStr}`;

        // Check if timeline already exists
        if (await this.entityExistsAsync(timelineBC, 'timeline')) {
          result.skipped += 1 + events.length;
          this.showSkipped();
          continue;
        }

        // Resolve country code (2-char → ISO-3)
        let countryId: string;
        try {
          countryId = mapCountryCode(legacyCountryCode);
        } catch {
          this.logWarning(
            `Unknown country code '${legacyCountryCode}' for SH HCR timeline, skipping`
          );
          result.skipped += 1 + events.length;
          continue;
        }

        // Try to resolve collection (SH exhibition → Collection)
        const collectionBC = `mwnf3_sharing_history:sh_exhibitions:${exhibitionIdStr}`;
        const collectionId = await this.getEntityUuidAsync(collectionBC, 'collection');
        if (!collectionId) {
          this.logWarning(
            `Collection not found: ${collectionBC} for SH timeline ${timelineBC}, importing without collection`
          );
        }

        // Build internal_name
        const internalName = `${legacyCountryCode} — Exhibition ${exhibitionIdStr}`;

        this.collectSample(
          'timeline',
          {
            country: legacyCountryCode,
            exhibition: exhibitionIdStr,
            events: events.length,
          } as unknown as Record<string, unknown>,
          'success'
        );

        if (this.isDryRun || this.isSampleOnlyMode) {
          this.logInfo(
            `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would import SH timeline: ${internalName} (${events.length} events)`
          );
          this.registerEntity('sample-timeline-sh-' + key, timelineBC, 'timeline');
          result.imported += 1 + events.length;
          this.showProgress();
          continue;
        }

        // Create timeline
        const timelineId = await this.context.strategy.writeTimeline({
          internal_name: internalName,
          country_id: countryId,
          collection_id: collectionId,
          backward_compatibility: timelineBC,
        });
        this.registerEntity(timelineId, timelineBC, 'timeline');
        result.imported++;
        this.showProgress();

        // Create events within this timeline
        let displayOrder = 1;
        for (const shHcr of events) {
          try {
            const transformed = transformShHcrEvent(shHcr);

            // Check if event already exists
            if (await this.entityExistsAsync(transformed.backwardCompatibility, 'timeline_event')) {
              result.skipped++;
              this.showSkipped();
              continue;
            }

            const eventId = await this.context.strategy.writeTimelineEvent({
              ...transformed.data,
              timeline_id: timelineId,
              display_order: displayOrder++,
            });
            this.registerEntity(eventId, transformed.backwardCompatibility, 'timeline_event');
            result.imported++;

            // Create translations for this event
            const translations = eventsByHcrId.get(shHcr.hcr_id) || [];
            for (const trans of translations) {
              try {
                const languageId = await this.getLanguageIdByLegacyCodeAsync(trans.lang);
                if (!languageId) {
                  this.logWarning(
                    `Unknown language code '${trans.lang}' for SH HCR event ${shHcr.hcr_id}, skipping translation`
                  );
                  continue;
                }

                const transData = transformShHcrEventTranslation(trans);
                await this.context.strategy.writeTimelineEventTranslation({
                  ...transData.data,
                  timeline_event_id: eventId,
                  language_id: languageId,
                });
                result.imported++;
              } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                this.logWarning(
                  `Failed to create translation for SH HCR event ${shHcr.hcr_id}:${trans.lang}: ${message}`
                );
              }
            }

            this.showProgress();
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            result.errors.push(`SH HCR event ${shHcr.hcr_id}: ${message}`);
            this.logError(`SH HCR event ${shHcr.hcr_id}`, message);
            this.showError();
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`SH HCR timeline ${key}: ${message}`);
        this.logError(`SH HCR timeline ${key}`, message);
        this.showError();
      }
    }

    return result;
  }

  // ===========================================================================
  // Step 3: SH HCR Images (item pivots + standalone)
  // ===========================================================================

  private async importShHcrImages(): Promise<ImportResult> {
    const result = this.createResult();

    // Query SH HCR images
    const images = await this.context.legacyDb.query<ShLegacyHcrImage>(
      'SELECT * FROM mwnf3_sharing_history.sh_hcr_images ORDER BY hcr_id, sort_order'
    );

    // Query SH HCR image texts (32 rows)
    const imageTexts = await this.context.legacyDb.query<ShLegacyHcrImageText>(
      'SELECT * FROM mwnf3_sharing_history.sh_hcr_image_texts ORDER BY hcr_img_id, lang'
    );

    this.logInfo(`Found ${images.length} SH HCR images, ${imageTexts.length} image texts`);

    // Group image texts by hcr_img_id and then by lang
    const textsByImgId = new Map<number, Map<string, ShLegacyHcrImageText>>();
    for (const txt of imageTexts) {
      if (!textsByImgId.has(txt.hcr_img_id)) {
        textsByImgId.set(txt.hcr_img_id, new Map());
      }
      const langMap = textsByImgId.get(txt.hcr_img_id)!;
      langMap.set(txt.lang, txt);
    }

    for (const img of images) {
      try {
        // Skip garbage row 768
        if (img.hcr_img_id === 768) {
          this.logInfo('Skipping garbage row hcr_img_id=768');
          result.skipped++;
          continue;
        }

        // Resolve the parent timeline event
        const eventBC = `mwnf3_sharing_history:sh_hcr:${img.hcr_id}`;
        const eventId = await this.getEntityUuidAsync(eventBC, 'timeline_event');
        if (!eventId) {
          this.logWarning(
            `Timeline event not found for backward_compatibility: ${eventBC} (image ${img.hcr_img_id})`
          );
          result.skipped++;
          this.showSkipped();
          continue;
        }

        if (img.ref_item && img.ref_item.trim() !== '') {
          // Item-linked image → timeline_event_item pivot
          const pivotBC = `mwnf3_sharing_history:sh_hcr_images:${img.hcr_img_id}`;

          // Parse ref_item: "PROJECT;COUNTRY;NUMBER"
          const parts = img.ref_item.split(';');
          if (parts.length < 3) {
            this.logWarning(
              `Invalid ref_item format '${img.ref_item}' for sh_hcr_images ${img.hcr_img_id}`
            );
            result.skipped++;
            this.showSkipped();
            continue;
          }

          const [project, country, number] = parts;
          if (!project || !country || !number) {
            this.logWarning(
              `Empty ref_item parts '${img.ref_item}' for sh_hcr_images ${img.hcr_img_id}`
            );
            result.skipped++;
            this.showSkipped();
            continue;
          }

          // Resolve item via backward_compatibility
          // SH items: depending on item_type
          const table = img.item_type === 'obj' ? 'sh_objects' : 'sh_monuments';
          const itemBC = `mwnf3_sharing_history:${table}:${project.toLowerCase()}:${country.toLowerCase()}:${number}`;
          const itemId = await this.getEntityUuidAsync(itemBC, 'item');

          if (!itemId) {
            this.logWarning(
              `Item not found for backward_compatibility: ${itemBC} (image ${img.hcr_img_id})`
            );
            result.skipped++;
            this.showSkipped();
            continue;
          }

          // Build extra from image texts (if any)
          let extra: string | null = null;
          const imgTexts = textsByImgId.get(img.hcr_img_id);
          if (imgTexts && imgTexts.size > 0) {
            const textsObj: Record<string, Record<string, string>> = {};
            for (const [legacyLang, txt] of imgTexts) {
              // Map 2-char to ISO-3 for JSON keys
              const langKey = await this.getLanguageIdByLegacyCodeAsync(legacyLang);
              if (!langKey) {
                this.logWarning(
                  `Unknown language code '${legacyLang}' for HCR image text ${img.hcr_img_id}, skipping text`
                );
                continue;
              }
              textsObj[langKey] = {
                name: txt.name || '',
                sname: txt.sname || '',
                name_detail: txt.name_detail || '',
                detail_justification: txt.detail_justification || '',
                date: txt.date || '',
                dynasty: txt.dynasty || '',
                museum: txt.museum || '',
                location: txt.location || '',
                artist: txt.artist || '',
                material: txt.material || '',
              };
            }
            extra = JSON.stringify({ texts: textsObj });
          }

          if (this.isDryRun || this.isSampleOnlyMode) {
            result.imported++;
            this.showProgress();
            continue;
          }

          await this.context.strategy.writeTimelineEventItem({
            timeline_event_id: eventId,
            item_id: itemId,
            display_order: img.sort_order,
            backward_compatibility: pivotBC,
            extra,
          });

          result.imported++;
          this.showProgress();
        } else {
          const imgTexts = textsByImgId.get(img.hcr_img_id);
          const altText = await this.getStandaloneImageAltTextAsync(imgTexts);

          // timeline_event_images has no backward_compatibility column —
          // identity is (owner, legacy path).
          if (await this.imageExistsAsync('timeline_event_images', eventId, img.picture)) {
            result.skipped++;
            this.showSkipped();
            continue;
          }

          if (this.isDryRun || this.isSampleOnlyMode) {
            result.imported++;
            this.showProgress();
            continue;
          }

          await this.context.strategy.writeTimelineEventImage({
            timeline_event_id: eventId,
            path: img.picture,
            original_name: this.getOriginalName(img.picture),
            mime_type: this.getMimeType(img.picture),
            size: 1,
            alt_text: altText,
            display_order: img.sort_order,
          });

          result.imported++;
          this.showProgress();
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`SH HCR image ${img.hcr_img_id}: ${message}`);
        this.logError(`SH HCR image ${img.hcr_img_id}`, message);
        this.showError();
      }
    }

    return result;
  }

  private getOriginalName(filePath: string): string {
    const segments = filePath.split('/');
    return segments.at(-1) || filePath;
  }

  private getMimeType(filePath: string): string {
    const normalizedPath = filePath.toLowerCase();
    const extension = Object.keys(IMAGE_MIME_TYPES).find((ext) => normalizedPath.endsWith(ext));

    return extension ? IMAGE_MIME_TYPES[extension] : 'image/jpeg';
  }

  private async getStandaloneImageAltTextAsync(
    imgTexts: Map<string, ShLegacyHcrImageText> | undefined
  ): Promise<string | null> {
    if (!imgTexts || imgTexts.size === 0) {
      return null;
    }

    const defaultLanguageId = await this.getDefaultLanguageIdAsync();
    let fallback: string | null = null;

    for (const [legacyLang, txt] of imgTexts) {
      const candidate = this.getStandaloneImageAltTextCandidate(txt);
      if (!candidate) {
        continue;
      }

      fallback ??= candidate;

      const languageId = await this.getLanguageIdByLegacyCodeAsync(legacyLang);
      if (languageId === defaultLanguageId) {
        return candidate;
      }
    }

    return fallback;
  }

  private getStandaloneImageAltTextCandidate(txt: ShLegacyHcrImageText): string | null {
    const candidates = [
      txt.name,
      txt.sname,
      txt.name_detail,
      txt.detail_justification,
      txt.museum,
      txt.location,
      txt.artist,
      txt.material,
      txt.date,
      txt.dynasty,
    ];

    for (const candidate of candidates) {
      const trimmed = candidate.trim();
      if (trimmed !== '') {
        return trimmed;
      }
    }

    return null;
  }

  // ===========================================================================
  // Step 4: SH Bibliography → Timeline.extra
  // ===========================================================================

  private async importShBibliography(): Promise<ImportResult> {
    const result = this.createResult();

    // Query the bibliography chain
    const biblioCountry = await this.context.legacyDb.query<ShLegacyBibliographyHcrCountry>(
      'SELECT * FROM mwnf3_sharing_history.rel_sh_bibliography_hcr_country ORDER BY country, exhibition_id, sort_order'
    );

    if (biblioCountry.length === 0) {
      this.logInfo('No bibliography links found');
      return result;
    }

    const biblioEntries = await this.context.legacyDb.query<ShLegacyBibliography>(
      'SELECT * FROM mwnf3_sharing_history.sh_bibliography ORDER BY biblio_id'
    );

    const biblioLangs = await this.context.legacyDb.query<ShLegacyBibliographyLang>(
      'SELECT * FROM mwnf3_sharing_history.sh_bibliography_langs ORDER BY biblio_id, lang'
    );

    this.logInfo(
      `Found ${biblioCountry.length} bibliography links, ${biblioEntries.length} entries, ${biblioLangs.length} language texts`
    );

    // Index bibliography status by biblio_id
    const biblioStatusMap = new Map<number, string>();
    for (const entry of biblioEntries) {
      biblioStatusMap.set(entry.biblio_id, entry.status);
    }

    // Index bibliography texts by biblio_id → language → text
    const biblioTextMap = new Map<number, Map<string, string>>();
    for (const langRow of biblioLangs) {
      if (!biblioTextMap.has(langRow.biblio_id)) {
        biblioTextMap.set(langRow.biblio_id, new Map());
      }
      biblioTextMap.get(langRow.biblio_id)!.set(langRow.lang, langRow.desc);
    }

    // Group bibliography links by (country, exhibition_id) = timeline
    const timelineBiblioMap = new Map<string, ShLegacyBibliographyHcrCountry[]>();
    for (const link of biblioCountry) {
      const key = `${link.country}:${link.exhibition_id}`;
      const existing = timelineBiblioMap.get(key) || [];
      existing.push(link);
      timelineBiblioMap.set(key, existing);
    }

    this.logInfo(`Processing bibliography for ${timelineBiblioMap.size} timelines`);

    for (const [key, links] of timelineBiblioMap) {
      const [legacyCountryCode, exhibitionIdStr] = key.split(':');
      if (!legacyCountryCode || !exhibitionIdStr) continue;

      try {
        const timelineBC = `mwnf3_sharing_history:sh_hcr:country:${legacyCountryCode}:exhibition:${exhibitionIdStr}`;
        const timelineId = await this.getEntityUuidAsync(timelineBC, 'timeline');

        if (!timelineId) {
          this.logWarning(`Timeline not found for bibliography: ${timelineBC}`);
          result.skipped += links.length;
          this.showSkipped();
          continue;
        }

        // Sort by sort_order
        links.sort((a, b) => a.sort_order - b.sort_order);

        // Build bibliography arrays per language
        const activeBiblio: Record<string, string[]> = {};
        const disabledBiblio: Record<string, string[]> = {};

        for (const link of links) {
          const status = biblioStatusMap.get(link.biblio_id) || 'A';
          const texts = biblioTextMap.get(link.biblio_id);

          if (!texts || texts.size === 0) {
            this.logWarning(`No bibliography text found for biblio_id ${link.biblio_id}`);
            result.skipped++;
            continue;
          }

          for (const [legacyLang, text] of texts) {
            // Map 2-char to ISO-3 for JSON keys
            const langKey = await this.getLanguageIdByLegacyCodeAsync(legacyLang);
            if (!langKey) {
              this.logWarning(
                `Unknown language code '${legacyLang}' for bibliography biblio_id=${link.biblio_id}, skipping text`
              );
              continue;
            }

            const target = status === 'A' ? activeBiblio : disabledBiblio;
            if (!target[langKey]) {
              target[langKey] = [];
            }
            target[langKey]!.push(text);
          }
        }

        // Legacy (class.br.inc.php getbr_hcr_rel_Info) kept `sort_order` for
        // a list ordered by hand (`sort_status` 'Y' on its first relation)
        // and sorted any other by its text.
        if (links[0]?.sort_status !== 'Y') {
          for (const list of [...Object.values(activeBiblio), ...Object.values(disabledBiblio)]) {
            list.sort(compareGeneralCi);
          }
        }

        if (this.isDryRun || this.isSampleOnlyMode) {
          result.imported += links.length;
          this.showProgress();
          continue;
        }

        // Build extra JSON and update the timeline
        const extra: Record<string, unknown> = {};
        if (Object.keys(activeBiblio).length > 0) {
          extra.bibliography = activeBiblio;
        }
        if (Object.keys(disabledBiblio).length > 0) {
          extra.disabled_bibliography = disabledBiblio;
        }

        if (Object.keys(extra).length > 0) {
          await this.context.strategy.updateTimelineExtra(timelineId, JSON.stringify(extra));
        }

        result.imported += links.length;
        this.showProgress();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`SH bibliography for timeline ${key}: ${message}`);
        this.logError(`SH bibliography for timeline ${key}`, message);
        this.showError();
      }
    }

    return result;
  }

  // ===========================================================================
  // Step 5: Baroque Art HCR (BAR-specific, collection-bound)
  // ===========================================================================

  private async importBarHcr(): Promise<ImportResult> {
    const result = this.createResult();

    // Resolve the Baroque Art collection (created by phase-01 ProjectImporter)
    const barCollectionBC = 'mwnf3:projects:BAR';
    const barCollectionId = await this.getEntityUuidAsync(barCollectionBC, 'collection');
    if (!barCollectionId) {
      this.logWarning(
        'BAR collection not found (backward_compatibility: mwnf3:projects:BAR). ' +
          'Skipping Baroque Art HCR import. Ensure phase-01 (project import) has run first.'
      );
      return result;
    }

    this.logInfo(`Resolved BAR collection: ${barCollectionId}`);

    // Query all mwnf3 HCR rows and translations (same source as Step 1)
    const hcrRows = await this.context.legacyDb.query<LegacyHcr>(
      'SELECT * FROM mwnf3.hcr ORDER BY country_id, from_ad, hcr_id'
    );
    const hcrEvents = await this.context.legacyDb.query<LegacyHcrEvent>(
      'SELECT * FROM mwnf3.hcr_events ORDER BY hcr_id, lang_id'
    );

    this.logInfo(`BAR: Found ${hcrRows.length} HCR rows, ${hcrEvents.length} translations`);

    // Query BAR objects (denormalized — one row per language per item)
    const barObjectRows = await this.context.legacyDb.query<BarLegacyObjectRow>(
      "SELECT project_id, country, museum_id, number, start_date, end_date FROM mwnf3.objects WHERE project_id = 'BAR' ORDER BY country, museum_id, number, (lang = 'en') DESC, lang"
    );

    // Query BAR monuments (denormalized — one row per language per item)
    const barMonumentRows = await this.context.legacyDb.query<BarLegacyMonumentRow>(
      "SELECT project_id, country, institution_id, number, start_date, end_date FROM mwnf3.monuments WHERE project_id = 'BAR' ORDER BY country, institution_id, number, (lang = 'en') DESC, lang"
    );

    this.logInfo(
      `BAR: Found ${barObjectRows.length} object rows, ${barMonumentRows.length} monument rows (including language duplicates)`
    );

    // Deduplicate BAR items: group by PK, keep first row (English preferred by ORDER BY above)
    const barItems = this.deduplicateBarItems(barObjectRows, barMonumentRows);
    this.logInfo(`BAR: Deduplicated to ${barItems.length} unique BAR items`);

    // Group translations by hcr_id
    const eventsByHcrId = new Map<number, LegacyHcrEvent[]>();
    for (const evt of hcrEvents) {
      const existing = eventsByHcrId.get(evt.hcr_id) || [];
      existing.push(evt);
      eventsByHcrId.set(evt.hcr_id, existing);
    }

    // Group HCR rows by country_id
    const hcrByCountry = new Map<string, LegacyHcr[]>();
    for (const row of hcrRows) {
      const existing = hcrByCountry.get(row.country_id) || [];
      existing.push(row);
      hcrByCountry.set(row.country_id, existing);
    }

    // Get the set of countries that have BAR items
    const barCountries = new Set<string>(barItems.map((item) => item.country));
    this.logInfo(`BAR: Items span ${barCountries.size} countries`);

    // Process each country that has both BAR items and HCR rows
    for (const legacyCountryCode of barCountries) {
      const countryHcrRows = hcrByCountry.get(legacyCountryCode);
      if (!countryHcrRows || countryHcrRows.length === 0) {
        this.logInfo(
          `BAR: No HCR rows for country '${legacyCountryCode}', skipping timeline creation`
        );
        continue;
      }

      const countryItems = barItems.filter((item) => item.country === legacyCountryCode);

      try {
        const timelineBC = `mwnf3:hcr:bar:country:${legacyCountryCode}`;
        const timelineAlreadyExists = await this.entityExistsAsync(timelineBC, 'timeline');

        // A dry-run/sample only estimates counts, so an already-imported country is
        // still just skipped outright here — the re-run path below (which resolves
        // the existing timeline and walks its events looking for missing
        // translations) only matters for a real, writing run.
        if (timelineAlreadyExists && (this.isDryRun || this.isSampleOnlyMode)) {
          result.skipped += 1 + countryHcrRows.length;
          this.showSkipped();
          continue;
        }

        let timelineId: string;

        if (timelineAlreadyExists) {
          // Re-run safety: resolve the existing timeline instead of skipping the
          // whole country outright, so a re-run can still reach the per-event
          // check below and fill in translations a previous run left missing
          // (this is what actually happened on staging: the timeline and its
          // events were created, but the id-collision fixed in this change
          // dropped every BAR translation).
          const existingTimelineId = await this.getEntityUuidAsync(timelineBC, 'timeline');
          if (!existingTimelineId) {
            this.logWarning(
              `BAR: Timeline exists but its UUID could not be resolved: ${timelineBC}`
            );
            result.skipped += 1 + countryHcrRows.length;
            this.showSkipped();
            continue;
          }
          timelineId = existingTimelineId;
          result.skipped++;
          this.showSkipped();
        } else {
          // Resolve country code (2-char → ISO-3)
          let countryId: string;
          try {
            countryId = mapCountryCode(legacyCountryCode);
          } catch {
            this.logWarning(
              `BAR: Unknown country code '${legacyCountryCode}' for BAR HCR timeline, skipping`
            );
            result.skipped += 1 + countryHcrRows.length;
            continue;
          }

          const internalName = `${legacyCountryCode} — Baroque Art`;

          if (this.isDryRun || this.isSampleOnlyMode) {
            this.logInfo(
              `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would import BAR timeline: ${internalName} (${countryHcrRows.length} events, ${countryItems.length} items)`
            );
            this.registerEntity('sample-bar-timeline-' + legacyCountryCode, timelineBC, 'timeline');
            result.imported += 1 + countryHcrRows.length;
            this.showProgress();
            continue;
          }

          // Create the BAR timeline bound to the Baroque Art collection
          timelineId = await this.context.strategy.writeTimeline({
            internal_name: internalName,
            country_id: countryId,
            collection_id: barCollectionId,
            backward_compatibility: timelineBC,
          });
          this.registerEntity(timelineId, timelineBC, 'timeline');
          result.imported++;
          this.showProgress();
        }

        let eventsImported = 0;
        let pivotCount = 0;

        // Create events and item associations within this timeline
        let displayOrder = 1;
        for (const hcr of countryHcrRows) {
          try {
            const eventBC = `mwnf3:hcr:bar:${hcr.hcr_id}`;

            // Re-run safety: resolve rather than unconditionally skip an event that
            // already exists, so a re-run can still fill in translations a previous
            // run left missing (e.g. the id-collision this step used to hit before
            // BAR translations got their own backward_compatibility namespace below).
            const eventAlreadyExists = await this.entityExistsAsync(eventBC, 'timeline_event');
            let eventId: string;

            if (eventAlreadyExists) {
              const existingEventId = await this.getEntityUuidAsync(eventBC, 'timeline_event');
              if (!existingEventId) {
                this.logWarning(
                  `BAR: Timeline event exists but its UUID could not be resolved: ${eventBC}`
                );
                result.skipped++;
                this.showSkipped();
                continue;
              }
              eventId = existingEventId;
              result.skipped++;
              this.showSkipped();
            } else {
              const transformed = transformHcrEvent(hcr);

              eventId = await this.context.strategy.writeTimelineEvent({
                ...transformed.data,
                backward_compatibility: eventBC,
                timeline_id: timelineId,
                display_order: displayOrder++,
              });
              this.registerEntity(eventId, eventBC, 'timeline_event');
              result.imported++;
              eventsImported++;
            }

            // Create translations for this event. The BAR translation is namespaced
            // under its own backward_compatibility prefix (mwnf3:hcr_events:bar:...,
            // next to the event's mwnf3:hcr:bar:<hcr_id>) — see transformHcrEventTranslation
            // for why sharing the mwnf3 prefix would collide. Each translation's own
            // existence is checked (not just the event's) so that re-running this step
            // against an event created before this fix fills in only what is missing.
            const translations = eventsByHcrId.get(hcr.hcr_id) || [];
            for (const trans of translations) {
              try {
                const languageId = await this.getLanguageIdByLegacyCodeAsync(trans.lang_id);
                if (!languageId) {
                  this.logWarning(
                    `BAR: Unknown language code '${trans.lang_id}' for HCR event ${hcr.hcr_id}, skipping translation`
                  );
                  continue;
                }

                const transData = transformHcrEventTranslation(trans, 'mwnf3:hcr_events:bar');
                if (
                  await this.entityExistsAsync(
                    transData.data.backward_compatibility!,
                    'timeline_event_translation'
                  )
                ) {
                  continue;
                }

                await this.context.strategy.writeTimelineEventTranslation({
                  ...transData.data,
                  timeline_event_id: eventId,
                  language_id: languageId,
                });
                result.imported++;
              } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                this.logWarning(
                  `BAR: Failed to create translation for HCR event ${hcr.hcr_id}:${trans.lang_id}: ${message}`
                );
              }
            }

            if (!eventAlreadyExists) {
              // Materialize item-to-event associations using the legacy BAR selection rule:
              // item.start_date >= hcr.from_ad AND item.end_date <= hcr.to_ad (same country)
              const matchingItems = countryItems.filter((item) =>
                this.barItemMatchesHcrEvent(item, hcr)
              );

              let pivotOrder = 1;
              for (const item of matchingItems) {
                try {
                  const itemId = await this.getEntityUuidAsync(item.backwardCompatibility, 'item');
                  if (!itemId) {
                    this.logWarning(
                      `BAR [${legacyCountryCode}]: Item not found for HCR event ${hcr.hcr_id}, backward_compatibility: ${item.backwardCompatibility}`
                    );
                    continue;
                  }

                  await this.context.strategy.writeTimelineEventItem({
                    timeline_event_id: eventId,
                    item_id: itemId,
                    display_order: pivotOrder++,
                    backward_compatibility: null,
                    extra: null,
                  });

                  pivotCount++;
                  result.imported++;
                } catch (error) {
                  const message = error instanceof Error ? error.message : String(error);
                  this.logWarning(
                    `BAR: Failed to create item pivot for HCR event ${hcr.hcr_id}, item ${item.backwardCompatibility}: ${message}`
                  );
                }
              }
            }

            this.showProgress();
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            result.errors.push(`BAR HCR event ${hcr.hcr_id}: ${message}`);
            this.logError(`BAR HCR event ${hcr.hcr_id}`, message);
            this.showError();
          }
        }

        this.logInfo(
          `BAR [${legacyCountryCode}]: imported ${eventsImported} events, ${pivotCount} item associations (${countryItems.length} items eligible)`
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`BAR HCR timeline country=${legacyCountryCode}: ${message}`);
        this.logError(`BAR HCR timeline country=${legacyCountryCode}`, message);
        this.showError();
      }
    }

    return result;
  }

  /**
   * Deduplicate BAR items from denormalized object and monument rows.
   * Rows are expected to be ordered with English first (preferred for date extraction).
   * Returns one entry per unique item PK.
   */
  deduplicateBarItems(
    objectRows: BarLegacyObjectRow[],
    monumentRows: BarLegacyMonumentRow[]
  ): BarDedupItem[] {
    const items: BarDedupItem[] = [];
    const seen = new Set<string>();

    for (const row of objectRows) {
      const bc = formatBackwardCompatibility({
        schema: 'mwnf3',
        table: 'objects',
        pkValues: [row.project_id, row.country, row.museum_id, row.number],
      });
      if (!seen.has(bc)) {
        seen.add(bc);
        const parsedStart = row.start_date !== null ? parseInt(row.start_date, 10) : NaN;
        const parsedEnd = row.end_date !== null ? parseInt(row.end_date, 10) : NaN;
        items.push({
          backwardCompatibility: bc,
          country: row.country,
          startDate: isNaN(parsedStart) ? null : parsedStart,
          endDate: isNaN(parsedEnd) ? null : parsedEnd,
        });
      }
    }

    for (const row of monumentRows) {
      const bc = formatBackwardCompatibility({
        schema: 'mwnf3',
        table: 'monuments',
        pkValues: [row.project_id, row.country, row.institution_id, row.number],
      });
      if (!seen.has(bc)) {
        seen.add(bc);
        const parsedStart = row.start_date !== null ? parseInt(row.start_date, 10) : NaN;
        const parsedEnd = row.end_date !== null ? parseInt(row.end_date, 10) : NaN;
        items.push({
          backwardCompatibility: bc,
          country: row.country,
          startDate: isNaN(parsedStart) ? null : parsedStart,
          endDate: isNaN(parsedEnd) ? null : parsedEnd,
        });
      }
    }

    return items;
  }

  /**
   * Check whether a BAR item falls within an HCR event's date range.
   * Legacy BAR selection rule: strict date containment —
   *   item.start_date >= hcr.from_ad AND item.end_date <= hcr.to_ad
   * Items with null dates cannot be associated and are excluded.
   */
  barItemMatchesHcrEvent(item: BarDedupItem, hcr: LegacyHcr): boolean {
    if (item.startDate === null || item.endDate === null) {
      return false;
    }
    return item.startDate >= hcr.from_ad && item.endDate <= hcr.to_ad;
  }
}
