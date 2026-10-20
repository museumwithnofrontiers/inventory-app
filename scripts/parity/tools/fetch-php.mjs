// node tools/fetch-php.mjs <islamicart|baroqueart> — warm the cache with every legacy page of
// every record × language that the dump or the package knows.
import { readFileSync } from 'node:fs';
import { get, mapAll, stats } from './lib/http.mjs';
import { loadPackage } from './lib/pkg.mjs';
import { PHP_SITES, idFromKey, labelIndex, legacyRecords, pageUrl, parsePage } from './legacy-php.mjs';
import { OUT } from './lib/paths.mjs';

const slug = process.argv[2];
const site = JSON.parse(readFileSync(`${OUT}/sitemap.json`, 'utf8')).sites.find((s) => s.slug === slug);
const cfg = PHP_SITES[slug];
const P = loadPackage(site.package, site.packageVersion);
const items = P.read('items.json').filter((i) => i.type === 'object' || i.type === 'monument');
const pkgByKey = new Map(items.map((i) => [i.backward_compatibility, i]));
const legacy = legacyRecords(cfg);

const jobs = [];
for (const key of new Set([...legacy.keys(), ...pkgByKey.keys()])) {
  const rec = legacy.get(key);
  const id = rec?.id ?? idFromKey(key);
  for (const lang of new Set([...(rec?.langs ?? []), ...(pkgByKey.get(key)?.languages ?? [])])) jobs.push({ id, lang });
}
console.log(JSON.stringify({ slug, legacyRecords: legacy.size, packageRecords: pkgByKey.size, pages: jobs.length }));
const labels = labelIndex(cfg);
const t = Date.now();
const res = await mapAll(jobs, async (j) => {
  const r = await get(pageUrl(cfg.host, j.id, j.lang));
  const p = r.status === 200 ? parsePage(r.body, j.lang, labels) : { empty: true, sections: [] };
  return { empty: p.empty, unknown: p.sections.filter((s) => !s.term).map((s) => s.label) };
});
console.log(JSON.stringify({ pages: res.length, empty: res.filter((r) => r.empty).length, unknownHeadings: res.reduce((n, r) => n + r.unknown.length, 0), ...stats, seconds: Math.round((Date.now() - t) / 1000) }));
