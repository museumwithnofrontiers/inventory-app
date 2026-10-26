import { convertHtmlToMarkdown } from '../../utils/html-to-markdown.js';

/**
 * Sharing History text columns with no item_translations column of their own
 * (the second description, history, the second and third names, keywords):
 * each kept in `extra` under its own key, converted like every other text
 * field. Legacy prints each under a heading of its own, so none is ever joined
 * to another; each site prints the ones its legacy sheet printed.
 */
export function textFields(
  fields: Record<string, string | null | undefined>
): Record<string, string> {
  const kept: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (!value || value.trim() === '') continue;
    kept[key] = convertHtmlToMarkdown(value);
  }
  return kept;
}
