// Text normalisation for legacy (HTML) vs package (Markdown) comparison.
// Two values are "same" when equal after normalise(); "format" when equal only after
// flatten() (markup, punctuation-at-end and whitespace differences); else "different".

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', hellip: '…', laquo: '«', raquo: '»', eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç', ouml: 'ö', uuml: 'ü', auml: 'ä', deg: '°', times: '×', copy: '©', middot: '·', shy: '' };

export function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

// Applies a replacement until the text stops changing: one pass over "<<b>i>" leaves "<i>".
export function untilStable(s, step) {
  for (let prev = null; prev !== s; ) [prev, s] = [s, step(s)];
  return s;
}

export function htmlToText(s) {
  const text = String(s)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h\d)>/gi, '\n');
  return decodeEntities(untilStable(text, (t) => t.replace(/<[^>]+>/g, '')));
}

export function markdownToText(s) {
  return String(s)
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/gs, '$2')
    .replace(/(^|[^\\*])\*(?!\s)([^*]+?)\*/g, '$1$2')
    .replace(/(^|\W)_(?!\s)([^_]+?)_(?=\W|$)/g, '$1$2')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\\([\\`*_{}[\]()#+\-.!>])/g, '$1');
}

const ws = (s) => s.replace(/\r\n?/g, '\n').replace(/[\u00a0\u2007\u202f\t ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{2,}/g, '\n').trim();

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
