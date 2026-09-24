/**
 * Museum Transformer
 *
 * Transforms legacy museum data to partner entities.
 * This is pure business logic with no dependencies on write strategy.
 */

import type { LegacyMuseum, LegacyMuseumName } from '../types/index.js';
import type { PartnerData, PartnerTranslationData } from '../../core/types.js';
import { mapLanguageCode, mapCountryCode } from '../../utils/code-mappings.js';
import { formatBackwardCompatibility } from '../../utils/backward-compatibility.js';
import { convertHtmlToMarkdown } from '../../utils/html-to-markdown.js';

/**
 * Monument reference for deferred resolution
 * The museum is physically located inside this monument
 */
export interface MuseumMonumentReference {
  mon_project_id: string;
  mon_country_id: string;
  mon_institution_id: string;
  mon_monument_id: number;
  mon_lang_id: string;
}

/**
 * Contact person data structure
 */
export interface ContactPerson {
  name?: string;
  title?: string;
  phone?: string;
  fax?: string;
  email?: string;
}

/**
 * Transformed museum result
 */
export interface TransformedMuseum {
  data: PartnerData;
  backwardCompatibility: string;
  /** Monument reference for deferred resolution (museum is located inside this monument) */
  monumentReference: MuseumMonumentReference | null;
  /** Logo paths for later import */
  logos: string[];
}

/**
 * Transformed museum translation result
 */
export interface TransformedMuseumTranslation {
  data: Omit<PartnerTranslationData, 'partner_id' | 'context_id'>;
  languageId: string;
}

/**
 * Extra fields extracted from museum data
 */
export interface MuseumExtraFields {
  source?: 'mwnf3';
  postal_address?: string;
  ex_name?: string;
  ex_description?: string;
  opening_hours?: string;
  how_to_reach?: string;
  region_id?: string;
  portal_display?: string;
  /** Contact person 1 (detailed structure) */
  contact_person_1?: ContactPerson;
  /** Contact person 2 (detailed structure) */
  contact_person_2?: ContactPerson;
  /** Additional URLs with their titles */
  urls?: Array<{ url: string; title?: string }>;
}

/**
 * Transform a legacy museum to partner
 */
export function transformMuseum(legacy: LegacyMuseum): TransformedMuseum {
  const backwardCompatibility = formatBackwardCompatibility({
    schema: 'mwnf3',
    table: 'museums',
    pkValues: [legacy.museum_id, legacy.country],
  });

  // internal_name must always be converted from legacy.name - no fallback
  if (!legacy.name) {
    throw new Error(`Museum ${legacy.museum_id}:${legacy.country} missing required name field`);
  }
  const internalName = convertHtmlToMarkdown(legacy.name);

  // Parse geoCoordinates if available (format: "lat,long" or "lat,long,zoom")
  let latitude: number | null = null;
  let longitude: number | null = null;
  let mapZoom: number | null = 16; // default zoom

  if (legacy.geoCoordinates) {
    const parts = legacy.geoCoordinates.split(',').map((p) => p.trim());
    if (parts.length >= 2) {
      latitude = parseFloat(parts[0]) || null;
      longitude = parseFloat(parts[1]) || null;
      if (parts.length >= 3) {
        mapZoom = parseInt(parts[2], 10) || 16;
      }
    }
  }

  // Also check zoom field if geoCoordinates didn't have zoom
  if (legacy.zoom && mapZoom === 16) {
    mapZoom = parseInt(legacy.zoom, 10) || 16;
  }

  // Extract monument reference for deferred resolution
  let monumentReference: MuseumMonumentReference | null = null;
  if (
    legacy.mon_project_id &&
    legacy.mon_country_id &&
    legacy.mon_institution_id &&
    legacy.mon_monument_id &&
    legacy.mon_lang_id
  ) {
    monumentReference = {
      mon_project_id: legacy.mon_project_id,
      mon_country_id: legacy.mon_country_id,
      mon_institution_id: legacy.mon_institution_id,
      mon_monument_id: legacy.mon_monument_id,
      mon_lang_id: legacy.mon_lang_id,
    };
  }

  // Extract logos (non-empty only)
  const logos: string[] = [legacy.logo, legacy.logo1, legacy.logo2, legacy.logo3].filter(
    (l): l is string => !!l && l.trim() !== ''
  );

  const data: PartnerData = {
    type: 'museum',
    internal_name: internalName,
    backward_compatibility: backwardCompatibility,
    latitude,
    longitude,
    map_zoom: mapZoom,
    country_id: legacy.country ? mapCountryCode(legacy.country) : null,
    // `mwnf3.museums.project_id` is the project the museum record was CREATED
    // under (FK fk_museums_projects), and it is what legacy's MWNF-384 branch
    // selects on. The legacy code is in hand here but the inventory UUID is
    // not, so — exactly as school-transformer does — the importer resolves it.
    project_id: null, // Resolved in the importer via lookup
    monument_item_id: null, // Will be resolved later by importer if monumentReference exists
    visible: false, // Default to false, can be updated later
  };

  return {
    data,
    backwardCompatibility,
    monumentReference,
    logos,
  };
}

/**
 * Transform a legacy museum name to partner translation
 */
export function transformMuseumTranslation(
  museum: LegacyMuseum,
  translation: LegacyMuseumName
): TransformedMuseumTranslation {
  const languageId = mapLanguageCode(translation.lang);

  const name = translation.name?.trim();
  if (!name) {
    throw new Error(`Museum translation missing name: ${museum.museum_id}:${translation.lang}`);
  }

  const nameMarkdown = convertHtmlToMarkdown(name);
  const descriptionMarkdown = translation.description
    ? convertHtmlToMarkdown(translation.description)
    : null;

  // backward_compatibility matches parent partner
  const backwardCompatibility = formatBackwardCompatibility({
    schema: 'mwnf3',
    table: 'museums',
    pkValues: [museum.museum_id, museum.country],
  });

  // Build extra field with structured data
  const extra: MuseumExtraFields = {
    source: 'mwnf3',
  };

  // Postal address (separate from physical address)
  if (museum.postal_address) extra.postal_address = museum.postal_address;

  // Translation-specific fields
  if (translation.ex_name) extra.ex_name = translation.ex_name;
  if (translation.ex_description) extra.ex_description = translation.ex_description;
  if (translation.opening_hours) extra.opening_hours = translation.opening_hours;
  if (translation.how_to_reach) extra.how_to_reach = translation.how_to_reach;

  // Other museum fields
  if (museum.region_id) extra.region_id = museum.region_id;
  if (museum.portal_display) extra.portal_display = museum.portal_display;

  // Contact person 1 (primary contact)
  if (museum.cp1_name || museum.cp1_title || museum.cp1_phone || museum.cp1_email) {
    extra.contact_person_1 = {
      name: museum.cp1_name || undefined,
      title: museum.cp1_title || undefined,
      phone: museum.cp1_phone || undefined,
      fax: museum.cp1_fax || undefined,
      email: museum.cp1_email || undefined,
    };
  }

  // Contact person 2 (secondary contact)
  if (museum.cp2_name || museum.cp2_title || museum.cp2_phone || museum.cp2_email) {
    extra.contact_person_2 = {
      name: museum.cp2_name || undefined,
      title: museum.cp2_title || undefined,
      phone: museum.cp2_phone || undefined,
      fax: museum.cp2_fax || undefined,
      email: museum.cp2_email || undefined,
    };
  }

  // Additional URLs with titles
  const urls: Array<{ url: string; title?: string }> = [];
  if (museum.url2) urls.push({ url: museum.url2, title: museum.title2 || undefined });
  if (museum.url3) urls.push({ url: museum.url3, title: museum.title3 || undefined });
  if (museum.url4) urls.push({ url: museum.url4, title: museum.title4 || undefined });
  if (museum.url5) urls.push({ url: museum.url5, title: museum.title5 || undefined });
  if (urls.length > 0) extra.urls = urls;

  // Only stringify if we have more than just the source field
  const extraJson = Object.keys(extra).length > 1 ? JSON.stringify(extra) : null;

  // Map contact fields:
  // - contact_name: cp1_name (primary contact person)
  // - contact_email_general: institution email
  // - contact_phone: institution phone
  // - contact_fax: institution fax
  // - contact_website: primary URL (with title1 as description if available)
  const data: Omit<PartnerTranslationData, 'partner_id' | 'context_id'> = {
    language_id: languageId,
    backward_compatibility: backwardCompatibility,
    name: nameMarkdown,
    description: descriptionMarkdown,
    city_display: translation.city || null,
    address: museum.address || null,
    contact_website: museum.url || null,
    contact_phone: museum.phone || null,
    contact_fax: museum.fax || null,
    contact_email_general: museum.email || null,
    extra: extraJson,
  };

  return { data, languageId };
}

/**
 * Group museums with their translations
 */
export interface MuseumGroup {
  key: string;
  museum: LegacyMuseum;
  translations: LegacyMuseumName[];
}

/**
 * Group legacy museums and museum names by museum key.
 *
 * One group per `mwnf3.museums` ROW, which is safe because
 * `PRIMARY KEY (museum_id, country)` makes the group key a candidate key of the
 * table: a legacy museum has exactly one row and therefore exactly one
 * `project_id`. That is why the museum→project link can be a single FK on
 * `partners.project_id` rather than a join table — see PartnerImporter.
 */
export function groupMuseumsByKey(
  museums: LegacyMuseum[],
  museumNames: LegacyMuseumName[]
): MuseumGroup[] {
  const translationMap = new Map<string, LegacyMuseumName[]>();

  for (const translation of museumNames) {
    const key = `${translation.museum_id}:${translation.country}`;
    if (!translationMap.has(key)) {
      translationMap.set(key, []);
    }
    translationMap.get(key)!.push(translation);
  }

  return museums.map((museum) => {
    const key = `${museum.museum_id}:${museum.country}`;
    return {
      key,
      museum,
      translations: translationMap.get(key) || [],
    };
  });
}
