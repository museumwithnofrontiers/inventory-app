// node tools/check-packages.mjs [--only slug,slug] — the package gates, with no legacy side:
// every image URL must be https://inventory.metanull.eu/pub/<uuid>.<ext>, and no text may hold
// raw HTML tags. Reads the packages the sitemap resolved (npm latest, or the local exports).
// Writes out/packages.json and out/packages.md. It reports; diff-runs.mjs judges the counts
// against the baseline.
import { readFileSync, writeFileSync } from 'node:fs';
import { scanPackage } from './lib/gates.mjs';
import { OUT } from './lib/paths.mjs';
import { packageRoot } from './lib/pkg.mjs';

const onlyArg = process.argv.indexOf('--only');
const only = onlyArg > 0 ? process.argv[onlyArg + 1].split(',') : null;
const sitemap = JSON.parse(readFileSync(`${OUT}/sitemap.json`, 'utf8'));
const sites = sitemap.sites.filter((s) => s.packageVersion && (!only || only.includes(s.slug)));

const result = {};
for (const s of sites) {
  const scan = scanPackage(packageRoot(s.package, s.packageVersion));
  result[s.slug] = { package: `${s.package}@${s.packageVersion}`, ...scan };
}
writeFileSync(`${OUT}/packages.json`, JSON.stringify({ packages: sitemap.packages, sites: result }, null, 1));

const failing = Object.entries(result).filter(([, r]) => r.images.bad || r.html.bad);
const md = [
  `# Package gates (${sitemap.packages})`,
  '',
  'Image URLs must be `https://inventory.metanull.eu/pub/<uuid>.<ext>`; texts must hold no raw HTML tags.',
  '',
  '| Site | Package | Image URLs | not /pub/<uuid> | Texts | with HTML tags |',
  '|---|---|---|---|---|---|',
  ...Object.entries(result).map(([slug, r]) => `| ${slug} | ${r.package} | ${r.images.total} | ${r.images.bad ? `**${r.images.bad}**` : 0} | ${r.html.total} | ${r.html.bad ? `**${r.html.bad}**` : 0} |`),
];
for (const [slug, r] of failing) {
  md.push('', `## ${slug}`, '');
  for (const b of r.images.samples) md.push(`- image \`${b.where}\`: ${b.value}`);
  for (const b of r.html.samples) md.push(`- html \`${b.where}\` ${b.tag}: ${b.value.replace(/\n/g, ' ⏎ ')}`);
}
writeFileSync(`${OUT}/packages.md`, md.join('\n') + '\n');
for (const [slug, r] of failing) console.error(`${slug}: ${r.images.bad} bad image URLs, ${r.html.bad} texts with HTML tags`);
console.log(`packages: ${sites.length} checked, ${failing.length} with a bad image URL or an HTML text`);
