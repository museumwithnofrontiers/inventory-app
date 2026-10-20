// node tools/jobs-assets.mjs — pages to inventory: every site's home, every gallery's and
// exhibition's about page (inner banner and chrome), and the standalone sites' page types.
import { readFileSync, writeFileSync } from 'node:fs';
import { OUT } from './lib/paths.mjs';
const sites = JSON.parse(readFileSync(`${OUT}/sitemap.json`, 'utf8')).sites;
const pages = JSON.parse(readFileSync(`${OUT}/jobs-pages.json`, 'utf8'));
const jobs = [];
for (const s of sites) {
  if (!s.legacyUrl) continue;
  jobs.push({ id: `${s.slug}--home--legacy`, url: s.legacyUrl, slug: s.slug, page: 'home', side: 'legacy' });
  jobs.push({ id: `${s.slug}--home--new`, url: s.newUrl, slug: s.slug, page: 'home', side: 'new' });
  if (s.kind === 'gallery' || s.kind === 'exhibition') {
    jobs.push({ id: `${s.slug}--about--legacy`, url: `${s.legacyUrl.replace(/\/$/, '')}/about`, slug: s.slug, page: 'about', side: 'legacy' });
    jobs.push({ id: `${s.slug}--about--new`, url: `${s.newUrl}#/about`, slug: s.slug, page: 'about', side: 'new' });
  }
}
const standalone = new Set(sites.filter((s) => s.kind === 'standalone').map((s) => s.slug));
for (const j of pages) if (standalone.has(j.slug)) jobs.push({ ...j, side: j.id.endsWith('--legacy') ? 'legacy' : 'new' });
writeFileSync(`${OUT}/jobs-assets.json`, JSON.stringify(jobs, null, 1));
// Two halves, for two browsers in parallel.
writeFileSync(`${OUT}/jobs-assets-a.json`, JSON.stringify(jobs.filter((_, i) => i % 2 === 0)));
writeFileSync(`${OUT}/jobs-assets-b.json`, JSON.stringify(jobs.filter((_, i) => i % 2 === 1)));
console.log(`${jobs.length} asset jobs`);
