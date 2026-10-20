// node tools/reasons.mjs [minCount] — every real difference in the latest run, totalled per
// field × verdict × stated reason, over all site reports.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { OUT } from './lib/paths.mjs';

const min = Number(process.argv[2] ?? 20);
const REAL = ['different', 'missing-in-package', 'extra-in-package'];
const tot = {};
for (const slug of readdirSync(OUT)) {
  for (const f of ['report.json', 'dump.json']) {
    const file = `${OUT}/${slug}/${f}`;
    if (!existsSync(file)) continue;
    const r = JSON.parse(readFileSync(file, 'utf8'));
    for (const [field, verdicts] of Object.entries(r.fields ?? {})) {
      for (const v of REAL) {
        const n = verdicts[v] ?? 0;
        if (!n) continue;
        let explained = 0;
        for (const [why, c] of Object.entries(r.reasons?.[`${field}|${v}`] ?? {})) {
          (tot[`${field}|${v}|${why}`] ??= { n: 0, sites: new Set() }).n += c;
          tot[`${field}|${v}|${why}`].sites.add(slug);
          explained += c;
        }
        if (n > explained) { (tot[`${field}|${v}|(no reason)`] ??= { n: 0, sites: new Set() }).n += n - explained; tot[`${field}|${v}|(no reason)`].sites.add(slug); }
      }
    }
  }
}
for (const [k, t] of Object.entries(tot).sort((a, b) => b[1].n - a[1].n)) if (t.n >= min) console.log(`${String(t.n).padStart(6)}  ${t.sites.size.toString().padStart(2)} sites  ${k}`);
