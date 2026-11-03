/**
 * SH Monument Detail Transformer
 *
 * Transforms Sharing History monument detail data to the new format.
 * Monument details are child Items of monuments.
 */

import type {
  ShLegacyMonumentDetail,
  ShLegacyMonumentDetailText,
  ShMonumentDetailGroup,
} from '../types/index.js';
import type { ItemData, ItemTranslationData } from '../../core/types.js';
import { mapCountryCode, mapLanguageCode } from '../../utils/code-mappings.js';
import { convertHtmlToMarkdown } from '../../utils/html-to-markdown.js';
import { formatShBackwardCompatibility } from './sh-project-transformer.js';
import { selectItemInternalName } from './item-internal-name-transformer.js';

const SH_MONUMENT_DETAILS_TABLE = 'sh_monument_details';

/**
 * Transformed SH Monument Detail
 */
export interface TransformedShMonumentDetail {
  data: Omit<ItemData, 'partner_id' | 'collection_id' | 'project_id' | 'parent_id'>;
  backwardCompatibility: string;
  parentBackwardCompatibility: string;
  warning?: string;
}

/**
 * Transformed SH Monument Detail Translation
 */
export interface TransformedShMonumentDetailTranslation {
  data: Omit<ItemTranslationData, 'item_id' | 'context_id' | 'backward_compatibility'>;
  languageId: string;
}

/**
 * Group SH monument details by primary key
 */
export function groupShMonumentDetailsByPK(
  details: ShLegacyMonumentDetail[],
  detailTexts: ShLegacyMonumentDetailText[]
): ShMonumentDetailGroup[] {
  // Create a map of translations by PK
  const translationMap = new Map<string, ShLegacyMonumentDetailText[]>();

  for (const text of detailTexts) {
    const key = `${text.project_id}:${text.country}:${text.number}:${text.detail_id}`;
    if (!translationMap.has(key)) {
      translationMap.set(key, []);
    }
    translationMap.get(key)!.push(text);
  }

  // Group details with their translations
  return details.map((detail) => {
    const key = `${detail.project_id}:${detail.country}:${detail.number}:${detail.detail_id}`;
    return {
      project_id: detail.project_id,
      country: detail.country,
      number: detail.number,
      detail_id: detail.detail_id,
      translations: translationMap.get(key) || [],
    };
  });
}

/**
 * Transform a SH monument detail group to Item
 */
export function transformShMonumentDetail(
  group: ShMonumentDetailGroup,
  defaultLanguageId: string
): TransformedShMonumentDetail {
  const backwardCompat = formatShBackwardCompatibility(
    SH_MONUMENT_DETAILS_TABLE,
    group.project_id,
    group.country,
    group.number,
    group.detail_id
  );

  // Parent monument backward compatibility
  const parentBackwardCompat = formatShBackwardCompatibility(
    'sh_monuments',
    group.project_id,
    group.country,
    group.number
  );

  const selectedInternalName = selectItemInternalName(
    group.translations.map((translation) => ({
      languageId: mapLanguageCode(translation.lang),
      value: translation.name === undefined ? null : translation.name,
    })),
    defaultLanguageId,
    'SH Monument Detail',
    backwardCompat
  );

  const data: Omit<ItemData, 'partner_id' | 'collection_id' | 'project_id' | 'parent_id'> = {
    internal_name: selectedInternalName.internalName,
    type: 'detail',
    backward_compatibility: backwardCompat,
    country_id: mapCountryCode(group.country),
    owner_reference: null,
    mwnf_reference: null,
    // Legacy lists a monument's details by their number.
    display_order: Number(group.detail_id),
  };

  return {
    data,
    backwardCompatibility: backwardCompat,
    parentBackwardCompatibility: parentBackwardCompat,
    warning: selectedInternalName.warning ?? undefined,
  };
}

/**
 * Transform a SH monument detail text to ItemTranslation
 * Returns null if required fields (name, description) are missing
 */
export function transformShMonumentDetailTranslation(
  text: ShLegacyMonumentDetailText
): TransformedShMonumentDetailTranslation | null {
  const languageId = mapLanguageCode(text.lang);

  // Validate required fields
  const name = text.name?.trim() || null;
  if (!name) {
    return null;
  }

  const description = text.description?.trim() || null;
  if (!description) {
    return null;
  }

  // Build extra JSON for translation-specific fields
  const extra: Record<string, unknown> = {};
  if (text.artist) extra.artist = convertHtmlToMarkdown(text.artist);
  if (text.date) extra.date = text.date;
  if (text.location) extra.location = convertHtmlToMarkdown(text.location);

  const extraField = Object.keys(extra).length > 0 ? JSON.stringify(extra) : null;

  const data: Omit<ItemTranslationData, 'item_id' | 'context_id' | 'backward_compatibility'> = {
    language_id: languageId,
    name: convertHtmlToMarkdown(name),
    description: convertHtmlToMarkdown(description),
    alternate_name: null,
    type: null,
    holder: null,
    owner: null,
    initial_owner: null,
    dates: text.date || null,
    location: text.location ? convertHtmlToMarkdown(text.location) : null,
    bibliography: null,
    extra: extraField,
  };

  return {
    data,
    languageId,
  };
}
