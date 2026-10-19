/**
 * Object Transformer
 *
 * Transforms legacy object data to item entities.
 * This contains the shared business logic for handling:
 * - Denormalized data (multiple language rows per object)
 * - EPM description2 handling
 * - HTML to Markdown conversion
 * - Field truncation for database limits
 * - Tag and artist extraction
 */

import type { LegacyObject, ObjectGroup } from '../types/index.js';
import type { ItemData, ItemTranslationData } from '../../core/types.js';
import { mapLanguageCode, mapCountryCode } from '../../utils/code-mappings.js';
import { formatBackwardCompatibility } from '../../utils/backward-compatibility.js';
import { convertHtmlToMarkdown } from '../../utils/html-to-markdown.js';
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
 * Transformed object result
 */
export interface TransformedObject {
  data: Omit<ItemData, 'collection_id' | 'partner_id' | 'project_id'>;
  backwardCompatibility: string;
  countryId: string;
  warnings: string[];
}

/**
 * Transformed object translation result
 */
export interface TransformedObjectTranslation {
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
 * Tag extraction result
 */
export interface ExtractedTags {
  materials: string[];
  keywords: string[];
  languageId: string;
}

/**
 * Artist extraction result
 */
export interface ExtractedArtist {
  name: string;
  birthplace: string | null;
  deathplace: string | null;
  birthdate: string | null;
  deathdate: string | null;
  periodActivity: string | null;
}

/**
 * Parse a year value from a legacy varchar column.
 * Only accepts integer strings in the SMALLINT range (-32768 to 32767).
 * Returns a warning when the value is non-null but cannot be stored.
 */
export function parseItemYear(raw: string | null | undefined): {
  value: number | null;
  warning: string | null;
} {
  if (!raw) return { value: null, warning: null };
  const trimmed = raw.trim();
  if (!trimmed) return { value: null, warning: null };
  if (!/^-?\d+$/.test(trimmed)) {
    return { value: null, warning: `Non-integer year value ignored: '${raw}'` };
  }
  const n = parseInt(raw, 10);
  if (n < -32768 || n > 32767) {
    return { value: null, warning: `Year value ${n} out of SMALLINT range, ignored` };
  }
  return { value: n, warning: null };
}

/**
 * Group denormalized object rows by non-lang PK columns
 */
export function groupObjectsByPK(objects: LegacyObject[]): ObjectGroup[] {
  const groups = new Map<string, ObjectGroup>();

  for (const obj of objects) {
    const key = `${obj.project_id}:${obj.country}:${obj.museum_id}:${obj.number}`;

    if (!groups.has(key)) {
      groups.set(key, {
        project_id: obj.project_id,
        country: obj.country,
        museum_id: obj.museum_id,
        number: obj.number,
        translations: [],
      });
    }

    groups.get(key)!.translations.push(obj);
  }

  return Array.from(groups.values());
}

/**
 * Transform an object group to item data
 * @param group Object group with all translations
 * @param defaultLanguageId Default language ID to use for internal_name
 */
export function transformObject(group: ObjectGroup, defaultLanguageId: string): TransformedObject {
  if (!group.translations || group.translations.length === 0) {
    throw new Error('No translations found for object');
  }

  const backwardCompatibility = formatBackwardCompatibility({
    schema: 'mwnf3',
    table: 'objects',
    pkValues: [group.project_id, group.country, group.museum_id, group.number],
  });

  const countryId = mapCountryCode(group.country);

  const selectedInternalName = selectItemInternalName(
    group.translations.map((translation) => ({
      languageId: mapLanguageCode(translation.lang),
      value: translation.name === undefined ? null : translation.name,
    })),
    defaultLanguageId,
    'Object',
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
  const startDateParsed = parseItemYear(selectedTranslation!.start_date);
  const endDateParsed = parseItemYear(selectedTranslation!.end_date);
  const warnings: string[] = [];
  if (startDateParsed.warning) warnings.push(startDateParsed.warning);
  if (endDateParsed.warning) warnings.push(endDateParsed.warning);
  if (selectedInternalName.warning) warnings.push(selectedInternalName.warning);

  const data: Omit<ItemData, 'collection_id' | 'partner_id' | 'project_id'> = {
    type: 'object',
    internal_name: selectedInternalName.internalName,
    owner_reference: selectedTranslation!.inventory_id || null,
    mwnf_reference: selectedTranslation!.working_number || null,
    backward_compatibility: backwardCompatibility,
    country_id: countryId,
    start_date: startDateParsed.value,
    end_date: endDateParsed.value,
  };

  return {
    data,
    backwardCompatibility,
    countryId,
    warnings,
  };
}

/**
 * Transform object translation
 * @param obj Legacy object data
 * @param descriptionField Which description field to use
 */
export function transformObjectTranslation(
  obj: LegacyObject,
  descriptionField: 'description' | 'description2' = 'description'
): TransformedObjectTranslation | null {
  const languageId = mapLanguageCode(obj.lang);
  const warnings: string[] = [];
  const objectKey = `${obj.project_id}:${obj.museum_id}:${obj.number}`;

  // Determine which description to use
  const sourceDescription =
    descriptionField === 'description2' ? obj.description2 : obj.description;

  // An absent description is not a reason to drop the record. `planTranslations`
  // decides which description field this plan is for; a plan with neither field
  // populated is a catalogued object that was never given descriptive text, and
  // legacy publishes it on the strength of its name and technical fields alone.
  const hasDescription = Boolean(sourceDescription && sourceDescription.trim());

  // Validate name
  const name = obj.name?.trim() || null;
  if (!name) {
    warnings.push(`${objectKey}:${obj.lang} - Missing required 'name' field`);
    return null;
  }

  // Convert HTML to Markdown
  const nameMarkdown = convertHtmlToMarkdown(name);
  const descriptionMarkdown = hasDescription ? convertHtmlToMarkdown(sourceDescription!) : null;
  const bibliographyMarkdown = obj.bibliography ? convertHtmlToMarkdown(obj.bibliography) : null;

  // Handle alternate_name with truncation
  let alternateNameMarkdown = obj.name2 ? convertHtmlToMarkdown(obj.name2) : null;
  if (alternateNameMarkdown && alternateNameMarkdown.length > 255) {
    warnings.push(
      `${objectKey}:${obj.lang} - alternate_name truncated (${alternateNameMarkdown.length} → 255 chars)`
    );
    alternateNameMarkdown = alternateNameMarkdown.substring(0, 252) + '...';
  }

  // Handle type with truncation
  let typeMarkdown = obj.typeof ? convertHtmlToMarkdown(obj.typeof) : null;
  if (typeMarkdown && typeMarkdown.length > 255) {
    warnings.push(`${objectKey}:${obj.lang} - type truncated (${typeMarkdown.length} → 255 chars)`);
    typeMarkdown = typeMarkdown.substring(0, 252) + '...';
  }

  // Convert other fields
  const holderMarkdown = obj.holding_museum ? convertHtmlToMarkdown(obj.holding_museum) : null;
  const ownerMarkdown = obj.current_owner ? convertHtmlToMarkdown(obj.current_owner) : null;
  const initialOwnerMarkdown = obj.original_owner
    ? convertHtmlToMarkdown(obj.original_owner)
    : null;
  const datesMarkdown = obj.date_description ? convertHtmlToMarkdown(obj.date_description) : null;
  const dimensionsMarkdown = obj.dimensions ? convertHtmlToMarkdown(obj.dimensions) : null;
  const placeOfProductionMarkdown = obj.production_place
    ? convertHtmlToMarkdown(obj.production_place)
    : null;
  const methodForDatationMarkdown = obj.datationmethod
    ? convertHtmlToMarkdown(obj.datationmethod)
    : null;
  const methodForProvenanceMarkdown = obj.provenancemethod
    ? convertHtmlToMarkdown(obj.provenancemethod)
    : null;
  const provenanceMarkdown = obj.provenance ? convertHtmlToMarkdown(obj.provenance) : null;
  const obtentionMarkdown = obj.obtentionmethod ? convertHtmlToMarkdown(obj.obtentionmethod) : null;

  // Convert location (composed from multiple fields)
  const locationParts = [obj.location, obj.province]
    .filter(Boolean)
    .map((part) => convertHtmlToMarkdown(part));
  const locationMarkdown = locationParts.length > 0 ? locationParts.join(', ') : null;

  // Build extra field for fields without dedicated columns
  const extraData: Record<string, unknown> = {};
  if (obj.workshop) extraData.workshop = obj.workshop;
  // Rights statement. `copyright` is the column this used to read on its own,
  // and it has never held a value; the text legacy's editors actually entered
  // — and that the legacy client renders in its #info-copyright block — is in
  // `notice_b`. Take the real column first so a later backfill wins, then fall
  // back. HTML-converted like every other text field: some values carry
  // entities and escaped quotes.
  const rights = [obj.copyright, obj.notice_b].find((value) => value?.trim());
  if (rights) extraData.copyright = convertHtmlToMarkdown(rights);
  if (obj.binding_desc) extraData.binding_desc = obj.binding_desc;
  if (obj.linkcatalogs) extraData.linkcatalogs = obj.linkcatalogs;
  if (obj.catalogue_holding_link) extraData.catalogue_holding_link = obj.catalogue_holding_link;
  if (obj.scriber) extraData.scriber = convertHtmlToMarkdown(obj.scriber);
  // The free-text Period / Dynasty line legacy prints on the sheet. The linked
  // dynasties (item_dynasty, DynastyImporter) are a separate, partial index.
  if (obj.dynasty) extraData.dynasty = convertHtmlToMarkdown(obj.dynasty);
  const extraField = Object.keys(extraData).length > 0 ? JSON.stringify(extraData) : null;

  // backward_compatibility matches parent item
  const backwardCompatibility = formatBackwardCompatibility({
    schema: 'mwnf3',
    table: 'objects',
    pkValues: [obj.project_id, obj.country, obj.museum_id, obj.number],
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
    holder: holderMarkdown,
    owner: ownerMarkdown,
    initial_owner: initialOwnerMarkdown,
    dates: datesMarkdown,
    location: locationMarkdown,
    dimensions: dimensionsMarkdown,
    place_of_production: placeOfProductionMarkdown,
    method_for_datation: methodForDatationMarkdown,
    method_for_provenance: methodForProvenanceMarkdown,
    provenance: provenanceMarkdown,
    obtention: obtentionMarkdown,
    bibliography: bibliographyMarkdown,
    extra: extraField,
  };

  return {
    data,
    authorName: obj.preparedby?.trim() || null,
    textCopyEditorName: obj.copyeditedby?.trim() || null,
    translatorName: obj.translationby?.trim() || null,
    translationCopyEditorName: obj.translationcopyeditedby?.trim() || null,
    warnings,
  };
}

/**
 * Extract tags from object data
 */
export function extractObjectTags(obj: LegacyObject): ExtractedTags {
  const languageId = mapLanguageCode(obj.lang);

  return {
    materials: parseTagString(obj.materials),
    keywords: parseTagString(obj.keywords),
    languageId,
  };
}

/**
 * Extract artists from object data.
 *
 * Uses the same two-pass split as parseTagString:
 * comma/Arabic comma first, then semicolon/Arabic semicolon for non-structured parts.
 * HTML tags (e.g. <br/>) are stripped before splitting.
 */
export function extractObjectArtists(obj: LegacyObject): ExtractedArtist[] {
  if (!obj.artist || obj.artist.trim() === '') {
    return [];
  }

  // Strip HTML tags before splitting
  const cleaned = obj.artist
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return [];

  // Pass 1: split on comma (ASCII) and Arabic comma (U+060C)
  const commaParts = cleaned
    .split(/[,\u060C]/)
    .map((s) => s.trim())
    .filter(Boolean);

  // Pass 2: structured (colon) parts kept as-is; others sub-split on semicolons
  const artistNames: string[] = [];
  for (const part of commaParts) {
    if (part.includes(':')) {
      artistNames.push(part);
    } else {
      const semiParts = part
        .split(/[;\u061B]/)
        .map((s) => s.trim())
        .filter(Boolean);
      artistNames.push(...semiParts);
    }
  }

  return artistNames.map((name) => ({
    name,
    birthplace: obj.birthplace || null,
    deathplace: obj.deathplace || null,
    birthdate: obj.birthdate || null,
    deathdate: obj.deathdate || null,
    periodActivity: obj.period_activity || null,
  }));
}

/**
 * Parse a materials or keywords string into its entries.
 *
 * Splits on semicolon (U+003B) and Arabic semicolon (U+061B) only. Legacy
 * prints the column as written, and a comma belongs to an entry ("Wool warp
 * and weft, wool pile"), so splitting there would print one entry as two.
 */
export function parseTagString(tagString: string | undefined | null): string[] {
  if (!tagString || tagString.trim() === '') {
    return [];
  }

  return tagString
    .split(/[;\u061B]/)
    .map((t) => t.trim())
    .filter((t) => t !== '');
}

/**
 * Determine which translations need to be created for EPM handling
 *
 * EPM (European Project Mediterranean) logic:
 * - For EPM project: only use description2 as description
 * - For other projects:
 *   - Create translation in own context using description
 *   - If description2 exists and EPM context exists, create EPM translation
 */
export interface TranslationPlan {
  translation: LegacyObject;
  contextType: 'own' | 'epm';
  descriptionField: 'description' | 'description2';
}

export function planTranslations(group: ObjectGroup, hasEpmContext: boolean): TranslationPlan[] {
  const plans: TranslationPlan[] = [];

  for (const translation of group.translations) {
    if (translation.project_id === 'EPM') {
      // EPM project: only use description2. A row without one still gets its
      // translation, with a null description, for the same reason as the
      // other projects below: legacy publishes it from its other fields.
      plans.push({
        translation,
        contextType: 'own',
        descriptionField: 'description2',
      });
    } else {
      const hasDescription = Boolean(translation.description && translation.description.trim());
      const hasDescription2 = Boolean(translation.description2 && translation.description2.trim());

      // Other projects: create in own context with description.
      //
      // A row with neither description still gets its own-context translation,
      // with a null description — otherwise the whole language row is lost and
      // with it the name, materials, dimensions, dates and bibliography that
      // legacy renders the sheet from. 43 objects and 1 monument across the
      // legacy corpus are catalogued this way and are published by legacy.
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
