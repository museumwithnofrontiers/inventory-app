// node tools/compare-dxa.mjs <slug> — curatorial parity of one DXA gallery/exhibition:
// live legacy dxa-api instance vs the published data package the new site installs.
import { readFileSync } from 'node:fs';
import { getJson, mapAll, stats } from './lib/http.mjs';
import { loadPackage } from './lib/pkg.mjs';
import { Report } from './lib/report.mjs';
import { checkImageUrls } from './lib/images.mjs';
import { compareExhibition } from './exhibition-themes.mjs';
import { compare, flatten, normalise, splitList } from './lib/text.mjs';
import { asList, dbUidToKey, link, paged, readLegacyDxa } from './legacy-dxa.mjs';
import { OUT } from './lib/paths.mjs';
import { droppedByCvJoin } from './lib/credits-cv.mjs';

const slug = process.argv[2];
const site = JSON.parse(readFileSync(`${OUT}/sitemap.json`, 'utf8')).sites.find((s) => s.slug === slug);
const apiBase = site.legacyUrl.replace(/\/$/, '') + '/api/v2';
const P = loadPackage(site.package, site.packageVersion);
const L = await readLegacyDxa(apiBase);
const R = new Report(slug, {
  legacy: apiBase,
  package: `${site.package}@${site.packageVersion} (published ${site.packagePublished?.slice(0, 10)})`,
  'compared at': new Date().toISOString().slice(0, 16).replace('T', ' ') + 'Z',
});
const lc = (s) => String(s).toLowerCase();

// ---------- package indexes
const items = P.read('items.json');
const itemByKey = new Map(items.map((i) => [lc(i.backward_compatibility), i]));
const itemById = new Map(items.map((i) => [i.id, i]));
const tags = new Map((P.read('tags.json') ?? []).map((t) => [t.id, t]));
const glossaryWord = (id, lang) => P.tr('glossary', lang, id)?.name ?? P.tr('glossary', lang, id)?.word ?? P.read('glossary.json').find((g) => g.id === id)?.word;
// The sites show a dynasty's name in the sheet language only, as dxa-api did.
const dynastyName = (id, lang) => P.tr('dynasties', lang, id)?.name;
// A picture's credits in one language, as the sites read them (viewer-core pictureCredits): the
// per-language maps, or the flat fields of a package exported before them.
const pictureCredits = (img, lang) => (img?.photographers || img?.copyrights
  ? { photographer: img.photographers?.[lang] ?? '', copyright: img.copyrights?.[lang] ?? '' }
  : { photographer: img?.photographer ?? '', copyright: img?.copyright ?? '' });
const countries = P.read('countries.json');
const countryCode = new Map(countries.map((c) => [c.id, c.code]));

// ---------- membership
const legacyKeys = L.sheets.map((s) => lc(dbUidToKey(s.row.dbUid)));
R.set('items (membership)', legacyKeys, [...itemByKey.keys()]);
if (L.list.total !== L.list.rows.length) R.note(`Legacy /items says total ${L.list.total} but its pages list ${L.list.rows.length}.`);
const count = (await getJson(`${apiBase}/items/count`)).json?.total;
if (count !== undefined && count !== L.list.rows.length) R.note(`Legacy /items/count answers ${count}; /items lists ${L.list.rows.length} records.`);
R.set('item × language', L.sheets.flatMap((s) => Object.keys(s.byLang).map((l) => `${lc(dbUidToKey(s.row.dbUid))}|${l}`)), items.flatMap((i) => i.languages.map((l) => `${lc(i.backward_compatibility)}|${l}`)));

// ---------- item sheets
const TR = {
  name: 'name', alsoKnownAs: 'alternate_name', typeOfObject: 'type', holdingMuseum: 'holder', currentOwner: 'owner',
  originalOwner: 'initial_owner', objectDate: 'dates', monumentDate: 'dates', dimensions: 'dimensions', materials: 'materials',
  keywords: 'keywords', provenance: 'provenance', description: 'description', shortDescription: 'short_description',
  methodOfDatation: 'method_for_datation', methodOfProvenance: 'method_for_provenance', methodOfObtention: 'obtention',
  bibliography: 'bibliography', workshop: 'workshop', placeOfProduction: 'place_of_production',
  catalogueHoldingLink: 'catalogue_holding_link', scriber: 'scriber', binding: 'binding_desc', notice_b: 'copyright',
  history: 'history', patrons: 'patrons', architects: 'architects',
};
const CREDITS = { writer: ['preparedBy', 'author'], copyEditor: ['copyEditedBy', 'copy_editor'], translator: ['translationBy', 'translator'], translationCopyEditor: ['translationCopyEditedBy', 'translation_copy_editor'] };
// Legacy fields that are list chrome, ids, links or derived names, not curatorial content.
const IGNORE = new Set(['databaseItemProperties', 'rank', 'projectId', 'countryId', 'partnerId', 'objectId', 'monumentId', 'institutionId', 'languageId', 'partnerName', 'projectName', 'countryName', 'imagePath', 'imageCopyright', 'i18n', 'dbUid', 'links', 'i18nLinks', 'theme_item_ref_list', 'projectSourceIsGallery', 'projectSourceIsExhibition', 'relatedObjectsMainLanguage', 'relatedMonumentsMainLanguage', 'x_galleries', 'x_exhibitions', 'x_all_exhibitions', 'startDate', 'endDate', 'inventoryId', 'workingNumber', 'artist', 'dynasties', 'authors', 'tags', 'pictures', 'glossary', 'relatedObjects', 'relatedMonuments', 'galleries', 'videos', 'audios', 'location', ...Object.keys(TR), ...Object.values(CREDITS).map((c) => c[0])]);
const pkgFieldsSeen = new Set(Object.values(TR).concat(Object.values(CREDITS).map((c) => c[1]), ['location']));
const pkgOnly = {};

// Keywords and materials: legacy keeps one "; "-joined string in its own order; the package
// keeps a list. Same items in another order → "format" (order); a legacy item split at its
// commas → "different" with the reason, since the site then prints it as separate entries.
const LISTS = new Set(['keywords', 'materials']);
function compareList(legacy, pkg) {
  const base = compare(legacy, pkg);
  if (base.verdict !== 'different' && base.verdict !== 'format') return base;
  const a = splitList(normalise(legacy)).map(flatten);
  const b = (Array.isArray(pkg) ? pkg : splitList(pkg)).map((x) => flatten(normalise(x, { from: 'markdown' })));
  const sameSet = a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');
  if (sameSet) return { ...base, verdict: 'format', why: 'same entries, package sorts them' };
  const commaSplit = a.flatMap((x) => x.split(/\s*,\s*/)).sort().join('|') === [...b].sort().join('|');
  if (commaSplit) return { ...base, verdict: 'different', why: 'legacy entry split at its commas' };
  return base;
}
const relKey = (href) => lc(dbUidToKey(new URL(href).pathname.replace(/^.*\/api\/v2/, '').replace(/\/[a-z]{2}$/, '')));
const selfName = L.self?.galleryName;

for (const s of L.sheets) {
  const key = lc(dbUidToKey(s.row.dbUid));
  const it = itemByKey.get(key);
  if (!it) continue;
  let first = true;
  for (const [lang, sh] of Object.entries(s.byLang)) {
    if (sh.__status) { R.field('item', 'sheet', { verdict: 'missing-in-package', legacy: `legacy sheet HTTP ${sh.__status}` }, `${key}|${lang}`); continue; }
    const tr = P.tr('items', lang, it.id) ?? {};
    const where = `${key}|${lang}`;
    for (const [lf, pf] of Object.entries(TR)) {
      if (!(lf in sh)) continue;
      R.field('item', pf, LISTS.has(pf) ? compareList(sh[lf], tr[pf]) : compare(sh[lf], tr[pf]), where);
    }
    // The free-text period/dynasty line (objects.dynasty), distinct from the linked dynasties.
    if ('dynastyDescription' in sh) R.field('item', 'dynasty (free text)', compare(sh.dynastyDescription, tr.dynasty ?? tr.period), where);
    // Location: the import merges location + province, so the package may say more.
    const loc = compare(sh.location, tr.location);
    if (loc.verdict === 'different' && flatten(normalise(tr.location, { from: 'markdown' })).startsWith(flatten(normalise(sh.location)))) loc.verdict = 'expected:location+province';
    R.field('item', 'location', loc, where);
    // Credits: authors_objects per language, else the objects column.
    for (const [role, [col, pf]] of Object.entries(CREDITS)) {
      const names = (sh.authors?.[role] ?? []).map((a) => a[lang] || a.en).filter(Boolean);
      const legacy = names.length ? names.join(', ') : sh[col];
      const r = compare(legacy, tr[pf]);
      if (r.verdict === 'extra-in-package' && droppedByCvJoin(key, lang, role)) r.verdict = 'expected:dxa-api drops a credit whose author has a CV in other languages only';
      // Legacy prints the credit in the page's script when authors_objects has it (e.g. Arabic).
      const latin = (sh.authors?.[role] ?? []).map((a) => a.en).filter(Boolean).join(', ');
      if (r.verdict === 'different' && latin && lang !== 'en' && flatten(normalise(tr[pf], { from: 'markdown' })) === flatten(latin)) r.why = `legacy prints the ${lang} spelling; the package keeps the Latin one`;
      if (r.verdict === 'different' && names.length > 1 && flatten(normalise(tr[pf], { from: 'markdown' })) === flatten(names[0])) r.why = `package keeps only the first of ${names.length} names`;
      if (r.verdict === 'different' && names.length > 1 && flatten(normalise(tr[pf], { from: 'markdown' })).replace(/ (and|&|;) /g, ', ') === flatten(legacy)) r.verdict = 'format';
      R.field('item', pf, r, where);
    }
    for (const [k, v] of Object.entries(sh)) if (!IGNORE.has(k) && v !== null && v !== '' && !(Array.isArray(v) && !v.length) && !(typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length)) R.unmapped('item', k, where);
    for (const k of Object.keys(tr)) if (!pkgFieldsSeen.has(k)) pkgOnly[k] = (pkgOnly[k] ?? 0) + 1;

    // Picture captions and credits are per language: dxa-api returned the page language's row only.
    (sh.pictures ?? []).forEach((pic, i) => {
      if (pic.caption || it.images[i]?.captions?.[lang]) R.field('item', 'image.caption', compare(pic.caption, it.images[i]?.captions?.[lang]), `${where}#${i + 1}`);
      const credits = pictureCredits(it.images[i], lang);
      R.field('item', 'image.copyright', compare(pic.copyright, credits.copyright, { pkgFrom: 'html' }), `${where}#${i + 1}`);
      R.field('item', 'image.photographer', compare(pic.photographer, credits.photographer, { pkgFrom: 'html' }), `${where}#${i + 1}`);
    });
    // Related records + their justification text.
    const rel = [...(sh.relatedObjects ?? []), ...(sh.relatedMonuments ?? [])];
    const relPkg = it.related_items ?? [];
    for (const r of rel) {
      const k = relKey(r.link);
      const p = relPkg.find((x) => lc(x.backward_compatibility) === k);
      if (!p) {
        // Legacy keeps link rows whose target record no longer exists; its own sheet is then empty.
        const target = await getJson(r.link);
        const dangling = !target.json || Array.isArray(target.json) || !target.json.name;
        R.field('item', 'related', { verdict: dangling ? 'expected:legacy link to a record that does not exist' : 'missing-in-package', legacy: k }, where);
        continue;
      }
      R.field('item', 'related', { verdict: 'same' }, where);
      R.field('item', 'related.justification', compare(r.justification, p.justifications?.[lang]), `${where}→${k}`);
    }
    // Glossary links: legacy reads a curated index; the inventory re-derives them from the text.
    const gL = new Set((sh.glossary ?? []).map((g) => flatten(normalise(g.name))));
    const gP = new Set((it.glossary_ids ?? []).map((id) => flatten(normalise(glossaryWord(id, lang) ?? ''))).filter(Boolean));
    const gSame = gL.size === gP.size && [...gL].every((x) => gP.has(x));
    R.field('item', 'glossary-links', gSame ? { verdict: gL.size ? 'same' : 'both-empty' } : { verdict: 'expected:glossary re-derived', legacy: [...gL].join('; '), pkg: [...gP].join('; ') }, where);
    // Dynasties (names in the sheet language).
    const dL = new Set((sh.dynasties ?? []).map((d) => flatten(normalise(d.name))));
    const dP = new Set((it.dynasty_ids ?? []).map((id) => flatten(normalise(dynastyName(id, lang) ?? ''))).filter(Boolean));
    R.field('item', 'dynasties', dL.size === dP.size && [...dL].every((x) => dP.has(x)) ? { verdict: dL.size ? 'same' : 'both-empty' } : { verdict: !dP.size ? 'missing-in-package' : !dL.size ? 'extra-in-package' : 'different', legacy: [...dL].join('; '), pkg: [...dP].join('; ') }, where);

    if (!first) continue;
    // ---- language-independent, once per record
    first = false;
    R.field('item', 'owner_reference', compare(sh.inventoryId, it.owner_reference, { pkgFrom: 'html' }), key);
    R.field('item', 'mwnf_reference', compare(sh.workingNumber, it.mwnf_reference, { pkgFrom: 'html' }), key);
    R.field('item', 'start/end', String(sh.startDate) === String(it.start_date) && String(sh.endDate) === String(it.end_date) ? { verdict: 'same' } : { verdict: 'different', legacy: `${sh.startDate}–${sh.endDate}`, pkg: `${it.start_date}–${it.end_date}` }, key);
    R.field('item', 'artist', compareList(sh.artist, it.artist_names), key);
    const tL = Object.values(sh.tags ?? {}).flatMap((o) => Object.keys(o));
    const tP = (it.tag_ids ?? []).map((id) => tags.get(id)?.legacy_tag_id);
    R.field('item', 'tags', tL.length === tP.length && tL.every((t) => tP.includes(t)) ? { verdict: tL.length ? 'same' : 'both-empty' } : { verdict: 'different', legacy: tL.sort().join(' '), pkg: tP.sort().join(' ') }, key);
    const pics = sh.pictures ?? [];
    R.field('item', 'image.count', pics.length === it.images.length ? { verdict: pics.length ? 'same' : 'both-empty' } : { verdict: pics.length > it.images.length ? 'missing-in-package' : 'extra-in-package', legacy: String(pics.length), pkg: String(it.images.length) }, key);
    const media = [...(sh.videos ?? []), ...(sh.audios ?? [])];
    R.field('item', 'media', media.length === (it.media ?? []).length ? { verdict: media.length ? 'same' : 'both-empty' } : { verdict: 'different', legacy: media.map((m) => m.url).join(' '), pkg: (it.media ?? []).map((m) => m.url).join(' ') }, key);
    const gl = (sh.galleries ?? []).map((g) => g.name).filter((n) => n !== selfName).sort();
    const gp = (it.gallery_references ?? []).filter((g) => g.kind === 'gallery').map((g) => g.name).sort();
    R.field('item', 'other galleries', gl.join('|') === gp.join('|') ? { verdict: gl.length ? 'same' : 'both-empty' } : { verdict: 'different', legacy: gl.join('; '), pkg: gp.join('; ') }, key);
  }
}
if (Object.keys(pkgOnly).length) R.note(`Package translation fields with no legacy sheet field: ${Object.entries(pkgOnly).map(([k, v]) => `${k} (${v})`).join(', ')}.`);

// ---------- gallery anchor
const G = P.read(`${site.kind}.json`) ?? {};
const self = L.self ?? {};
const anchor = (f, a, b, expected) => R.field('site', f, String(a ?? '') === String(b ?? '') ? { verdict: 'same' } : { verdict: expected ? `expected:${expected}` : 'different', legacy: String(a), pkg: String(b) }, slug);
anchor('key', self.galleryKey, G.slug);
anchor('name.en', self.galleryName, G.names?.en ?? G.titles?.en);
anchor('hidden', self.hidden, G.hidden);
anchor('featured', self.featured, G.featured, self.featured !== G.featured ? 'dxa-api inverts featured' : null);
anchor('hasTimeline', self.hasTimeline, G.has_timeline);
anchor('hasCountryBasedTimeline', self.hasCountryBasedTimeline, G.has_country_timeline);
anchor('liveDate', self.liveDate, G.live_date?.slice(0, 10));
// Legacy answers a bare size folder (…/zoom/) when the gallery has no image.
anchor('image', /\/(zoom|hi_res|lo_res)\/$/.test(self.image ?? '') ? null : self.image?.replace(/^.*?\/(thematic_gallery\/)/, '$1') ?? null, G.image_path ?? null);
const banner = link(self, 'banner-object');
anchor('banner item', banner ? relKey(banner) : null, G.banner_item_id ? lc(itemById.get(G.banner_item_id)?.backward_compatibility ?? 'banner_item_id not in items.json') : null);

// ---------- partners
const pkgPartners = P.read('partners.json');
const partnerKey = (row) => {
  const src = row.databaseItemProperties?.source ?? {};
  if (src.database === 'sharing-history') return lc(`mwnf3_sharing_history:sh_partners:${row.partnerId}`);
  if (src.table === 'institution') return lc(`mwnf3:institutions:${row.partnerId}:${row.countryId}`);
  return lc(`mwnf3:museums:${row.partnerId}:${row.countryId}`);
};
const pByKey = new Map(pkgPartners.map((p) => [lc(p.backward_compatibility), p]));
// Exhibitions list their monument institutions separately (/institutions).
if (site.kind === 'exhibition') {
  const inst = await paged(apiBase, 'institutions');
  for (const r of inst.rows) r.databaseItemProperties = { source: { ...(r.databaseItemProperties?.source ?? {}), table: 'institution' } };
  L.partners.rows.push(...inst.rows);
}
R.set('partners', L.partners.rows.map(partnerKey), [...pByKey.keys()]);
const PTR = { partnerName: 'name', name: 'name', city: 'city', description: 'description', address: 'address', phone: 'phone', fax: 'fax', email: 'email', website: 'website', url: 'website' };
await mapAll(L.partners.rows, async (row) => {
  const key = partnerKey(row);
  const p = pByKey.get(key);
  if (!p) return;
  const langs = String(row.i18n ?? 'en').split(',').map((x) => x.trim()).filter(Boolean);
  R.field('partner', 'languages', langs.sort().join(',') === [...p.languages].sort().join(',') ? { verdict: 'same' } : { verdict: 'different', legacy: langs.join(','), pkg: p.languages.join(',') }, key);
  if (row.hasObjects !== undefined) R.field('partner', 'holds items', (row.hasObjects ? 1 : 0) === (p.item_count > 0 ? 1 : 0) ? { verdict: 'same' } : { verdict: 'different', legacy: String(row.hasObjects), pkg: String(p.item_count) }, key);
  const href = link(row, 'partner');
  for (const lang of langs) {
    const d = href ? (await getJson(`${href}/${lang}`)).json : null;
    const rec = d && !Array.isArray(d) ? d : row;
    const tr = P.tr('partners', lang, p.id) ?? {};
    const en = P.tr('partners', 'en', p.id) ?? {};
    for (const [lf, pf] of Object.entries(PTR)) {
      if (!(lf in rec) || (lf === 'partnerName' && 'name' in rec)) continue;
      const r = compare(rec[lf], tr[pf]);
      // dxa-api answers some partners in English whatever the language asked; the package has the translation.
      if (r.verdict === 'different' && lang !== 'en' && compare(rec[lf], en[pf]).verdict === 'same') r.verdict = 'expected:legacy API answers in English';
      R.field('partner', pf, r, `${key}|${lang}`);
    }
    if (d) for (const [k, v] of Object.entries(d)) if (!(k in PTR) && v && typeof v !== 'object' && !/Id$|^has|^is|Name$|^logo$|^i18n$|^languageId$|^lat|^lon|^zoom/.test(k)) R.unmapped('partner', k, `${key}|${lang}`);
  }
});

// ---------- countries, tags, years
const countryIds = (x) => (x?.items ? asList(x.items).map((c) => c.countryId) : Object.keys(x ?? {}));
const partnerCountries = new Set(L.partners.rows.map((r) => r.countryId));
const legacyCountries = new Set([...countryIds(L.itemCountries), ...countryIds(L.eventCountries)]);
R.set('countries (items ∪ timeline ∪ partners)', [...legacyCountries, ...partnerCountries], countries.map((c) => c.code));
const legacyTags = Object.keys(L.tags ?? {});
R.set('facet tags', legacyTags, [...tags.values()].map((t) => t.legacy_tag_id));
for (const t of tags.values()) if (L.tags?.[t.legacy_tag_id] !== undefined) R.field('tag', 'label.en', compare(L.tags[t.legacy_tag_id], t.label), t.legacy_tag_id);

// ---------- timeline (English)
const ev = P.read('timeline_events.json') ?? [];
const evKey = (cc, y, text, from) => `${cc}|${y}|${flatten(normalise(text, { from })).slice(0, 80)}`;
const pkgEvText = (e) => P.tr('timeline_events', 'en', e.id)?.description ?? P.tr('timeline_events', 'en', e.id)?.name;
const legacyEv = L.events.rows.map((e) => evKey(e.countryId, e.A, e.description ?? e.name, 'html'));
const pkgEv = ev.map((e) => evKey(countryCode.get(e.country_id), e.year_from, pkgEvText(e), 'markdown'));
R.set('timeline events (country|year|text, en)', legacyEv, pkgEv);
const evByKey = new Map(ev.map((e, i) => [pkgEv[i], e]));
L.events.rows.forEach((e, i) => {
  const p = evByKey.get(legacyEv[i]);
  if (!p) return;
  const where = legacyEv[i].slice(0, 40);
  R.field('event', 'text.en', compare(e.description ?? e.name, pkgEvText(p)), where);
  // Legacy prints the year when the date text is empty; the package stores that year as the text.
  const d = compare(e.eventDate, P.tr('timeline_events', 'en', p.id)?.date_from_description);
  if (d.verdict === 'extra-in-package' && String(d.pkg) === String(e.A)) d.verdict = 'expected:year as date text';
  R.field('event', 'date text.en', d, where);
});

// Items whose partner_id names a partner the package does not ship.
const partnerIds = new Set(pkgPartners.map((p) => p.id));
const dangling = items.filter((i) => i.partner_id && !partnerIds.has(i.partner_id));
R.fields['package.item partner_id resolves'] = { same: items.filter((i) => i.partner_id).length - dangling.length, 'missing-in-package': dangling.length };
if (dangling.length) R.samples['package.item partner_id resolves|missing-in-package'] = dangling.slice(0, 10).map((i) => ({ where: i.backward_compatibility, pkg: `partner_id ${i.partner_id} not in partners.json` }));
if (site.kind === 'exhibition') await compareExhibition({ apiBase, self: L.self, P, R });
await checkImageUrls(P.root, R);
R.write(`${OUT}/${slug}`);
console.log(JSON.stringify({ slug, ...stats }));
