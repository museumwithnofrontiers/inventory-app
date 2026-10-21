import { describe, expect, it } from 'vitest';

import { convertHtmlToMarkdown } from '../../src/utils/html-to-markdown.js';

// Legacy's editor left unclosed emphasis tags. A browser reads `<i>a<i> b` as
// one italic run inside another and prints all of it in italics; one pair of
// delimiters says the same in Markdown, two pairs leave asterisks on the page.
describe('convertHtmlToMarkdown — emphasis inside emphasis', () => {
  it('writes an unclosed italic inside an italic as one italic run', () => {
    expect(convertHtmlToMarkdown('<i>In situ<i> à Qousayr Amra.')).toBe('*In situ à Qousayr Amra.*');
  });

  it('writes nested italics, however deep, with one pair', () => {
    expect(convertHtmlToMarkdown('<em>a <span><i>b</i></span> c</em> d')).toBe('*a b c* d');
  });

  it('keeps italics side by side as they are', () => {
    expect(convertHtmlToMarkdown('<i>Qusayr Amra</i> and <i>hammam</i>')).toBe('*Qusayr Amra* and *hammam*');
  });
});
