// node tools/compare-partners-php.mjs <islamicart|baroqueart|sharinghistory> — the partners the
// legacy records point at (holding museum / responsible institution / SH partner) vs the
// package's partners.json, with names, cities and descriptions per language from the dump.
import { readFileSync } from 'node:fs';
import { loadPackage } from './lib/pkg.mjs';
import { Report } from './lib/report.mjs';
import { readTable } from './lib/sqldump.mjs';
import { compare } from './lib/text.mjs';
import { PHP_SITES } from './legacy-php.mjs';
import { OUT } from './lib/paths.mjs';

const slug = process.argv[2];
const site = JSON.parse(readFileSync(`${OUT}/sitemap.json`, 'utf8')).sites.find((s) => s.slug === slug);
const cfg = PHP_SITES[slug];
const P = loadPackage(site.package, site.packageVersion);
const R = new Report(`${slug} — partners`, { legacy: 'dump: partners referenced by the site\'s records, and their per-language texts', package: `${site.package}@${site.packageVersion}` });
const lc = (s) => String(s).toLowerCase();
const partners = P.read('partners.json');
const byKey = new Map(partners.map((p) => [lc(p.backward_compatibility), p]));

const legacy = new Map(); // key → { texts: lang → {name, city, description} }
if (!cfg.sh) {
  const used = new Set();
  for (const r of readTable('mwnf3', 'objects')) if (cfg.projects.includes(r.project_id)) used.add(lc(`mwnf3:museums:${r.museum_id}:${r.country}`));
  for (const r of readTable('mwnf3', 'monuments')) if (cfg.projects.includes(r.project_id)) used.add(lc(`mwnf3:institutions:${r.institution_id}:${r.country}`));
  for (const r of readTable('mwnf3', 'museumnames')) { const k = lc(`mwnf3:museums:${r.museum_id}:${r.country}`); if (used.has(k)) ((legacy.get(k) ?? legacy.set(k, {}).get(k))[r.lang] = r); }
  for (const r of readTable('mwnf3', 'institutionnames')) { const k = lc(`mwnf3:institutions:${r.institution_id}:${r.country}`); if (used.has(k)) ((legacy.get(k) ?? legacy.set(k, {}).get(k))[r.lang] = r); }
  for (const k of used) if (!legacy.has(k)) legacy.set(k, {});
} else {
  const used = new Set(readTable('mwnf3_sharing_history', 'sh_objects').map((r) => r.partners_id).filter(Boolean).map((id) => lc(`mwnf3_sharing_history:sh_partners:${id}`)));
  for (const r of readTable('mwnf3_sharing_history', 'sh_monuments')) if (r.partners_id) used.add(lc(`mwnf3_sharing_history:sh_partners:${r.partners_id}`));
  for (const r of readTable('mwnf3_sharing_history', 'sh_partner_names')) { const k = lc(`mwnf3_sharing_history:sh_partners:${r.partners_id}`); if (used.has(k)) ((legacy.get(k) ?? legacy.set(k, {}).get(k))[r.lang] = r); }
  for (const k of used) if (!legacy.has(k)) legacy.set(k, {});
}

// A record can point at a museum/institution id that has no row of its own (e.g. monuments' Mon01
// group code): legacy shows no partner page for it either.
const ghosts = [...legacy.entries()].filter(([, t]) => !Object.keys(t).length).map(([k]) => k);
for (const k of ghosts) legacy.delete(k);
if (ghosts.length) R.note(`Referenced by records but with no partner row in legacy (no partner page there either): ${ghosts.join(', ')}.`);
const { onlyLegacy } = R.set('partners referenced by records', [...legacy.keys()], [...byKey.keys()].filter((k) => k.startsWith(cfg.sh ? 'mwnf3_sharing_history:sh_partners' : 'mwnf3:')));
R.note('"Only package" partners are expected when the site also lists partners without records (project partners, associated institutions).');
for (const [k, texts] of legacy) {
  const p = byKey.get(k);
  if (!p) continue;
  for (const [lang, t] of Object.entries(texts)) {
    const tr = P.tr('partners', lang, p.id);
    if (!tr) { R.field('partner', 'language', { verdict: 'missing-in-package', legacy: lang }, `${k}|${lang}`); continue; }
    for (const f of ['name', 'city', 'description']) if (t[f] !== undefined) R.field('partner', f, compare(t[f], tr[f]), `${k}|${lang}`);
  }
}
// Items whose partner_id names a partner the package does not ship. The package ships the
// partners legacy lists, and the set above reports any it lists and the package lacks; an item
// may still point to an institution legacy lists nowhere and links from no page (checked on
// 2026-10-22 for Islamic Art and Baroque Art), which legacy does not show either.
const DANGLING = 'expected:partner legacy lists nowhere';
const ids = new Set(partners.map((p) => p.id));
const dangling = P.read('items.json').filter((i) => i.partner_id && !ids.has(i.partner_id));
R.fields['package.item partner_id resolves'] = { same: P.read('items.json').filter((i) => i.partner_id).length - dangling.length, ...(dangling.length ? { [DANGLING]: dangling.length } : {}) };
if (dangling.length) R.samples[`package.item partner_id resolves|${DANGLING}`] = dangling.slice(0, 10).map((i) => ({ where: i.backward_compatibility, pkg: `partner_id ${i.partner_id} not in partners.json` }));
R.write(`${OUT}/${slug}`, 'partners');
console.log(`partners: legacy ${legacy.size}, missing in package ${onlyLegacy.length}`);
