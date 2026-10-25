/**
 * SH Monument Transformer
 *
 * Transforms Sharing History monument data to the new format.
 * Key differences from mwnf3:
 * - PK: (project_id, country, number) - no partner in PK
 * - Partner linked via FK `partners_id`
 * - pd_country stored in extra JSON as `country_id_present_days`
 */

import { creditsAsWritten } from './credits-as-written.js';
import type { ShLegacyMonument, ShLegacyMonumentText, ShMonumentGroup } from '../types/index.js';
import type { ItemData, ItemTranslationData } from '../../core/types.js';
import { mapCountryCode, mapLanguageCode } from '../../utils/code-mappings.js';
import { convertHtmlToMarkdown } from '../../utils/html-to-markdown.js';
import { textFields } from './sh-text-fields.js';
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

  // Every column legacy prints under a heading of its own stays a field of its
  // own: the description here; the second one, the history and the second and
  // third names in extra below. Each site prints the ones its legacy sheet printed.
  const description = text.description?.trim() ? convertHtmlToMarkdown(text.description) : '';
  const alternateName = text.name2?.trim() ? convertHtmlToMarkdown(text.name2) : null;

  // Build dates string
  const datesParts: string[] = [];
  if (text.date_description) {
    datesParts.push(convertHtmlToMarkdown(text.date_description));
  }
  // The dynasty is its own line on the sheet (extra.dynasty), not part of the dates.
  const dates = datesParts.length > 0 ? datesParts.join('; ') : null;

  // The institution alone: legacy prints the responsible institution's
  // own-language name under its own heading (extra.responsible_institution_org),
  // never in the institution's place.
  const holder = text.institution?.trim() ? convertHtmlToMarkdown(text.institution) : null;

  // The location and the province are two columns, each kept on its own
  // (extra.province below); each site composes the line it printed.
  const location = text.location?.trim() ? convertHtmlToMarkdown(text.location) : null;

  const type = text.typeof ? convertHtmlToMarkdown(text.typeof) : null;

  // Build extra JSON for translation-specific fields
  const extra: Record<string, unknown> = {};
  if (text.province?.trim()) extra.province = convertHtmlToMarkdown(text.province);
  const credits = creditsAsWritten(text);
  if (credits) extra.credits_as_written = credits;
  Object.assign(
    extra,
    textFields({
      description2: text.description2,
      history: text.history,
      second_name: text.second_name,
      third_name: text.third_name,
      keywords: text.keywords,
    })
  );
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
  // Legacy prints the responsible institution's name in its own language as
  // a line of its own ("Responsible Institution (original language)"); kept
  // whole, as legacy stores it, whatever `holder` and the contact keep.
  if (text.responsible_institution_org) {
    extra.responsible_institution_org = convertHtmlToMarkdown(text.responsible_institution_org);
  }
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
