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

/**
 * The credit line legacy's image server (images.museumwnf.org, cache.php)
 * printed on a project's pictures when it did not print the picture's own
 * copyright. It becomes the Project's `copyright`, which inventory-app burns
 * on every image of the project that has none of its own.
 *
 * Projects missing here keep inventory-app's global fallback, which is what
 * legacy printed for them too ("© Museum With No Frontiers"), except Baroque
 * Art, where legacy printed a bare "©".
 */
const MWNF3_PROJECT_COPYRIGHT: Readonly<Record<string, string>> = {
  ISL: '© Discover Islamic Art (MWNF)',
  IAM: '© Islamic Art in the Mediterranean (MWNF)',
};

/**
 * Legacy printed these projects' line on every picture and never read the
 * picture's own copyright.
 */
const PROJECTS_OVERRIDING_PICTURES: ReadonlySet<string> = new Set(['ISL', 'IAM']);

/** Legacy's line for a Sharing History picture with no copyright of its own. */
export const SHARING_HISTORY_COPYRIGHT = '© MWNF | Sharing History';

/**
 * The copyright of the Project imported from an mwnf3 project, or null for
 * the global fallback.
 */
export function mwnf3ProjectCopyright(projectId: string): string | null {
  return MWNF3_PROJECT_COPYRIGHT[projectId.trim().toUpperCase()] ?? null;
}

/**
 * The copyright an mwnf3 picture's image row carries: null for a project
 * whose line legacy printed instead of the picture's own (the image then
 * burns its Project's), otherwise as pickImageCopyright(). The legacy text
 * still reaches the picture translations' `extra.copyright` either way.
 */
export function pickMwnf3PictureCopyright(
  projectId: string,
  rows: ReadonlyArray<{ lang: string | null | undefined; copyright: string | null | undefined }>
): string | null {
  if (PROJECTS_OVERRIDING_PICTURES.has(projectId.trim().toUpperCase())) {
    return null;
  }

  return pickImageCopyright(rows);
}

function isEnglish(lang: string | null | undefined): boolean {
  const code = lang?.trim().toLowerCase();

  return code === 'en' || code === 'eng';
}
