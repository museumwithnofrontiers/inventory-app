import { convertHtmlToMarkdown } from '../../utils/html-to-markdown.js';

/**
 * Sharing History records also appear in the galleries and exhibitions, whose
 * sheet (dxa-api) shows some of their fields differently from the Sharing
 * History site: description and short description apart, history apart, the
 * second name alone, and keywords. The record's own translation keeps the
 * Sharing History site's merged form, so these are kept beside it in
 * `extra.gallery_sheet`, converted like every other text field.
 */
export function gallerySheetFields(
  fields: Record<string, string | null | undefined>
): Record<string, string> | null {
  const sheet: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (!value || value.trim() === '') continue;
    sheet[key] = convertHtmlToMarkdown(value);
  }
  return Object.keys(sheet).length > 0 ? sheet : null;
}
