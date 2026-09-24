/**
 * Institution Transformer
 *
 * Transforms legacy institution data to partner entities.
 * This is pure business logic with no dependencies on write strategy.
 */

import type { LegacyInstitution, LegacyInstitutionName } from '../types/index.js';
import type { PartnerData, PartnerTranslationData } from '../../core/types.js';
import { mapLanguageCode, mapCountryCode } from '../../utils/code-mappings.js';
import { formatBackwardCompatibility } from '../../utils/backward-compatibility.js';
import { convertHtmlToMarkdown } from '../../utils/html-to-markdown.js';

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
 * Transformed institution result
 */
export interface TransformedInstitution {
  data: PartnerData;
  backwardCompatibility: string;
  /** Logo paths for later import */
  logos: string[];
}

/**
 * Transformed institution translation result
 */
export interface TransformedInstitutionTranslation {
  data: Omit<PartnerTranslationData, 'partner_id' | 'context_id'>;
  languageId: string;
}

/**
 * Extra fields extracted from institution data
 */
export interface InstitutionExtraFields {
  source?: 'mwnf3';
  region_id?: string;
  /** Contact person 1 (detailed structure) */
  contact_person_1?: ContactPerson;
  /** Contact person 2 (detailed structure) */
  contact_person_2?: ContactPerson;
  /** Additional URLs */
  urls?: Array<{ url: string }>;
}

/**
 * Transform a legacy institution to partner
 */
export function transformInstitution(legacy: LegacyInstitution): TransformedInstitution {
  const backwardCompatibility = formatBackwardCompatibility({
    schema: 'mwnf3',
    table: 'institutions',
    pkValues: [legacy.institution_id, legacy.country],
  });

  // internal_name must always be converted from legacy.name - no fallback
  if (!legacy.name) {
    throw new Error(
      `Institution ${legacy.institution_id}:${legacy.country} missing required name field`
    );
  }
  const internalName = convertHtmlToMarkdown(legacy.name);

  // Extract logos (non-empty only)
  const logos: string[] = [legacy.logo, legacy.logo1, legacy.logo2].filter(
    (l): l is string => !!l && l.trim() !== ''
  );

  const data: PartnerData = {
    type: 'institution',
    internal_name: internalName,
    backward_compatibility: backwardCompatibility,
    latitude: null, // Institutions don't have geocoordinates in legacy data
    longitude: null,
    map_zoom: 16, // default zoom
    country_id: legacy.country ? mapCountryCode(legacy.country) : null,
    project_id: null,
    monument_item_id: null,
    visible: false, // Default to false
  };

  return {
    data,
    backwardCompatibility,
    logos,
  };
}

/**
 * Transform a legacy institution name to partner translation
 */
export function transformInstitutionTranslation(
  institution: LegacyInstitution,
  translation: LegacyInstitutionName
): TransformedInstitutionTranslation {
  const languageId = mapLanguageCode(translation.lang);

  const name = translation.name?.trim();
  if (!name) {
    throw new Error(
      `Institution translation missing name: ${institution.institution_id}:${translation.lang}`
    );
  }

  const nameMarkdown = convertHtmlToMarkdown(name);
  const descriptionMarkdown = translation.description
    ? convertHtmlToMarkdown(translation.description)
    : null;

  // backward_compatibility matches parent partner
  const backwardCompatibility = formatBackwardCompatibility({
    schema: 'mwnf3',
    table: 'institutions',
    pkValues: [institution.institution_id, institution.country],
  });

  // Build extra field with structured data
  const extra: InstitutionExtraFields = {
    source: 'mwnf3',
  };

  // Other institution fields
  if (institution.region_id) extra.region_id = institution.region_id;

  // Contact person 1 (primary contact)
  if (
    institution.cp1_name ||
    institution.cp1_title ||
    institution.cp1_phone ||
    institution.cp1_email
  ) {
    extra.contact_person_1 = {
      name: institution.cp1_name || undefined,
      title: institution.cp1_title || undefined,
      phone: institution.cp1_phone || undefined,
      fax: institution.cp1_fax || undefined,
      email: institution.cp1_email || undefined,
    };
  }

  // Contact person 2 (secondary contact)
  if (
    institution.cp2_name ||
    institution.cp2_title ||
    institution.cp2_phone ||
    institution.cp2_email
  ) {
    extra.contact_person_2 = {
      name: institution.cp2_name || undefined,
      title: institution.cp2_title || undefined,
      phone: institution.cp2_phone || undefined,
      fax: institution.cp2_fax || undefined,
      email: institution.cp2_email || undefined,
    };
  }

  // Additional URLs
  const urls: Array<{ url: string }> = [];
  if (institution.url2) urls.push({ url: institution.url2 });
  if (urls.length > 0) extra.urls = urls;

  // Only stringify if we have more than just the source field
  const extraJson = Object.keys(extra).length > 1 ? JSON.stringify(extra) : null;

  // Map contact fields:
  // - contact_email_general: institution email
  // - contact_phone: institution phone
  // - contact_fax: institution fax
  // - contact_website: primary URL
  const data: Omit<PartnerTranslationData, 'partner_id' | 'context_id'> = {
    language_id: languageId,
    backward_compatibility: backwardCompatibility,
    name: nameMarkdown,
    description: descriptionMarkdown,
    city_display: institution.city || null,
    address: institution.address || null,
    contact_website: institution.url || null,
    contact_phone: institution.phone || null,
    contact_fax: institution.fax || null,
    contact_email_general: institution.email || null,
    extra: extraJson,
  };

  return { data, languageId };
}

/**
 * Group institutions with their translations
 */
export interface InstitutionGroup {
  key: string;
  institution: LegacyInstitution;
  translations: LegacyInstitutionName[];
}

/**
 * Group legacy institutions and institution names by institution key
 */
export function groupInstitutionsByKey(
  institutions: LegacyInstitution[],
  institutionNames: LegacyInstitutionName[]
): InstitutionGroup[] {
  const translationMap = new Map<string, LegacyInstitutionName[]>();

  for (const translation of institutionNames) {
    const key = `${translation.institution_id}:${translation.country}`;
    if (!translationMap.has(key)) {
      translationMap.set(key, []);
    }
    translationMap.get(key)!.push(translation);
  }

  return institutions.map((institution) => {
    const key = `${institution.institution_id}:${institution.country}`;
    return {
      key,
      institution,
      translations: translationMap.get(key) || [],
    };
  });
}
