// node tools/jobs-links.mjs — the new pages the links pass reads (inventory-app#2482): the new
// side of the style pass's jobs (every site's home, each page type of the representative sites)
// and of the static pass's (each site's static pages), once each.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { OUT } from './lib/paths.mjs';

const read = (file) => (existsSync(`${OUT}/${file}`) ? JSON.parse(readFileSync(`${OUT}/${file}`, 'utf8')) : []);
const seen = new Set();
const jobs = [];
for (const job of [...read('jobs-home.json'), ...read('jobs-pages.json'), ...read('jobs-static.json')]) {
  if (!job.id.endsWith('--new') || !job.url || seen.has(job.url)) continue;
  seen.add(job.url);
  jobs.push({ id: job.id, url: job.url, slug: job.slug ?? job.id.split('--')[0], page: job.page ?? job.id.split('--')[1] });
}
writeFileSync(`${OUT}/jobs-links.json`, JSON.stringify(jobs, null, 1));
console.log(`${jobs.length} jobs`);
