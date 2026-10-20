// node tools/compare-dump-exh.mjs <slug> — a DXA exhibition compared through the dump, for the
// one whose legacy instance is closed to the public (the-hijaz-railway answers 403). Membership
// (the project's own records ∪ the gallery link tables), the theme tree, each theme's texts and
// curated pictures with their contextual texts. Run it on an open exhibition to calibrate.
import { readFileSync, existsSync } from 'node:fs';
import { loadPackage } from './lib/pkg.mjs';
import { Report } from './lib/report.mjs';
import { readTable } from './lib/sqldump.mjs';
import { compare } from './lib/text.mjs';
import { LEGACY_DB, OUT } from './lib/paths.mjs';

const slug = process.argv[2];
const site = JSON.parse(readFileSync(`${OUT}/sitemap.json`, 'utf8')).sites.find((s) => s.slug === slug);
const P = loadPackage(site.package, site.packageVersion);
const E = P.read('exhibition.json');
const gid = Number(E.backward_compatibility.split(':').pop());
const project = E.mwnf3_project_id;
const R = new Report(`${slug} — dump`, { legacy: `dump (gallery ${gid}, project ${project}); the live instance answers 403`, package: `${site.package}@${site.packageVersion}` });
const lc = (s) => String(s).toLowerCase();
const T = (db, t) => (existsSync(`${LEGACY_DB}/data/${db}_${t}.sql`) ? readTable(db, t) : []);
const tg = 'mwnf3_thematic_gallery';

// ---- membership
const keys = new Set();
for (const r of T('mwnf3', 'objects')) if (r.project_id === project) keys.add(lc(`mwnf3:objects:${r.project_id}:${r.country}:${r.museum_id}:${r.number}`));
for (const r of T('mwnf3', 'monuments')) if (r.project_id === project) keys.add(lc(`mwnf3:monuments:${r.project_id}:${r.country}:${r.institution_id}:${r.number}`));
const mine = (r) => Number(r.gallery_id) === gid;
for (const r of T(tg, 'thg_gallery_mwnf3_objects').filter(mine)) keys.add(lc(`mwnf3:objects:${r.objects_project_id}:${r.objects_country}:${r.objects_museum_id}:${r.objects_number}`));
for (const r of T(tg, 'thg_gallery_mwnf3_monuments').filter(mine)) keys.add(lc(`mwnf3:monuments:${r.monuments_project_id}:${r.monuments_country}:${r.monuments_institution_id}:${r.monuments_number}`));
for (const r of T(tg, 'thg_gallery_sh_objects').filter(mine)) keys.add(lc(`mwnf3_sharing_history:sh_objects:${r.sh_objects_project_id}:${r.sh_objects_country}:${r.sh_objects_number}`));
for (const r of T(tg, 'thg_gallery_sh_monuments').filter(mine)) keys.add(lc(`mwnf3_sharing_history:sh_monuments:${r.sh_monuments_project_id}:${r.sh_monuments_country}:${r.sh_monuments_number}`));
for (const r of T(tg, 'thg_gallery_explore_monuments').filter(mine)) keys.add(lc(`mwnf3_explore:monument:${r.item_id}`));
const travel = T(tg, 'thg_gallery_travel_monuments').filter(mine).length;
const items = P.read('items.json');
const pkgKeys = items.map((i) => lc(i.backward_compatibility));
const nonTravel = pkgKeys.filter((k) => !k.startsWith('mwnf3_travels'));
R.set('items (dump membership, Travels excluded)', [...keys], nonTravel);
R.field('membership', 'Travels monuments (count only)', travel === pkgKeys.length - nonTravel.length ? { verdict: travel ? 'same' : 'both-empty' } : { verdict: 'different', legacy: String(travel), pkg: String(pkgKeys.length - nonTravel.length) }, 'travel');

// ---- themes
const themes = T(tg, 'theme').filter(mine);
const flat = P.read('themes.json').flatMap((t) => [t, ...(t.sub_themes ?? [])]);
const byKey = new Map(flat.map((t) => [t.backward_compatibility, t]));
R.set('themes (top level)', themes.filter((t) => t.parent_theme_id === null).map((t) => `mwnf3_thematic_gallery:theme:${gid}:${t.theme_id}`), P.read('themes.json').map((t) => t.backward_compatibility));
R.set('sub-themes', themes.filter((t) => t.parent_theme_id !== null).map((t) => `mwnf3_thematic_gallery:theme:${gid}:${t.theme_id}`), P.read('themes.json').flatMap((t) => (t.sub_themes ?? []).map((x) => x.backward_compatibility)));
const ttr = (lang, id) => P.translations.themes?.[lang]?.[id] ?? {};
for (const r of T(tg, 'theme_i18n').filter(mine)) {
  const p = byKey.get(`mwnf3_thematic_gallery:theme:${gid}:${r.theme_id}`);
  if (!p) continue;
  const t = ttr(r.language_id, p.id);
  for (const f of ['title', 'quote', 'presentation']) R.field('theme', f, compare(r[f], t[f]), `theme ${r.theme_id}|${r.language_id}`);
}
const pics = new Map();
for (const r of T(tg, 'theme_item').filter(mine)) pics.set(r.theme_id, (pics.get(r.theme_id) ?? 0) + 1);
for (const t of themes) {
  const p = byKey.get(`mwnf3_thematic_gallery:theme:${gid}:${t.theme_id}`);
  if (!p) continue;
  const n = pics.get(t.theme_id) ?? 0;
  R.field('theme', 'picture count', n === (p.pictures ?? []).length ? { verdict: n ? 'same' : 'both-empty' } : { verdict: n > (p.pictures ?? []).length ? 'missing-in-package' : 'extra-in-package', legacy: String(n), pkg: String((p.pictures ?? []).length) }, `theme ${t.theme_id}`);
}
const ctx = T(tg, 'theme_item_i18n').filter(mine);
const pkgCtx = new Set(Object.entries(P.translations.themes ?? {}).flatMap(([lang, m]) => Object.entries(m).filter(([k, v]) => k.includes('/') && v.contextual_description).map(([k]) => `${lang}|${k}`)));
R.field('theme', 'contextual descriptions (count)', { verdict: ctx.filter((r) => r.contextual_description).length === pkgCtx.size ? 'same' : 'different', legacy: String(ctx.filter((r) => r.contextual_description).length), pkg: String(pkgCtx.size) }, 'all themes');
R.write(`${OUT}/${slug}`, 'dump');
console.log(`${slug}: dump membership ${keys.size}, package ${pkgKeys.length}`);
