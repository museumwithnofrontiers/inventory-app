/**
 * A data package holds Markdown, and every website renders it through one
 * pipeline that escapes raw HTML on sight. A tag that survived the conversion
 * would reach every website as the characters it is, so the conversion
 * refuses to hand one over: a leak fails the import, where the data is made,
 * rather than being worked around in a site.
 */

import { describe, expect, it } from 'vitest';
import {
  assertMarkdownOnly,
  containsHtml,
  convertHtmlToMarkdown,
} from '../../src/utils/html-to-markdown.js';

describe('containsHtml', () => {
  it('sees a tag', () => {
    expect(containsHtml('A <i>title</i>.')).toBe(true);
    expect(containsHtml('<div class="x">\n\nBlock\n\n</div>')).toBe(true);
  });

  it('does not mistake ordinary Markdown for markup', () => {
    expect(containsHtml('An *italic* title with a [link](https://example.org).')).toBe(false);
    expect(containsHtml('Write to <office@museumwnf.net> or see <https://example.org/>.')).toBe(false);
    expect(containsHtml('The code span `<div>` is text.')).toBe(false);
    expect(containsHtml('a < b and c > d')).toBe(false);
    expect(containsHtml('')).toBe(false);
    expect(containsHtml(null)).toBe(false);
  });
});

describe('assertMarkdownOnly', () => {
  it('names the field it refuses', () => {
    expect(() => assertMarkdownOnly('<b>x</b>', 'heading')).toThrow('heading');
    expect(() => assertMarkdownOnly('**x**', 'heading')).not.toThrow();
  });
});

describe('convertHtmlToMarkdown', () => {
  it('produces Markdown that passes its own guard', () => {
    const markdown = convertHtmlToMarkdown(
      '<p>See <a href="https://example.org">this</a>, <i>that</i> and <span style="color:red">the other</span>.<br/>Next line.</p>'
    );
    expect(containsHtml(markdown)).toBe(false);
    expect(markdown).toContain('[this](https://example.org)');
    expect(markdown).toContain('*that*');
    expect(markdown).toContain('the other');
  });
});

// Legacy prints these texts as HTML, where a leading tab or four spaces and a
// pipe-separated layout mean nothing. Markdown reads the first as a code block
// and the second as a table, and the tags inside them reached the sites raw.
describe('containsHtml — indented and tabular legacy text', () => {
  const bibliography =
    '    Lane, A., <i>Early Islamic Pottery</i>, London, 1947.<br>\n    Watson, O., <i>Ceramics from Islamic Lands</i>, London, 2004.';

  it('sees a tag in text indented by four spaces', () => {
    expect(containsHtml(bibliography)).toBe(true);
  });

  it('sees a tag in text indented by a tab', () => {
    expect(containsHtml('\tLane, A., <i>Early Islamic Pottery</i>, London, 1947.')).toBe(true);
    expect(containsHtml('Bibliography:\n\n\t\t<b>Lane</b>, 1947.')).toBe(true);
  });

  it('sees a tag in a table cell', () => {
    expect(containsHtml('| Author | Title |\n| --- | --- |\n| Lane | <i>Early Islamic Pottery</i> |')).toBe(
      true
    );
    expect(containsHtml('| <b>Author</b> | Title |\n| --- | --- |\n| Lane | 1947 |')).toBe(true);
  });

  it('still reads indented and tabular text without tags as plain', () => {
    expect(containsHtml('    a < b and c > d')).toBe(false);
    expect(containsHtml('\tWrite to <office@museumwnf.net>.')).toBe(false);
    expect(containsHtml('| a | b |\n| --- | --- |\n| 1 < 2 | `<i>` |')).toBe(false);
  });

  it('leaves a fenced code block alone', () => {
    expect(containsHtml('```\n<i>x</i>\n```')).toBe(false);
  });

  it('converts the indented bibliography, and its Markdown stays as it is', () => {
    const once = convertHtmlToMarkdown(bibliography);
    expect(once).toContain('*Early Islamic Pottery*');
    expect(once).toContain('*Ceramics from Islamic Lands*');
    expect(containsHtml(once)).toBe(false);
    expect(convertHtmlToMarkdown(once)).toBe(once);
  });

  it('converts a tab-indented title', () => {
    const once = convertHtmlToMarkdown('\tLane, A., <i>Early Islamic Pottery</i>, London, 1947.');
    expect(once).toBe('Lane, A., *Early Islamic Pottery*, London, 1947.');
    expect(convertHtmlToMarkdown(once)).toBe(once);
  });
});