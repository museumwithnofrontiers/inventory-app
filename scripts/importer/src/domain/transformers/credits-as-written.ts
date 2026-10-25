import { convertHtmlToMarkdown } from '../../utils/html-to-markdown.js';

/**
 * A legacy text row's own credit columns, as typed.
 *
 * Legacy keeps a record's credits twice: per person in its credit tables
 * (`authors_objects`, `sh_authors_objects`, …, which the AuthorImporter turns
 * into item_translation_author), and as text in the row itself. The galleries'
 * sheet (dxa-api) prints the text when the credit table has nobody for a role
 * on that page — "Cherid Houria", or "أنيت هاغِِدورن." with its doubled vowel
 * mark — so the text is kept exactly as written, under the package's role
 * names. Which site prints it is the exporters' business.
 */
export function creditsAsWritten(row: {
  preparedby?: string | null;
  copyeditedby?: string | null;
  translationby?: string | null;
  translationcopyeditedby?: string | null;
}): Record<string, string> | null {
  const kept: Record<string, string> = {};
  const columns = {
    author: row.preparedby,
    copy_editor: row.copyeditedby,
    translator: row.translationby,
    translation_copy_editor: row.translationcopyeditedby,
  };
  for (const [role, value] of Object.entries(columns)) {
    if (value?.trim()) kept[role] = convertHtmlToMarkdown(value);
  }
  return Object.keys(kept).length > 0 ? kept : null;
}
