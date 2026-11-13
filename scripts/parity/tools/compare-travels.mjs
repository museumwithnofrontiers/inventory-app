// node tools/compare-travels.mjs — Travels: legacy MWNF Travel's Exhibition Trails pages
// (https://travels.museumwnf.org/travel_et_*.php, raw HTML) vs @museumwnf/travels-data. The
// trails and their languages, each trail's header, description, curators and Travel Book, its
// itineraries with their names, locations and descriptions, and each itinerary's gallery: the
// monuments, their pictures and the pictures' captions.
import { readFileSync } from 'node:fs';
import { get, stats } from './lib/http.mjs';
import { loadPackage } from './lib/pkg.mjs';
import { Report } from './lib/report.mjs';
import { compare, decodeEntities } from './lib/text.mjs';
import { checkImageUrls } from './lib/images.mjs';
import { OUT } from './lib/paths.mjs';

const BASE = 'https://travels.museumwnf.org';
const site = JSON.parse(readFileSync(`${OUT}/sitemap.json`, 'utf8')).sites.find((s) => s.slug === 'travels');
const P = loadPackage(site.package, site.packageVersion);
const R = new Report('travels', { legacy: `${BASE}/travel_et_home.php`, package: `${site.package}@${site.packageVersion} (published ${site.packagePublished?.slice(0, 10)})`, 'compared at': new Date().toISOString().slice(0, 16).replace('T', ' ') + 'Z' });
const page = async (path) => (await get(`${BASE}/${path.replace(/&amp;/g, '&')}`)).body ?? '';
const unique = (xs) => [...new Set(xs)];

// ---------- package
const collections = P.read('collections.json');
const C = new Map(collections.map((c) => [c.backward_compatibility, c]));
const childrenOf = new Map();
for (const c of collections) (childrenOf.get(c.parent_id) ?? childrenOf.set(c.parent_id, []).get(c.parent_id)).push(c);
const items = new Map(P.read('items.json').map((i) => [i.id, i]));
const tr = (c, lang) => {
  const t = P.tr('collections', lang, c?.id) ?? {};
  return { ...(t.extra ?? {}), ...t };
};

// ---------- legacy: the lists (the menu's countries and themes, the home's selects), then each
// list's trails and their languages
const home = await page('travel_et_home.php');
const lists = unique([
  ...[...home.matchAll(/travel_et_trail\.php\?((?:cid|tid)=[A-Za-z]+)/g)].map((m) => m[1]),
  ...[...home.matchAll(/<option[^>]*value="([a-z]{2})"/g)].filter((m) => !['en', 'ar'].includes(m[1])).map((m) => `cid=${m[1]}`),
  ...[...home.matchAll(/<option[^>]*value="([A-Z]{3})"/g)].map((m) => `tid=${m[1]}`),
]);
const trails = new Map(); // P:c:n → Set(lang)
const addTrail = (key, lang) => (trails.get(key) ?? trails.set(key, new Set()).get(key)).add(lang);
for (const list of lists) {
  const html = await page(`travel_et_trail.php?${list}`);
  for (const m of html.matchAll(/travel_et_trailDetail\.php\?id=([A-Z]+);([a-z]+);(\d+);([a-z]+)/g)) addTrail(`${m[1]}:${m[2]}:${m[3]}`, m[4]);
}
const pkgTrails = collections.filter((c) => c.type === 'exhibition trail');
R.set('trails legacy lists', [...trails.keys()].map((k) => `mwnf3_travels:trail:${k}`), pkgTrails.filter((c) => c.backward_compatibility.split(':')[2] !== 'GPA').map((c) => c.backward_compatibility));
R.note('Legacy lists no GPA trail ("Comment for avoiding display GPA"), and neither does the site (viewer-layout HIDDEN_PROJECTS); its pages answer at their address, so they are compared below.');
// A trail no list names, whose pages legacy still serves at their address.
const headerLinesOf = (html) => [...(html.split('id="exDetailsmenuListing">')[1] ?? '').split("<div id='exDetails'>")[0].split('<div id="exDetails">')[0].matchAll(/class=['"]exDetailsmainLinks['"]>([\s\S]*?)<\/div>/g)].map((m) => m[1]);
for (const c of pkgTrails) {
  const key = c.backward_compatibility.replace('mwnf3_travels:trail:', '');
  if (trails.has(key)) continue;
  const [proj, cid, n] = key.split(':');
  for (const lang of ['en', 'fr', 'es', 'it', 'de', 'pt', 'tr', 'ar'].filter((l) => P.tr('collections', l, c.id))) {
    const html = await page(`travel_et_trailDetail.php?id=${encodeURIComponent(`${proj};${cid};${n};${lang}`)}&fl=desc`);
    if (headerLinesOf(html)[0]?.replace(/<[^>]*>/g, '').trim()) addTrail(key, lang);
  }
}
R.set('trails', [...trails.keys()].map((k) => `mwnf3_travels:trail:${k}`), pkgTrails.map((c) => c.backward_compatibility));

const between = (html, start, end) => {
  const i = html.indexOf(start);
  if (i < 0) return '';
  const j = html.indexOf(end, i + start.length);
  return html.slice(i + start.length, j < 0 ? undefined : j);
};
const descContent = (html) => between(html, '<div id="descContent">', '</div>');
const headerLines = (html) => [...between(html, 'id="exDetailsmenuListing">', '<div id=\'exDetails\'>').matchAll(/class=['"]exDetailsmainLinks['"]>([\s\S]*?)<\/div>/g)].map((m) => m[1]);

for (const [key, langs] of trails) {
  const trail = C.get(`mwnf3_travels:trail:${key}`);
  if (!trail) continue;
  const [proj, cid, n] = key.split(':');
  const pkgLangs = unique(['en', 'fr', 'es', 'it', 'de', 'pt', 'tr', 'ar'].filter((l) => P.tr('collections', l, trail.id)));
  R.field('trail', 'languages', [...langs].sort().join(' ') === pkgLangs.sort().join(' ') ? { verdict: 'same' } : { verdict: 'different', legacy: [...langs].sort().join(' '), pkg: pkgLangs.join(' ') }, key);
  const itineraries = (childrenOf.get(trail.id) ?? []).filter((c) => c.type === 'itinerary');
  let structureDone = false;

  for (const lang of [...langs].sort((a, b) => (a === 'en' ? -1 : b === 'en' ? 1 : a.localeCompare(b)))) {
    const where = `${key}|${lang}`;
    const t = tr(trail, lang);
    const id = encodeURIComponent(`${proj};${cid};${n};${lang}`);
    const desc = await page(`travel_et_trailDetail.php?id=${id}&fl=desc`);
    const [title, subtitle, region] = headerLines(desc);
    R.field('trail', 'title', compare(title, t.title), where);
    R.field('trail', 'subtitle', compare(subtitle, t.subtitle), where);
    R.field('trail', 'region', compare((region ?? '').replace(/<b>[\s\S]*?<\/b>/, ''), t.region_territory), where);
    R.field('trail', 'description', compare(descContent(desc), t.description), where);
    const cur = descContent(await page(`travel_et_trailDetail.php?id=${id}&fl=cur`));
    const parts = cur.split(/<strong>[\s\S]*?<\/strong>/).slice(1);
    R.field('trail', 'curated_by', compare(parts[0], t.curated_by), where);
    R.field('trail', 'photo_by', compare(parts[1], t.photo_by), where);
    if (lang === [...langs][0] || lang === 'en') {
      const books = unique([...desc.matchAll(/books\.museumwnf\.org\/book\/(\d+)\//g)].map((m) => `mwnf3:bookbase:${m[1]}`));
      const pkgBooks = (trail.publications ?? []).map((p) => p.backward_compatibility);
      R.field('trail', 'travel book', books.sort().join(' ') === pkgBooks.sort().join(' ') ? { verdict: books.length ? 'same' : 'both-empty' } : { verdict: !pkgBooks.length ? 'missing-in-package' : 'different', legacy: books.join(' '), pkg: pkgBooks.join(' ') }, key);
    }

    // ---------- the itineraries page: names and main locations
    const its = await page(`travel_et_trailDetail.php?id=${id}&fl=its`);
    const blocks = its.split('<div class="borderbottom">').slice(1);
    const legacyIts = blocks.map((b) => {
      const m = b.match(/travel_et_itenary\.php\?id=([A-Z]+);([a-z]+);([IVXL]+);([a-z]+);(\d+)&(?:amp;)?fl=des[^"]*">([\s\S]*?)<\/a>/);
      if (!m) return null;
      // The main locations: the <strong> names between the itinerary's name and its gallery link
      // (the label before them is in the page's language).
      const after = b.slice(b.indexOf(m[0]) + m[0].length);
      const locs = after.slice(after.indexOf('</strong>') + 9, after.search(/<a href="travel_et_itenary\.php\?[^"]*fl=vl/));
      return { roman: m[3], href: m[0].slice(0, m[0].indexOf('"')), name: m[6].replace(/&nbsp;&gt;&gt;\s*$/, ''), locations: [...locs.matchAll(/<strong>([\s\S]*?)<\/strong>/g)].map((x) => decodeEntities(x[1]).trim()).filter((x) => x && !x.includes('<a')) };
    }).filter(Boolean);
    if (!structureDone) R.set(`itineraries of ${key}`, legacyIts.map((x) => `mwnf3_travels:itinerary:${key}:${x.roman}`), itineraries.map((c) => c.backward_compatibility));

    for (const li of legacyIts) {
      const itin = C.get(`mwnf3_travels:itinerary:${key}:${li.roman}`);
      if (!itin) continue;
      const iw = `${key}:${li.roman}|${lang}`;
      const it = tr(itin, lang);
      R.field('itinerary', 'title', compare(li.name, it.title), iw);
      const locations = (childrenOf.get(itin.id) ?? []).filter((c) => c.type === 'location');
      R.field('itinerary', 'locations', compare(li.locations.join('; '), locations.map((l) => tr(l, lang).title).filter(Boolean).join('; ')), iw);
      const des = await page(`travel_et_itenary.php?id=${proj};${cid};${li.roman};${lang};${n}&fl=des&itrNo=${li.href.match(/itrNo=(\d+)/)?.[1] ?? ''}`);
      R.field('itinerary', 'description', compare(descContent(des), it.description), iw);

      // ---------- the gallery: monuments, pictures and captions (structure once, captions per language)
      const vl = await page(`travel_et_itenary.php?id=${proj};${cid};${li.roman};${lang};${n}&fl=vl&itrNo=${li.href.match(/itrNo=(\d+)/)?.[1] ?? ''}`);
      const pics = new Map(); // loc:letter → Map(number → caption)
      const re = new RegExp(`imgInfo\\['[^']*?/trails/${proj.toLowerCase()}/${cid}/${n}/${li.roman.toLowerCase()}/(\\d+)/([a-z]+)/(\\d+)\\.jpg'\\]\\s*=\\s*\\["[^"]*",\\s*"((?:[^"\\\\]|\\\\.)*)"\\]`, 'g');
      for (const m of vl.matchAll(re)) {
        const mk = `${m[1]}:${m[2]}`;
        (pics.get(mk) ?? pics.set(mk, new Map()).get(mk)).set(Number(m[3]), m[4].replace(/\\(.)/g, '$1'));
      }
      const pkgMonuments = new Map();
      for (const loc of locations) for (const ref of loc.items ?? []) {
        const item = items.get(ref.id);
        const k = item?.backward_compatibility.match(/^mwnf3_travels:monument:[^:]+:[^:]+:[^:]+:[^:]+:(\d+):([a-z]+)$/);
        // Legacy's gallery lists pictures, so a monument with none is in neither gallery.
        if (k && (item.images ?? []).length) pkgMonuments.set(`${k[1]}:${k[2]}`, item);
      }
      if (!structureDone) R.set(`monuments of ${key}:${li.roman}`, [...pics.keys()].map((k) => `${key}:${li.roman}:${k}`), [...pkgMonuments.keys()].map((k) => `${key}:${li.roman}:${k}`));
      for (const [mk, legacyPics] of pics) {
        const item = pkgMonuments.get(mk);
        if (!item) continue;
        // Every package image counts: two images at one position are two pictures the site shows.
        const images = item.images ?? [];
        const pkgPics = new Map();
        for (const im of images) if (!pkgPics.has(im.display_order) || !pkgPics.get(im.display_order).captions?.[lang]) pkgPics.set(im.display_order, im);
        const mw = `${key}:${li.roman}:${mk}`;
        if (!structureDone) R.field('monument', 'pictures', legacyPics.size === images.length ? { verdict: 'same' } : { verdict: legacyPics.size > images.length ? 'missing-in-package' : 'extra-in-package', legacy: String(legacyPics.size), pkg: String(images.length) }, mw);
        for (const [num, caption] of legacyPics) {
          const im = pkgPics.get(num);
          if (im) R.field('picture', 'caption', compare(caption, im.captions?.[lang]), `${mw}:${num}|${lang}`);
        }
      }
    }
    structureDone = true;
  }
}

R.note('The tour offers, guides and agencies (travel_*.php outside the Exhibition Trails) are not in the inventory (D-T2); only the travel_et_* pages are compared.');
R.note('A monument\'s pictures are matched by their number in legacy\'s path (…/<itinerary>/<location>/<letter>/<n>.jpg) and the package image\'s display_order.');
await checkImageUrls(P.root, R);
R.write(`${OUT}/travels`);
console.log(JSON.stringify({ trails: trails.size, ...stats }));
