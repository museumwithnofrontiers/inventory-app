// node tools/compare-collections.mjs <islamicart|baroqueart|sharinghistory> — the exhibition
// structure (exhibitions → themes → pages/subthemes) and each one's item membership:
// legacy dump vs the package's collections.json. Writes out/<slug>/collections.md.
import { readFileSync, existsSync } from 'node:fs';
import { loadPackage } from './lib/pkg.mjs';
import { Report } from './lib/report.mjs';
import { readTable } from './lib/sqldump.mjs';
import { PHP_SITES } from './legacy-php.mjs';
import { LEGACY_DB, OUT } from './lib/paths.mjs';

const slug = process.argv[2];
const site = JSON.parse(readFileSync(`${OUT}/sitemap.json`, 'utf8')).sites.find((s) => s.slug === slug);
const cfg = PHP_SITES[slug];
const P = loadPackage(site.package, site.packageVersion);
const R = new Report(`${slug} — collections`, {
  legacy: 'mwnf3 / mwnf3_sharing_history dump (sets and memberships)',
  package: `${site.package}@${site.packageVersion}`,
});
const lc = (s) => String(s).toLowerCase();
const collections = P.read('collections.json');
const items = P.read('items.json');
const keyOf = new Map(items.map((i) => [i.id, i.backward_compatibility]));
const byKey = new Map(collections.map((c) => [lc(c.backward_compatibility), c]));
const members = (c) => new Set((c?.items ?? []).map((m) => keyOf.get(m.id)).filter(Boolean).map(norm));
// mwnf3:objects:ISL:tr:Mus01_A:1 and O;ISL;tr;1_A;1 → o;isl;tr;1_a;1
function norm(key) {
  let p = key.includes(';') ? key.split(';') : key.split(':').slice(1);
  if (!key.includes(';')) p = [p[0].replace(/^sh_/, '')[0], ...p.slice(1)];
  else p[0] = p[0][0];
  if (p.length === 5) p[3] = String(p[3]).toLowerCase().replace(/^(mus|mon|ins)/, '').replace(/^0+(?=\d)/, '');
  return p.map(lc).join(';');
}
const table = (db, t) => (existsSync(`${LEGACY_DB}/data/${db}_${t}.sql`) ? readTable(db, t) : []);

function level(name, legacyRows, idCol, keyPrefix, membership) {
  const keys = legacyRows.map((r) => lc(`${keyPrefix}:${r[idCol]}`));
  R.set(name, keys, [...byKey.keys()].filter((k) => k.startsWith(lc(keyPrefix) + ':') && /:\d+$/.test(k)));
  if (!membership) return;
  for (const r of legacyRows) {
    const k = lc(`${keyPrefix}:${r[idCol]}`);
    const c = byKey.get(k);
    if (!c) continue;
    const L = membership.get(String(r[idCol])) ?? new Set();
    const Pm = members(c);
    const missing = [...L].filter((x) => !Pm.has(x));
    const extra = [...Pm].filter((x) => !L.has(x));
    R.field('membership', name, !missing.length && !extra.length ? { verdict: L.size ? 'same' : 'both-empty' } : { verdict: missing.length ? 'missing-in-package' : 'extra-in-package', legacy: `${L.size} items; not in package: ${missing.slice(0, 5).join(' ')}`, pkg: `${Pm.size} items; not in legacy: ${extra.slice(0, 5).join(' ')}` }, k);
  }
}
const group = (rows, col, keyFn) => {
  const m = new Map();
  for (const r of rows) (m.get(String(r[col])) ?? m.set(String(r[col]), new Set()).get(String(r[col]))).add(keyFn(r));
  return m;
};

if (!cfg.sh) {
  for (const [kind, root] of [['exhibition', 'exhibitions'], ['artintro', 'artintros']]) {
    const tops = table('mwnf3', root).filter((r) => cfg.projects.includes(r.project_id));
    if (!tops.length) continue;
    const topIds = new Set(tops.map((r) => r[`${kind}_id`]));
    const themes = table('mwnf3', `${kind}_themes`).filter((r) => topIds.has(r[`${kind}_id`]));
    const themeIds = new Set(themes.map((r) => r.theme_id));
    const pages = table('mwnf3', `${kind}_pages`).filter((r) => themeIds.has(r.theme_id));
    const pageIds = new Set(pages.map((r) => r.page_id));
    const imgs = table('mwnf3', `${kind}_page_images`).filter((r) => pageIds.has(r.page_id) && r.ref_item);
    level(`${root}`, tops, `${kind}_id`, `mwnf3:${root}`);
    level(`${kind}_themes`, themes, 'theme_id', `mwnf3:${kind}_themes`);
    level(`${kind}_pages`, pages, 'page_id', `mwnf3:${kind}_pages`, group(imgs, 'page_id', (r) => norm(r.ref_item)));
    const hidden = tops.filter((r) => r.show && r.show !== 'y').map((r) => `${r[`${kind}_id`]} ${r.name}`);
    if (hidden.length) R.note(`${root} not shown on legacy (show ≠ y): ${hidden.join('; ')}`);
  }
} else {
  const db = 'mwnf3_sharing_history';
  const exh = table(db, 'sh_exhibitions').filter((r) => cfg.projects.includes(String(r.project_id).toUpperCase()));
  const exhIds = new Set(exh.map((r) => r.exhibition_id));
  const themes = table(db, 'sh_exhibition_themes').filter((r) => exhIds.has(r.exhibition_id));
  const themeIds = new Set(themes.map((r) => r.theme_id));
  const subs = table(db, 'sh_exhibition_subthemes').filter((r) => themeIds.has(r.theme_id));
  const rel = (lvl, col) => {
    const m = new Map();
    for (const t of ['objects', 'monuments']) {
      for (const r of table(db, `rel_${t}_${lvl}`)) {
        const k = norm(`mwnf3_sharing_history:sh_${t}:${r.project_id}:${r.country}:${r.number}`);
        (m.get(String(r[col])) ?? m.set(String(r[col]), new Set()).get(String(r[col]))).add(k);
      }
    }
    return m;
  };
  // Slideshow pictures name an item too ('project;country;number', item_type obj|mon); the importer
  // makes those items members of the collection as well.
  const slides = (t, col) => {
    const m = new Map();
    for (const r of table(db, t)) {
      if (!r.image_item) continue;
      const [p, c, n] = String(r.image_item).split(';');
      const k = norm(`mwnf3_sharing_history:sh_${r.item_type === 'mon' ? 'monuments' : 'objects'}:${p}:${c}:${n}`);
      (m.get(String(r[col])) ?? m.set(String(r[col]), new Set()).get(String(r[col]))).add(k);
    }
    return m;
  };
  const union = (a, b) => new Map([...new Set([...a.keys(), ...b.keys()])].map((k) => [k, new Set([...(a.get(k) ?? []), ...(b.get(k) ?? [])])]));
  const hiddenExh = new Set(exh.filter((r) => r.show && !['y', 'Y'].includes(r.show)).map((r) => r.exhibition_id));
  const shown = (rows, parentOk) => rows.filter(parentOk);
  const themeOk = (t) => !hiddenExh.has(t.exhibition_id);
  const shownThemes = new Set(themes.filter(themeOk).map((t) => t.theme_id));
  for (const [name, rows, col, lvl, img] of [
    ['sh_exhibitions', shown(exh, (r) => !hiddenExh.has(r.exhibition_id)), 'exhibition_id', 'exhibitions', 'sh_exhibition_images'],
    ['sh_exhibition_themes', shown(themes, themeOk), 'theme_id', 'themes', 'sh_exhibition_theme_images'],
    ['sh_exhibition_subthemes', shown(subs, (s) => shownThemes.has(s.theme_id)), 'subtheme_id', 'subthemes', 'sh_exhibition_subtheme_images'],
  ]) {
    const assigned = rel(lvl, col);
    level(`${name} (assigned items)`, rows, col, `mwnf3_sharing_history:${name}`, assigned);
    level(`${name} (assigned ∪ slideshow items)`, rows, col, `mwnf3_sharing_history:${name}`, union(assigned, slides(img, col)));
  }
  const hidden = exh.filter((r) => r.show && r.show !== 'y' && r.show !== 'Y').map((r) => `${r.exhibition_id} ${r.name} (show=${r.show})`);
  if (hidden.length) R.note(`exhibitions not shown on legacy: ${hidden.join('; ')}`);
}

R.write(`${OUT}/${slug}`, "collections");
console.log(`collections written for ${slug}`);
