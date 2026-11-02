/**
 * Sharing History Project Chronology Importer
 *
 * Legacy Sharing History's "Chronology" (about_chronology_list.php,
 * about_chronology_txt.php) lists the activities of one MWNF activity tree:
 * the project's root activity (config.inc.php ABOUT_ACTIVITY_CH_ID) and its
 * public sub-activities, in activity order, each on a page of its own with
 * its text, its organisers and sponsors, and its photographs.
 *
 * It becomes one Timeline bound to the Sharing History project's root
 * collection, the root activity's own fields in the timeline's `extra`, and
 * one Timeline Event per sub-activity:
 * - its years and, when legacy has the day, its dates;
 * - its title and text as its English translation (legacy's activities are
 *   English only), every other legacy column in the translation's `extra`,
 *   each its own field;
 * - its EU funding columns in the event's `extra`;
 * - its pictures (act_activities_files) as Timeline Event Images, which
 *   image-sync copies from the legacy mirror (`activities/{id}/…`).
 *
 * Legacy schema: mwnf3.act_activities, mwnf3.act_activities_files
 *
 * Dependencies:
 * - ShProjectImporter (the project's root collection)
 * - LanguageImporter
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';
import { convertHtmlToMarkdown } from '../../utils/html-to-markdown.js';

/** Legacy's ABOUT_ACTIVITY_CH_ID: the Sharing History project's activity tree. */
export const SH_CHRONOLOGY_ROOT_ACTIVITY = 351;

const SH_PROJECT_BC = 'mwnf3_sharing_history:sh_projects:awe';

export interface LegacyActivity {
  activity_id: number;
  main_activity_id: number | null;
  title: string | null;
  subtitle: string | null;
  description: string | null;
  rea_from_year: string | null;
  rea_from_month: string | null;
  rea_from_day: string | null;
  rea_to_year: string | null;
  rea_to_month: string | null;
  rea_to_day: string | null;
  ongoing: string | null;
  rea_countries: string | null;
  rea_cities: string | null;
  organisers: string | null;
  coorganisers: string | null;
  participants: string | null;
  sponsors: string | null;
  eu_financing: string | null;
  eu_funding1: string | null;
  eu_funding2: string | null;
  remarks: string | null;
}

export interface LegacyActivityFile {
  file_id: number;
  activity_id: number;
  path: string | null;
  order: number | null;
  caption: string | null;
  type: string | null;
}

const IMAGE_MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
};

const text = (value: string | null | undefined): string => (value ?? '').trim();

/** The non-empty entries of a record, Markdown where legacy kept HTML. */
function fields(
  activity: LegacyActivity,
  plain: Array<keyof LegacyActivity>,
  html: Array<keyof LegacyActivity> = []
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of plain) {
    const value = text(activity[key] as string | null);
    if (value) out[key] = value;
  }
  for (const key of html) {
    const value = text(activity[key] as string | null);
    if (value) out[key] = convertHtmlToMarkdown(value);
  }
  return out;
}

const year = (value: string | null): number | null => {
  const n = Number.parseInt(text(value), 10);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** `YYYY-MM-DD` when legacy has the whole date, else null. */
export function activityDate(y: string | null, m: string | null, d: string | null): string | null {
  const [yy, mm, dd] = [text(y), text(m), text(d)];
  if (!/^\d{4}$/.test(yy) || !/^\d{1,2}$/.test(mm) || !/^\d{1,2}$/.test(dd)) return null;
  return `${yy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

export class ShChronologyImporter extends BaseImporter {
  getName(): string {
    return 'ShChronologyImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      this.logInfo('Importing the Sharing History project chronology...');

      // Legacy's ActivityList: the public sub-activities of the root, by id.
      const activities = await this.context.legacyDb.query<LegacyActivity>(
        `SELECT * FROM mwnf3.act_activities
         WHERE (activity_id = ? OR main_activity_id = ?) AND public = 'yes'
         ORDER BY activity_id`,
        [SH_CHRONOLOGY_ROOT_ACTIVITY, SH_CHRONOLOGY_ROOT_ACTIVITY]
      );
      const root = activities.find((a) => a.activity_id === SH_CHRONOLOGY_ROOT_ACTIVITY);
      if (!root) {
        this.logWarning(`Activity ${SH_CHRONOLOGY_ROOT_ACTIVITY} not found; no chronology`);
        return result;
      }
      const children = activities.filter((a) => a.activity_id !== SH_CHRONOLOGY_ROOT_ACTIVITY);

      const files =
        children.length > 0
          ? await this.context.legacyDb.query<LegacyActivityFile>(
              `SELECT file_id, activity_id, path, \`order\`, caption, type
               FROM mwnf3.act_activities_files
               WHERE activity_id IN (${children.map(() => '?').join(',')})
               ORDER BY activity_id, \`order\`, file_id`,
              children.map((a) => a.activity_id)
            )
          : [];
      this.logInfo(`Found ${children.length} activities, ${files.length} files`);

      const collectionId = await this.getEntityUuidAsync(SH_PROJECT_BC, 'collection');
      if (!collectionId) {
        result.errors.push(`Sharing History root collection not found (${SH_PROJECT_BC})`);
        result.success = false;
        return result;
      }
      const languageId = await this.getLanguageIdByLegacyCodeAsync('en');
      if (!languageId) {
        result.errors.push('English not found');
        result.success = false;
        return result;
      }

      if (this.isDryRun || this.isSampleOnlyMode) {
        result.imported += 1 + children.length;
        return result;
      }

      const timelineBC = `mwnf3:act_activities:${root.activity_id}`;
      let timelineId = await this.getEntityUuidAsync(timelineBC, 'timeline');
      if (!timelineId) {
        timelineId = await this.context.strategy.writeTimeline({
          internal_name: text(root.title) || timelineBC,
          country_id: null,
          collection_id: collectionId,
          backward_compatibility: timelineBC,
          extra: JSON.stringify(
            fields(
              root,
              [
                'title',
                'subtitle',
                'rea_from_year',
                'rea_to_year',
                'rea_countries',
                'rea_cities',
                'organisers',
                'coorganisers',
                'participants',
              ],
              ['description', 'sponsors', 'remarks']
            )
          ),
        });
        this.registerEntity(timelineId, timelineBC, 'timeline');
        result.imported++;
      } else {
        result.skipped++;
      }

      let displayOrder = 1;
      for (const activity of children) {
        const eventBC = `mwnf3:act_activities:${activity.activity_id}`;
        try {
          let eventId = await this.getEntityUuidAsync(eventBC, 'timeline_event');
          if (eventId) {
            result.skipped++;
            displayOrder++;
          } else {
            const from = year(activity.rea_from_year);
            const to = year(activity.rea_to_year) ?? from;
            if (from === null || to === null) {
              this.logWarning(`Activity ${activity.activity_id} has no year; skipped`);
              result.skipped++;
              continue;
            }
            const eventExtra = fields(activity, [
              'ongoing',
              'eu_financing',
              'eu_funding1',
              'eu_funding2',
            ]);
            eventId = await this.context.strategy.writeTimelineEvent({
              timeline_id: timelineId,
              internal_name: text(activity.title) || eventBC,
              year_from: from,
              year_to: to,
              date_from: activityDate(
                activity.rea_from_year,
                activity.rea_from_month,
                activity.rea_from_day
              ),
              date_to: activityDate(
                activity.rea_to_year,
                activity.rea_to_month,
                activity.rea_to_day
              ),
              display_order: displayOrder++,
              backward_compatibility: eventBC,
              extra: Object.keys(eventExtra).length ? JSON.stringify(eventExtra) : null,
            });
            this.registerEntity(eventId, eventBC, 'timeline_event');

            const translationExtra = fields(
              activity,
              [
                'subtitle',
                'rea_cities',
                'rea_countries',
                'organisers',
                'coorganisers',
                'participants',
              ],
              ['sponsors', 'remarks']
            );
            await this.context.strategy.writeTimelineEventTranslation({
              timeline_event_id: eventId,
              language_id: languageId,
              name: text(activity.title) || null,
              description: text(activity.description)
                ? convertHtmlToMarkdown(text(activity.description))
                : null,
              backward_compatibility: eventBC,
              extra: Object.keys(translationExtra).length ? JSON.stringify(translationExtra) : null,
            });
            result.imported++;
          }

          for (const file of files.filter((f) => f.activity_id === activity.activity_id)) {
            const path = text(file.path);
            if (!path || (file.type && file.type !== 'image')) continue;
            if (await this.imageExistsAsync('timeline_event_images', eventId, path)) {
              result.skipped++;
              continue;
            }
            const extension = Object.keys(IMAGE_MIME_TYPES).find((ext) =>
              path.toLowerCase().endsWith(ext)
            );
            await this.context.strategy.writeTimelineEventImage({
              timeline_event_id: eventId,
              path,
              original_name: path.split('/').at(-1) ?? path,
              mime_type: extension ? IMAGE_MIME_TYPES[extension]! : 'image/jpeg',
              size: 1,
              alt_text: text(file.caption) || null,
              display_order: file.order ?? 0,
            });
            result.imported++;
          }
          this.showProgress();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.errors.push(`Activity ${activity.activity_id}: ${message}`);
          this.logError(`Activity ${activity.activity_id}`, message);
          this.showError();
        }
      }

      this.showSummary(result.imported, result.skipped, result.errors.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.success = false;
      result.errors.push(message);
      this.logError('ShChronologyImporter', message);
    }

    return result;
  }
}
