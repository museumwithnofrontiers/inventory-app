/**
 * Timeline Transformer
 *
 * Transforms legacy HCR (Heritage Conservation Resources) data into
 * inventory-app Timeline/TimelineEvent/TimelineEventTranslation format.
 *
 * Source tables:
 * - mwnf3.hcr → TimelineEvent (timelines are implicit, one per country)
 * - mwnf3.hcr_events → TimelineEventTranslation
 * - mwnf3_sharing_history.sh_hcr → TimelineEvent (timelines are implicit, one per country×exhibition)
 * - mwnf3_sharing_history.sh_hcr_events → TimelineEventTranslation
 */

import type { TimelineEventData, TimelineEventTranslationData } from '../../core/types.js';
import type { LegacyHcr, LegacyHcrEvent } from '../types/index.js';
import type { ShLegacyHcr, ShLegacyHcrEvent } from '../types/index.js';

// ============================================================================
// Transformed result types
// ============================================================================

export interface TransformedTimelineEvent {
  data: Omit<TimelineEventData, 'timeline_id'>;
  backwardCompatibility: string;
}

export interface TransformedTimelineEventTranslation {
  data: Omit<TimelineEventTranslationData, 'timeline_event_id'>;
}

// ============================================================================
// mwnf3 HCR transformers
// ============================================================================

/**
 * Transform a legacy mwnf3 HCR row into TimelineEvent data.
 * The timeline_id is resolved by the importer.
 */
export function transformHcrEvent(legacy: LegacyHcr): TransformedTimelineEvent {
  const backwardCompatibility = `mwnf3:hcr:${legacy.hcr_id}`;

  return {
    data: {
      internal_name: legacy.name || `hcr-${legacy.hcr_id}`,
      year_from: legacy.from_ad,
      // Legacy's to_ad is NOT NULL DEFAULT 0, and 0 there means no end year
      // (1,010 of 1,075 rows; the sites read it so): none (M16 G3 #2699).
      year_to: legacy.to_ad === 0 ? null : legacy.to_ad,
      year_from_ah: legacy.from_ah ?? null,
      year_to_ah: legacy.to_ah ?? null,
      date_from: null,
      date_to: null,
      display_order: 0, // Will be assigned by importer within timeline group
      backward_compatibility: backwardCompatibility,
    },
    backwardCompatibility,
  };
}

/**
 * Transform a legacy mwnf3 hcr_events row into TimelineEventTranslation data.
 * The timeline_event_id and language_id (ISO-3) are resolved by the importer.
 *
 * `backwardCompatibilityPrefix` lets a caller that copies the parent `mwnf3.hcr`
 * row under a second key (the Baroque Art timeline step copies it under
 * `mwnf3:hcr:bar:<hcr_id>`) give the translation its own namespaced key too.
 * SqlStrategy.writeTimelineEventTranslation derives the row's id deterministically
 * from this key plus the language, so leaving it at the default `mwnf3:hcr_events`
 * prefix for a second copy of the same hcr_id/lang would collide with the id
 * already used by the original mwnf3 event's translation and be rejected as a
 * duplicate primary key.
 */
export function transformHcrEventTranslation(
  legacy: LegacyHcrEvent,
  backwardCompatibilityPrefix = 'mwnf3:hcr_events'
): TransformedTimelineEventTranslation {
  const backwardCompatibility = `${backwardCompatibilityPrefix}:${legacy.hcr_id}:${legacy.lang_id}`;

  return {
    data: {
      language_id: '', // Resolved by importer via getLanguageIdByLegacyCodeAsync
      name: legacy.name || null,
      description: legacy.description || null,
      date_from_description: legacy.datedesc_ad || null,
      date_to_description: null, // mwnf3 has no separate date_to description
      date_from_ah_description: legacy.datedesc_ah || null,
      backward_compatibility: backwardCompatibility,
    },
  };
}

// ============================================================================
// Sharing History HCR transformers
// ============================================================================

/**
 * Build a date string (YYYY-MM-DD) from SH HCR date parts.
 * Returns null if year is missing or invalid.
 */
function buildShDate(year: string, month: number | null, day: number | null): string | null {
  const y = parseInt(year, 10);
  if (isNaN(y) || y === 0) return null;

  const m = month && month >= 1 && month <= 12 ? month : 1;
  const d = day && day >= 1 && day <= 31 ? day : 1;

  return `${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
}

/**
 * Transform a legacy SH sh_hcr row into TimelineEvent data.
 * The timeline_id is resolved by the importer.
 */
export function transformShHcrEvent(legacy: ShLegacyHcr): TransformedTimelineEvent {
  const backwardCompatibility = `mwnf3_sharing_history:sh_hcr:${legacy.hcr_id}`;

  const yearFrom = parseInt(legacy.date_from_year, 10) || 0;
  // An empty end year stays empty (M16 G2 #2697); legacy leaves it out on 1497.
  const yearTo = parseInt(legacy.date_to_year, 10);

  return {
    data: {
      internal_name: legacy.name || `sh-hcr-${legacy.hcr_id}`,
      year_from: yearFrom,
      year_to: Number.isNaN(yearTo) ? null : yearTo,
      year_from_ah: null, // SH does not have AH dates
      year_to_ah: null,
      date_from: buildShDate(legacy.date_from_year, legacy.date_from_month, legacy.date_from_date),
      date_to: buildShDate(legacy.date_to_year, legacy.date_to_month, legacy.date_to_date),
      display_order: 0, // Will be assigned by importer within timeline group
      backward_compatibility: backwardCompatibility,
    },
    backwardCompatibility,
  };
}

/**
 * Transform a legacy SH sh_hcr_events row into TimelineEventTranslation data.
 * The timeline_event_id and language_id (ISO-3) are resolved by the importer.
 */
export function transformShHcrEventTranslation(
  legacy: ShLegacyHcrEvent
): TransformedTimelineEventTranslation {
  const backwardCompatibility = `mwnf3_sharing_history:sh_hcr_events:${legacy.hcr_id}:${legacy.lang}`;

  return {
    data: {
      language_id: '', // Resolved by importer via getLanguageIdByLegacyCodeAsync
      name: legacy.name || null,
      description: legacy.description || null,
      date_from_description: legacy.date_from || null,
      date_to_description: legacy.date_to || null,
      date_from_ah_description: null, // SH has no AH date descriptions
      backward_compatibility: backwardCompatibility,
    },
  };
}
