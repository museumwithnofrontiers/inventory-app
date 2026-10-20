// Site map: every legacy site ↔ its new site, package and status.
//   legacy roster : mwnf3_thematic_gallery.thg_gallery (+ _url, _lang) from the dumps,
//                   plus the standalone sites named in dxa-client's .env files
//   new roster    : scripts/exporters/instances/*.json, joined with the live sites.json
//   checks        : package on npm (version, date), gallery.json's legacy key, both URLs answer
// Writes out/sitemap.json and out/sitemap.md.
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { get, getJson, mapAll } from './lib/http.mjs';
import { readTable } from './lib/sqldump.mjs';

import { LEGACY_CODE, OUT } from './lib/paths.mjs';
import { SOURCE, instances, isLocal, localRoot } from './lib/pkg.mjs';
mkdirSync(OUT, { recursive: true });
const refresh = process.argv.includes('--refresh');

// ---- legacy roster
const db = 'mwnf3_thematic_gallery';
const galleries = readTable(db, 'thg_gallery');
const urls = new Map(readTable(db, 'thg_gallery_url').map((r) => [r.gallery_id, r.link]));
const langs = new Map();
for (const r of readTable(db, 'thg_gallery_lang')) (langs.get(r.gallery_id) ?? langs.set(r.gallery_id, []).get(r.gallery_id)).push(r.lang_id ?? r.lang);
const thgProjects = new Map(readTable(db, 'thg_projects').map((r) => [r.project_id, r]));

// dxa-client per-site .env: legacy client code ↔ mwnf3 project
const envDir = `${LEGACY_CODE}/dxa-client/environment`;
const clientByProject = new Map();
for (const f of readdirSync(envDir).filter((f) => f.startsWith('.env.'))) {
  const env = Object.fromEntries(readFileSync(`${envDir}/${f}`, 'utf8').split(/\r?\n/).filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')]));
  if (env.VUE_APP_DXA) clientByProject.set(env.VUE_APP_DXA, { code: f.slice(5), endpoint: env.VUE_APP_DXA_ENDPOINT, name: env.VUE_APP_DXA_FULL });
}
const anyEnv = readFileSync(`${envDir}/.env.dca`, 'utf8');
const envUrl = (k) => anyEnv.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1].trim();

const legacy = galleries
  .filter((g) => g.parent_gallery_id === null)
  .map((g) => ({
    legacyKey: `mwnf3_thematic_gallery:thg_gallery:${g.gallery_id}`,
    galleryId: g.gallery_id,
    thgProject: g.project_id,
    thgProjectName: thgProjects.get(g.project_id)?.name ?? null,
    mwnf3Project: g.mwnf3_project_id,
    name: g.name,
    link: g.link,
    status: g.status,
    // Exhibitions share one host; each lives under its link (see the validation notes).
    legacyUrl: g.project_id === 'EXH' && urls.get(g.gallery_id) ? `${urls.get(g.gallery_id)}/${encodeURIComponent(g.link)}/en/` : urls.get(g.gallery_id) ?? null,
    languages: langs.get(g.gallery_id) ?? [],
    client: clientByProject.get(g.mwnf3_project_id)?.code ?? null,
  }));
const standaloneLegacy = {
  islamicart: envUrl('VUE_APP_ISLAMIC_ART_URL'),
  baroqueart: envUrl('VUE_APP_BAROQUE_ART_URL'),
  sharinghistory: envUrl('VUE_APP_SHARING_HISTORY_URL'),
  galleries: envUrl('VUE_APP_GALLERIES_URL'),
  explore: 'https://explore.museumwnf.org',
};

// ---- new roster
// npm is always asked afresh: a cached registry answer once made a whole run compare the
// previous release without saying so. Legacy home pages are re-read only with --refresh.
const live = await getJson('https://raw.githubusercontent.com/museumwithnofrontiers/museumwithnofrontiers.github.io/main/sites.json', { refresh: true });
const siteBySlug = new Map((live.json?.sites ?? []).map((s) => [s.slug, s]));

const rows = await mapAll(instances(), async (inst) => {
  const pkg = inst.package_name;
  const reg = await getJson(`https://registry.npmjs.org/${pkg}`, { refresh: true });
  const latest = reg.json?.['dist-tags']?.latest ?? null;
  const published = latest ? reg.json.time?.[latest] : null;
  // Local mode compares the export on disk; its gallery.json names the legacy gallery.
  const local = isLocal ? localRoot(pkg) : null;
  let galleryKey = null;
  if (inst.kind === 'gallery' || inst.kind === 'exhibition') {
    if (local) galleryKey = JSON.parse(readFileSync(`${local}/${inst.kind}.json`, 'utf8')).backward_compatibility ?? null;
    else if (latest) galleryKey = (await getJson(`https://cdn.jsdelivr.net/npm/${pkg}@${latest}/${inst.kind}.json`)).json?.backward_compatibility ?? null;
  }
  const site = siteBySlug.get(inst.slug);
  const newUrl = site?.url ?? `https://museumwithnofrontiers.github.io/${inst.slug}/`;
  const newStatus = (await get(newUrl, { refresh: true })).status;
  const leg = galleryKey ? legacy.find((l) => l.legacyKey === galleryKey) : null;
  const legacyUrl = leg?.legacyUrl ?? standaloneLegacy[inst.slug] ?? null;
  const legacyStatus = legacyUrl ? (await get(legacyUrl, { refresh })).status : null;
  return {
    slug: inst.slug,
    kind: inst.kind,
    title: inst.name,
    newUrl,
    newStatus,
    listedOnOrgSite: Boolean(site),
    package: pkg,
    // The version the comparison reads: npm latest, or "local" for an export on disk.
    packageVersion: isLocal ? (local ? 'local' : null) : latest,
    packagePublished: isLocal ? (local ? statSync(`${local}/manifest.json`).mtime.toISOString() : null) : published,
    packageSource: isLocal ? local : 'npm',
    npmLatest: latest,
    legacyKey: galleryKey,
    legacyName: leg?.name ?? null,
    legacyStatus: leg?.status ?? null,
    mwnf3Project: leg?.mwnf3Project ?? null,
    legacyClient: leg?.client ?? null,
    legacyUrl,
    legacyHttp: legacyStatus,
  };
});

const mapped = new Set(rows.map((r) => r.legacyKey).filter(Boolean));
const unmatchedLegacy = legacy.filter((l) => !mapped.has(l.legacyKey));

writeFileSync(`${OUT}/sitemap.json`, JSON.stringify({ generatedAt: new Date().toISOString(), packages: SOURCE, sites: rows, unmatchedLegacy }, null, 2));

const md = [
  `# Site map — ${new Date().toISOString().slice(0, 10)}`,
  '',
  `${rows.length} new sites (exporter instances); ${legacy.length} top-level legacy THG galleries/exhibitions in the dump; ${unmatchedLegacy.length} of them with no new site.`,
  '',
  '| Site | Kind | Legacy | Legacy key | mwnf3 project | Legacy HTTP | New HTTP | On org site | Package | Published |',
  '|---|---|---|---|---|---|---|---|---|---|',
  ...rows
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.slug.localeCompare(b.slug))
    .map((r) => `| ${r.slug} | ${r.kind} | ${r.legacyUrl ?? '—'} | ${r.legacyKey?.split(':').pop() ?? '—'}${r.legacyStatus === 'H' ? ' (hidden)' : ''} | ${r.mwnf3Project ?? '—'} | ${r.legacyHttp ?? '—'} | ${r.newStatus} | ${r.listedOnOrgSite ? 'yes' : 'no'} | ${r.packageVersion ?? 'MISSING'} | ${r.packagePublished?.slice(0, 10) ?? '—'} |`),
  '',
  '## Legacy THG entries with no new site',
  '',
  '| id | name | link | status | THG project | mwnf3 project | URL |',
  '|---|---|---|---|---|---|---|',
  ...unmatchedLegacy.map((l) => `| ${l.galleryId} | ${l.name} | ${l.link ?? ''} | ${l.status} | ${l.thgProject ?? ''} ${l.thgProjectName ? '(' + l.thgProjectName + ')' : ''} | ${l.mwnf3Project ?? ''} | ${l.legacyUrl ?? ''} |`),
];
writeFileSync(`${OUT}/sitemap.md`, md.join('\n') + '\n');
console.log(md.slice(0, 4).join('\n'));
console.log(`unmatched legacy: ${unmatchedLegacy.map((l) => `${l.galleryId}:${l.link ?? l.name}(${l.status})`).join(', ')}`);
// A site with no package to compare is a hole in the run, not a detail: say so and fail.
const onlyArg = process.argv.indexOf('--only');
const only = onlyArg > 0 ? process.argv[onlyArg + 1].split(',') : null;
const missing = rows.filter((r) => !r.packageVersion && (!only || only.includes(r.slug))).map((r) => r.slug);
if (missing.length) {
  console.error(`no ${isLocal ? 'local export' : 'npm version'} for: ${missing.join(', ')}`);
  process.exitCode = 1;
}
