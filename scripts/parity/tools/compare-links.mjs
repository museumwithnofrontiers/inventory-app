// node tools/compare-links.mjs [<jobs.json>] — the links pass's judgement (inventory-app#2482):
// every link of the new pages links.mjs read, by tools/lib/links.mjs. Writes out/links.json and
// out/links.md: the links that still go to a site with a new address (the gate: exit 1 when
// there is one), those kept on purpose (links-allow.json), and those to legacy pages that have no
// new site. Exit 2 when a page could not be read: it proves nothing either way.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { LINKS, OUT, TOOLS } from './lib/paths.mjs';
import { judge, portedTargets } from './lib/links.mjs';

const jobsFile = process.argv[2] ?? `${OUT}/jobs-links-run.json`;
const jobs = JSON.parse(readFileSync(existsSync(jobsFile) ? jobsFile : `${OUT}/jobs-links.json`, 'utf8'));
const sites = JSON.parse(readFileSync(`${OUT}/sitemap.json`, 'utf8')).sites;
const allowFile = `${TOOLS}/links-allow.json`;
const allow = existsSync(allowFile) ? JSON.parse(readFileSync(allowFile, 'utf8')) : [];
const targets = portedTargets(sites);

const groups = { ported: new Map(), allowed: new Map(), legacy: new Map() };
const failed = [];
let read = 0;
let anchors = 0;
for (const job of jobs) {
  const file = `${LINKS}/${job.id}.json`;
  if (!existsSync(file)) {
    failed.push(`${job.id}: not read`);
    continue;
  }
  const page = JSON.parse(readFileSync(file, 'utf8'));
  if (page.error) {
    failed.push(`${job.id}: ${page.error}`);
    continue;
  }
  read++;
  for (const a of page.anchors ?? []) {
    anchors++;
    const verdict = judge(a.href, targets, allow);
    if (!verdict.kind) continue;
    const key = `${a.text}\u0000${a.href}`;
    const group = groups[verdict.kind];
    if (!group.has(key)) group.set(key, { text: a.text, href: a.href, in: a.in, target: verdict.target?.slug ?? null, newUrl: verdict.target?.newUrl ?? null, reason: verdict.reason ?? null, pages: [] });
    group.get(key).pages.push(`${job.slug}/${job.page}`);
  }
}

const list = (kind) => [...groups[kind].values()].sort((a, b) => b.pages.length - a.pages.length || a.href.localeCompare(b.href));
const report = { pages: jobs.length, read, failed, anchors, ported: list('ported'), allowed: list('allowed'), legacy: list('legacy') };
writeFileSync(`${OUT}/links.json`, JSON.stringify(report, null, 1));

// A table cell: its backslashes first, then the pipes that would end it.
const cell = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
const pages = (p) => `${p.length}: ${[...new Set(p)].slice(0, 4).join(', ')}${p.length > 4 ? ', …' : ''}`;
const md = [
  '# Links to legacy',
  '',
  `${read} of ${jobs.length} new pages read, ${anchors} links. To a site with a new address: **${report.ported.length}** (the gate); kept on purpose: ${report.allowed.length}; to legacy pages with no new site: ${report.legacy.length}.`,
  '',
  '## To a site with a new address',
  '',
  '| link | address | where | new site | pages |',
  '|---|---|---|---|---|',
  ...report.ported.map((l) => `| ${cell(l.text)} | ${cell(l.href)} | ${l.in ?? ''} | ${l.target} | ${pages(l.pages)} |`),
  '',
  '## Kept on purpose',
  '',
  '| link | address | why | pages |',
  '|---|---|---|---|',
  ...report.allowed.map((l) => `| ${cell(l.text)} | ${cell(l.href)} | ${cell(l.reason)} | ${pages(l.pages)} |`),
  '',
  '## To legacy pages with no new site',
  '',
  '| link | address | where | pages |',
  '|---|---|---|---|',
  ...report.legacy.map((l) => `| ${cell(l.text)} | ${cell(l.href)} | ${l.in ?? ''} | ${pages(l.pages)} |`),
  ...(failed.length ? ['', '## Pages not read', '', ...failed.map((f) => `- ${f}`)] : []),
  '',
];
writeFileSync(`${OUT}/links.md`, md.join('\n'));
console.log(`links: ${report.ported.length} to a site with a new address, ${report.allowed.length} kept, ${report.legacy.length} to unported legacy pages; ${failed.length} pages not read`);
// A page that could not be read proves nothing: the step fails to run (2) rather than pass.
process.exit(failed.length ? 2 : report.ported.length ? 1 : 0);
