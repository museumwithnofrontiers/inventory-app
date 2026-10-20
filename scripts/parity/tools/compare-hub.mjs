// node tools/compare-hub.mjs — the galleries hub: legacy dxa-api deployment
// (https://galleries.museumwnf.org/api/v2) vs @museumwnf/galleries-data: the gallery list and
// the partner directory.
import { readFileSync } from 'node:fs';
import { getJson, stats } from './lib/http.mjs';
import { loadPackage } from './lib/pkg.mjs';
import { Report } from './lib/report.mjs';
import { compare } from './lib/text.mjs';
import { checkImageUrls } from './lib/images.mjs';
import { link, paged } from './legacy-dxa.mjs';
import { OUT } from './lib/paths.mjs';

const API = 'https://galleries.museumwnf.org/api/v2';
const site = JSON.parse(readFileSync(`${OUT}/sitemap.json`, 'utf8')).sites.find((s) => s.slug === 'galleries');
const P = loadPackage(site.package, site.packageVersion);
const R = new Report('galleries', { legacy: API, package: `${site.package}@${site.packageVersion} (published ${site.packagePublished?.slice(0, 10)})` });
const lc = (s) => String(s).toLowerCase();

const legacyGalleries = (await paged(API, 'thg/galleries')).rows;
const galleries = P.read('galleries.json');
const G = new Map(galleries.map((g) => [g.backward_compatibility, g]));
R.set('galleries', legacyGalleries.map((g) => `mwnf3_thematic_gallery:thg_gallery:${g.galleryId}`), [...G.keys()]);
const order = (a) => a.join(' ');
R.field('site', 'gallery order', order(legacyGalleries.map((g) => g.galleryId)) === order(galleries.map((g) => g.backward_compatibility.split(':').pop())) ? { verdict: 'same' } : { verdict: 'different', legacy: order(legacyGalleries.map((g) => g.galleryId)), pkg: order(galleries.map((g) => g.backward_compatibility.split(':').pop())) }, 'galleries.json');
for (const g of legacyGalleries) {
  const p = G.get(`mwnf3_thematic_gallery:thg_gallery:${g.galleryId}`);
  if (!p) continue;
  const k = `thg_gallery:${g.galleryId}`;
  R.field('gallery', 'name.en', compare(g.galleryName, p.names?.en), k);
  R.field('gallery', 'slug', compare(g.galleryKey, p.slug), k);
  R.field('gallery', 'host', compare(g.url, p.legacy_host), k);
  R.field('gallery', 'languages', compare(g.languageList, (p.languages ?? []).join(',')), k);
  R.field('gallery', 'image', compare(g.image?.replace(/^.*?(thematic_gallery\/)/, '$1'), p.image_path), k);
  if (g.featured !== p.featured) R.field('gallery', 'featured', { verdict: 'expected:dxa-api inverts featured', legacy: String(g.featured), pkg: String(p.featured) }, k);
  else R.field('gallery', 'featured', { verdict: 'same' }, k);
}

const legacyPartners = (await paged(API, 'partners')).rows;
const partners = P.read('partners.json');
const PB = new Map(partners.map((p) => [lc(p.backward_compatibility), p]));
const key = (r) => lc(`mwnf3:museums:${r.partnerId}:${r.countryId}`);
R.set('partners', legacyPartners.map(key), [...PB.keys()]);
for (const r of legacyPartners) {
  const p = PB.get(key(r));
  if (!p) continue;
  for (const lang of String(r.i18n ?? 'en').split(',')) {
    const t = P.tr('partners', lang, p.id) ?? {};
    const href = link(r, 'partner');
    const d = href ? (await getJson(`${href}/${lang}`)).json : null;
    const rec = d && !Array.isArray(d) ? d : r;
    R.field('partner', 'name', compare(rec.partnerName ?? rec.name, t.name), `${key(r)}|${lang}`);
    R.field('partner', 'city', compare(rec.city, t.city), `${key(r)}|${lang}`);
    if (rec.description !== undefined) R.field('partner', 'description', compare(rec.description, t.description), `${key(r)}|${lang}`);
  }
  R.field('partner', 'holds items', (r.hasObjects ? 1 : 0) === (p.item_count > 0 ? 1 : 0) ? { verdict: 'same' } : { verdict: 'expected:the hub ships no items', legacy: String(r.hasObjects), pkg: String(p.item_count) }, key(r));
}
await checkImageUrls(P.root, R);
R.write(`${OUT}/galleries`);
console.log(JSON.stringify({ galleries: legacyGalleries.length, partners: legacyPartners.length, ...stats }));
