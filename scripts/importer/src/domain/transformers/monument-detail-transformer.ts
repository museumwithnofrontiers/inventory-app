/**
 * Monument Detail Transformer
 *
 * Transforms legacy monument detail data to item entities.
 * Monument details are simpler than monuments with fewer fields.
 */

import type { LegacyMonumentDetail, MonumentDetailGroup } from '../types/index.js';
import type { ItemData, ItemTranslationData } from '../../core/types.js';
import { mapLanguageCode, mapCountryCode } from '../../utils/code-mappings.js';
import { formatBackwardCompatibility } from '../../utils/backward-compatibility.js';
import { convertHtmlToMarkdown } from '../../utils/html-to-markdown.js';
import { selectItemInternalName } from './item-internal-name-transformer.js';

/**
 * Transformed monument detail result
 */
export interface TransformedMonumentDetail {
  data: Omit<ItemData, 'collection_id' | 'partner_id' | 'project_id'>;
  backwardCompatibility: string;
  countryId: string;
  parentBackwardCompatibility: string;
  warning: string | null;
}

/**
 * Transformed monument detail translation result
 */
export interface TransformedMonumentDetailTranslation {
  data: Omit<
    ItemTranslationData,
    | 'item_id'
    | 'context_id'
    | 'author_id'
    | 'text_copy_editor_id'
    | 'translator_id'
    | 'translation_copy_editor_id'
  >;
  warnings: string[];
}

/**
 * Tag extraction result for monument details
 */
export interface ExtractedMonumentDetailTags {
  artists: string[];
  languageId: string;
}

/**
 * Group denormalized monument detail rows by non-lang PK columns
 */
export function groupMonumentDetailsByPK(details: LegacyMonumentDetail[]): MonumentDetailGroup[] {
  const groups = new Map<string, MonumentDetailGroup>();

  for (const detail of details) {
    const key = `${detail.project_id}:${detail.country_id}:${detail.institution_id}:${detail.monument_id}:${detail.detail_id}`;

    if (!groups.has(key)) {
      groups.set(key, {
        project_id: detail.project_id,
        country_id: detail.country_id,
        institution_id: detail.institution_id,
        monument_id: detail.monument_id,
        detail_id: detail.detail_id,
        translations: [],
      });
    }

    groups.get(key)!.translations.push(detail);
  }

  return Array.from(groups.values());
}

function isBlankField(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim() === '';
}

/**
 * True when no language version of the group carries any content at all.
 *
 * The legacy monument editor exposed a fixed set of detail slots and persisted
 * the unused ones as rows with every content column empty (`name` is
 * `NOT NULL DEFAULT ''` in the legacy schema, so they are empty strings rather
 * than NULLs). Such a group has nothing to import: no name to derive an
 * internal_name from, and no description, so transformMonumentDetailTranslation
 * would decline every language version too — the item would end up with no
 * translation at all.
 *
 * All five content columns are tested on purpose. A group whose name is blank
 * but which still carries a description, a location, a date or an artist is a
 * genuine data problem, and must keep failing loudly in selectItemInternalName
 * rather than being swallowed here.
 */
export function isBlankMonumentDetailGroup(group: MonumentDetailGroup): boolean {
  if (group.translations.length === 0) {
    // Not a padding row but a malformed group; transformMonumentDetail reports it.
    return false;
  }

  return group.translations.every(
    (translation) =>
      isBlankField(translation.name) &&
      isBlankField(translation.description) &&
      isBlankField(translation.location) &&
      isBlankField(translation.date) &&
      isBlankField(translation.artist)
  );
}

/**
 * Transform a monument detail group to item data
 * @param group Monument detail group with all translations
 * @param defaultLanguageId Default language ID to use for internal_name
 */
export function transformMonumentDetail(
  group: MonumentDetailGroup,
  defaultLanguageId: string
): TransformedMonumentDetail {
  if (!group.translations || group.translations.length === 0) {
    throw new Error('No translations found for monument detail');
  }

  const backwardCompatibility = formatBackwardCompatibility({
    schema: 'mwnf3',
    table: 'monument_details',
    pkValues: [
      group.project_id,
      group.country_id,
      group.institution_id,
      group.monument_id,
      group.detail_id,
    ],
  });

  // Build parent monument backward compatibility (without detail_id)
  const parentBackwardCompatibility = formatBackwardCompatibility({
    schema: 'mwnf3',
    table: 'monuments',
    pkValues: [group.project_id, group.country_id, group.institution_id, group.monument_id],
  });

  const countryId = mapCountryCode(group.country_id);

  const selectedInternalName = selectItemInternalName(
    group.translations.map((translation) => ({
      languageId: mapLanguageCode(translation.lang_id),
      value: translation.name === undefined ? null : translation.name,
    })),
    defaultLanguageId,
    'Monument detail',
    backwardCompatibility
  );

  const data: Omit<ItemData, 'collection_id' | 'partner_id' | 'project_id'> = {
    type: 'detail',
    internal_name: selectedInternalName.internalName,
    owner_reference: null,
    mwnf_reference: null,
    backward_compatibility: backwardCompatibility,
    country_id: countryId,
  };

  return {
    data,
    backwardCompatibility,
    countryId,
    parentBackwardCompatibility,
    warning: selectedInternalName.warning,
  };
}

/**
 * Transform monument detail translation
 */
export function transformMonumentDetailTranslation(
  detail: LegacyMonumentDetail
): TransformedMonumentDetailTranslation | null {
  const languageId = mapLanguageCode(detail.lang_id);
  const warnings: string[] = [];

  // Legacy prints a detail's heading, location, dates and artist even when it has no
  // description; skip only a translation with neither a name nor a description.
  const hasDescription = !!detail.description?.trim();
  if (!detail.name?.trim() && !hasDescription) {
    return null;
  }

  // Convert HTML fields to Markdown
  // Name is required for ItemTranslationData
  const nameMarkdown = detail.name?.trim()
    ? convertHtmlToMarkdown(detail.name)
    : convertHtmlToMarkdown(detail.description).slice(0, 100);
  const descriptionMarkdown = hasDescription ? convertHtmlToMarkdown(detail.description) : null;
  const locationMarkdown = detail.location ? convertHtmlToMarkdown(detail.location) : null;
  const datesMarkdown = detail.date ? convertHtmlToMarkdown(detail.date) : null;
  // The artist line as this language prints it; the artist entities are language-independent.
  const artistMarkdown = detail.artist?.trim() ? convertHtmlToMarkdown(detail.artist) : null;

  // backward_compatibility matches parent item
  const backwardCompatibility = formatBackwardCompatibility({
    schema: 'mwnf3',
    table: 'monument_details',
    pkValues: [
      detail.project_id,
      detail.country_id,
      detail.institution_id,
      detail.monument_id,
      detail.detail_id,
    ],
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
    alternate_name: null,
    type: null,
    holder: null,
    owner: null,
    initial_owner: null,
    dates: datesMarkdown,
    location: locationMarkdown,
    dimensions: null,
    place_of_production: null,
    method_for_datation: null,
    method_for_provenance: null,
    obtention: null,
    bibliography: null,
    extra: artistMarkdown ? JSON.stringify({ artist: artistMarkdown }) : null,
  };

  return {
    data,
    warnings,
  };
}

/**
 * Extract artists from monument detail data
 * Artists are stored as text that may contain multiple artists
 */
export function extractMonumentDetailTags(
  detail: LegacyMonumentDetail
): ExtractedMonumentDetailTags {
  const languageId = mapLanguageCode(detail.lang_id);

  // Parse artist field (similar to keywords but for artists)
  const artists: string[] = [];
  if (detail.artist && detail.artist.trim()) {
    // Split by common delimiters including Arabic equivalents, but not inside brackets:
    // "Heinrich Reinhart (Erzgie\u00DFer, 1575-1629)" is one artist.
    const rawArtists = detail.artist
      .split(/[;,\n\u060C\u061B](?![^()]*\))/)
      .map((a) => a.trim())
      .filter((a) => a.length > 0);
    artists.push(...rawArtists);
  }

  return {
    artists,
    languageId,
  };
}
