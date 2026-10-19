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

// The exhibition popup (Water in Islam) reached the sites as `\*\*\*\*Welcome…`
// with an empty `[email]()`: its Markdown went through the conversion a second
// time when a later import step wrote its `extra` back.
describe('convertHtmlToMarkdown — the exhibition popup', () => {
  const popup =
    '<p style="text-align: center;"><span style="font-size: 14pt;"><strong><strong>Welcome to the MWNF online exhibition platform!</strong></strong></span></p>\r\n' +
    '<p style="text-align: center;"> </p>\r\n' +
    '<p class="MsoNormal"><span><strong>If you believe that what we do is important, please consider making a donation.</strong> Contact us at this <a href="mailto: management@museumwnf.net">email</a> for further details.</span></p>';

  it('writes bold inside bold as plain bold', () => {
    expect(convertHtmlToMarkdown(popup)).toMatch(/^\*\*Welcome to the MWNF online exhibition platform!\*\*$/m);
  });

  it('keeps the e-mail link', () => {
    expect(convertHtmlToMarkdown(popup)).toContain('[email](<mailto: management@museumwnf.net>)');
  });

  it('leaves its own Markdown unchanged when converted again', () => {
    const once = convertHtmlToMarkdown(popup);
    expect(convertHtmlToMarkdown(once)).toBe(once);
  });
});
