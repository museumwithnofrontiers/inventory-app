// Runs in the Playwright image (the parity service): node tools/build-style-page.mjs
// Resizes the screenshots and writes the review page: site/index.html + site/img/*.
import sharp from 'sharp';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { NOTES, OUT, SHOTS, SITE, TOOLS } from './lib/paths.mjs';

mkdirSync(`${SITE}/img`, { recursive: true });
const home = JSON.parse(readFileSync(`${OUT}/style-home.json`, 'utf8'));
const pages = JSON.parse(readFileSync(`${OUT}/style-pages.json`, 'utf8'));
const notes = existsSync(`${NOTES}/style-notes.json`) ? JSON.parse(readFileSync(`${NOTES}/style-notes.json`, 'utf8')) : {};
const sitemap = new Map(JSON.parse(readFileSync(`${OUT}/sitemap.json`, 'utf8')).sites.map((s) => [s.slug, s]));

async function img(id, width, maxHeight, suffix) {
  const src = `${SHOTS}/${id}.jpg`;
  const dst = `${SITE}/img/${id}${suffix}.jpg`;
  if (!existsSync(src)) return null;
  if (!existsSync(dst)) {
    const meta = await sharp(src).metadata();
    const h = Math.min(meta.height, Math.round(maxHeight * (meta.width / width)));
    await sharp(src).extract({ left: 0, top: 0, width: meta.width, height: h }).resize({ width }).jpeg({ quality: 64, mozjpeg: true }).toFile(dst);
  }
  return `img/${id}${suffix}.jpg`;
}

const rows = [];
for (const r of home) {
  const s = sitemap.get(r.slug);
  rows.push({
    ...r,
    title: s?.title ?? r.slug,
    legacyUrl: s?.legacyUrl,
    newUrl: s?.newUrl,
    thumbs: { legacy: await img(`${r.slug}--home--legacy`, 320, 900, '-t'), new: await img(`${r.slug}--home--new`, 320, 900, '-t') },
    full: { legacy: await img(`${r.slug}--home--legacy`, 900, 2400, ''), new: await img(`${r.slug}--home--new`, 900, 2400, '') },
  });
}
const pairs = [];
for (const p of pages) {
  pairs.push({ ...p, full: { legacy: await img(`${p.slug}--${p.page}--legacy`, 900, 2400, ''), new: await img(`${p.slug}--${p.page}--new`, 900, 2400, '') } });
}
// Assets: per site counts, and every missing asset once with the sites that lose it.
let assets = null;
if (existsSync(`${OUT}/assets.json`)) {
  const A = JSON.parse(readFileSync(`${OUT}/assets.json`, 'utf8'));
  const groups = new Map();
  for (const r of A) for (const x of r.rows.filter((y) => !y.match && !y.random)) {
    const k = x.legacy.hash?.bits ?? x.legacy.file;
    const g = groups.get(k) ?? { role: x.role, thumb: x.legacy.thumb, url: x.legacy.url, alt: x.legacy.alt, size: x.legacy.hash ? `${x.legacy.hash.w}×${x.legacy.hash.h}` : '', sites: [] };
    if (!g.sites.includes(r.slug)) g.sites.push(r.slug);
    groups.set(k, g);
  }
  assets = {
    notes: existsSync(`${NOTES}/assets-notes.json`) ? JSON.parse(readFileSync(`${NOTES}/assets-notes.json`, 'utf8')) : [],
    sites: A.map((r) => ({ slug: r.slug, kind: r.kind, title: r.title, legacy: r.rows.length, kept: r.rows.filter((x) => x.match).length, random: r.rows.filter((x) => x.random).length, missing: r.rows.filter((x) => !x.match && !x.random).length, added: r.added.length, legacyHost: r.newFromLegacyHost.length })),
    missing: [...groups.values()].sort((a, b) => b.sites.length - a.sites.length),
  };
}
// Static pages: every legacy page with its paragraph verdicts, a few missing samples, footer diffs.
let statics = null;
if (existsSync(`${OUT}/static.json`)) {
  const S = JSON.parse(readFileSync(`${OUT}/static.json`, 'utf8'));
  const c = (rows, v) => rows.filter((r) => r.verdict === v).length;
  statics = {
    notes: existsSync(`${NOTES}/static-notes.json`) ? JSON.parse(readFileSync(`${NOTES}/static-notes.json`, 'utf8')) : [],
    pages: S.flatMap((r) => r.pages.filter((p) => p.rows.length && !(p.page === 'home' && r.slug === 'galleries')).map((p) => ({
      slug: r.slug, kind: r.kind, title: r.title, page: p.page, url: p.url, newUrl: p.newUrl, newPage: p.newPage,
      total: p.rows.length, kept: c(p.rows, 'kept'), moved: c(p.rows, 'moved'), partial: c(p.rows, 'partial'), missing: c(p.rows, 'missing'),
      samples: p.rows.filter((x) => x.verdict === 'missing').slice(0, 4).map((x) => x.text.slice(0, 240)),
    }))),
    footer: S.filter((r) => r.footer.missing.length).map((r) => ({ slug: r.slug, title: r.title, missing: r.footer.missing })),
  };
}
const data = { generated: new Date().toISOString().slice(0, 10), rows, pairs, notes, assets, statics };
writeFileSync(`${SITE}/data.json`, JSON.stringify(data));
writeFileSync(`${SITE}/style-parity.html`, readFileSync(`${TOOLS}/style-page.html`, 'utf8'));
const n = readdirSync(`${SITE}/img`).length;
console.log(`page written: ${rows.length} sites, ${pairs.length} page pairs, ${n} images`);
