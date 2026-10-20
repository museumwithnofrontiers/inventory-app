// Reads one legacy DXA site (gallery or exhibition) through its own dxa-api instance:
// the membership list, every item sheet in every language it offers, partners, tags,
// countries and the timeline. Everything goes through the cache in lib/http.mjs.
import { getJson, mapAll } from './lib/http.mjs';

const asList = (x) => (Array.isArray(x) ? x : x && typeof x === 'object' ? Object.values(x) : []);

export async function paged(base, path) {
  const sep = path.includes('?') ? '&' : '?';
  const first = await getJson(`${base}/${path}`);
  if (!first.json) return { status: first.status, rows: [] };
  if (Array.isArray(first.json)) return { status: 200, rows: first.json, total: first.json.length };
  const last = first.json.page?.lastPage ?? 1;
  const rest = await mapAll(
    Array.from({ length: Math.max(0, last - 1) }, (_, i) => i + 2),
    (p) => getJson(`${base}/${path}${sep}page=${p}`),
  );
  const rows = [first, ...rest].flatMap((r) => asList(r.json?.items));
  return { status: 200, rows, total: first.json.page?.total ?? rows.length };
}

const link = (rec, rel) => rec.links?.find((l) => l.rel === rel)?.href;

export async function readLegacyDxa(apiBase) {
  const self = (await getJson(`${apiBase}/thg/galleries/self`)).json;
  const list = await paged(apiBase, 'items');

  // Each list row names its sheet ("object"/"monument" link). The first sheet lists every
  // language the record has (i18nLinks); fetch them all.
  const sheets = await mapAll(list.rows, async (row) => {
    const href = link(row, 'object') ?? link(row, 'monument');
    const firstLang = String(row.i18n ?? row.languageId ?? 'en').split(',')[0].trim() || 'en';
    const first = href ? await getJson(`${href}/${firstLang}`) : { status: 'no-link', json: null };
    const byLang = {};
    if (first.json) byLang[first.json.languageId ?? firstLang] = first.json;
    const others = (first.json?.i18nLinks ?? []).filter((l) => !byLang[l.rel]);
    await mapAll(others, async (l) => {
      const r = await getJson(l.href);
      byLang[l.rel] = r.json ?? { __status: r.status };
    });
    return { row, href, status: first.status, byLang };
  });

  const partners = await paged(apiBase, 'partners');
  const tags = (await getJson(`${apiBase}/items/tags`)).json;
  const itemCountries = (await getJson(`${apiBase}/items/countries`)).json;
  const eventCountries = (await getJson(`${apiBase}/events/countries`)).json;
  const events = await paged(apiBase, 'events');
  const years = (await getJson(`${apiBase}/items/years`)).json;
  return { self, list, sheets, partners, tags, itemCountries, eventCountries, events, years };
}

// "/mwnf3/objects/DCA/uk/Mus31/19" → "mwnf3:objects:DCA:uk:Mus31:19"
// "/sh/objects/AWE/de/19"         → "mwnf3_sharing_history:sh_objects:awe:de:19"
export function dbUidToKey(dbUid) {
  const p = dbUid.replace(/^\//, '').split('/');
  if (p[0] === 'mwnf3') return ['mwnf3', ...p.slice(1)].join(':');
  if (p[0] === 'sh') return ['mwnf3_sharing_history', `sh_${p[1]}`, ...p.slice(2)].join(':');
  if (p[0] === 'thg') return ['mwnf3_thematic_gallery', `thg_${p[1]}`, ...p.slice(2)].join(':');
  if (p[0] === 'travel' || p[0] === 'travels') return ['mwnf3_travels', ...p.slice(1)].join(':');
  if (p[0] === 'explore') return ['mwnf3_explore', p[1].replace(/s$/, ''), ...p.slice(2)].join(':');
  return p.join(':');
}

export { asList, link };
