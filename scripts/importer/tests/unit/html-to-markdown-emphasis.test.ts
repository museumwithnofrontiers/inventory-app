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

// A browser prints two runs of one style that touch as one run.
describe('convertHtmlToMarkdown — touching runs', () => {
  it('writes touching italics as one italic run', () => {
    expect(convertHtmlToMarkdown('Hálová, <i>Brno</i><i>, stavební vývoj</i>, Prague')).toBe(
      'Hálová, *Brno, stavební vývoj*, Prague'
    );
  });

  it('writes three touching italics as one run', () => {
    expect(convertHtmlToMarkdown('<i>a</i><em>b</em><i>c</i> d')).toBe('*abc* d');
  });

  it('writes touching bold as one bold run', () => {
    expect(convertHtmlToMarkdown('<b>Abu Bakr</b><strong> Gallery</strong>')).toBe('**Abu Bakr Gallery**');
  });

  it('ignores an empty run between two italics', () => {
    expect(convertHtmlToMarkdown('<i>a</i><i> </i>b')).toBe('*a* b');
  });
});

// A delimiter after a line break, or between punctuation and a letter, does not
// close its run in Markdown; the page would show the asterisks legacy never did.
describe('convertHtmlToMarkdown — a run whose edges Markdown can close', () => {
  it('ends a bold run before the line break it ends with', () => {
    expect(convertHtmlToMarkdown('<b>the domed fountain.<br></b>Next')).toBe('**the domed fountain.**  \nNext');
  });

  it('ends an italic run before the punctuation that touches the next word', () => {
    expect(convertHtmlToMarkdown('mit Blau und <i>Lüster-</i>Glasur verziert')).toBe('mit Blau und *Lüster*-Glasur verziert');
  });

  it('starts an italic run after the punctuation that touches the previous word', () => {
    // Turndown escapes a hyphen that starts a run's text; the escape moves with it.
    expect(convertHtmlToMarkdown('Lüster<i>-Kacheln</i> aus Irak')).toBe('Lüster\\-*Kacheln* aus Irak');
  });

  it('starts an italic run after the punctuation and the space that follow the previous word', () => {
    expect(convertHtmlToMarkdown('Creswell,K.A.C<i>., Early Muslim Architecture</i>. 2nd edition')).toBe(
      'Creswell,K.A.C., *Early Muslim Architecture*. 2nd edition'
    );
  });

  it('ends an italic run before the space and the punctuation that touch the next word', () => {
    expect(convertHtmlToMarkdown('the <i>Kacheln ,</i>mit denen')).toBe('the *Kacheln* ,mit denen');
  });

  it('prints a run of punctuation alone without its style', () => {
    expect(convertHtmlToMarkdown('Die 139 Kacheln<i>,</i> mit denen')).toBe('Die 139 Kacheln, mit denen');
  });

  it('keeps punctuation inside a run that ends before a space', () => {
    expect(convertHtmlToMarkdown('the <i>caliph’s</i> palace (<i>qasr</i>.)')).toBe('the *caliph’s* palace (*qasr*.)');
  });
});