import { describe, expect, it } from 'vitest';

import { convertHtmlToMarkdown } from '../../src/utils/html-to-markdown.js';

// Legacy prints every field as HTML, so a character reference in a field with
// no tags still reads as its character there. The tag-free path used to return
// the text untouched and the sites showed `dor&eacute;`.
describe('convertHtmlToMarkdown — character references in tag-free text', () => {
  it('decodes named and numeric references', () => {
    expect(convertHtmlToMarkdown('Petit flacon en verre dor&eacute; &#8211; ch&acirc;tain')).toBe(
      'Petit flacon en verre doré – châtain'
    );
  });

  it('decodes quotes and dashes in right-to-left text', () => {
    expect(convertHtmlToMarkdown('الحمراءَ &quot;قصراً ملكياً&quot; 437 &ndash; 473')).toBe(
      'الحمراءَ "قصراً ملكياً" 437 – 473'
    );
  });

  it('keeps a decoded angle bracket as text, never as a tag', () => {
    expect(convertHtmlToMarkdown('a &lt;b&gt; c')).toBe('a &lt;b> c');
  });

  it('keeps the line breaks of the text', () => {
    expect(convertHtmlToMarkdown('Gom&eacute;z, 2001.\nTorres, 1998.')).toBe(
      'Goméz, 2001.\nTorres, 1998.'
    );
  });

  it('returns text without references exactly as written', () => {
    expect(convertHtmlToMarkdown('Wool & silk, *knotted*')).toBe('Wool & silk, *knotted*');
  });
});
