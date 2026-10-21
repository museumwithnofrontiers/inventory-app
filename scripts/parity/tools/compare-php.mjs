// node tools/compare-php.mjs <islamicart|baroqueart> — curatorial parity of a legacy PHP museum:
// legacy record list (dump) + live legacy item pages (raw HTML) vs its data package.
import { readFileSync } from 'node:fs';
import { get, stats } from './lib/http.mjs';
import { loadPackage } from './lib/pkg.mjs';
import { Report } from './lib/report.mjs';
import { compare, compareArtistLine, compareJoined, flatten, normalise, splitList } from './lib/text.mjs';
import { PHP_SITES, idFromKey, imageNumbers, labelIndex, legacyRecords, pageUrl as pageUrlOn, parsePage } from './legacy-php.mjs';
import { checkImageUrls } from './lib/images.mjs';
import { OUT } from './lib/paths.mjs';

const slug = process.argv[2] ?? 'islamicart';
const site = JSON.parse(readFileSync(`${OUT}/sitemap.json`, 'utf8')).sites.find((s) => s.slug === slug);
const cfg = PHP_SITES[slug];
const pageUrl = (id, lang) => pageUrlOn(cfg.host, id, lang);
const P = loadPackage(site.package, site.packageVersion);
const R = new Report(slug, {
  legacy: `record list from the mwnf3 dump; content from the live pages ${cfg.host}/database_item.php`,
  package: `${site.package}@${site.packageVersion} (published ${site.packagePublished?.slice(0, 10)})`,
  'compared at': new Date().toISOString().slice(0, 16).replace('T', ' ') + 'Z',
});
const lc = (s) => String(s).toLowerCase();
const items = P.read('items.json').filter((i) => i.type === 'object' || i.type === 'monument');
const byKey = new Map(items.map((i) => [lc(i.backward_compatibility), i]));
const legacy = legacyRecords(cfg);
const labels = labelIndex(cfg);

R.set('records (dump vs package)', [...legacy.keys()].map(lc), [...byKey.keys()]);
R.set('record × language (dump vs package)', [...legacy.values()].flatMap((r) => r.langs.map((l) => `${lc(r.key)}|${l}`)), items.flatMap((i) => i.languages.map((l) => `${lc(i.backward_compatibility)}|${l}`)));

const TERM = {
  db_name_object: 'name', db_name_monument: 'name', db_alsoknowas: 'alternate_name', db_location: 'location',
  db_holdingmuseum: 'holder', db_originalowner: 'initial_owner', db_currentowner: 'owner', db_objectdate: 'dates',
  db_monumentdate: 'dates', db_period: 'dates', db_scribe: 'scriber', db_dimensions: 'dimensions',
  db_production_place: 'place_of_production', production_db_place: 'place_of_production', patrons: 'patrons', db_workshop: 'workshop', db_provenance: 'provenance',
  db_binding_txt: 'binding_desc', db_objectdatationmethod: 'method_for_datation', db_monumentdatationmethod: 'method_for_datation',
  db_obtentionmethod: 'obtention', db_provenanceestablished: 'method_for_provenance', db_catalogue_link_txt: 'catalogue_holding_link',
  db_bibliography: 'bibliography', db_architects: 'architects', db_artistsm: 'architects',
  db_type_of_object: 'type', db_denominationsdb: 'type', db_typeof_object: 'type', db_archival: 'archival', db_institution: 'holder', db_Patrons: 'patrons', db_production_db_place: 'place_of_production', db_history: 'history', db_patrons: 'patrons', db_notice_b_title: 'copyright',
  db_thirdname_object: 'alternate_name', db_thirdname_monument: 'alternate_name', db_secondname_object: 'second_name', db_secondname_monument: 'second_name',
};
const CREDIT = (term) => (/translation_?copy|transcopy/.test(term) ? 'translation_copy_editor' : /copy/.test(term) ? 'copy_editor' : /transl/.test(term) ? 'translator' : /writer|prepar|author/.test(term) ? 'author' : null);
const pkgOnly = {};
const creditExtra = {};
const creditShown = {};

let shown = 0;
let notShown = 0;
for (const rec of new Set([...legacy.keys(), ...items.map((i) => i.backward_compatibility)])) {
  const key = lc(rec);
  const it = byKey.get(key);
  const L = legacy.get(rec) ?? [...legacy.values()].find((r) => lc(r.key) === key);
  const id = L?.id ?? idFromKey(rec);
  const langs = new Set([...(L?.langs ?? []), ...(it?.languages ?? [])]);
  let first = true;
  let legacyImages = 0;
  for (const lang of langs) {
    const r = await get(pageUrl(id, lang));
    if (!r.body) { R.note(`not fetched: ${pageUrl(id, lang)}`); continue; }
    const page = parsePage(r.body, lang, labels);
    const where = `${key}|${lang}`;
    if (page.empty) {
      notShown++;
      if (it?.languages.includes(lang)) R.field('record', 'legacy page', { verdict: 'extra-in-package', pkg: 'legacy shows no content for this language' }, where);
      continue;
    }
    shown++;
    if (!it) { R.field('record', 'package record', { verdict: 'missing-in-package', legacy: page.sections[0]?.html?.slice(0, 80) }, where); continue; }
    if (!it.languages.includes(lang)) R.field('record', 'package language', { verdict: 'missing-in-package', legacy: 'legacy page has content' }, where);
    const tr = P.tr('items', lang, it.id) ?? {};
    const seen = new Set();
    const details = it.details ?? [];
    const detailsSeen = new Set();
    for (const s of page.sections) {
      if (!s.term) {
        // Monument pages print each Special Feature (monument detail) as its own heading.
        const d = details.find((x) => flatten(normalise(P.tr('items', lang, x.id)?.name ?? x.internal_name, { from: 'markdown' })) === flatten(normalise(s.label)));
        if (d) {
          // <h3>name</h3><p>location</p><p>dates</p><p>artist</p><p>description…</p>
          detailsSeen.add(d.id);
          const dtr = P.tr('items', lang, d.id) ?? {};
          const dw = `${where}→${d.backward_compatibility}`;
          let paras = s.html.split(/<\/p>/).map((x) => normalise(x)).filter(Boolean);
          const take = (value, from = 'markdown') => {
            const v = flatten(normalise(value, { from }));
            const i = v ? paras.findIndex((p) => flatten(p) === v) : -1;
            if (i >= 0) paras.splice(i, 1);
            return i >= 0;
          };
          for (const f of ['location', 'dates']) R.field('detail', f, !dtr[f] ? { verdict: 'both-empty' } : take(dtr[f]) ? { verdict: 'same' } : { verdict: 'different', pkg: dtr[f], legacy: paras.join(' ⏎ ') }, dw);
          // The artist line lists every artist; the package keeps each name (with its dates) once per spelling.
          const known = new Set((d.artist_names ?? []).map((a) => flatten(normalise(a))));
          const ai = paras.findIndex((p) => { const parts = p.split(/\s*[;,]\s*(?![^(]*\))/).map(flatten).filter(Boolean); return parts.length && parts.every((x) => known.has(x)); });
          const artistHit = ai >= 0 ? (paras.splice(ai, 1), true) : (d.artist_names ?? []).some((a) => take(a, 'html'));
          if ((d.artist_names ?? []).length) R.field('detail', 'artist', artistHit ? { verdict: 'same' } : { verdict: 'different', pkg: d.artist_names.join('; '), legacy: paras.join(' ⏎ ') }, dw);
          R.field('detail', 'description', glossaryNote(s, compare(paras.join('\n'), dtr.description, { legacyFrom: 'text' })), dw);
        } else if (it.type === 'monument') R.field('detail', 'heading', { verdict: 'missing-in-package', legacy: s.label }, where);
        else R.unmapped('page', `label "${s.label}"`, where);
        continue;
      }
      const pf = TERM[s.term];
      if (cfg.sh && (pf === 'alternate_name' || pf === 'second_name')) {
        // Sharing History: the package joins the second name and the original-language name.
        const names = page.sections.filter((x) => ['alternate_name', 'second_name'].includes(TERM[x.term])).map((x) => normalise(x.html));
        if (pf === 'alternate_name' || !page.sections.some((x) => TERM[x.term] === 'alternate_name')) {
          const r4 = compare(names.join('; '), tr.alternate_name, { legacyFrom: 'text' });
          if (names.length > 1 && ['same', 'format'].includes(r4.verdict)) r4.why = 'second name and original-language name joined in one field';
          R.field('item', 'alternate_name', r4, where);
        }
        seen.add('alternate_name');
        continue;
      }
      if (cfg.sh && pf === 'history') {
        // Sharing History monuments: the package appends History to the Description.
        const inDesc = tr.description && flatten(normalise(tr.description, { from: 'markdown' })).includes(flatten(normalise(s.html)));
        R.field('item', 'history', inDesc ? { verdict: 'format', why: 'History merged into the Description' } : compare(s.html, tr.history), where);
        continue;
      }
      if (cfg.sh && s.term === 'db_description') {
        const hist = page.sections.find((x) => TERM[x.term] === 'history');
        const merged = hist ? `${normalise(s.html)}\n${normalise(hist.html)}` : null;
        let r5 = compare(s.html, tr.description);
        if (r5.verdict === 'different' && merged && ['same', 'format'].includes(compare(merged, tr.description, { legacyFrom: 'text' }).verdict)) r5 = { ...r5, verdict: 'format', why: 'History merged into the Description' };
        R.field('item', 'description', glossaryNote(s, r5), where);
        seen.add('description');
        continue;
      }
      if (pf === 'location') {
        // The page prints location, province and then the country name.
        const r0 = compare(s.html, tr.location);
        const a = flatten(normalise(s.html));
        const b = flatten(normalise(tr.location, { from: 'markdown' }));
        if (r0.verdict === 'different' && b && a.startsWith(b + ',') && !a.slice(b.length + 1).includes(',')) { r0.verdict = 'format'; r0.why = 'page adds the country name'; }
        if (r0.verdict === 'missing-in-package' && !a.includes(',')) { r0.verdict = 'format'; r0.why = 'page prints only the country name'; }
        if (r0.verdict === 'different') {
          const a0 = normalise(s.html);
          const b0 = normalise(tr.location, { from: 'markdown' }).replace(/\.(?=,|$)/g, '');
          if (a0 === b0 || (a0.startsWith(b0 + ',') && !a0.slice(b0.length + 1).includes(','))) r0.why = 'package keeps a final period inside the location ("Mértola., Beja.")';
          else if (b0 && a0.includes(', ' + b0 + ',') && !a0.startsWith(b0)) r0.why = `monument address missing: legacy prints monuments.address first in this line; the package does not ship it ("${a0.slice(0, a0.indexOf(', ' + b0)).slice(0, 40)}…")`;
        }
        R.field('item', 'location', r0, where);
        seen.add('location');
      } else if (pf) {
        seen.add(pf);
        R.field('item', pf, glossaryNote(s, compare(s.html, tr[pf])), where);
      } else if (s.term === 'db_material' && tr.materials !== undefined) {
        // Sharing History keeps the materials line as text.
        R.field('item', 'materials', compare(s.html, tr.materials), where);
        seen.add('materials');
      } else if (s.term === 'db_material') {
        // This package keeps materials (and keywords) in the item's flat tag list.
        const want = splitList(normalise(s.html)).map(flatten);
        const have = new Set((it.tags ?? []).map((t) => flatten(normalise(t, { from: 'markdown' }))));
        const missing = want.filter((w) => !have.has(w));
        R.field('item', 'materials (in tags)', !missing.length ? { verdict: 'format', why: 'kept as tags' } : { verdict: missing.length === want.length ? 'missing-in-package' : 'different', legacy: normalise(s.html), pkg: (it.tags ?? []).join('; '), why: `${missing.length} of ${want.length} entries not in tags` }, where);
      } else if (s.term === 'db_description') {
        // ISL: long text + a short one behind a toggle. EPM: the short text is the description.
        const pkgDesc = tr.description ?? tr.short_description;
        const r1 = compare(s.html, pkgDesc);
        if (!tr.description && tr.short_description && r1.verdict === 'same') r1.why = 'EPM: short text shown as the description';
        R.field('item', 'description', glossaryNote(s, r1), where);
        seen.add('description');
      } else if (s.term === 'db_dynasty') {
        R.field('item', 'dynasty (free text)', compare(s.html, tr.dynasty ?? tr.period), where);
        seen.add('dynasty');
      } else if (s.term === 'db_artist' || s.term === 'db_author') {
        for (const f of ['artist', 'artist_birthdate', 'artist_birthplace', 'artist_deathdate', 'artist_deathplace']) seen.add(f);
        if (tr.artist !== undefined || cfg.sh) R.field('item', 'artist', artistWithLife(s.html, tr), where);
        else if (first) {
          // The page prints the artist's life data after the name: "Georg Petel (1601/2, Weilheim-1634/5, Augsburg)".
          // The whole line first: a name can hold a comma ("Jenig, clockmaker"). Then entry by entry, for another order.
          const byLine = compareArtistLine(s.html, it.artist_names, tr);
          let r3 = byLine.verdict === 'different' ? listCompare(s.html.replace(/,/g, ';'), it.artist_names, true) : byLine;
          let bare = normalise(s.html);
          // Drop the parenthesised groups that hold dates ("(1698 Unter Peissenberg – 1780(?) Baden)"), keep "(painter)".
          bare = bare.replace(/\s*\((?:[^()]|\([^()]*\))*\d(?:[^()]|\([^()]*\))*\)/g, '');
          if (r3.verdict === 'different' && [compareJoined(bare, it.artist_names), listCompare(bare.replace(/,/g, ';'), it.artist_names, true)].some((r) => /same|format/.test(r.verdict))) r3 = { ...r3, why: 'artist life data (birth/death) not in the package' };
          R.field('item', 'artist', r3, key);
        }
      } else if (s.term === 'db_museumnumberforobject' || s.term === 'db_invnumberforobject') {
        if (first) R.field('item', 'owner_reference', compare(s.html, it.owner_reference, { pkgFrom: 'html' }), key);
      } else R.unmapped('page', s.term, where);
    }
    for (const d of details) if (!detailsSeen.has(d.id) && (d.languages ?? []).includes(lang)) R.field('detail', 'heading', { verdict: 'extra-in-package', pkg: P.tr('items', lang, d.id)?.name ?? d.internal_name }, where);
    if (page.short !== null && page.short !== undefined) R.field('item', 'short_description', glossaryNote({ brokenGlossary: page.shortBroken }, compare(page.short, tr.short_description)), where);
    // Fields the package has for this language and the page does not show.
    for (const [k, v] of Object.entries(tr)) {
      if (seen.has(k) || ['short_description', 'author', 'copy_editor', 'translator', 'translation_copy_editor', 'keywords', 'linkcatalogs', 'type'].includes(k)) continue;
      if (v && !(Array.isArray(v) && !v.length)) R.field('item', k, { verdict: 'extra-in-package', pkg: Array.isArray(v) ? v.join('; ') : v }, where);
      pkgOnly[k] = (pkgOnly[k] ?? 0) + 1;
    }
    // Credits (names in the page's script; Arabic pages print the original spelling).
    const credits = {};
    for (const [term, names] of Object.entries(page.credits ?? {})) {
      const role = CREDIT(term);
      if (role) credits[role] = names.join(', ');
      if (term === 'db_workingnumber' && first) R.field('item', 'mwnf_reference', compare(names[0], it.mwnf_reference, { pkgFrom: 'html' }), key);
    }
    for (const role of ['author', 'copy_editor', 'translator', 'translation_copy_editor']) {
      const r2 = compare(credits[role], tr[role]);
      const names = (credits[role] ?? '').split(', ');
      if (r2.verdict === 'different' && lang === 'ar') r2.why = 'Arabic page prints the original spelling';
      else if (r2.verdict === 'extra-in-package' && lang === 'ar') r2.why = 'Arabic page omits a credit that has no Arabic spelling';
      else if (r2.verdict === 'different' && names.length > 1 && flatten(normalise(tr[role] ?? '', { from: 'markdown' })) === flatten(names[0])) r2.why = 'package keeps only the first of several names';
      if (r2.verdict === 'extra-in-package') creditExtra[role] = (creditExtra[role] ?? 0) + 1;
      if (credits[role]) creditShown[role] = (creditShown[role] ?? 0) + 1;
      R.field('item', role, r2, where);
    }
    // A page shows the pictures that have a caption row in its language; keep the most any page shows.
    legacyImages = Math.max(legacyImages, imageNumbers(r.body, id).length);
    first = false;
  }
  if (it && !first) {
    const n = legacyImages;
    R.field('item', 'image.count', n === it.images.length ? { verdict: n ? 'same' : 'both-empty' } : { verdict: n > it.images.length ? 'missing-in-package' : 'extra-in-package', legacy: String(n), pkg: String(it.images.length) }, key);
  }
}

// Sharing History prints "Name (birthdate, birthplace-deathdate, deathplace)"; the package keeps the parts.
function artistWithLife(html, tr) {
  const life = [[tr.artist_birthdate, tr.artist_birthplace].filter(Boolean).join(', '), [tr.artist_deathdate, tr.artist_deathplace].filter(Boolean).join(', ')];
  const composed = tr.artist && (life[0] || life[1]) ? `${tr.artist} (${life.join('-')})` : tr.artist;
  const r = compare(html, composed);
  return r.verdict === 'same' || r.verdict === 'format' ? { ...r, verdict: r.verdict, why: composed !== tr.artist ? 'name + life data from separate fields' : undefined } : r;
}

function glossaryNote(section, result) {
  if (section.brokenGlossary && ['same', 'format'].includes(result.verdict)) return { ...result, verdict: 'expected:legacy page prints broken glossary markup' };
  // A glossary term with an apostrophe (Shi'ite, mina'i) breaks legacy's javascript: link and the
  // word disappears from the page; the package keeps it.
  if (result.verdict === 'different' && !result.why) {
    const words = (s) => flatten(s).split(/\s+/);
    const a = words(result.legacy);
    const lost = words(result.pkg).filter((w) => /'/.test(w) && !a.includes(w));
    const strip = (s) => flatten(s).split(/\s+/).filter((w) => !lost.includes(w)).join(' ');
    if (lost.length && strip(result.pkg) === flatten(result.legacy)) return { ...result, verdict: 'expected:legacy glossary link drops a term with an apostrophe' };
  }
  return result;
}
R.note(`${shown} legacy pages with content; ${notShown} record × language pairs where legacy shows nothing.`);
if (Object.keys(pkgOnly).length) R.note(`Package fields present where the legacy page has no section: ${Object.entries(pkgOnly).map(([k, v]) => `${k} (${v})`).join(', ')}.`);

function listCompare(legacyHtml, pkg) {
  const base = compare(legacyHtml, pkg);
  if (base.verdict !== 'different' && base.verdict !== 'format') return base;
  const a = splitList(normalise(legacyHtml)).map(flatten);
  const b = (Array.isArray(pkg) ? pkg : splitList(pkg)).map((x) => flatten(normalise(x, { from: 'markdown' })));
  if (a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|')) return { ...base, verdict: 'format', why: 'same entries, other order' };
  if (a.flatMap((x) => x.split(/\s*,\s*/)).sort().join('|') === [...b].sort().join('|')) return { ...base, verdict: 'different', why: 'legacy entry split at its commas' };
  return base;
}

// A credit the legacy page never prints at all is a page choice, not a data gap.
for (const [role, n] of Object.entries(creditExtra)) {
  if (creditShown[role]) continue;
  const f = R.fields[`item.${role}`];
  delete f['extra-in-package'];
  f['expected:legacy page never prints this credit'] = n;
  delete R.samples[`item.${role}|extra-in-package`];
}
await checkImageUrls(P.root, R);
R.write(`${OUT}/${slug}`);
console.log(JSON.stringify({ shown, notShown, ...stats }));
