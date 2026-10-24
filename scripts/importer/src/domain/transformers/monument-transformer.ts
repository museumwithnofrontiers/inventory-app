/**
 * Monument Transformer
 *
 * Transforms legacy monument data to item entities.
 * Similar to ObjectTransformer but for monuments.
 */

import type { LegacyMonument, MonumentGroup } from '../types/index.js';
import type { ItemData, ItemTranslationData } from '../../core/types.js';
import { mapLanguageCode, mapCountryCode } from '../../utils/code-mappings.js';
import { formatBackwardCompatibility } from '../../utils/backward-compatibility.js';
import { convertHtmlToMarkdown } from '../../utils/html-to-markdown.js';
import { parseTagString } from './object-transformer.js';
import { selectItemInternalName } from './item-internal-name-transformer.js';

function hasTranslationName(value: string | null | undefined): value is string {
  if (typeof value !== 'string') {
    return false;
  }

  if (value.trim() === '') {
    return false;
  }

  return true;
}

/**
 * Transformed monument result
 */
export interface TransformedMonument {
  data: Omit<ItemData, 'collection_id' | 'partner_id' | 'project_id'>;
  backwardCompatibility: string;
  countryId: string;
  warning: string | null;
}

/**
 * Transformed monument translation result
 */
export interface TransformedMonumentTranslation {
  data: Omit<
    ItemTranslationData,
    | 'item_id'
    | 'context_id'
    | 'author_id'
    | 'text_copy_editor_id'
    | 'translator_id'
    | 'translation_copy_editor_id'
  >;
  authorName: string | null;
  textCopyEditorName: string | null;
  translatorName: string | null;
  translationCopyEditorName: string | null;
  warnings: string[];
}

/**
 * Tag extraction result for monuments
 */
export interface ExtractedMonumentTags {
  keywords: string[];
  languageId: string;
}

/**
 * Group denormalized monument rows by non-lang PK columns
 */
export function groupMonumentsByPK(monuments: LegacyMonument[]): MonumentGroup[] {
  const groups = new Map<string, MonumentGroup>();

  for (const monument of monuments) {
    const key = `${monument.project_id}:${monument.country}:${monument.institution_id}:${monument.number}`;

    if (!groups.has(key)) {
      groups.set(key, {
        project_id: monument.project_id,
        country: monument.country,
        institution_id: monument.institution_id,
        number: monument.number,
        translations: [],
      });
    }

    groups.get(key)!.translations.push(monument);
  }

  return Array.from(groups.values());
}

/**
 * Transform a monument group to item data
 * @param group Monument group with all translations
 * @param defaultLanguageId Default language ID to use for internal_name
 */
export function transformMonument(
  group: MonumentGroup,
  defaultLanguageId: string
): TransformedMonument {
  if (!group.translations || group.translations.length === 0) {
    throw new Error('No translations found for monument');
  }

  const backwardCompatibility = formatBackwardCompatibility({
    schema: 'mwnf3',
    table: 'monuments',
    pkValues: [group.project_id, group.country, group.institution_id, group.number],
  });

  const countryId = mapCountryCode(group.country);

  const selectedInternalName = selectItemInternalName(
    group.translations.map((translation) => ({
      languageId: mapLanguageCode(translation.lang),
      value: translation.name === undefined ? null : translation.name,
    })),
    defaultLanguageId,
    'Monument',
    backwardCompatibility
  );

  let selectedTranslation = group.translations[0];
  for (const translation of group.translations) {
    if (
      mapLanguageCode(translation.lang) === defaultLanguageId &&
      hasTranslationName(translation.name)
    ) {
      selectedTranslation = translation;
      break;
    }
  }

  if (!hasTranslationName(selectedTranslation.name)) {
    for (const translation of group.translations) {
      if (hasTranslationName(translation.name)) {
        selectedTranslation = translation;
        break;
      }
    }
  }

  // Parse start_date/end_date from selected translation (year values stored as varchar)
  const startDate = selectedTranslation!.start_date
    ? parseInt(selectedTranslation!.start_date, 10) || null
    : null;
  const endDate = selectedTranslation!.end_date
    ? parseInt(selectedTranslation!.end_date, 10) || null
    : null;

  const data: Omit<ItemData, 'collection_id' | 'partner_id' | 'project_id'> = {
    type: 'monument',
    internal_name: selectedInternalName.internalName,
    owner_reference: selectedTranslation!.inventory_id || null,
    mwnf_reference: selectedTranslation!.working_number || null,
    backward_compatibility: backwardCompatibility,
    country_id: countryId,
    start_date: startDate,
    end_date: endDate,
  };

  return {
    data,
    backwardCompatibility,
    countryId,
    warning: selectedInternalName.warning,
  };
}

/**
 * Transform monument translation
 */
export function transformMonumentTranslation(
  monument: LegacyMonument,
  descriptionField: 'description' | 'description2' = 'description'
): TransformedMonumentTranslation | null {
  const languageId = mapLanguageCode(monument.lang);
  const warnings: string[] = [];
  const monumentKey = `${monument.project_id}:${monument.institution_id}:${monument.number}`;

  // Determine which description to use
  const sourceDescription =
    descriptionField === 'description2' ? monument.description2 : monument.description;

  // An absent description is not a reason to drop the record — see the matching
  // comment in `transformObjectTranslation` (object-transformer.ts).
  const hasDescription = Boolean(sourceDescription && sourceDescription.trim());

  // Validate name
  const name = monument.name?.trim() || null;
  if (!name) {
    warnings.push(`${monumentKey}:${monument.lang} - Missing required 'name' field`);
    return null;
  }

  // Convert HTML to Markdown
  const nameMarkdown = convertHtmlToMarkdown(name);
  const descriptionMarkdown = hasDescription ? convertHtmlToMarkdown(sourceDescription!) : null;
  const bibliographyMarkdown = monument.bibliography
    ? convertHtmlToMarkdown(monument.bibliography)
    : null;

  // Handle alternate_name with truncation
  let alternateNameMarkdown = monument.name2 ? convertHtmlToMarkdown(monument.name2) : null;
  if (alternateNameMarkdown && alternateNameMarkdown.length > 255) {
    warnings.push(
      `${monumentKey}:${monument.lang} - alternate_name truncated (${alternateNameMarkdown.length} → 255 chars)`
    );
    alternateNameMarkdown = alternateNameMarkdown.substring(0, 252) + '...';
  }

  // Handle type with truncation
  let typeMarkdown = monument.typeof ? convertHtmlToMarkdown(monument.typeof) : null;
  if (typeMarkdown && typeMarkdown.length > 255) {
    warnings.push(
      `${monumentKey}:${monument.lang} - type truncated (${typeMarkdown.length} → 255 chars)`
    );
    typeMarkdown = typeMarkdown.substring(0, 252) + '...';
  }

  // Convert other fields
  const ownerMarkdown = monument.current_owner
    ? convertHtmlToMarkdown(monument.current_owner)
    : null;
  const initialOwnerMarkdown = monument.original_owner
    ? convertHtmlToMarkdown(monument.original_owner)
    : null;
  const datesMarkdown = monument.date_description
    ? convertHtmlToMarkdown(monument.date_description)
    : null;
  const methodForDatationMarkdown = monument.datationmethod
    ? convertHtmlToMarkdown(monument.datationmethod)
    : null;

  // The location and the province are two columns, each kept on its own: the
  // PHP sites print both on one line, the galleries and exhibitions the
  // location alone, and each site composes the line it printed.
  const locationMarkdown = monument.location?.trim()
    ? convertHtmlToMarkdown(monument.location)
    : null;

  // Build extra field for fields without dedicated columns
  const extraData: Record<string, unknown> = {};
  if (monument.province?.trim()) extraData.province = convertHtmlToMarkdown(monument.province);

  // External links
  if (monument.linkcatalogs) extraData.linkcatalogs = monument.linkcatalogs;
  if (monument.external_sources) extraData.external_sources = monument.external_sources;

  // Monument contact information (language-specific visitor info)
  const monumentContact: Record<string, string> = {};
  if (monument.address) monumentContact.address = convertHtmlToMarkdown(monument.address);
  if (monument.phone) monumentContact.phone = monument.phone;
  if (monument.fax) monumentContact.fax = monument.fax;
  if (monument.email) monumentContact.email = monument.email;
  if (monument.institution)
    monumentContact.institution = convertHtmlToMarkdown(monument.institution);
  if (Object.keys(monumentContact).length > 0) {
    extraData.monument_contact = monumentContact;
  }

  // Additional descriptive fields
  if (monument.patrons) extraData.patrons = convertHtmlToMarkdown(monument.patrons);
  if (monument.architects) extraData.architects = convertHtmlToMarkdown(monument.architects);
  if (monument.history) extraData.history = convertHtmlToMarkdown(monument.history);

  // Rights statement — same pair, same precedence and same reasoning as the
  // object transformer. Neither column was read here before, so the legacy
  // client's "Additional copyright information" line had no source at all on
  // the monument path.
  const rights = [monument.copyright, monument.notice_b].find((value) => value?.trim());
  if (rights) extraData.copyright = convertHtmlToMarkdown(rights);
  // The free-text Period / Dynasty line legacy prints on the sheet. The linked
  // dynasties (item_dynasty, DynastyImporter) are a separate, partial index.
  if (monument.dynasty) extraData.dynasty = convertHtmlToMarkdown(monument.dynasty);
  // The keywords column as this row writes it. The keyword tags made from it
  // are shared across records: they give every record one spelling and lose
  // the Arabic list separator. Same key as the object transformer.
  if (monument.keywords?.trim()) extraData.keywords = convertHtmlToMarkdown(monument.keywords);

  const extraField = Object.keys(extraData).length > 0 ? JSON.stringify(extraData) : null;

  // backward_compatibility matches parent item
  const backwardCompatibility = formatBackwardCompatibility({
    schema: 'mwnf3',
    table: 'monuments',
    pkValues: [monument.project_id, monument.country, monument.institution_id, monument.number],
  });

  const data: Omit<
    ItemTranslationData,
    | 'item_id'
    | 'context_id'
    | 'author_id'
    | 'text_copy_editor_id'
    | 'translator_id'
    | 'translation_copy_editor_id'
  > = {
    language_id: languageId,
    backward_compatibility: backwardCompatibility,
    name: nameMarkdown,
    description: descriptionMarkdown,
    alternate_name: alternateNameMarkdown,
    type: typeMarkdown,
    holder: null,
    owner: ownerMarkdown,
    initial_owner: initialOwnerMarkdown,
    dates: datesMarkdown,
    location: locationMarkdown,
    dimensions: null,
    place_of_production: null,
    method_for_datation: methodForDatationMarkdown,
    method_for_provenance: null,
    provenance: null,
    obtention: null,
    bibliography: bibliographyMarkdown,
    extra: extraField,
  };

  return {
    data,
    authorName: monument.preparedby?.trim() || null,
    textCopyEditorName: monument.copyeditedby?.trim() || null,
    translatorName: monument.translationby?.trim() || null,
    translationCopyEditorName: monument.translationcopyeditedby?.trim() || null,
    warnings,
  };
}

/**
 * Extract tags from monument data
 */
export function extractMonumentTags(monument: LegacyMonument): ExtractedMonumentTags {
  const languageId = mapLanguageCode(monument.lang);

  return {
    keywords: parseTagString(monument.keywords),
    languageId,
  };
}

/**
 * Monument translation plan type
 */
export interface MonumentTranslationPlan {
  translation: LegacyMonument;
  contextType: 'own' | 'epm';
  descriptionField: 'description' | 'description2';
}

/**
 * Plan translations for monument with EPM handling
 */
export function planMonumentTranslations(
  group: MonumentGroup,
  hasEpmContext: boolean
): MonumentTranslationPlan[] {
  const plans: MonumentTranslationPlan[] = [];

  for (const translation of group.translations) {
    if (translation.project_id === 'EPM') {
      // EPM project: only use description2. A row without one still gets its
      // translation — see the matching comment in `planTranslations`
      // (object-transformer.ts).
      plans.push({
        translation,
        contextType: 'own',
        descriptionField: 'description2',
      });
    } else {
      const hasDescription = Boolean(translation.description && translation.description.trim());
      const hasDescription2 = Boolean(translation.description2 && translation.description2.trim());

      // Other projects: create in own context with description.
      // A row with neither description still gets one — see the matching
      // comment in `planTranslations` (object-transformer.ts).
      if (hasDescription || !hasDescription2) {
        plans.push({
          translation,
          contextType: 'own',
          descriptionField: 'description',
        });
      }

      // Also create EPM translation if description2 exists
      if (hasDescription2 && hasEpmContext) {
        plans.push({
          translation,
          contextType: 'epm',
          descriptionField: 'description2',
        });
      }
    }
  }

  return plans;
}
