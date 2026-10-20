// node tools/diff-runs.mjs [<baseline>] [<run dir> | --run <run dir>] [--only slug,slug] [--no-gate]
// Compares a parity run with a baseline, field by field and site by site, and gates on it.
//   <baseline>  a stored summary: baselines/<date>/ or its diff-runs.json (default: the newest
//               baselines/<date>/), or a full earlier run directory (its */report.json files)
//   <run dir>   the run to judge (default: out/)
// "Real" differences are different + missing-in-package + extra-in-package. The gate fails
// (exit 1) when, for any site of the run:
//   - a field has more real differences than in the baseline,
//   - a record set has more records on one side only than in the baseline,
//   - its package has an image URL that is not /pub/<uuid>, or a text with raw HTML tags
//     (out/packages.json, written by check-packages.mjs).
// A site the baseline does not know is reported and not gated. Writes <run dir>/diff-runs.md and
// <run dir>/diff-runs.json; the json's perSite block is what a later run uses as its baseline.
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { OUT, TOOLS } from './lib/paths.mjs';

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const value = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : null);
const positional = args.filter((a, i) => !a.startsWith('--') && !['--only', '--run'].includes(args[i - 1]));
const only = value('--only')?.split(',') ?? null;
const gate = !flag('--no-gate');

const BASELINES = `${TOOLS}/../baselines`;
const newest = () => readdirSync(BASELINES).filter((d) => /^\d{4}-\d{2}-\d{2}/.test(d)).sort().pop();
const baseArg = positional[0] ?? `${BASELINES}/${newest()}`;
const runDir = value('--run') ?? positional[1] ?? OUT;
const REAL = new Set(['different', 'missing-in-package', 'extra-in-package']);
const REPORTS = ['report.json', 'dump.json', 'collections.json', 'partners.json'];

// Per site: every field's verdict totals, and every record set's one-sided count.
function summarise(dir) {
  const perSite = {};
  for (const slug of readdirSync(dir)) {
    if (!statSync(`${dir}/${slug}`).isDirectory()) continue;
    for (const f of REPORTS) {
      const file = `${dir}/${slug}/${f}`;
      if (!existsSync(file)) continue;
      const r = JSON.parse(readFileSync(file, 'utf8'));
      const site = (perSite[slug] ??= { fields: {}, sets: {} });
      for (const [field, verdicts] of Object.entries(r.fields ?? {})) {
        const t = (site.fields[field] ??= { real: 0, same: 0, format: 0, expected: 0, total: 0 });
        for (const [v, n] of Object.entries(verdicts)) {
          t.total += n;
          if (REAL.has(v)) t.real += n;
          else if (v === 'same' || v === 'both-empty') t.same += n;
          else if (v === 'format') t.format += n;
          else if (v.startsWith('expected')) t.expected += n;
        }
      }
      for (const s of r.sets ?? []) site.sets[`${f.replace('.json', '')}: ${s.name}`] = { onlyLegacy: s.onlyLegacy.length, onlyPkg: s.onlyPkg.length };
    }
  }
  const ov = existsSync(`${dir}/overview.json`) ? JSON.parse(readFileSync(`${dir}/overview.json`, 'utf8')) : { rows: [] };
  for (const row of ov.rows) if (perSite[row.slug]) Object.assign(perSite[row.slug], { real: row.real, unexp: row.unexp, setsOff: row.setsOff });
  return perSite;
}

function loadBaseline(path) {
  const file = path.endsWith('.json') ? path : `${path}/diff-runs.json`;
  if (existsSync(file)) {
    const j = JSON.parse(readFileSync(file, 'utf8'));
    if (j.perSite) return j.perSite;
  }
  if (existsSync(path) && statSync(path).isDirectory()) return summarise(path);
  throw new Error(`no baseline at ${path}: expected a diff-runs.json with perSite, or a run directory`);
}

const A = loadBaseline(baseArg);
const Ball = summarise(runDir);
const B = only ? Object.fromEntries(Object.entries(Ball).filter(([s]) => only.includes(s))) : Ball;

// ---- per-field totals over the sites of this run
const fieldTotals = (perSite, slugs) => {
  const t = {};
  for (const s of slugs) for (const [f, v] of Object.entries(perSite[s]?.fields ?? {})) {
    const x = (t[f] ??= { real: 0, format: 0, total: 0, sites: 0 });
    x.real += v.real;
    x.format += v.format;
    x.total += v.total;
    if (v.real) x.sites++;
  }
  return t;
};
const slugs = Object.keys(B).sort();
const FA = fieldTotals(A, slugs);
const FB = fieldTotals(B, slugs);
const rows = [...new Set([...Object.keys(FA), ...Object.keys(FB)])]
  .map((f) => {
    const a = FA[f] ?? { real: 0, format: 0, total: 0 };
    const b = FB[f] ?? { real: 0, format: 0, total: 0, sites: 0 };
    return { field: f, before: a.real, after: b.real, delta: b.real - a.real, formatBefore: a.format, formatAfter: b.format, totalAfter: b.total, sitesAfter: b.sites };
  })
  .sort((x, y) => x.delta - y.delta || x.field.localeCompare(y.field));
const siteRows = slugs.map((s) => ({
  slug: s,
  realBefore: A[s]?.real ?? null,
  realAfter: B[s]?.real ?? null,
  unexpBefore: A[s]?.unexp ?? null,
  unexpAfter: B[s]?.unexp ?? null,
  setsAfter: (B[s]?.setsOff ?? []).join('; '),
}));

// ---- the gate
const failures = [];
const unknown = [];
for (const s of slugs) {
  if (!A[s]) { unknown.push(s); continue; }
  for (const [f, v] of Object.entries(B[s].fields)) {
    const before = A[s].fields[f]?.real ?? 0;
    if (v.real > before) failures.push({ slug: s, what: `field ${f}`, before, after: v.real });
  }
  for (const [name, v] of Object.entries(B[s].sets)) {
    const a = A[s].sets?.[name] ?? { onlyLegacy: 0, onlyPkg: 0 };
    if (v.onlyLegacy > a.onlyLegacy) failures.push({ slug: s, what: `set ${name}: only in legacy`, before: a.onlyLegacy, after: v.onlyLegacy });
    if (v.onlyPkg > a.onlyPkg) failures.push({ slug: s, what: `set ${name}: only in the package`, before: a.onlyPkg, after: v.onlyPkg });
  }
}
const pkgFile = `${runDir}/packages.json`;
const packages = existsSync(pkgFile) ? JSON.parse(readFileSync(pkgFile, 'utf8')).sites : null;
if (gate && !packages) failures.push({ slug: '*', what: 'package gates did not run (tools/check-packages.mjs)', before: null, after: null });
for (const [s, r] of Object.entries(packages ?? {})) {
  if (only && !only.includes(s)) continue;
  if (r.images.bad) failures.push({ slug: s, what: `package image URLs not /pub/<uuid> (e.g. ${r.images.samples[0].value})`, before: 0, after: r.images.bad });
  if (r.html.bad) failures.push({ slug: s, what: `package texts with raw HTML (e.g. ${r.html.samples[0].tag} in ${r.html.samples[0].where})`, before: 0, after: r.html.bad });
}

const sum = (list, k) => list.reduce((n, r) => n + (r[k] ?? 0), 0);
const md = [
  `# Parity run vs baseline`,
  '',
  `- **baseline:** ${baseArg}`,
  `- **run:** ${runDir}${only ? ` (only ${only.join(', ')})` : ''}`,
  `- **real differences (overview):** ${sum(siteRows, 'realBefore')} → ${sum(siteRows, 'realAfter')}`,
  '',
  '## Gate',
  '',
  failures.length ? `**FAILED** — ${failures.length} regressions:` : gate ? '**PASSED** — no field, record set or package gate got worse.' : 'Not gated (--no-gate).',
  ...(failures.length ? ['', '| Site | What | Baseline | Run |', '|---|---|---|---|', ...failures.map((f) => `| ${f.slug} | ${f.what} | ${f.before ?? ''} | ${f.after ?? ''} |`)] : []),
  ...(unknown.length ? ['', `Not in the baseline, so not gated: ${unknown.join(', ')}.`] : []),
  '',
  '## Fields (real differences = different / missing / extra, summed over the sites of this run)',
  '',
  '| Field | Before | After | Δ | Format-only before → after | Compared after | Sites still off |',
  '|---|---|---|---|---|---|---|',
  ...rows.filter((r) => r.before || r.after || r.formatBefore || r.formatAfter).map((r) => `| ${r.field} | ${r.before} | ${r.after} | ${r.delta > 0 ? '+' : ''}${r.delta} | ${r.formatBefore} → ${r.formatAfter} | ${r.totalAfter} | ${r.sitesAfter} |`),
  '',
  '## Sites',
  '',
  '| Site | Real before | Real after | Unexplained before | after | Record sets off (after) |',
  '|---|---|---|---|---|---|',
  ...siteRows.map((r) => `| ${r.slug} | ${r.realBefore ?? '—'} | ${r.realAfter ?? '—'} | ${r.unexpBefore ?? '—'} | ${r.unexpAfter ?? '—'} | ${r.setsAfter || '✓'} |`),
].join('\n');
writeFileSync(`${runDir}/diff-runs.md`, md + '\n');
// One line per field and per row: the json is committed as a baseline, so keep its diffs readable.
const json = JSON.stringify({ baseline: baseArg, only, failures, unknown, rows, siteRows, perSite: Ball }, null, 1).replace(/\{\n\s*([^{}[\]]*?)\n\s*\}/g, (_, body) => `{ ${body.replace(/\n\s*/g, ' ')} }`);
writeFileSync(`${runDir}/diff-runs.json`, json + '\n');

console.log(`fields ${rows.length}, sites ${siteRows.length}, real ${sum(siteRows, 'realBefore')} → ${sum(siteRows, 'realAfter')}`);
for (const f of failures) console.error(`REGRESSION ${f.slug}: ${f.what} ${f.before ?? ''} → ${f.after ?? ''}`);
if (gate && failures.length) process.exitCode = 1;
