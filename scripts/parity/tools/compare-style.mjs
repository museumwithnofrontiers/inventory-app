// node tools/compare-style.mjs <page> — compares the style signatures in shots/ for one page type
// (home, item, …): <slug>--<page>--legacy.json vs <slug>--<page>--new.json, for every site that has
// both. Writes out/style-<page>.md and out/style-<page>.json.
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { OUT, SHOTS } from './lib/paths.mjs';

const pageType = process.argv[2] ?? 'home';
const sites = JSON.parse(readFileSync(`${OUT}/sitemap.json`, 'utf8')).sites;

// sRGB → Lab, ΔE76.
const lab = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92));
  const [x, y, z] = [
    (c[0] * 0.4124 + c[1] * 0.3576 + c[2] * 0.1805) / 0.95047,
    c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722,
    (c[0] * 0.0193 + c[1] * 0.1192 + c[2] * 0.9505) / 1.08883,
  ].map((v) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116));
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
};
const dE = (a, b) => { const p = lab(a); const q = lab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
const shares = (m = {}) => { const t = Object.values(m).reduce((a, b) => a + b, 0) || 1; return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v / t])); };

// How much of legacy's distribution the new one reproduces (colours within ΔE 10 pooled).
function palette(L, N) {
  const l = shares(L);
  const n = shares(N);
  const lc = Object.entries(l).filter(([k]) => k !== 'image');
  const nc = Object.entries(n).filter(([k]) => k !== 'image');
  const near = (hex, list) => list.reduce((best, [k, v]) => { const d = dE(hex, k); return d < best.d ? { k, v, d } : best; }, { k: null, v: 0, d: Infinity });
  let overlap = Math.min(l.image ?? 0, n.image ?? 0);
  const pool = new Map(nc);
  for (const [k, v] of lc.sort((a, b) => b[1] - a[1])) {
    const m = near(k, [...pool.entries()]);
    if (m.k && m.d < 10) {
      const take = Math.min(v, pool.get(m.k));
      overlap += take;
      pool.set(m.k, pool.get(m.k) - take);
    }
  }
  const missing = lc.filter(([k, v]) => v >= 0.02 && near(k, nc.filter(([, x]) => x >= 0.005)).d >= 10).map(([k, v]) => ({ hex: k, share: v }));
  const added = nc.filter(([k, v]) => v >= 0.02 && near(k, lc.filter(([, x]) => x >= 0.005)).d >= 10).map(([k, v]) => ({ hex: k, share: v }));
  return { overlap, missing, added, legacyImage: l.image ?? 0, newImage: n.image ?? 0, legacyTop: lc.sort((a, b) => b[1] - a[1]).slice(0, 5), newTop: nc.sort((a, b) => b[1] - a[1]).slice(0, 5) };
}
const topFont = (f = {}) => Object.entries(shares(f)).sort((a, b) => b[1] - a[1])[0] ?? ['—', 0];

// "pages": every captured page type other than home, for the representative sites.
const kinds = new Map(sites.map((s) => [s.slug, s.kind]));
const targets = pageType === 'pages'
  ? [...new Set(readdirSync(`${SHOTS}`).filter((f) => f.endsWith('--legacy.json') && !f.includes('--home--')).map((f) => f.replace('--legacy.json', '')))].map((k) => { const [slug, page] = k.split('--'); return { slug, page }; })
  : sites.map((s) => ({ slug: s.slug, page: pageType }));
const rows = [];
for (const { slug, page } of targets) {
  const s = { slug, kind: kinds.get(slug) };
  const fl = `${SHOTS}/${slug}--${page}--legacy.json`;
  const fn = `${SHOTS}/${slug}--${page}--new.json`;
  if (!existsSync(fl) || !existsSync(fn)) continue;
  const L = JSON.parse(readFileSync(fl, 'utf8'));
  const N = JSON.parse(readFileSync(fn, 'utf8'));
  if (!L.bg || !N.bg) { rows.push({ slug, page, kind: s.kind, legacyUrl: L.url, newUrl: N.url, error: L.error ?? N.error ?? `status ${L.status}/${N.status}` }); continue; }
  const bg = palette(L.bg, N.bg);
  const text = palette(L.text, N.text);
  const [lf, lfs] = topFont(L.fonts);
  const [nf, nfs] = topFont(N.fonts);
  const marks = {};
  for (const k of ['header', 'nav', 'h1', 'h2', 'link', 'button', 'footer']) {
    const a = L.marks?.[k];
    const b = N.marks?.[k];
    if (!a && !b) continue;
    marks[k] = { legacy: a, new: b };
  }
  rows.push({ slug, page, kind: s.kind, legacyUrl: L.url, newUrl: N.url, legacyStatus: L.status, newStatus: N.status, legacyError: L.error, newError: N.error, bg, text, font: { legacy: lf, legacyShare: lfs, new: nf, newShare: nfs }, height: { legacy: L.scrollHeight, new: N.scrollHeight }, marks });
}

const pct = (x) => `${Math.round(100 * x)}%`;
const sw = (c) => `\`${c.hex}\` ${pct(c.share)}`;
const md = [`# Style — ${pageType} pages, legacy vs new (${new Date().toISOString().slice(0, 10)})`, '',
  'Background: share of legacy\'s painted area (sampled on a 48×32 grid of the first screen, images apart) whose colour the new page reproduces within ΔE 10. Text: the same over visible text, weighted by length. "Gone": legacy colours covering ≥2% that the new page doesn\'t use; "New": the reverse.', '',
  '| Site | Kind | Background kept | Gone (legacy) | New | Images L/N | Text colour kept | Font L → N | Page height L/N |', '|---|---|---|---|---|---|---|---|---|'];
for (const r of rows) {
  if (r.error) { md.push(`| ${r.slug}${r.page !== "home" ? " · " + r.page : ""} | ${r.kind} | — | ${r.error} | | | | | |`); continue; }
  md.push(`| ${r.slug}${r.page !== "home" ? " · " + r.page : ""} | ${r.kind} | ${pct(r.bg.overlap)} | ${r.bg.missing.map(sw).join(', ')} | ${r.bg.added.map(sw).join(', ')} | ${pct(r.bg.legacyImage)}/${pct(r.bg.newImage)} | ${pct(r.text.overlap)} | ${r.font.legacy}${r.font.legacy === r.font.new ? ' =' : ` → **${r.font.new}**`} | ${r.height.legacy}/${r.height.new} |`);
}
writeFileSync(`${OUT}/style-${pageType}.md`, md.join('\n') + '\n');
writeFileSync(`${OUT}/style-${pageType}.json`, JSON.stringify(rows, null, 1));
console.log(`${rows.length} sites compared for ${pageType}`);
