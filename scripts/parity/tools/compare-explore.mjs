// node tools/compare-explore.mjs — Explore: the live legacy API (https://explore.museumwnf.org/api)
// vs @museumwnf/explore-data. The tree (themes, countries, territories, locations, itineraries),
// each location's monuments and texts, each theme's countries, each sub-itinerary's monuments.
import { readFileSync } from 'node:fs';
import { getJson, mapAll, stats } from './lib/http.mjs';
import { loadPackage } from './lib/pkg.mjs';
import { Report } from './lib/report.mjs';
import { compare } from './lib/text.mjs';
import { checkImageUrls } from './lib/images.mjs';
import { OUT } from './lib/paths.mjs';

const API = 'https://explore.museumwnf.org/api';
const site = JSON.parse(readFileSync(`${OUT}/sitemap.json`, 'utf8')).sites.find((s) => s.slug === 'explore');
const P = loadPackage(site.package, site.packageVersion);
const R = new Report('explore', { legacy: API, package: `${site.package}@${site.packageVersion} (published ${site.packagePublished?.slice(0, 10)})`, 'compared at': new Date().toISOString().slice(0, 16).replace('T', ' ') + 'Z' });
const J = async (path) => (await getJson(`${API}/${path}`)).json;
const byLang = (arr, field = 'value') => Object.fromEntries((arr ?? []).map((x) => [x.langId ?? x.lang, x[field] ?? x]));

const collections = P.read('collections.json');
const C = new Map(collections.map((c) => [c.backward_compatibility, c]));
const keysOf = (prefix, type) => collections.filter((c) => c.backward_compatibility.startsWith(prefix) && (!type || c.type === type)).map((c) => c.backward_compatibility);
const tr = (c, lang) => P.tr('collections', lang, c.id) ?? {};

// ---------- legacy tree
const countries = await J('countries');
const territories = await J('territories');
const themes = await J('themes');
const itineraries = await J('itineraries/itineraries');
const locLists = await mapAll(countries, (c) => J(`locations?c=${c.countryId}`));
const locations = [...new Map(locLists.flat().filter(Boolean).map((l) => [l.locationId, l])).values()];
const locDetails = await mapAll(locations, (l) => J(`locations/${l.locationId}`));
const themeDetails = await mapAll(themes, (t) => J(`themes/${t.themeId}`));
const subIds = [...new Set(itineraries.flatMap((i) => (i.subItineraries ?? []).map((s) => s.subItineraryId ?? s.itineraryId)))];
const subDetails = await mapAll(subIds, (id) => J(`itineraries/sub-itineraries/${id}`));

R.set('themes', themes.map((t) => `mwnf3_explore:thematiccycle:${t.themeId}`), keysOf('mwnf3_explore:thematiccycle:'));
R.set('countries', countries.map((c) => `mwnf3_explore:country:${c.countryId}`), keysOf('mwnf3_explore:country:'));
R.set('territories', territories.map((t) => `mwnf3_explore:region:${t.territoryId}`), keysOf('mwnf3_explore:region:'));
R.set('locations', locations.map((l) => `mwnf3_explore:location:${l.locationId}`), keysOf('mwnf3_explore:location:'));
// The five location routes (113, 114, 115, 124, 126) are reached from a location's relatedRoutes,
// not from the itinerary list; the package files them as itineraries (explore-legacy-analysis.md).
const routes = [...new Set(locDetails.flatMap((d) => (d?.relatedRoutes ?? []).map((r) => r.routeId)).filter(Boolean))];
R.set('itineraries (top level) + location routes', [...itineraries.map((i) => i.itineraryId), ...routes].map((id) => `mwnf3_explore:itinerary:${id}`), keysOf('mwnf3_explore:itinerary:', 'itinerary'));
R.set('sub-itineraries', subIds.map((id) => `mwnf3_explore:itinerary:${id}`), keysOf('mwnf3_explore:itinerary:', 'exhibition trail'));

// ---------- texts: countries, territories, themes
const texts = (entity, key, names, descs) => {
  const c = C.get(key);
  if (!c) return;
  for (const [lang, v] of Object.entries(names)) R.field(entity, 'name', compare(v, tr(c, lang).title), `${key}|${lang}`);
  for (const [lang, v] of Object.entries(descs)) R.field(entity, 'description', compare(v, tr(c, lang).description), `${key}|${lang}`);
};
// A country's name is the country reference's (countries.json, by legacy code), which the site
// prints (explore.js `nameOf`); its collection's title is never shown.
const countryEntity = new Map(P.read('countries.json').filter((c) => c.code).map((c) => [c.code, c]));
for (const c of countries) {
  const key = `mwnf3_explore:country:${c.countryId}`;
  const col = C.get(key);
  const ent = countryEntity.get(c.countryId);
  for (const [lang, v] of Object.entries(byLang(c.countryName))) R.field('country', 'name', compare(v, (ent && P.tr('countries', lang, ent.id)?.name) ?? tr(col, lang).title), `${key}|${lang}`);
  for (const [lang, v] of Object.entries(byLang(c.countryDescription))) R.field('country', 'description', compare(v, tr(col, lang).description), `${key}|${lang}`);
}
for (const t of territories) texts('territory', `mwnf3_explore:region:${t.territoryId}`, byLang(t.territoryName), byLang(t.territoryDescription));
themeDetails.forEach((t) => {
  if (!t) return;
  const key = `mwnf3_explore:thematiccycle:${t.themeId}`;
  texts('theme', key, byLang(t.themeName), byLang(t.themeDescription));
  const c = C.get(key);
  const pk = new Set((tr(c, 'en').extra?.country_ids ?? c?.extra?.country_ids ?? []).map(String));
  const lk = (t.countries ?? []).map((x) => x.countryId);
  R.field('theme', 'countries', lk.length === pk.size && lk.every((x) => pk.has(x)) ? { verdict: 'same' } : { verdict: 'different', legacy: lk.join(' '), pkg: [...pk].join(' ') }, key);
});

// ---------- locations: texts and monuments
locDetails.forEach((d) => {
  if (!d) return;
  const key = `mwnf3_explore:location:${d.locationId}`;
  const c = C.get(key);
  if (!c) return;
  for (const [lang, v] of Object.entries(byLang(d.locationName))) R.field('location', 'name', compare(v, tr(c, lang).title), `${key}|${lang}`);
  for (const det of d.locationDetails ?? []) {
    const t = tr(c, det.langId);
    const x = { ...(t.extra ?? {}), ...t };
    for (const [lf, pf] of [['howToReach', 'how_to_reach'], ['info', 'info'], ['contact', 'contact'], ['preparedBy', 'prepared_by']]) if (det[lf] || x[pf]) R.field('location', pf, compare(det[lf], x[pf]), `${key}|${det.langId}`);
  }
  const lm = new Set((d.monuments ?? []).map((m) => m.monumentId));
  const pm = new Set((c.items ?? []).flatMap((m) => m.extra?.explore_monument_ids ?? []));
  const missing = [...lm].filter((x) => !pm.has(x));
  const extra = [...pm].filter((x) => !lm.has(x));
  R.field('location', 'monuments', !missing.length && !extra.length ? { verdict: lm.size ? 'same' : 'both-empty' } : { verdict: missing.length ? 'missing-in-package' : 'extra-in-package', legacy: `${lm.size}; not in package: ${missing.slice(0, 8).join(' ')}`, pkg: `${pm.size}; not in legacy: ${extra.slice(0, 8).join(' ')}` }, key);
});

// ---------- sub-itineraries: monuments
subDetails.forEach((d, i) => {
  if (!d) return;
  const key = `mwnf3_explore:itinerary:${subIds[i]}`;
  const c = C.get(key);
  if (!c) return;
  for (const [lang, v] of Object.entries(byLang(d.subItineraryName))) R.field('sub-itinerary', 'name', compare(v, tr(c, lang).title), `${key}|${lang}`);
  const lm = new Set((d.locations ?? []).flatMap((l) => (l.monuments ?? []).map((m) => m.monumentId)));
  const pm = new Set((c.items ?? []).map((m) => m.extra?.explore_monument_id).filter((x) => x !== undefined));
  const missing = [...lm].filter((x) => !pm.has(x));
  const extra = [...pm].filter((x) => !lm.has(x));
  R.field('sub-itinerary', 'monuments', !missing.length && !extra.length ? { verdict: lm.size ? 'same' : 'both-empty' } : { verdict: missing.length ? 'missing-in-package' : 'extra-in-package', legacy: `${lm.size}; not in package: ${missing.slice(0, 8).join(' ')}`, pkg: `${pm.size}; not in legacy: ${extra.slice(0, 8).join(' ')}` }, key);
});

R.note('Monument pages (1,693 /monuments/{id}) are not compared field by field here: their texts come from each source database and are covered by those sites\' checks.');
await checkImageUrls(P.root, R);
R.write(`${OUT}/explore`);
console.log(JSON.stringify({ locations: locations.length, subItineraries: subIds.length, ...stats }));
