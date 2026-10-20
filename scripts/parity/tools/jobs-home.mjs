// node tools/jobs-home.mjs — capture jobs for the home page of every site, legacy and new.
import { readFileSync, writeFileSync } from 'node:fs';
import { OUT } from './lib/paths.mjs';
const sites = JSON.parse(readFileSync(`${OUT}/sitemap.json`, 'utf8')).sites;
const jobs = sites.flatMap((s) => [
  { id: `${s.slug}--home--legacy`, url: s.legacyUrl },
  { id: `${s.slug}--home--new`, url: s.newUrl },
]).filter((j) => j.url);
writeFileSync(`${OUT}/jobs-home.json`, JSON.stringify(jobs, null, 1));
console.log(`${jobs.length} jobs`);
