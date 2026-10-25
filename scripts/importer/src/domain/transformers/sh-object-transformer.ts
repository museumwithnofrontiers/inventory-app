/**
 * SH Object Transformer
 *
 * Transforms Sharing History object data to the new format.
 * Key differences from mwnf3:
 * - PK: (project_id, country, number) - no partner in PK
 * - Partner linked via FK `partners_id`
 * - pd_country stored in extra JSON as `country_id_present_days`
 */

import { creditsAsWritten } from './credits-as-written.js';
import type { ShLegacyObject, ShLegacyObjectText, ShObjectGroup } from '../types/index.js';
import type { ItemData, ItemTranslationData } from '../../core/types.js';
import { mapCountryCode, mapLanguageCode } from '../../utils/code-mappings.js';
import { convertHtmlToMarkdown } from '../../utils/html-to-markdown.js';
import { textFields } from './sh-text-fields.js';
import { formatShBackwardCompatibility } from './sh-project-transformer.js';
import { selectItemInternalName } from './item-internal-name-transformer.js';

const SH_OBJECTS_TABLE = 'sh_objects';

/**
 * Transformed SH Object
 */
export interface TransformedShObject {
  data: Omit<ItemData, 'partner_id' | 'collection_id' | 'project_id'>;
  backwardCompatibility: string;
  warning?: string;
}

/**
 * Transformed SH Object Translation
 */
export interface TransformedShObjectTranslation {
  data: Omit<ItemTranslationData, 'item_id' | 'context_id' | 'backward_compatibility'>;
  languageId: string;
}

/**
 * Group SH objects by primary key
 */
export function groupShObjectsByPK(
  objects: ShLegacyObject[],
  objectTexts: ShLegacyObjectText[]
): ShObjectGroup[] {
  // Create a map of translations by PK
  const translationMap = new Map<string, ShLegacyObjectText[]>();

  for (const text of objectTexts) {
    const key = `${text.project_id}:${text.country}:${text.number}`;
    if (!translationMap.has(key)) {
      translationMap.set(key, []);
    }
    translationMap.get(key)!.push(text);
  }

  // Group objects with their translations
  return objects.map((obj) => {
    const key = `${obj.project_id}:${obj.country}:${obj.number}`;
    return {
      project_id: obj.project_id,
      country: obj.country,
      number: obj.number,
      partners_id: obj.partners_id,
      working_number: obj.working_number,
      inventory_id: obj.inventory_id,
      start_date: obj.start_date,
      end_date: obj.end_date,
      display_status: obj.display_status,
      pd_country: obj.pd_country,
      translations: translationMap.get(key) || [],
    };
  });
}

/**
 * Transform a SH object group to Item
 */
export function transformShObject(
  group: ShObjectGroup,
  defaultLanguageId: string
): TransformedShObject {
  const backwardCompat = formatShBackwardCompatibility(
    SH_OBJECTS_TABLE,
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
    'SH Object',
    backwardCompat
  );

  const data: Omit<ItemData, 'partner_id' | 'collection_id' | 'project_id'> = {
    internal_name: selectedInternalName.internalName,
    type: 'object',
    backward_compatibility: backwardCompat,
    country_id: mapCountryCode(group.country),
    parent_id: null,
    owner_reference: group.inventory_id || null,
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
 * Transform a SH object text to ItemTranslation
 * Returns null if required fields (name) is missing
 * Description is built from description OR description2 (at least one must be present)
 */
export function transformShObjectTranslation(
  text: ShLegacyObjectText,
  pdCountry?: string | null
): TransformedShObjectTranslation | null {
  const languageId = mapLanguageCode(text.lang);

  // Validate required fields - name is required
  const name = text.name?.trim() || null;
  if (!name) {
    return null;
  }

  // Every column legacy prints under a heading of its own stays a field of its
  // own: the description here, the second one, the second and third names in
  // extra below. Each site prints the ones its legacy sheet printed.
  const description = text.description?.trim() ? convertHtmlToMarkdown(text.description) : '';
  const alternateName = text.name2?.trim() ? convertHtmlToMarkdown(text.name2) : null;

  // Build dates string
  const datesParts: string[] = [];
  if (text.date_description) {
    datesParts.push(convertHtmlToMarkdown(text.date_description));
  }
  // The dynasty is its own line on the sheet (extra.dynasty), not part of the dates.
  const dates = datesParts.length > 0 ? datesParts.join('; ') : null;

  // Build owner info
  const owner = text.current_owner ? convertHtmlToMarkdown(text.current_owner) : null;
  const initialOwner = text.original_owner ? convertHtmlToMarkdown(text.original_owner) : null;
  // The holding museum alone: legacy prints the institution's own-language
  // name under its own heading (extra.holding_institution_org), never here.
  const holder = text.holding_museum?.trim() ? convertHtmlToMarkdown(text.holding_museum) : null;

  // The location and the province are two columns, each kept on its own
  // (extra.province below); each site composes the line it printed.
  const location = text.location?.trim() ? convertHtmlToMarkdown(text.location) : null;

  const type = text.typeof ? convertHtmlToMarkdown(text.typeof) : null;

  // Build extra JSON for translation-specific fields
  const extra: Record<string, unknown> = {};
  if (text.archival) extra.archival = convertHtmlToMarkdown(text.archival);
  if (text.province?.trim()) extra.province = convertHtmlToMarkdown(text.province);
  const credits = creditsAsWritten(text);
  if (credits) extra.credits_as_written = credits;
  Object.assign(
    extra,
    textFields({
      description2: text.description2,
      second_name: text.second_name,
      third_name: text.third_name,
      keywords: text.keywords,
    })
  );
  // The free-text Period / Dynasty line legacy prints on the sheet (its own
  // line, not part of the dates). The linked dynasties are a separate index.
  if (text.dynasty) extra.dynasty = convertHtmlToMarkdown(text.dynasty);
  if (text.dimensions) extra.dimensions = convertHtmlToMarkdown(text.dimensions);
  if (text.materials) extra.materials = convertHtmlToMarkdown(text.materials);
  if (text.artist) extra.artist = convertHtmlToMarkdown(text.artist);
  if (text.birthdate) extra.artist_birthdate = text.birthdate;
  if (text.birthplace) extra.artist_birthplace = convertHtmlToMarkdown(text.birthplace);
  if (text.deathdate) extra.artist_deathdate = text.deathdate;
  if (text.deathplace) extra.artist_deathplace = convertHtmlToMarkdown(text.deathplace);
  if (text.period_activity) extra.period_activity = convertHtmlToMarkdown(text.period_activity);
  if (text.production_place) extra.production_place = convertHtmlToMarkdown(text.production_place);
  if (text.workshop) extra.workshop = convertHtmlToMarkdown(text.workshop);
  if (text.datationmethod) extra.datation_method = convertHtmlToMarkdown(text.datationmethod);
  if (text.provenancemethod) extra.provenance_method = convertHtmlToMarkdown(text.provenancemethod);
  if (text.obtentionmethod) extra.obtention_method = convertHtmlToMarkdown(text.obtentionmethod);
  // Legacy prints the holding institution's name in its own language as a
  // line of its own ("Holding Institution (original language)"), beside the
  // English name `holder` carries; kept whole, as legacy stores it.
  if (text.holding_institution_org) {
    extra.holding_institution_org = convertHtmlToMarkdown(text.holding_institution_org);
  }
  if (text.notice) extra.notice = convertHtmlToMarkdown(text.notice);
  if (text.notice_c) extra.notice_c = convertHtmlToMarkdown(text.notice_c);
  // `notice_b` is the rights statement here too — every one of its values is a
  // "Copyright image: <institution>" line. It used to be exported under the
  // legacy column name, which taught consumers a name that means nothing to
  // them; it now normalises onto `copyright`, the same key and the same
  // precedence as the mwnf3 object and monument transformers.
  const rights = [text.copyright, text.notice_b].find((value) => value?.trim());
  if (rights) extra.copyright = convertHtmlToMarkdown(rights);
  if (text.linkcatalogs) extra.linkcatalogs = text.linkcatalogs;
  if (pdCountry) extra.country_id_present_days = mapCountryCode(pdCountry);

  const extraField = Object.keys(extra).length > 0 ? JSON.stringify(extra) : null;

  // Build provenance field
  const provenance = text.provenance ? convertHtmlToMarkdown(text.provenance) : null;

  const data: Omit<ItemTranslationData, 'item_id' | 'context_id' | 'backward_compatibility'> = {
    language_id: languageId,
    name: convertHtmlToMarkdown(name),
    description,
    alternate_name: alternateName,
    type,
    holder,
    owner,
    initial_owner: initialOwner,
    dates,
    location,
    bibliography: text.bibliography ? convertHtmlToMarkdown(text.bibliography) : null,
    provenance,
    extra: extraField,
  };

  return {
    data,
    languageId,
  };
}
