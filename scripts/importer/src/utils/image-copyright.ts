/**
 * The copyright an imported picture is burned with, stored on the image row's
 * own `copyright` column (item_images, partner_images).
 *
 * inventory-app burns that column verbatim, whereas legacy stored the bare
 * rights holder ("Moravská galerie v Brně") and its watermark added the mark
 * itself. The mark is therefore added here, once. The same legacy value keeps
 * reaching `extra.copyright` untouched; this is an additional field, not a
 * replacement.
 */

const COPYRIGHT_MARK = '©';

/**
 * Burn-ready text for one legacy copyright value, or null when it is blank.
 */
export function toImageCopyright(value: string | null | undefined): string | null {
  const text = value?.trim();
  if (!text) {
    return null;
  }

  return text.startsWith(COPYRIGHT_MARK) ? text : `${COPYRIGHT_MARK} ${text}`;
}

/**
 * One copyright for a picture whose legacy rows are stored per language, since
 * the image row holds a single value: the English text when it is filled,
 * otherwise the first filled text in the rows' order. Where the languages
 * disagree in the legacy data, an English value always exists.
 */
export function pickImageCopyright(
  rows: ReadonlyArray<{ lang: string | null | undefined; copyright: string | null | undefined }>
): string | null {
  const filled = rows.filter((row) => row.copyright?.trim());
  const chosen = filled.find((row) => isEnglish(row.lang)) ?? filled[0];

  return toImageCopyright(chosen?.copyright);
}

function isEnglish(lang: string | null | undefined): boolean {
  const code = lang?.trim().toLowerCase();

  return code === 'en' || code === 'eng';
}
