/**
 * Publications (legacy "books", mwnf3.bookbase + mwnf3.books): the pure
 * mappings phase 12 applies. See the M14 proposal, part 2 and part 4.
 *
 * - bookbase is the work → publications
 * - books is one version (language × publisher × format × edition) → publication_editions
 * - a work's texts in one language come from its reference edition → publication_translations
 */

/** Legacy books_category_names ids → PublicationCategory. 1 ("MWNF BOOKS") is not a kind. */
export const CATEGORY_BY_LEGACY_ID: Record<number, string> = {
  2: 'virtual-museum',
  3: 'exhibition-trail',
  4: 'educational',
  5: 'other',
  6: 'gallery',
};

/**
 * Works legacy files under two categories, given one by Pascal (D-P3, #2517):
 * 48 "MWNF Educational Guide" and 53 "Architectural Guide Tunis".
 */
export const CATEGORY_OVERRIDES: Record<number, string> = {
  48: 'educational',
  53: 'other',
};

export function publicationCategory(bookId: number, legacyCategoryIds: number[]): string | null {
  const override = CATEGORY_OVERRIDES[bookId];
  if (override) return override;
  const kinds = [
    ...new Set(
      legacyCategoryIds
        .map((id) => CATEGORY_BY_LEGACY_ID[Number(id)])
        .filter((kind): kind is string => !!kind)
    ),
  ];
  return kinds.length === 1 ? kinds[0]! : null;
}

/** Legacy books.type → PublicationFormat. */
export const FORMAT_BY_LEGACY_TYPE: Record<string, string> = {
  book: 'print',
  digp: 'print-on-demand',
  ebook: 'ebook',
};

const FORMAT_RANK: Record<string, number> = { book: 0, digp: 1, ebook: 2 };

export function toInt(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const match = /\d+/.exec(String(value));
  return match ? Number(match[0]) : null;
}

/** The legacy columns of one books row that phase 12 reads. */
export interface LegacyEdition {
  book_id: number;
  lang_id: string;
  type: string;
  edition: string | null;
  publisher_id: number | null;
  publish_year: string | null;
  title: string | null;
  subtitle: string | null;
  description1: string | null;
  description2: string | null;
  author: string | null;
  photographer: string | null;
  local_coordinator: string | null;
  remarks1: string | null;
  remarks2: string | null;
  [column: string]: unknown;
}

export function editionBackwardCompat(row: {
  book_id: number;
  lang_id: string;
  publisher_id: number | null;
  type: string;
  edition: string | null;
}): string {
  return `mwnf3:books:${row.book_id}:${row.lang_id}:${row.publisher_id ?? ''}:${row.type}:${toInt(row.edition) ?? ''}`;
}

/**
 * The edition whose texts a work's translation carries: the most recent
 * publish year in that language; print before print-on-demand before e-book
 * on a tie.
 */
export function pickReferenceEdition<T extends LegacyEdition>(rows: T[]): T | null {
  if (rows.length === 0) return null;
  return [...rows].sort((a, b) => {
    const year = (toInt(b.publish_year) ?? 0) - (toInt(a.publish_year) ?? 0);
    if (year !== 0) return year;
    const rank = (FORMAT_RANK[a.type] ?? 9) - (FORMAT_RANK[b.type] ?? 9);
    if (rank !== 0) return rank;
    return (toInt(b.edition) ?? 0) - (toInt(a.edition) ?? 0);
  })[0]!;
}

/** Translation columns ← legacy books columns of the reference edition. */
export const TRANSLATION_FIELDS = {
  title: 'title',
  subtitle: 'subtitle',
  description: 'description2',
  introduction: 'description1',
  author_credit: 'author',
  photography_credit: 'photographer',
  coordination_credit: 'local_coordinator',
} as const;

const TEXT_COLUMNS = [
  'title',
  'subtitle',
  'description1',
  'description2',
  'author',
  'photographer',
  'local_coordinator',
  'remarks1',
  'remarks2',
] as const;

function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}

/** The translation's own fields, from its reference edition. */
export function translationTexts(reference: LegacyEdition): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const [field, column] of Object.entries(TRANSLATION_FIELDS)) {
    out[field] = text(reference[column]);
  }
  return out;
}

/** The translation's residual columns (remarks), each under its own key. */
export function translationExtra(reference: LegacyEdition): Record<string, string> | null {
  const extra: Record<string, string> = {};
  const remarks1 = text(reference.remarks1);
  const remarks2 = text(reference.remarks2);
  if (remarks1) extra.remarks_1 = remarks1;
  if (remarks2) extra.remarks_2 = remarks2;
  return Object.keys(extra).length > 0 ? extra : null;
}

/**
 * An edition's texts that differ from its translation's reference edition
 * (D-P9: kept in extra.legacy_texts), keyed by legacy column. A column the
 * edition leaves empty where the reference has a text is kept as '': legacy
 * prints the version's own row, so that version shows nothing there.
 */
export function legacyTexts(
  edition: LegacyEdition,
  reference: LegacyEdition
): Record<string, string> | null {
  const out: Record<string, string> = {};
  if (edition !== reference) {
    for (const column of TEXT_COLUMNS) {
      const mine = text(edition[column]);
      if (mine !== text(reference[column])) out[column] = mine ?? '';
    }
  }
  // The counts legacy keeps as text: the edition stores the number, and a value
  // that is more than a number ("868 + a DVD with 55,000 supplementary digital
  // images") is also kept whole, as legacy prints it.
  for (const column of ['count_pages', 'count_images', 'count_plans']) {
    const raw = text(edition[column]);
    if (raw !== null && !/^\d+$/.test(raw)) out[column] = raw;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** The "get it from" shop links (D-P8: kept in extra.shop_links, not modelled). */
export function shopLinks(
  row: Record<string, unknown>
): Array<{ name: string | null; url: string }> | null {
  const links: Array<{ name: string | null; url: string }> = [];
  for (let n = 1; n <= 10; n++) {
    const suffix = String(n).padStart(2, '0');
    const url = text(row[`get_from_url_${suffix}`]);
    if (url) links.push({ name: text(row[`get_from_name_${suffix}`]), url });
  }
  return links.length > 0 ? links : null;
}

/** bookbase.ref_trail "IAM;pt;1" → the Travels trail key. */
export function refTrailBackwardCompat(refTrail: string | null | undefined): string | null {
  const value = text(refTrail);
  if (!value) return null;
  const [project, country, number] = value.split(';').map((p) => p.trim());
  if (!project || !country || !number || !/^\d+$/.test(number)) return null;
  return `mwnf3_travels:trail:${project}:${country.toLowerCase()}:${Number(number)}`;
}

/** A catalogue code: one trail book in one language ("IAM_JO_EN_001"). */
export interface CatalogueCode {
  code: string;
  trailBackwardCompat: string;
  language: string;
}

/**
 * Parses an object's or monument's `linkcatalogs`: up to three codes separated
 * by ";", with legacy's typos (O for 0, a trailing "."). Free-text citations
 * are not codes and are left alone.
 */
export function parseCatalogueCodes(value: string | null | undefined): {
  codes: CatalogueCode[];
  unparsed: string[];
} {
  const codes: CatalogueCode[] = [];
  const unparsed: string[] = [];
  const raw = text(value);
  if (!raw) return { codes, unparsed };
  for (const part of raw.split(';')) {
    const candidate = part.trim().replace(/\.+$/, '');
    if (!candidate) continue;
    const match = /^([A-Za-z]{3})_([A-Za-z]{2})_([A-Za-z]{2})_([0-9Oo]{1,3})$/.exec(candidate);
    if (!match) {
      if (/^[A-Za-z]{3}_/.test(candidate)) unparsed.push(candidate);
      continue;
    }
    const [, project, country, language, numberText] = match;
    const number = Number(numberText!.replace(/[Oo]/g, '0'));
    codes.push({
      code: candidate.toUpperCase(),
      trailBackwardCompat: `mwnf3_travels:trail:${project!.toUpperCase()}:${country!.toLowerCase()}:${number}`,
      language: language!.toLowerCase(),
    });
  }
  return { codes, unparsed };
}
