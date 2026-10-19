/**
 * SH Monument Transformer
 *
 * Transforms Sharing History monument data to the new format.
 * Key differences from mwnf3:
 * - PK: (project_id, country, number) - no partner in PK
 * - Partner linked via FK `partners_id`
 * - pd_country stored in extra JSON as `country_id_present_days`
 */

import type { ShLegacyMonument, ShLegacyMonumentText, ShMonumentGroup } from '../types/index.js';
import type { ItemData, ItemTranslationData } from '../../core/types.js';
import { mapCountryCode, mapLanguageCode } from '../../utils/code-mappings.js';
import { convertHtmlToMarkdown } from '../../utils/html-to-markdown.js';
import { gallerySheetFields } from './sh-gallery-sheet.js';
import { formatShBackwardCompatibility } from './sh-project-transformer.js';
import { selectItemInternalName } from './item-internal-name-transformer.js';

const SH_MONUMENTS_TABLE = 'sh_monuments';

/**
 * Transformed SH Monument
 */
export interface TransformedShMonument {
  data: Omit<ItemData, 'partner_id' | 'collection_id' | 'project_id'>;
  backwardCompatibility: string;
  warning?: string;
}

/**
 * Transformed SH Monument Translation
 */
export interface TransformedShMonumentTranslation {
  data: Omit<ItemTranslationData, 'item_id' | 'context_id' | 'backward_compatibility'>;
  languageId: string;
}

/**
 * Group SH monuments by primary key
 */
export function groupShMonumentsByPK(
  monuments: ShLegacyMonument[],
  monumentTexts: ShLegacyMonumentText[]
): ShMonumentGroup[] {
  // Create a map of translations by PK
  const translationMap = new Map<string, ShLegacyMonumentText[]>();

  for (const text of monumentTexts) {
    const key = `${text.project_id}:${text.country}:${text.number}`;
    if (!translationMap.has(key)) {
      translationMap.set(key, []);
    }
    translationMap.get(key)!.push(text);
  }

  // Group monuments with their translations
  return monuments.map((mon) => {
    const key = `${mon.project_id}:${mon.country}:${mon.number}`;
    return {
      project_id: mon.project_id,
      country: mon.country,
      number: mon.number,
      partners_id: mon.partners_id,
      working_number: mon.working_number,
      start_date: mon.start_date,
      end_date: mon.end_date,
      display_status: mon.display_status,
      pd_country: mon.pd_country,
      translations: translationMap.get(key) || [],
    };
  });
}

/**
 * Transform a SH monument group to Item
 */
export function transformShMonument(
  group: ShMonumentGroup,
  defaultLanguageId: string
): TransformedShMonument {
  const backwardCompat = formatShBackwardCompatibility(
    SH_MONUMENTS_TABLE,
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
    'SH Monument',
    backwardCompat
  );

  const data: Omit<ItemData, 'partner_id' | 'collection_id' | 'project_id'> = {
    internal_name: selectedInternalName.internalName,
    type: 'monument',
    backward_compatibility: backwardCompat,
    country_id: mapCountryCode(group.country),
    parent_id: null,
    owner_reference: null,
    mwnf_reference: group.working_number || null,
    start_date: group.start_date ? parseInt(group.start_date, 10) || null : null,
    end_date: group.end_date ? parseInt(group.end_date, 10) || null : null,
  };

  return {
    data,
    backwardCompatibility: backwardCompat,
    warning: selectedInternalName.warning ?? undefined,
  };
}

/**
 * Transform a SH monument text to ItemTranslation
 * Returns null if required fields (name) is missing
 * Description is built from description, description2, and history (at least one should be present)
 */
export function transformShMonumentTranslation(
  text: ShLegacyMonumentText,
  pdCountry?: string | null
): TransformedShMonumentTranslation | null {
  const languageId = mapLanguageCode(text.lang);

  // Validate required fields - name is required
  const name = text.name?.trim() || null;
  if (!name) {
    return null;
  }

  // Build description combining description, description2, and history (use whichever is available)
  const descriptions = [text.description, text.description2, text.history]
    .filter((d): d is string => !!d && d.trim() !== '')
    .map((d) => convertHtmlToMarkdown(d));

  // Use combined description, or fallback to empty string if none available
  // (allow items with name but no description to be imported)
  const description = descriptions.length > 0 ? descriptions.join('\n\n') : '';

  // Build alternate name from name2, second_name, third_name
  const alternateNames = [text.name2, text.second_name, text.third_name]
    .filter((n): n is string => !!n && n.trim() !== '')
    .map((n) => convertHtmlToMarkdown(n));
  let alternateName = alternateNames.length > 0 ? alternateNames.join('; ') : null;

  // Truncate if needed
  if (alternateName && alternateName.length > 255) {
    alternateName = alternateName.substring(0, 252) + '...';
  }

  // Build dates string
  const datesParts: string[] = [];
  if (text.date_description) {
    datesParts.push(convertHtmlToMarkdown(text.date_description));
  }
  // The dynasty is its own line on the sheet (extra.dynasty), not part of the dates.
  const dates = datesParts.length > 0 ? datesParts.join('; ') : null;

  // Build holder info from institution
  const holder =
    text.institution || text.responsible_institution_org
      ? convertHtmlToMarkdown(text.institution || text.responsible_institution_org || '')
      : null;

  // Build location
  const locationParts = [text.location, text.province]
    .filter((l): l is string => !!l && l.trim() !== '')
    .map((l) => convertHtmlToMarkdown(l));
  const location = locationParts.length > 0 ? locationParts.join(', ') : null;

  // Build type (with truncation)
  let type = text.typeof ? convertHtmlToMarkdown(text.typeof) : null;
  if (type && type.length > 255) {
    type = type.substring(0, 252) + '...';
  }

  // Build extra JSON for translation-specific fields
  const extra: Record<string, unknown> = {};
  // The fields as the galleries and exhibitions sheet shows a Sharing History
  // record (dxa-api): description and short description apart, the second name
  // alone, keywords. The Sharing History site itself shows them merged, as
  // above; its exporter leaves this block out.
  const gallerySheet = gallerySheetFields({
    description: text.description,
    short_description: text.description2,
    history: text.history,
    also_known_as: text.name2,
    keywords: text.keywords,
  });
  if (gallerySheet) extra.gallery_sheet = gallerySheet;
  // The free-text Period / Dynasty line legacy prints on the sheet (its own
  // line, not part of the dates). The linked dynasties are a separate index.
  if (text.dynasty) extra.dynasty = convertHtmlToMarkdown(text.dynasty);

  // Monument contact information (language-specific visitor info)
  const monumentContact: Record<string, string> = {};
  if (text.address) monumentContact.address = convertHtmlToMarkdown(text.address);
  if (text.phone) monumentContact.phone = text.phone;
  if (text.fax) monumentContact.fax = text.fax;
  if (text.email) monumentContact.email = text.email;
  // institution is already used for holder, but store responsible_institution_org if different
  if (text.responsible_institution_org && text.responsible_institution_org !== text.institution) {
    monumentContact.responsible_institution = convertHtmlToMarkdown(
      text.responsible_institution_org
    );
  }
  if (Object.keys(monumentContact).length > 0) {
    extra.monument_contact = monumentContact;
  }

  // Additional descriptive fields
  if (text.patrons) extra.patrons = convertHtmlToMarkdown(text.patrons);
  if (text.architects) extra.architects = convertHtmlToMarkdown(text.architects);
  if (text.datationmethod) extra.datation_method = convertHtmlToMarkdown(text.datationmethod);
  if (text.external_sources) extra.external_sources = convertHtmlToMarkdown(text.external_sources);
  if (text.linkcatalogs) extra.linkcatalogs = text.linkcatalogs;

  // Notice fields
  if (text.notice) extra.notice = convertHtmlToMarkdown(text.notice);
  if (text.notice_c) extra.notice_c = convertHtmlToMarkdown(text.notice_c);
  // Same normalisation as the object path. Both columns are empty on
  // sh_monuments_texts today; mapped anyway, because an unmapped column
  // silently drops whatever an editor enters later.
  const rights = [text.copyright, text.notice_b].find((value) => value?.trim());
  if (rights) extra.copyright = convertHtmlToMarkdown(rights);
  if (pdCountry) extra.country_id_present_days = mapCountryCode(pdCountry);

  const extraField = Object.keys(extra).length > 0 ? JSON.stringify(extra) : null;

  const data: Omit<ItemTranslationData, 'item_id' | 'context_id' | 'backward_compatibility'> = {
    language_id: languageId,
    name: convertHtmlToMarkdown(name),
    description,
    alternate_name: alternateName,
    type,
    holder,
    owner: null,
    initial_owner: null,
    dates,
    location,
    bibliography: text.bibliography ? convertHtmlToMarkdown(text.bibliography) : null,
    extra: extraField,
  };

  return {
    data,
    languageId,
  };
}
