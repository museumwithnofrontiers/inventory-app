// Text normalisation for legacy (HTML) vs package (Markdown) comparison.
// Two values are "same" when equal after normalise(); "format" when equal only after
// flatten() (markup, punctuation-at-end and whitespace differences); else "different".

// The HTML 4 named entities: legacy texts use the whole Latin-1 set (&acirc;, &Oacute; …), and a
// name left undecoded reads as a difference. Names are case-sensitive (&Agrave; is not &agrave;).
const LATIN1 = 'nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr deg plusmn sup2 sup3 acute micro para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest Agrave Aacute Acirc Atilde Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times Oslash Ugrave Uacute Ucirc Uuml Yacute THORN szlig agrave aacute acirc atilde auml aring aelig ccedil egrave eacute ecirc euml igrave iacute icirc iuml eth ntilde ograve oacute ocirc otilde ouml divide oslash ugrave uacute ucirc uuml yacute thorn yuml';
const ENTITIES = {
  ...Object.fromEntries(LATIN1.split(' ').map((n, i) => [n, String.fromCodePoint(0xa0 + i)])),
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', shy: '',
  OElig: 'Œ', oelig: 'œ', Scaron: 'Š', scaron: 'š', Yuml: 'Ÿ', fnof: 'ƒ', circ: 'ˆ', tilde: '˜',
  ensp: ' ', emsp: ' ', thinsp: ' ', zwnj: '‌', zwj: '‍', lrm: '‎', rlm: '‏',
  ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', sbquo: '‚', ldquo: '“', rdquo: '”', bdquo: '„',
  dagger: '†', Dagger: '‡', bull: '•', hellip: '…', permil: '‰', prime: '′', Prime: '″',
  lsaquo: '‹', rsaquo: '›', oline: '‾', euro: '€', trade: '™', minus: '−',
};

export function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z][a-z0-9]*);/gi, (m, n) => ENTITIES[n] ?? ENTITIES[n.toLowerCase()] ?? m);
}

export function htmlToText(s) {
  // Legacy also writes "</br>", which browsers break the line on too.
  let text = String(s)
    .replace(/<\/?br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h\d)>/gi, '\n');
  // Only what a browser reads as a tag: "<" followed by a letter, "/", "!" or "?". Any other "<" is
  // printed as it is, so legacy's "25.<<br/>" shows "25.<" and its "<\i>" shows "<\i>".
  return decodeEntities(text.replace(/<[a-z/!?][^>]*>/gi, ''));
}

// An escaped character ("\_", "\*") is text, never an emphasis marker: it is set aside in the
// Private Use Area while the markup is removed, then restored.
const ESCAPED = /\\([\\`*_{}[\]()#+\-.!>])/g;
const PUA = 0xe000;
export function markdownToText(s) {
  return String(s)
    .replace(ESCAPED, (_, c) => String.fromCharCode(PUA + c.charCodeAt(0)))
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/gs, '$2')
    .replace(/(^|[^*])\*(?!\s)([^*]+?)\*/g, '$1$2')
    .replace(/(^|\W)_(?!\s)([^_]+?)_(?=\W|$)/g, '$1$2')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[-]/g, (c) => String.fromCharCode(c.charCodeAt(0) - PUA));
}

// A soft hyphen (U+00AD) is invisible unless the line breaks there, on either side.
const ws = (s) => s.replace(/­/g, '').replace(/\r\n?/g, '\n').replace(/[\u00a0\u2007\u202f\t ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{2,}/g, '\n').trim();

export function normalise(v, { from = 'html' } = {}) {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return v.map((x) => normalise(x, { from })).filter(Boolean).join('; ');
  const s = from === 'markdown' ? markdownToText(v) : htmlToText(v);
  return ws(s.normalize('NFC'));
}

export function flatten(s) {
  return s
    .toLowerCase()
    .replace(/[\s\n]+/g, ' ')
    .replace(/[‘’`´]/g, "'")
    .replace(/[“”«»]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/؛/g, ';')
    .replace(/،/g, ',')
    .replace(/\s*([;,:.])\s*/g, '$1 ')
    .replace(/[.;,\s]+$/g, '')
    .trim();
}

export function compare(legacyRaw, pkgRaw, { legacyFrom = 'html', pkgFrom = 'markdown' } = {}) {
  const a = normalise(legacyRaw, { from: legacyFrom });
  const b = normalise(pkgRaw, { from: pkgFrom });
  if (!a && !b) return { verdict: 'both-empty' };
  if (a && !b) return { verdict: 'missing-in-package', legacy: a };
  if (!a && b) return { verdict: 'extra-in-package', pkg: b };
  if (a === b) return { verdict: 'same' };
  if (flatten(a) === flatten(b)) return { verdict: 'format', legacy: a, pkg: b };
  if (/&(#\d+|[a-z]+);/i.test(b) && flatten(a) === flatten(decodeEntities(b))) return { verdict: 'different', legacy: a, pkg: b, why: 'package text holds HTML entities (&agrave; …)' };
  if (flatten(a).replace(/\s/g, '') === flatten(b).replace(/\s/g, '')) return { verdict: 'format', legacy: a, pkg: b, why: 'line breaks only' };
  if (/[*_]/.test(b) && flatten(a.replace(/[*_]/g, '')) === flatten(b.replace(/[*_]/g, ''))) return { verdict: 'different', legacy: a, pkg: b, why: 'stray or misplaced Markdown emphasis in the package text' };
  // Legacy text stored already-encoded ("&Aacute;") and prints it literally; the package decoded it.
  if (/&(#\d+|[a-z]+);/i.test(a) && flatten(decodeEntities(a)) === flatten(b)) return { verdict: 'expected:legacy prints double-encoded entities', legacy: a, pkg: b };
  return { verdict: 'different', legacy: a, pkg: b, similarity: similarity(flatten(a), flatten(b)) };
}

// Legacy's PHP sheets print a list of names on one line, joined with ", ", and a name can hold a
// comma itself ("Jenig, clockmaker"). The package keeps each name whole, so compare the joined line.
// Legacy has no explicit order for the names (they print as typed) and the package sorts them, so
// the same names in another order are a format difference only.
export function compareJoined(legacyRaw, names) {
  const r = compare(legacyRaw, (names ?? []).join(', '));
  if (r.verdict !== 'different' || (names ?? []).length < 2) return r;
  let rest = flatten(normalise(legacyRaw));
  const flat = names.map((n) => flatten(normalise(n, { from: 'markdown' }))).sort((a, b) => b.length - a.length);
  for (const n of flat) {
    const i = rest.indexOf(n);
    if (!n || i < 0) return r;
    rest = `${rest.slice(0, i)} ${rest.slice(i + n.length)}`;
  }
  return /^[\s,;]*$/.test(rest) ? { verdict: 'format', legacy: r.legacy, pkg: r.pkg, why: 'same entries, other order' } : r;
}

// Legacy Baroque Art prints the record's life data after the artist line, from its own columns:
// "artist (birthdate, birthplace-deathdate, deathplace)", "Unknown" included when that is the value.
// The package keeps the names in `artist_names` and the life data in the translation's `artist_*`.
export function artistLife(tr) {
  const [born, bornAt, died, diedAt] = ['artist_birthdate', 'artist_birthplace', 'artist_deathdate', 'artist_deathplace'].map((f) => normalise(tr?.[f], { from: 'markdown' }));
  if (!(born || bornAt || died || diedAt)) return '';
  return `(${born}${bornAt ? `, ${bornAt}` : ''}${died ? `-${died}` : ''}${diedAt ? `, ${diedAt}` : ''})`;
}

export function compareArtistLine(legacyRaw, names, tr) {
  const r = compareJoined(legacyRaw, names);
  const life = artistLife(tr);
  if (!life || r.verdict !== 'different' || !(names ?? []).length) return r;
  const line = normalise(legacyRaw);
  if (!flatten(line).endsWith(flatten(life))) return r;
  const exact = line.endsWith(life);
  const r2 = compareJoined(exact ? line.slice(0, -life.length) : line.slice(0, line.lastIndexOf('(')), names);
  if (r2.verdict !== 'same' && r2.verdict !== 'format') return r;
  return { verdict: exact ? r2.verdict : 'format', legacy: line, pkg: `${names.join(', ')} ${life}`, why: 'name + life data from separate fields' };
}

// Token-set overlap (Dice on words); good enough to rank how different two texts are.
export function similarity(a, b) {
  const ta = a.split(/\W+/u).filter(Boolean);
  const tb = b.split(/\W+/u).filter(Boolean);
  if (!ta.length || !tb.length) return 0;
  const count = new Map();
  for (const t of ta) count.set(t, (count.get(t) ?? 0) + 1);
  let both = 0;
  for (const t of tb) {
    const n = count.get(t);
    if (n) { both++; count.set(t, n - 1); }
  }
  return Math.round((200 * both) / (ta.length + tb.length)) / 100;
}

export const splitList = (s) => (s ? String(s).split(/\s*[;؛]\s*/).map((x) => x.trim()).filter(Boolean) : []);
