// node tools/jobs-static.mjs — the static pages of every site, legacy and new.
import { readFileSync, writeFileSync } from 'node:fs';
import { OUT } from './lib/paths.mjs';
const sites = JSON.parse(readFileSync(`${OUT}/sitemap.json`, 'utf8')).sites;
const jobs = [];
// The standalone sites' static pages that a new page rebuilds: legacy's page → the new route. The
// crawl from the legacy home records the pages it links to under the same key (static.mjs), so a
// pair here also covers a page the crawl misses.
const STANDALONE_PAGES = {
  islamicart: { 'isl_missionstatement.php': '/mission-statement', 'recommendedlinks.php': '/recommended-links' },
  baroqueart: { 'atrium_sponsor_detail.php?id=BAR&flg=local': '/sponsors' },
  sharinghistory: {
    'about.php': '/about',
    'about_team.php': '/about/team',
    'sponsor_detail.php?id=AWE': '/sponsors',
    'sponsor_detail_local.php?id=AWE': '/sponsors/local',
  },
};
// The page key static.mjs gives a crawled legacy page.
const pageKey = (href) => {
  const url = new URL(href);
  return url.pathname.split('/').pop().replace(/\.php$/, '') + (url.search ? '-' + url.searchParams.toString().replace(/[^a-z0-9]+/gi, '_') : '');
};
const pair = (s, page, legacyPath, newPath) => {
  if (legacyPath !== null && s.legacyUrl) jobs.push({ id: `${s.slug}--${page}--legacy`, url: legacyPath, slug: s.slug, page, side: 'legacy' });
  if (newPath !== null) jobs.push({ id: `${s.slug}--${page}--new`, url: newPath, slug: s.slug, page, side: 'new' });
};
for (const s of sites) {
  const L = (s.legacyUrl ?? '').replace(/\/$/, '');
  const N = `${s.newUrl}#`;
  if (s.kind === 'gallery') for (const p of ['about', 'credits', 'how-to-search']) pair(s, p, `${L}/${p}`, `${N}/${p}`);
  if (s.kind === 'exhibition') for (const p of ['about', 'credits', 'related']) pair(s, p, s.slug === 'the-hijaz-railway' ? null : `${L}/${p}`, `${N}/${p}`);
  if (s.slug === 'galleries') for (const p of ['about', 'credits']) pair(s, p, `${L}/${p}`, `${N}/${p}`);
  if (s.slug === 'explore') for (const p of ['about', 'credits', 'get-involved', 'important-information', 'new']) pair(s, p, `${L}/${p}`, `${N}/${p}`);
  if (['islamicart', 'baroqueart', 'sharinghistory'].includes(s.slug)) {
    // Legacy: the home page and the static pages it links to (crawled); new: the home page and
    // the pages that rebuild a legacy one.
    jobs.push({ id: `${s.slug}--home--legacy`, url: `${L}/index.php`, slug: s.slug, page: 'home', side: 'legacy', crawl: true });
    jobs.push({ id: `${s.slug}--home--new`, url: `${N}/`, slug: s.slug, page: 'home', side: 'new' });
    for (const [legacyPath, newPath] of Object.entries(STANDALONE_PAGES[s.slug] ?? {})) {
      const legacyUrl = `${L}/${legacyPath}`;
      pair(s, pageKey(legacyUrl), legacyUrl, `${N}${newPath}`);
    }
  } else {
    // Home pages carry the footer links.
    pair(s, 'home', s.legacyUrl, `${N}/`);
  }
}
writeFileSync(`${OUT}/jobs-static.json`, JSON.stringify(jobs, null, 1));
writeFileSync(`${OUT}/jobs-static-a.json`, JSON.stringify(jobs.filter((_, i) => i % 2 === 0)));
writeFileSync(`${OUT}/jobs-static-b.json`, JSON.stringify(jobs.filter((_, i) => i % 2 === 1)));
console.log(`${jobs.length} static jobs`);
