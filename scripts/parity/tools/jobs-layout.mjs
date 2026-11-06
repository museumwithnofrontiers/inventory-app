// node tools/jobs-layout.mjs — the pages the `layout` pass opens: every page type of every DXA
// exhibition, at the three widths legacy was reviewed at (#2379). New sites only: the rules need
// no legacy page. Writes out/jobs-layout.json: [{ id, url, slug, page, width, open? }].
import { readFileSync, writeFileSync } from 'node:fs';
import { loadPackage } from './lib/pkg.mjs';
import { OUT } from './lib/paths.mjs';

export const WIDTHS = [1920, 1366, 390];

const sites = JSON.parse(readFileSync(`${OUT}/sitemap.json`, 'utf8')).sites
  .filter((s) => s.kind === 'exhibition' && s.newUrl && s.packageVersion);
const jobs = [];
for (const s of sites) {
  const P = loadPackage(s.package, s.packageVersion);
  const items = P.read('items.json') ?? [];
  const item = items.find((i) => (i.images?.length ?? 0) > 1) ?? items[0];
  const hidden = new Set(P.read('exhibition.json')?.hidden_partner_ids ?? []);
  const partner = (P.read('partners.json') ?? []).find((p) => !hidden.has(p.id));
  const pages = [
    ['home', ''],
    ['about', 'about'],
    // `open`: the themes page is judged with every theme opened, as Pascal read it.
    ['themes', 'themes', 'themes'],
    ['theme', 'theme/1/1'],
    ['theme-gallery', 'theme-gallery/1'],
    ['collection', 'collection'],
    ['partners', 'partners'],
    ['related', 'related'],
    ['credits', 'credits'],
    ['timeline', 'timeline'],
    ...(item ? [['item', `item/${item.id}`]] : []),
    ...(partner ? [['partner', `partner/${partner.id}`]] : []),
  ];
  for (const width of WIDTHS) {
    for (const [page, path, open] of pages) {
      jobs.push({ id: `${s.slug}--${page}--${width}`, url: `${s.newUrl}#/${path}`, slug: s.slug, page, width, ...(open ? { open } : {}) });
    }
  }
}
writeFileSync(`${OUT}/jobs-layout.json`, JSON.stringify(jobs, null, 1));
console.log(`${jobs.length} layout jobs on ${sites.length} exhibitions`);
