// Runs in the Playwright container (sharp): node tools/compare-assets.mjs
// Matches every non-curatorial image of each legacy site with the new site's by a 64-bit
// difference hash (≤ 8 bits apart and a similar aspect ratio count as the same picture).
// Writes out/assets.json, out/assets.md and site/img/a/<file>.png thumbnails.
import sharp from 'sharp';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { ASSETS, OUT, SITE } from './lib/paths.mjs';

const sites = JSON.parse(readFileSync(`${OUT}/sitemap.json`, 'utf8')).sites;
const HASHES = `${ASSETS}/hashes.json`;
// Read it outright, with no existence check first: a missing file is an empty cache.
let hashes = {};
try {
  hashes = JSON.parse(readFileSync(HASHES, 'utf8'));
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
}
mkdirSync(`${SITE}/img/a`, { recursive: true });

async function hashOf(file) {
  if (hashes[file] !== undefined) return hashes[file];
  try {
    const img = sharp(`${ASSETS}/files/${file}`, { density: 96, animated: false });
    const meta = await img.metadata();
    const px = await sharp(`${ASSETS}/files/${file}`, { density: 96 }).flatten({ background: '#ffffff' }).grayscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer();
    let bits = '';
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += px[y * 9 + x] > px[y * 9 + x + 1] ? '1' : '0';
    hashes[file] = { bits, w: meta.width ?? 0, h: meta.height ?? 0 };
  } catch {
    hashes[file] = null;
  }
  return hashes[file];
}
const ham = (a, b) => { let d = 0; for (let i = 0; i < 64; i++) if (a[i] !== b[i]) d++; return d; };
async function thumb(file) {
  const out = `${SITE}/img/a/${file.replace(/\.[^.]+$/, '')}.png`;
  if (!existsSync(out)) {
    try { await sharp(`${ASSETS}/files/${file}`, { density: 96 }).resize({ width: 220, height: 120, fit: 'inside', withoutEnlargement: true }).png().toFile(out); } catch { return null; }
  }
  return `img/a/${file.replace(/\.[^.]+$/, '')}.png`;
}

function role(u) {
  const url = u.url.toLowerCase();
  if (u.how === 'icon') return 'favicon';
  if (/logo/.test(url) || /logo|mwnf/i.test(u.alt) || (u.region === 'header' && u.w <= 260 && u.h <= 120)) return 'logo';
  if (/thg_galleries\/\d+\/1\.jpg/.test(url)) return 'gallery tile';
  if (/banner|home_image|hero/.test(url) || ((u.region === 'header' || u.region === 'banner') && u.w >= 700)) return 'banner';
  if (u.how === 'css') return 'background';
  if (u.region === 'footer' || /sponsor|partner|logos?\//.test(url)) return 'sponsor / partner mark';
  if (u.w <= 48 && u.h <= 48) return 'icon';
  return 'other';
}
const legacyHost = (url) => /(^https?:\/\/)([a-z0-9-]+\.)*museumwnf\.org\//i.test(url);

const inventories = readdirSync(`${ASSETS}`).filter((f) => f.endsWith('.json') && f !== 'hashes.json').map((f) => JSON.parse(readFileSync(`${ASSETS}/${f}`, 'utf8')));
const result = [];
for (const s of sites) {
  const pick = (side) => {
    const m = new Map();
    for (const inv of inventories.filter((i) => i.slug === s.slug && i.side === side)) {
      for (const a of inv.assets) {
        if (/maps\.google|maps\.gstatic|tile\.openstreetmap|basemaps|\.tile\./i.test(a.url)) continue;
        // New sites serve some chrome (exhibition logos, home images) from the inventory's /pub:
        // keep those as match candidates on the new side; legacy keeps chrome only.
        if ((a.content && !(side === 'new' && /inventory\.metanull\.eu\/pub\//.test(a.url))) || !a.file || (!a.visible && a.how !== 'icon')) continue;
        if (a.how !== 'icon' && a.w * a.h < 200) continue; // spacers, tracking pixels
        if (!m.has(a.file)) m.set(a.file, { ...a, pages: [inv.page], role: role(a) });
        else if (!m.get(a.file).pages.includes(inv.page)) m.get(a.file).pages.push(inv.page);
      }
    }
    return [...m.values()];
  };
  const L = pick('legacy');
  const N = pick('new');
  if (!L.length && !N.length) continue;
  for (const a of [...L, ...N]) { a.hash = await hashOf(a.file); a.thumb = await thumb(a.file); }
  const used = new Set();
  const rows = L.map((a) => {
    let best = null;
    for (const b of N) {
      if (b.file === a.file) { best = { b, d: 0, same: true }; break; }
      if (!a.hash || !b.hash) continue;
      const ra = a.hash.w / (a.hash.h || 1);
      const rb = b.hash.w / (b.hash.h || 1);
      if (Math.abs(ra - rb) / Math.max(ra, rb) > 0.2) continue;
      const d = ham(a.hash.bits, b.hash.bits);
      if (d <= 8 && (!best || d < best.d)) best = { b, d, same: false };
    }
    if (best) used.add(best.b.file);
    // Both sides show a random handful of sibling galleries: a tile can't be matched one for one.
    if (!best && a.role === 'gallery tile' && N.some((b) => b.role === 'gallery tile')) return { role: a.role, legacy: a, match: null, random: true };
    return { role: a.role, legacy: a, match: best ? { file: best.b.file, url: best.b.url, identical: best.same, distance: best.d, thumb: best.b.thumb, w: best.b.w, h: best.b.h, size: best.b.hash ? `${best.b.hash.w}×${best.b.hash.h}` : '' } : null };
  });
  const added = N.filter((b) => !used.has(b.file) && !/inventory\.metanull\.eu\/pub\//.test(b.url));
  result.push({
    slug: s.slug, kind: s.kind, title: s.title,
    rows, added,
    newFromLegacyHost: N.filter((b) => legacyHost(b.url)).map((b) => ({ url: b.url, role: b.role })),
  });
}
writeFileSync(HASHES, JSON.stringify(hashes));
writeFileSync(`${OUT}/assets.json`, JSON.stringify(result, null, 1));

// ---- markdown: per site, then the assets missing most widely
const md = [`# Assets — legacy vs new (${new Date().toISOString().slice(0, 10)})`, '',
  'Non-curatorial images each page loads (logos, banners, gallery tiles, backgrounds, sponsor marks, favicons), matched by perceptual hash. "From legacy host" counts new-site images still served by a museumwnf.org server.', '',
  '| Site | Kind | Legacy assets | Kept | Random tiles | Missing | Added on new | New from legacy host | Missing (by role) |', '|---|---|---|---|---|---|---|---|---|'];
for (const r of result) {
  const miss = r.rows.filter((x) => !x.match && !x.random);
  const byRole = Object.entries(miss.reduce((m, x) => ((m[x.role] = (m[x.role] ?? 0) + 1), m), {})).map(([k, v]) => `${k} ${v}`).join(', ');
  md.push(`| ${r.slug} | ${r.kind} | ${r.rows.length} | ${r.rows.filter((x) => x.match).length} | ${r.rows.filter((x) => x.random).length} | ${miss.length} | ${r.added.length} | ${r.newFromLegacyHost.length} | ${byRole} |`);
}
const missing = new Map();
for (const r of result) for (const x of r.rows.filter((y) => !y.match && !y.random)) {
  const k = x.legacy.hash?.bits ?? x.legacy.file;
  const e = missing.get(k) ?? { role: x.role, url: x.legacy.url, alt: x.legacy.alt, sites: [] };
  e.sites.push(r.slug);
  missing.set(k, e);
}
md.push('', '## Missing assets, most widespread first', '', '| Role | Example (legacy URL) | Alt | Sites |', '|---|---|---|---|');
for (const e of [...missing.values()].sort((a, b) => b.sites.length - a.sites.length)) md.push(`| ${e.role} | ${e.url.slice(0, 100)} | ${e.alt.slice(0, 40)} | ${e.sites.length}: ${e.sites.slice(0, 8).join(', ')}${e.sites.length > 8 ? ' …' : ''} |`);
writeFileSync(`${OUT}/assets.md`, md.join('\n') + '\n');
console.log(`assets compared for ${result.length} sites; ${missing.size} distinct missing assets`);
