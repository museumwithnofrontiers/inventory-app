/**
 * School Transformer
 *
 * Transforms legacy school data to partner entities (type: school).
 * Follows the same pattern as museum-transformer and institution-transformer.
 */

import type { LegacySchool, LegacySchoolName } from '../types/index.js';
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
 * Transformed school result
 */
export interface TransformedSchool {
  data: PartnerData;
  backwardCompatibility: string;
  /** Logo path for later import (single logo) */
  logo: string | null;
}

/**
 * Transformed school translation result
 */
export interface TransformedSchoolTranslation {
  data: Omit<PartnerTranslationData, 'partner_id' | 'context_id'>;
  languageId: string;
}

/**
 * Extra fields extracted from school data
 */
export interface SchoolExtraFields {
  source?: 'mwnf3';
  postal_address?: string;
  fax?: string;
  region_id?: string;
  /** The region's name in this translation's language (mwnf3.regionnames) */
  region?: string;
  /** Contact person 1 */
  contact_person_1?: ContactPerson;
  /** Contact person 2 */
  contact_person_2?: ContactPerson;
}

/**
 * School group - a school with its translations (keyed by school_id:country)
 */
export interface SchoolGroup {
  key: string;
  school: LegacySchool;
  translations: LegacySchoolName[];
}

/**
 * Transform a legacy school to partner
 */
export function transformSchool(legacy: LegacySchool): TransformedSchool {
  const backwardCompatibility = formatBackwardCompatibility({
    schema: 'mwnf3',
    table: 'schools',
    pkValues: [legacy.school_id, legacy.country],
  });

  if (!legacy.name) {
    throw new Error(`School ${legacy.school_id}:${legacy.country} missing required name field`);
  }
  const internalName = convertHtmlToMarkdown(legacy.name);

  const logo = legacy.logo?.trim() || null;

  const data: PartnerData = {
    type: 'school',
    internal_name: internalName,
    backward_compatibility: backwardCompatibility,
    latitude: null,
    longitude: null,
    map_zoom: null,
    country_id: legacy.country ? mapCountryCode(legacy.country) : null,
    project_id: null, // Resolved in the importer via lookup
    monument_item_id: null,
    visible: true,
  };

  return {
    data,
    backwardCompatibility,
    logo,
  };
}

/**
 * Transform a legacy school name to partner translation
 */
export function transformSchoolTranslation(
  school: LegacySchool,
  translation: LegacySchoolName,
  regionName?: string
): TransformedSchoolTranslation {
  const languageId = mapLanguageCode(translation.lang);

  const name = translation.name?.trim();
  if (!name) {
    throw new Error(`School translation missing name: ${school.school_id}:${translation.lang}`);
  }

  const nameMarkdown = convertHtmlToMarkdown(name);
  const descriptionMarkdown = translation.description
    ? convertHtmlToMarkdown(translation.description)
    : null;

  const backwardCompatibility = formatBackwardCompatibility({
    schema: 'mwnf3',
    table: 'schools',
    pkValues: [school.school_id, school.country],
  });

  // Build extra field with structured data
  const extra: SchoolExtraFields = {
    source: 'mwnf3',
  };

  if (school.postal_address) extra.postal_address = school.postal_address;
  if (school.fax) extra.fax = school.fax;
  if (school.region_id) extra.region_id = school.region_id;
  if (regionName) extra.region = regionName;

  // Contact person 1
  if (school.cp1_name || school.cp1_title || school.cp1_phone || school.cp1_email) {
    extra.contact_person_1 = {
      name: school.cp1_name || undefined,
      title: school.cp1_title || undefined,
      phone: school.cp1_phone || undefined,
      fax: school.cp1_fax || undefined,
      email: school.cp1_email || undefined,
    };
  }

  // Contact person 2
  if (school.cp2_name || school.cp2_title || school.cp2_phone || school.cp2_email) {
    extra.contact_person_2 = {
      name: school.cp2_name || undefined,
      title: school.cp2_title || undefined,
      phone: school.cp2_phone || undefined,
      fax: school.cp2_fax || undefined,
      email: school.cp2_email || undefined,
    };
  }

  const hasExtra = Object.keys(extra).length > 1; // more than just 'source'

  const data: Omit<PartnerTranslationData, 'partner_id' | 'context_id'> = {
    language_id: languageId,
    name: nameMarkdown,
    description: descriptionMarkdown,
    city_display: school.city || null,
    address: school.address || null,
    contact_phone: school.phone || null,
    contact_email_general: school.email || null,
    contact_website: school.url || null,
    extra: hasExtra ? JSON.stringify(extra) : null,
    backward_compatibility: backwardCompatibility,
  };

  return {
    data,
    languageId,
  };
}

/**
 * Group schools by composite key (school_id:country)
 */
export function groupSchoolsByKey(
  schools: LegacySchool[],
  schoolNames: LegacySchoolName[]
): SchoolGroup[] {
  const translationMap = new Map<string, LegacySchoolName[]>();

  for (const translation of schoolNames) {
    const key = `${translation.school_id}:${translation.country}`;
    if (!translationMap.has(key)) {
      translationMap.set(key, []);
    }
    translationMap.get(key)!.push(translation);
  }

  return schools.map((school) => {
    const key = `${school.school_id}:${school.country}`;
    return {
      key,
      school,
      translations: translationMap.get(key) || [],
    };
  });
}
