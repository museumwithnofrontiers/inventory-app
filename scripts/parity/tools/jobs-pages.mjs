// node tools/jobs-pages.mjs — every page type of the representative sites, legacy and new:
// two galleries, two exhibitions, the five standalone sites. Same record on both sides.
import { readFileSync, writeFileSync } from 'node:fs';
import { loadPackage } from './lib/pkg.mjs';
import { OUT } from './lib/paths.mjs';

const sites = new Map(JSON.parse(readFileSync(`${OUT}/sitemap.json`, 'utf8')).sites.map((s) => [s.slug, s]));
const jobs = [];
const pair = (slug, page, legacy, nu) => {
  jobs.push({ id: `${slug}--${page}--legacy`, url: legacy, slug, page });
  jobs.push({ id: `${slug}--${page}--new`, url: nu, slug, page });
};
const pkg = (slug) => { const s = sites.get(slug); return loadPackage(s.package, s.packageVersion); };
const byKey = (list, key) => list.find((x) => x.backward_compatibility.toLowerCase() === key.toLowerCase());

// ---- galleries: carpets (dark olive palette), calligraphy (light shades, white text)
for (const [slug, itemKey] of [['carpets', 'mwnf3:objects:DCA:uk:Mus31:19'], ['calligraphy', null]]) {
  const s = sites.get(slug);
  const L = s.legacyUrl.replace(/\/$/, '');
  const N = `${s.newUrl}#`;
  const P = pkg(slug);
  const items = P.read('items.json');
  const it = itemKey ? byKey(items, itemKey) : items.find((i) => i.images.length > 1 && i.languages.length > 1) ?? items[0];
  const uid = it.backward_compatibility.split(':').slice(0, 2).join('/') + '/' + it.backward_compatibility.split(':').slice(2).join('/');
  const partner = P.read('partners.json').find((p) => p.id === it.partner_id);
  const [, , pid, pcc] = partner.backward_compatibility.split(':');
  for (const page of ['', 'collection', 'partners', 'timeline', 'about', 'credits', 'how-to-search']) pair(slug, page || 'home', `${L}/${page}`, `${N}/${page}`);
  pair(slug, 'item', `${L}/database-item/${uid}/en`, `${N}/item/${it.id}`);
  pair(slug, 'partner', `${L}/partner/mwnf3/${pcc}/${pid}/en`, `${N}/partner/${partner.id}`);
}

// ---- exhibitions: water-in-islam (own palette), the-use-of-colours-in-art (client defaults)
for (const slug of ['water-in-islam', 'the-use-of-colours-in-art']) {
  const s = sites.get(slug);
  const L = s.legacyUrl.replace(/\/$/, '');
  const N = `${s.newUrl}#`;
  const P = pkg(slug);
  const themes = P.read('themes.json');
  const t = themes[1] ?? themes[0];
  const tid = t.backward_compatibility.split(':').pop();
  const it = P.read('items.json').find((i) => i.backward_compatibility.startsWith('mwnf3:objects') && i.images.length > 1) ?? P.read('items.json')[0];
  const [, , proj, cc, mus, num] = it.backward_compatibility.split(':');
  for (const page of ['', 'about', 'themes', 'partners', 'timeline', 'credits']) pair(slug, page || 'home', `${L}/${page}`, `${N}/${page}`);
  pair(slug, 'theme', `${L}/theme/${tid}`, `${N}/theme/${tid}`);
  pair(slug, 'item', `${L}/database-item/${proj}/${cc}/${mus}/${num}/en`, `${N}/item/${it.id}`);
}

// ---- the two PHP museums
for (const [slug, itemKey, monKey] of [['islamicart', 'mwnf3:objects:ISL:it:Mus01:9', 'mwnf3:monuments:ISL:dz:Mon01:7'], ['baroqueart', 'mwnf3:objects:BAR:hu:Mus11:22', 'mwnf3:monuments:BAR:at:Mon11:36']]) {
  const s = sites.get(slug);
  const L = s.legacyUrl.replace(/\/$/, '');
  const N = `${s.newUrl}#`;
  const P = pkg(slug);
  const items = P.read('items.json');
  const partners = P.read('partners.json');
  const cols = P.read('collections.json');
  const it = byKey(items, itemKey);
  const mon = byKey(items, monKey);
  const partner = partners.find((p) => p.id === it.partner_id);
  const [, , pid, pcc] = partner.backward_compatibility.split(':');
  const exh = cols.filter((c) => /^mwnf3:exhibitions:\d+$/.test(c.backward_compatibility))[0];
  const idOf = (key) => key.split(':').slice(1).map((x, i) => (i === 0 ? x.replace(/s$/, '') : x)).join(';');
  pair(slug, 'home', `${L}/index.php`, `${N}/`);
  pair(slug, 'database', `${L}/database.php`, `${N}/database`);
  pair(slug, 'item', `${L}/database_item.php?id=${idOf(it.backward_compatibility)};en`, `${N}/item/${it.id}`);
  pair(slug, 'monument', `${L}/database_item.php?id=${idOf(mon.backward_compatibility)};en`, `${N}/item/${mon.id}`);
  pair(slug, 'partners', `${L}/partners.php`, `${N}/partners`);
  pair(slug, 'partner', `${L}/pm_partner.php?id=${pid};${pcc}&type=museum`, `${N}/partner/${partner.id}`);
  pair(slug, 'permanent-collection', `${L}/pc_entrance.php`, `${N}/permanent-collection`);
  pair(slug, 'timeline', `${L}/hcr_home.php`, `${N}/timeline`);
  pair(slug, 'exhibitions', `${L}/exhibitions/${slug === 'islamicart' ? 'ISL' : 'BAR'}/index.php`, `${N}/exhibitions`);
  if (exh) pair(slug, 'exhibition', `${L}/exhibitions/${slug === 'islamicart' ? 'ISL' : 'BAR'}/index.php`, `${N}/exhibitions/${exh.id}`);
}

// ---- Sharing History
{
  const s = sites.get('sharinghistory');
  const L = s.legacyUrl.replace(/\/$/, '');
  const N = `${s.newUrl}#`;
  const P = pkg('sharinghistory');
  const it = byKey(P.read('items.json'), 'mwnf3_sharing_history:sh_objects:awe:pt:102');
  const partner = P.read('partners.json').find((p) => p.id === it.partner_id);
  const exh = P.read('collections.json').find((c) => c.backward_compatibility === 'mwnf3_sharing_history:sh_exhibitions:1');
  pair('sharinghistory', 'home', `${L}/index.php`, `${N}/`);
  pair('sharinghistory', 'database', `${L}/database.php`, `${N}/database`);
  pair('sharinghistory', 'item', `${L}/database_item.php?id=object;AWE;pt;102;en`, `${N}/item/${it.id}`);
  pair('sharinghistory', 'partners', `${L}/pm_partner_list.php`, `${N}/partners`);
  if (partner) pair('sharinghistory', 'partner', `${L}/pm_partner.php?id=${partner.backward_compatibility.split(':').pop().toUpperCase()}`, `${N}/partner/${partner.id}`);
  pair('sharinghistory', 'exhibition', `${L}/exhibition.php?exhibition=1`, `${N}/exhibitions/${exh?.id}`);
  pair('sharinghistory', 'historical-background', `${L}/historical_background.php`, `${N}/historical-background`);
  pair('sharinghistory', 'timeline', `${L}/hcr_home.php`, `${N}/timeline`);
}

// ---- Explore and the galleries hub: legacy paths work on both
{
  const L = 'https://explore.museumwnf.org';
  const N = `${sites.get('explore').newUrl}#`;
  for (const [page, path] of [['home', ''], ['theme', 'themes/1'], ['country', 'countries/tn'], ['itineraries', 'itineraries/tn'], ['about', 'about'], ['credits', 'credits']]) pair('explore', page, `${L}/${path}`, `${N}/${path}`);
  const G = 'https://galleries.museumwnf.org';
  const GN = `${sites.get('galleries').newUrl}#`;
  for (const [page, path] of [['home', ''], ['list', 'list'], ['partners', 'partners'], ['about', 'about'], ['credits', 'credits']]) pair('galleries', page, `${G}/${path}`, `${GN}/${path}`);
}

writeFileSync(`${OUT}/jobs-pages.json`, JSON.stringify(jobs.filter((j) => !j.id.includes('--home--')), null, 1));
console.log(`${jobs.length} jobs (${jobs.filter((j) => !j.id.includes('--home--')).length} beyond the home pages)`);
