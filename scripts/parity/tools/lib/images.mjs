// Every image a package ships must be a /pub/<uuid>.<ext> URL (the stable public route);
// anything else is a path that the inventory does not serve.
// This is the report field the baselines count; check-packages.mjs (lib/gates.mjs) runs the
// wider package gate, which also covers non-`url` keys and URLs without an image extension.
import { readFileSync, readdirSync } from 'node:fs';
import { get } from './http.mjs';
import { GOOD_IMAGE_URL as GOOD } from './gates.mjs';

// Legacy's image host: the full-size file at the path a picture row keeps.
const LEGACY_IMAGES = 'https://images.museumwnf.org/full';

export async function checkImageUrls(root, report) {
  const bad = [];
  let total = 0;
  for (const f of readdirSync(root).filter((f) => f.endsWith('.json'))) {
    const s = readFileSync(`${root}/${f}`, 'utf8');
    for (const m of s.matchAll(/"url":"([^"]+\.(?:jpe?g|png|gif|webp|svg))"/gi)) {
      total++;
      if (!GOOD.test(m[1])) bad.push(`${f}: ${m[1]}`);
    }
  }
  const statuses = {};
  for (const b of bad.slice(0, 20)) {
    const url = b.slice(b.indexOf(': ') + 2);
    const status = /^https?:\/\//.test(url) ? (await get(url)).status : 'not a URL';
    statuses[status] = (statuses[status] ?? 0) + 1;
  }
  // The import keeps a picture row whose file legacy is missing too, under its legacy path
  // (decision 2026-10-24: the row stays, broken, as it is on legacy). Legacy's image host
  // answers 404 for that path as well, so the URL is expected; any other is a difference.
  const missingOnLegacy = [];
  const different = [];
  for (const b of bad) {
    const path = b.slice(b.indexOf(': ') + 2).match(/\/pub\/(.+)$/)?.[1];
    if (path && (await get(`${LEGACY_IMAGES}/${path}`)).status === 404) missingOnLegacy.push(b);
    else different.push(b);
  }
  const expected = 'expected:file missing on legacy too';
  report.fields['package.image URL is /pub/<uuid>'] = { same: total - bad.length, different: different.length, ...(missingOnLegacy.length ? { [expected]: missingOnLegacy.length } : {}) };
  for (const b of different.slice(0, 8)) (report.samples['package.image URL is /pub/<uuid>|different'] ??= []).push({ where: b.split(': ')[0], pkg: b.split(': ')[1] });
  for (const b of missingOnLegacy.slice(0, 8)) (report.samples[`package.image URL is /pub/<uuid>|${expected}`] ??= []).push({ where: b.split(': ')[0], pkg: b.split(': ')[1] });
  if (bad.length) report.note(`${bad.length} of ${total} package image URLs are not /pub/<uuid> files, ${missingOnLegacy.length} of them missing on legacy too; HTTP status of the first ${Math.min(20, bad.length)}: ${JSON.stringify(statuses)}.`);
}
