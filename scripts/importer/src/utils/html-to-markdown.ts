/**
 * HTML to Markdown Converter
 *
 * Uses Turndown library for robust HTML to Markdown conversion.
 * This is shared business logic used by all importers.
 */
import TurndownService from 'turndown';
import { Marked, type Token, type Tokens } from 'marked';

// Create a singleton instance of TurndownService
const turndownService = new TurndownService({
  headingStyle: 'atx',
  hr: '---',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
  strongDelimiter: '**',
});

// Bold inside bold (`<strong><strong>x</strong></strong>`, as legacy's editor
// wrote it) is still just bold. Each level would otherwise add its own `**`,
// and `****x****` is not bold in Markdown.
turndownService.addRule('nestedStrong', {
  filter: (node) =>
    (node.nodeName === 'STRONG' || node.nodeName === 'B') &&
    (node.parentNode?.nodeName === 'STRONG' || node.parentNode?.nodeName === 'B'),
  replacement: (content) => content,
});

// Italic inside italic is still italic. Legacy's editor left unclosed tags
// (`<i>In situ<i> à Qousayr Amra.`), which a browser reads as one italic run
// inside another and prints in italics; a second pair of `*` would leave
// stray asterisks on the page instead.
turndownService.addRule('nestedEmphasis', {
  filter: (node) => {
    if (node.nodeName !== 'EM' && node.nodeName !== 'I') return false;
    for (let up = node.parentNode; up; up = up.parentNode) {
      if (up.nodeName === 'EM' || up.nodeName === 'I') return true;
    }
    return false;
  },
  replacement: (content) => content,
});

/**
 * Convert HTML string to Markdown using Turndown
 * Robust parser that handles malformed HTML gracefully
 */
export function convertHtmlToMarkdown(html: string | null | undefined): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  const trimmed = html.trim();

  // Only text that holds HTML goes through the HTML conversion. A `<` alone
  // doesn't make it HTML: Markdown this converter wrote, e.g. a link to
  // `<mailto: x>`, would otherwise be converted a second time when a later
  // step writes it back, its tag-like target dropped and its Markdown escaped.
  if (!containsHtml(trimmed)) {
    // Plain text is stored as written, except for its character references:
    // legacy prints the page as HTML, so `&eacute;` reads "é" there and must
    // be decoded here as the HTML path decodes it.
    if (!CHARACTER_REFERENCE.test(trimmed)) {
      return trimmed;
    }
    return decodeCharacterReferences(trimmed);
  }

  try {
    // Use Turndown to convert HTML to Markdown
    const markdown = turndownService.turndown(trimmed).trim();
    assertMarkdownOnly(markdown);
    return markdown;
  } catch (error) {
    // Re-throw with more context instead of falling back to unsafe operations
    throw new Error(
      `Failed to convert HTML to Markdown: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }
}

const CHARACTER_REFERENCE = /&(?:#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);/i;

/**
 * Decode the character references in tag-free text through the same HTML
 * conversion, a line at a time so the text keeps its line breaks. A `<` that
 * decoding produces is written back as `&lt;`: it was text, never a tag.
 */
function decodeCharacterReferences(text: string): string {
  const markdown = text
    .split(/\r?\n/)
    .map((line) =>
      line.trim() === '' ? '' : turndownService.turndown(line).trim().replace(/</g, '&lt;')
    )
    .join('\n');
  assertMarkdownOnly(markdown);
  return markdown;
}

/**
 * A data package holds Markdown, and every website renders it through one
 * pipeline that escapes raw HTML on sight. A tag that survives the conversion
 * would therefore reach a page as the characters it is, on every website at
 * once — so a leak is a fault of this importer, and it fails the import here
 * rather than being worked around downstream.
 *
 * Read with the Markdown parser the websites render with, not with a pattern:
 * an autolink (`<https://…>`), an email autolink and a code span are ordinary
 * Markdown that happen to contain angle brackets.
 */
export function containsHtml(text: string | null | undefined): boolean {
  if (!text || !text.includes('<')) return false;
  return tokensContainHtml(markdown.lexer(text));
}

function tokensContainHtml(tokens: Token[] | undefined): boolean {
  for (const token of tokens ?? []) {
    if (token.type === 'html') return true;
    // Legacy prints its texts as HTML, where a line indented by a tab or four
    // spaces is just a line. Markdown reads it as a code block and keeps its
    // tags as text, so the tags would pass unseen and reach the sites raw.
    // The block's text is read again as the paragraph it is. A fenced block is
    // left alone: nobody writes one by accident.
    if (token.type === 'code' && (token as Tokens.Code).codeBlockStyle === 'indented') {
      if (tokensContainHtml(markdown.lexer((token as Tokens.Code).text))) return true;
      continue;
    }
    if (token.type === 'table') {
      const table = token as Tokens.Table;
      const cells = [...table.header, ...table.rows.flat()];
      if (cells.some((cell) => tokensContainHtml(cell.tokens))) return true;
      continue;
    }
    const children = (token as { tokens?: Token[] }).tokens;
    const items = (token as { items?: Token[] }).items;
    if (tokensContainHtml(children) || tokensContainHtml(items)) return true;
  }
  return false;
}

export function assertMarkdownOnly(markdown: string, field = 'a text'): void {
  if (containsHtml(markdown)) {
    throw new Error(`HTML survived the conversion of ${field} to Markdown: ${markdown.slice(0, 120)}`);
  }
}

/**
 * Convert HTML fields in an object to Markdown
 * @param obj Object containing fields that may have HTML
 * @param htmlFields Array of field names that contain HTML
 * @returns New object with HTML fields converted to Markdown
 */
export function convertHtmlFieldsToMarkdown<T extends Record<string, unknown>>(
  obj: T,
  htmlFields: string[]
): T {
  const result: Record<string, unknown> = { ...obj };

  htmlFields.forEach((field) => {
    if (field in result && typeof result[field] === 'string') {
      result[field] = convertHtmlToMarkdown(result[field] as string);
    }
  });

  return result as T;
}

/**
 * Fields holding a JSON document rather than a text.
 *
 * Converting one of these as a whole would destroy it — Turndown would be
 * handed braces and quotes and asked to read them as markup. They are instead
 * decoded and converted value by value, because the texts inside them are
 * legacy content like any other: the curator justifications in a collection
 * item's `extra` reached three websites with their `<i>` tags intact, for the
 * years this field was skipped outright.
 */
const JSON_FIELDS = new Set(['extra']);

/**
 * Convert every string inside a decoded JSON value, leaving the shape, the
 * keys and the non-string values exactly as they were.
 */
function convertJsonValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return convertHtmlToMarkdown(value);
  }
  if (Array.isArray(value)) {
    return value.map(convertJsonValue);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        convertJsonValue(item),
      ])
    );
  }
  return value;
}

/**
 * Convert the texts inside a JSON field, in whichever form it arrives.
 *
 * Callers build `extra` both ways: some hand over an already-encoded string,
 * others an object that the strategy stringifies on its way into the query.
 * Both are the same field and both need converting, and handling only the
 * string is how 367 `<i>` tags survived a reimport that was supposed to
 * convert them.
 *
 * A string that does not decode is returned untouched: a field declared JSON
 * that is not holding JSON is a separate problem, and mangling it here would
 * hide that one too.
 */
export function sanitizeJsonField<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    return convertJsonValue(value) as T;
  }
  if (typeof value !== 'string') {
    return value;
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(value);
  } catch {
    return value;
  }
  if (decoded === null || typeof decoded !== 'object') {
    return value;
  }
  return JSON.stringify(convertJsonValue(decoded)) as T;
}

/**
 * MySQL zero-date patterns produced by legacy Windows MySQL.
 * MySQL 8+ with STRICT_TRANS_TABLES + NO_ZERO_DATE rejects these on INSERT.
 */
const ZERO_DATE_PATTERN = /^0000-00-00/;

/**
 * Sanitize a date value from the legacy database.
 *
 * mysql2 returns DATETIME columns as Date objects by default.
 * Legacy MySQL on Windows stored '0000-00-00 00:00:00' as a default,
 * which mysql2 converts to an Invalid Date object.
 *
 * This function explicitly handles:
 * - null / undefined → null
 * - empty string → null
 * - Date object that is Invalid Date → null
 * - string matching '0000-00-00...' → null
 * - valid Date object → ISO string (YYYY-MM-DD HH:mm:ss)
 * - valid date string → returned as-is
 */
export function sanitizeDateValue(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    if (isNaN(value.getTime())) {
      return null;
    }
    return value.toISOString().slice(0, 19).replace('T', ' ');
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '' || ZERO_DATE_PATTERN.test(trimmed)) {
      return null;
    }
    return trimmed;
  }

  return null;
}

/**
 * Sanitize ALL string fields in an object by converting HTML to Markdown
 *
 * This function iterates over all properties of the object and converts
 * any string value from HTML to Markdown. This is safe because:
 * - convertHtmlToMarkdown returns strings unchanged if they contain no HTML tags
 * - The conversion is idempotent (calling it twice produces the same result)
 *
 * Use this as a catch-all sanitizer at the persistence layer to ensure
 * no HTML content reaches the database.
 *
 * Note: fields in JSON_FIELDS (like 'extra') hold a JSON document, so they are
 * decoded and converted value by value rather than as one string.
 *
 * @param data The data object to sanitize
 * @returns A new object with all string fields converted from HTML to Markdown
 */
export function sanitizeAllStrings<T extends object>(data: T): T {
  const result = { ...data };

  for (const key of Object.keys(result) as (keyof T)[]) {
    const value = result[key];
    if (JSON_FIELDS.has(key as string)) {
      (result as Record<string, unknown>)[key as string] = sanitizeJsonField(value);
      continue;
    }
    if (typeof value === 'string') {
      (result as Record<string, unknown>)[key as string] = convertHtmlToMarkdown(value);
    }
  }

  return result;
}

/**
 * The text a Markdown document reads as, taken from the token tree rather
 * than by rewriting the source.
 *
 * `marked` is the Markdown parser this estate already uses — viewer-core
 * renders every text with it — so this is not a second opinion on the grammar,
 * it is the same one asked a different question.
 */
const markdown = new Marked({ async: false, gfm: true });

function textOfTokens(tokens: Token[] | undefined): string {
  let text = '';
  for (const token of tokens ?? []) {
    const children = (token as { tokens?: Token[] }).tokens;
    const items = (token as { items?: Token[] }).items;
    if (children?.length) {
      text += textOfTokens(children);
    } else if (token.type === 'text' || token.type === 'codespan' || token.type === 'code') {
      text += (token as { text?: string }).text ?? '';
    } else if (token.type === 'space' || token.type === 'br') {
      text += ' ';
    }
    if (items?.length) {
      text += ' ' + textOfTokens(items);
    }
    if (token.type === 'paragraph' || token.type === 'heading' || token.type === 'list_item') {
      text += ' ';
    }
  }
  return text;
}

/**
 * Strip all markup and return plain text.
 *
 * Two parsers, each answering the question it exists to answer: Turndown reads
 * the HTML, `marked` reads the Markdown that comes out of it. Nothing here
 * matches markup with a pattern.
 *
 * This replaced fourteen chained `.replace()` calls, which is not a way to
 * read either grammar: `**bold` with no closing pair, an underscore inside a
 * word, a `#` that starts a sentence and a `---` in the middle of a line were
 * all handled wrongly, and a nested construct was handled by luck.
 */
export function stripHtml(html: string | null | undefined): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  // Turndown handles malformed HTML gracefully, and returns the string
  // unchanged when there is no HTML in it.
  const text = textOfTokens(markdown.lexer(convertHtmlToMarkdown(html)));

  // Whitespace only — collapsing runs of it is not parsing.
  return text.split(/\s+/).filter(Boolean).join(' ');
}
