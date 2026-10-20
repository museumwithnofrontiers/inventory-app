// node tools/compare-static.mjs — static pages, legacy vs new, from static/*.json.
// Unit: a legacy paragraph (≥ 30 characters) split into sentences. A paragraph is "kept" when
// ≥ 90% of its sentences are on the matching new page, "moved" when they are elsewhere on the new
// site (its other pages or its bundled i18n), "partial" when some are, else "missing". New-page
// paragraphs with no sentence anywhere on the legacy site are "added". Footer links are diffed.
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { OUT, STATIC } from './lib/paths.mjs';

const sites = JSON.parse(readFileSync(`${OUT}/sitemap.json`, 'utf8')).sites;
const pages = readdirSync(`${STATIC}`).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(`${STATIC}/${f}`, 'utf8')));
const flat = (s) => String(s).toLowerCase().normalize('NFKC').replace(/[‘’`´']/g, "'").replace(/[“”«»"]/g, '').replace(/[–—-]/g, ' ').replace(/[^\p{L}\p{N}' ]+/gu, ' ').replace(/\s+/g, ' ').trim();
const sentences = (p) => p.split(/(?<=[.!?;:])\s+/).map(flat).filter((s) => s.length >= 20);
const coverage = (p, hay) => { const ss = sentences(p); if (!ss.length) return hay.includes(flat(p)) ? 1 : 0; return ss.filter((s) => hay.includes(s)).length / ss.length; };
const normHref = (h) => { try { const u = new URL(h); return `${u.host.replace(/^www\./, '')}${u.pathname.replace(/\/$/, '')}`.toLowerCase(); } catch { return h; } };

const result = [];
for (const s of sites) {
  const L = pages.filter((p) => p.slug === s.slug && p.side === 'legacy' && !p.error);
  const N = pages.filter((p) => p.slug === s.slug && p.side === 'new' && !p.error);
  if (!L.length && !N.length) continue;
  // Lines repeated on most legacy pages are chrome (menus, footers), not page content.
  const freq = new Map();
  for (const p of L) for (const t of new Set(p.paragraphs)) freq.set(t, (freq.get(t) ?? 0) + 1);
  const chrome = (t) => L.length >= 3 && freq.get(t) >= Math.ceil(L.length * 0.6);
  const bundle = existsSync(`${STATIC}/${s.slug}--bundle.txt`) ? flat(readFileSync(`${STATIC}/${s.slug}--bundle.txt`, 'utf8')) : '';
  const newAll = flat(N.map((p) => p.paragraphs.join(' ')).join(' ')) + ' ' + bundle;
  const legacyAll = flat(L.map((p) => p.paragraphs.join(' ')).join(' '));
  const pageRows = [];
  for (const lp of L) {
    if (lp.page === 'home' && ['gallery', 'exhibition'].includes(s.kind)) continue; // home is curatorial chrome; footer handled below
    const np = N.find((p) => p.page === lp.page);
    const same = np ? flat(np.paragraphs.join(' ')) : '';
    const paras = [...new Set(lp.paragraphs)].filter((t) => t.length >= 30 && !chrome(t));
    const rows = paras.map((t) => {
      const c1 = same ? coverage(t, same) : 0;
      if (c1 >= 0.9) return { verdict: 'kept', text: t };
      const c2 = coverage(t, newAll);
      if (c2 >= 0.9) return { verdict: 'moved', text: t };
      if (Math.max(c1, c2) >= 0.3) return { verdict: 'partial', text: t, coverage: Math.round(100 * Math.max(c1, c2)) };
      return { verdict: 'missing', text: t };
    });
    pageRows.push({ page: lp.page, url: lp.url, newUrl: np?.url ?? null, newPage: !!np, rows });
  }
  // New-only text on the pages that have a legacy counterpart.
  const added = [];
  for (const np of N) {
    if (np.page === 'home' && s.kind !== 'standalone') continue;
    for (const t of [...new Set(np.paragraphs)].filter((x) => x.length >= 30)) if (coverage(t, legacyAll) < 0.3) added.push({ page: np.page, text: t });
  }
  // Portal and social links on the home pages, wherever they sit (legacy galleries have no <footer>).
  const PORTAL = /^(museumwnf\.org\/(about|league|mycollection)|youtube\.com|x\.com|twitter\.com|facebook\.com|instagram\.com|weibo\.com|linkedin\.com)/;
  const linkSet = (p) => new Set((p?.links ?? []).map((l) => normHref(l.href)).filter((h) => PORTAL.test(h)));
  const fl = linkSet(L.find((p) => p.page === 'home'));
  const fn = linkSet(N.find((p) => p.page === 'home'));
  result.push({ slug: s.slug, kind: s.kind, title: s.title, pages: pageRows, added, footer: { missing: [...fl].filter((h) => !fn.has(h)), added: [...fn].filter((h) => !fl.has(h)) } });
}
writeFileSync(`${OUT}/static.json`, JSON.stringify(result, null, 1));

const count = (rows, v) => rows.filter((r) => r.verdict === v).length;
const md = [`# Static pages — legacy vs new (${new Date().toISOString().slice(0, 10)})`, '', 'Paragraphs of legacy static pages (≥ 30 characters, menus removed), matched sentence by sentence on the new site.', '',
  '| Site | Page | New page | Paragraphs | Kept | Moved | Partial | Missing |', '|---|---|---|---|---|---|---|---|'];
for (const r of result) for (const p of r.pages) md.push(`| ${r.slug} | ${p.page} | ${p.newPage ? 'yes' : '**no**'} | ${p.rows.length} | ${count(p.rows, 'kept')} | ${count(p.rows, 'moved')} | ${count(p.rows, 'partial')} | ${count(p.rows, 'missing') ? `**${count(p.rows, 'missing')}**` : 0} |`);
md.push('', '## Footer links', '', '| Site | Legacy links not on the new footer | New footer links not on legacy |', '|---|---|---|');
for (const r of result) if (r.footer.missing.length || r.footer.added.length) md.push(`| ${r.slug} | ${r.footer.missing.join('<br>')} | ${r.footer.added.join('<br>')} |`);
md.push('', '## Missing paragraphs (samples)', '');
for (const r of result) for (const p of r.pages) { const m = p.rows.filter((x) => x.verdict === 'missing'); if (m.length) md.push(`### ${r.slug} · ${p.page}`, '', ...m.slice(0, 6).map((x) => `- ${x.text.slice(0, 220)}`), ''); }
md.push('## Text on new pages that legacy does not have (samples)', '');
for (const r of result) if (r.added.length) md.push(`### ${r.slug}`, '', ...r.added.slice(0, 6).map((x) => `- (${x.page}) ${x.text.slice(0, 200)}`), '');
writeFileSync(`${OUT}/static.md`, md.join('\n') + '\n');
console.log(`static pages compared for ${result.length} sites`);
