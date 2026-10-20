// The parity tool's one entry point. Run it in the `parity` compose service (see README.md):
//
//   node run.mjs [mode…] [--only slug,slug] [--packages latest|local|local:<dir>]
//                [--baseline <path>] [--no-gate] [--refresh] [--warm] [--concurrency N]
//
// Modes (default: curatorial):
//   curatorial  sitemap, every site's records and fields vs live legacy, the package gates,
//               the overview, and the gate against the baseline
//   packages    sitemap and the package gates only (no legacy request): the quick pre-publish check
//   style       screenshots and style signatures of legacy and new pages, and the review page
//   assets      every non-curatorial image of each page, matched legacy ↔ new
//   static      the static pages' texts and footer links
//
// Exit code: 0 when every step ran and the gate passed, 1 when the gate failed, 2 when a step
// failed to run.
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MODES = ['curatorial', 'packages', 'style', 'assets', 'static'];
const USAGE = `usage: node run.mjs [${MODES.join('|')}…] [--only slug,slug] [--packages latest|local|local:<dir>] [--baseline <path>] [--no-gate] [--refresh] [--warm] [--concurrency N]`;

const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h')) {
  console.log(USAGE);
  process.exit(0);
}
const opts = { modes: [], only: null, packages: 'latest', baseline: null, gate: true, refresh: false, warm: false, concurrency: null };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  const next = () => {
    if (i + 1 >= argv.length) fail(`${a} needs a value`);
    return argv[++i];
  };
  if (a === '--only') opts.only = next().split(',').filter(Boolean);
  else if (a === '--packages') opts.packages = next();
  else if (a === '--baseline') opts.baseline = next();
  else if (a === '--concurrency') opts.concurrency = next();
  else if (a === '--no-gate') opts.gate = false;
  else if (a === '--refresh') opts.refresh = true;
  else if (a === '--warm') opts.warm = true;
  else if (MODES.includes(a)) opts.modes.push(a);
  else fail(`unknown argument ${a}`);
}
if (!opts.modes.length) opts.modes.push('curatorial');
if (!/^(latest|local|local:.+)$/.test(opts.packages)) fail(`--packages must be latest, local or local:<dir>`);
if (opts.concurrency && !/^[1-5]$/.test(opts.concurrency)) fail('--concurrency is 1 to 5: the legacy servers are shared');

function fail(message) {
  console.error(`${message}\n${USAGE}`);
  process.exit(2);
}

// The child processes read every setting from the environment (tools/lib/paths.mjs, pkg.mjs, http.mjs).
const env = { ...process.env, PARITY_PACKAGES: opts.packages };
if (opts.concurrency) env.PARITY_CONCURRENCY = opts.concurrency;
const { OUT } = await import('./tools/lib/paths.mjs');
mkdirSync(OUT, { recursive: true });
const LOG = `${OUT}/run.log`;
const broken = [];
let gateFailed = false;

// One tool, one child process: each tool is a script that reads its own argv.
function step(tool, args = [], { gate = false } = {}) {
  const t = Date.now();
  const r = spawnSync(process.execPath, ['--max-old-space-size=4096', `${HERE}/tools/${tool}`, ...args], { env, stdio: ['ignore', 'inherit', 'inherit'] });
  const line = `${new Date().toISOString().slice(11, 19)} ${tool} ${args.join(' ')} — ${Math.round((Date.now() - t) / 1000)}s, exit ${r.status ?? r.signal}`;
  appendFileSync(LOG, line + '\n');
  console.log(`▸ ${line}`);
  if (r.status === 0) return true;
  if (gate && r.status === 1) gateFailed = true;
  else broken.push(`${tool} ${args.join(' ')}`.trim());
  return false;
}

const sitemapFile = `${OUT}/sitemap.json`;
const sites = () => JSON.parse(readFileSync(sitemapFile, 'utf8')).sites;
const selected = (list) => list.filter((s) => s.packageVersion && (!opts.only || opts.only.includes(s.slug)));
const onlyArgs = opts.only ? ['--only', opts.only.join(',')] : [];

appendFileSync(LOG, `START ${new Date().toISOString()} ${argv.join(' ')}\n`);
// The sitemap comes first, every time: it resolves the package versions on npm afresh. The
// previous one goes first, so that a sitemap that crashes cannot leave stale versions behind.
rmSync(sitemapFile, { force: true });
if (!step('sitemap.mjs', [...(opts.refresh ? ['--refresh'] : []), ...onlyArgs])) {
  if (!existsSync(sitemapFile)) process.exit(2);
  console.error('sitemap: some sites have no package; they are skipped');
}
if (opts.only) {
  const known = new Set(sites().map((s) => s.slug));
  const wrong = opts.only.filter((s) => !known.has(s));
  if (wrong.length) fail(`unknown site: ${wrong.join(', ')}`);
}

// The legacy instance of the-hijaz-railway answers 403: it is read from the dump instead, and
// water-in-islam goes through the same comparison to calibrate it (decisions D3/D8).
const DUMP_EXHIBITIONS = ['the-hijaz-railway', 'water-in-islam'];
const PHP = ['islamicart', 'baroqueart', 'sharinghistory'];

if (opts.modes.includes('curatorial')) {
  for (const s of selected(sites())) {
    if (s.kind === 'gallery' || (s.kind === 'exhibition' && s.slug !== 'the-hijaz-railway')) step('compare-dxa.mjs', [s.slug]);
    if (DUMP_EXHIBITIONS.includes(s.slug)) step('compare-dump-exh.mjs', [s.slug]);
    if (PHP.includes(s.slug)) {
      if (opts.warm) step('fetch-php.mjs', [s.slug]);
      step('compare-php.mjs', [s.slug]);
      step('compare-collections.mjs', [s.slug]);
      step('compare-partners-php.mjs', [s.slug]);
    }
    if (s.slug === 'explore') step('compare-explore.mjs');
    if (s.slug === 'galleries') step('compare-hub.mjs');
  }
}
// The package checks report; diff-runs judges them, and the comparison, against the baseline.
const gateArgs = [...(opts.baseline ? [opts.baseline] : []), '--run', OUT, ...onlyArgs, ...(opts.gate ? [] : ['--no-gate'])];
if (opts.modes.includes('curatorial') || opts.modes.includes('packages')) step('check-packages.mjs', onlyArgs);
if (opts.modes.includes('curatorial')) {
  step('aggregate.mjs');
  step('diff-runs.mjs', gateArgs, { gate: true });
} else if (opts.modes.includes('packages')) step('diff-runs.mjs', [...gateArgs, '--packages-only'], { gate: true });

// The browser modes write a jobs list, then work through it (cached per job; delete the
// capture to redo one). --only narrows the list.
function jobs(file) {
  const all = JSON.parse(readFileSync(`${OUT}/${file}`, 'utf8'));
  const list = opts.only ? all.filter((j) => opts.only.includes(j.slug ?? j.id.split('--')[0])) : all;
  const path = `${OUT}/${file.replace('.json', '-run.json')}`;
  writeFileSync(path, JSON.stringify(list));
  return path;
}
if (opts.modes.includes('style')) {
  if (step('jobs-home.mjs')) step('capture.mjs', [jobs('jobs-home.json')]);
  if (step('jobs-pages.mjs')) step('capture.mjs', [jobs('jobs-pages.json')]);
  step('compare-style.mjs', ['home']);
  step('compare-style.mjs', ['pages']);
  step('build-style-page.mjs');
}
if (opts.modes.includes('assets')) {
  if (!existsSync(`${OUT}/jobs-pages.json`)) step('jobs-pages.mjs');
  if (step('jobs-assets.mjs')) step('assets.mjs', [jobs('jobs-assets.json')]);
  step('compare-assets.mjs');
}
if (opts.modes.includes('static')) {
  if (step('jobs-static.mjs')) step('static.mjs', [jobs('jobs-static.json')]);
  step('compare-static.mjs');
}

appendFileSync(LOG, `DONE ${new Date().toISOString()}${broken.length ? ` — failed: ${broken.join('; ')}` : ''}${gateFailed ? ' — GATE FAILED' : ''}\n`);
if (broken.length) console.error(`steps that failed: ${broken.join('; ')}`);
if (gateFailed && opts.gate) console.error(`GATE FAILED: see ${OUT}/diff-runs.md and ${OUT}/packages.md`);
process.exit(broken.length ? 2 : gateFailed && opts.gate ? 1 : 0);
