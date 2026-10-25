// node tools/diff-runs.mjs [<baseline>] [<run dir> | --run <run dir>] [--only slug,slug] [--packages-only] [--no-gate]
// Compares a parity run with a baseline, field by field and site by site, and gates on it.
//   <baseline>  a stored summary: baselines/<date>/ or its diff-runs.json (default: the newest
//               baselines/<date>/), or a full earlier run directory (its */report.json files)
//   <run dir>   the run to judge (default: out/)
// "Real" differences are different + missing-in-package + extra-in-package. The gate fails
// (exit 1) when, for any site of the run:
//   - a field has more real differences than in the baseline,
//   - a record set has more records on one side only than in the baseline,
//   - its package has more image URLs that are not /pub/<uuid>, or more texts with raw HTML
//     tags, than in the baseline (out/packages.json, written by check-packages.mjs). The ones
//     the baseline already has are listed as open defects, not as regressions.
// A site the baseline does not know gets no field or record-set gate, and the package checks
// judge it strictly: any bad URL or HTML text fails. --packages-only (the packages mode) judges
// the package checks alone. Writes <run dir>/diff-runs.md and <run dir>/diff-runs.json; the
// json's perSite block is what a later run uses as its baseline.
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { OUT, TOOLS } from './lib/paths.mjs';

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const value = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : null);
const positional = args.filter((a, i) => !a.startsWith('--') && !['--only', '--run'].includes(args[i - 1]));
const only = value('--only')?.split(',') ?? null;
const gate = !flag('--no-gate');
const packagesOnly = flag('--packages-only');

const BASELINES = `${TOOLS}/../baselines`;
const newest = () => readdirSync(BASELINES).filter((d) => /^\d{4}-\d{2}-\d{2}/.test(d)).sort().pop();
const baseArg = positional[0] ?? `${BASELINES}/${newest()}`;
const runDir = value('--run') ?? positional[1] ?? OUT;
const REAL = new Set(['different', 'missing-in-package', 'extra-in-package']);
const REPORTS = ['report.json', 'dump.json', 'collections.json', 'partners.json'];

// Per site: every field's verdict totals, every record set's one-sided count, and the package
// checks' counts.
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
  if (existsSync(`${dir}/packages.json`)) {
    for (const [slug, p] of Object.entries(JSON.parse(readFileSync(`${dir}/packages.json`, 'utf8')).sites)) {
      (perSite[slug] ??= { fields: {}, sets: {} }).packages = { images: p.images.bad, html: p.html.bad };
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
const pkgFile = `${runDir}/packages.json`;
const packages = existsSync(pkgFile) ? JSON.parse(readFileSync(pkgFile, 'utf8')).sites : null;
// The packages mode judges the sites whose packages it checked; a full run, the sites it compared.
const inRun = (s) => (!only || only.includes(s)) && (!packagesOnly || packages?.[s]);
const B = Object.fromEntries(Object.entries(Ball).filter(([s]) => inRun(s)));

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
  if (packagesOnly) continue;
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
// Package checks: more than the baseline is a regression; as many or fewer is an open defect
// still to fix (and, when fewer, a baseline to lower).
const open = [];
if (gate && !packages) failures.push({ slug: '*', what: 'package gates did not run (tools/check-packages.mjs)', before: null, after: null });
for (const [s, r] of Object.entries(packages ?? {})) {
  if (!inRun(s)) continue;
  // A baseline taken before the package checks existed has no counts: list, don't judge.
  const measured = !A[s] || A[s].packages;
  const base = A[s]?.packages ?? { images: measured ? 0 : null, html: measured ? 0 : null };
  const checks = [
    ['images', r.images, `package image URLs not /pub/<uuid> (e.g. ${r.images.samples[0]?.value})`],
    ['html', r.html, `package texts with raw HTML (e.g. ${r.html.samples[0]?.tag} in ${r.html.samples[0]?.where})`],
  ];
  for (const [k, now, what] of checks) {
    if (measured && now.bad > base[k]) failures.push({ slug: s, what, before: base[k], after: now.bad });
    else if (now.bad || base[k]) open.push({ slug: s, check: k === 'images' ? 'image URLs not /pub/<uuid>' : 'texts with raw HTML', before: base[k], after: now.bad });
  }
}

const sum = (list, k) => list.reduce((n, r) => n + (r[k] ?? 0), 0);
const md = [
  `# Parity run vs baseline`,
  '',
  `- **baseline:** ${baseArg}`,
  `- **run:** ${runDir}${only ? ` (only ${only.join(', ')})` : ''}${packagesOnly ? ' — package checks only' : ''}`,
  ...(packagesOnly ? [] : [`- **real differences (overview):** ${sum(siteRows, 'realBefore')} → ${sum(siteRows, 'realAfter')}`]),
  '',
  '## Gate',
  '',
  failures.length ? `**FAILED** — ${failures.length} regressions:` : gate ? `**PASSED** — no ${packagesOnly ? 'package check' : 'field, record set or package check'} got worse.` : 'Not gated (--no-gate).',
  ...(failures.length ? ['', '| Site | What | Baseline | Run |', '|---|---|---|---|', ...failures.map((f) => `| ${f.slug} | ${f.what} | ${f.before ?? ''} | ${f.after ?? ''} |`)] : []),
  ...(unknown.length ? ['', `Not in the baseline, so the package checks judge them strictly${packagesOnly ? '' : ' and their fields and record sets are not gated'}: ${unknown.join(', ')}.`] : []),
  ...(open.length
    ? [
        '',
        '## Open package defects',
        '',
        'Known in the baseline, so not regressions, but each one is still a place where the site can differ from legacy. Details per URL and text are in `packages.md`. When a count falls, take a new baseline to lock it in.',
        '',
        '| Site | Check | Baseline | Run |',
        '|---|---|---|---|',
        ...open.map((o) => `| ${o.slug} | ${o.check} | ${o.before ?? 'not measured'} | ${o.after}${o.before !== null && o.after < o.before ? ' ↓' : ''} |`),
      ]
    : []),
  ...(packagesOnly
    ? []
    : [
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
      ]),
].join('\n');
writeFileSync(`${runDir}/diff-runs.md`, md + '\n');
// One line per field and per row: the json is committed as a baseline, so keep its diffs readable.
const json = JSON.stringify({ baseline: baseArg, only, packagesOnly, failures, open, unknown, rows, siteRows, perSite: Ball }, null, 1).replace(/\{\n\s*([^{}[\]]*?)\n\s*\}/g, (_, body) => `{ ${body.replace(/\n\s*/g, ' ')} }`);
writeFileSync(`${runDir}/diff-runs.json`, json + '\n');

console.log(`sites ${slugs.length}, ${failures.length} regressions, ${open.length} open package defects${packagesOnly ? '' : `, real ${sum(siteRows, 'realBefore')} → ${sum(siteRows, 'realAfter')}`}`);
for (const f of failures) console.error(`REGRESSION ${f.slug}: ${f.what} ${f.before ?? ''} → ${f.after ?? ''}`);
if (gate && failures.length) process.exitCode = 1;
