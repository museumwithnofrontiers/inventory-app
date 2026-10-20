// The package gates and the baseline gate, on small packages and reports written to a temp dir.
// No network: neither check-packages nor diff-runs requests anything.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { HTML_TAG, scanPackage } from '../tools/lib/gates.mjs';

const TOOLS = join(dirname(fileURLToPath(import.meta.url)), '..', 'tools');
const write = (file, data) => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(data));
};
const PUB = 'https://inventory.metanull.eu/pub/0b5e2a64-6c3f-4f0e-9d7b-3a1c2e4f5a6b.jpg';

function pkg(items, translations) {
  const root = mkdtempSync(join(tmpdir(), 'parity-pkg-'));
  write(`${root}/manifest.json`, { name: 'test' });
  write(`${root}/package.json`, { description: 'not scanned: <b>npm metadata</b>' });
  write(`${root}/items.json`, items);
  write(`${root}/translations/items.en.json`, translations);
  return root;
}

test('a package of /pub/<uuid> images and Markdown texts passes', () => {
  const root = pkg(
    [{ id: 'a', images: [{ url: PUB }], image_path: 'thematic_gallery/thg_galleries/9/1.jpg' }],
    { a: { name: 'Carpet', description: '*Wool* < 5 cm, see <https://museumwnf.org>' } },
  );
  const r = scanPackage(root);
  assert.equal(r.images.total, 1);
  assert.equal(r.images.bad, 0);
  assert.equal(r.html.bad, 0);
});

test('relative or foreign image URLs fail (the 2026-10-19 regression)', () => {
  const root = pkg(
    [{ id: 'a', images: [{ url: '/pub/0b5e2a64-6c3f-4f0e-9d7b-3a1c2e4f5a6b.jpg' }, { url: 'https://inventory.metanull.eu/pub/objects/ISL/1.jpg' }, { url: 'pictures/x.png' }] }],
    {},
  );
  const r = scanPackage(root);
  assert.equal(r.images.total, 3);
  assert.equal(r.images.bad, 3);
  assert.match(r.images.samples[0].where, /^items\.json: \[0\]\.images\[0\]\.url$/);
});

test('raw HTML tags in texts fail, wherever they sit', () => {
  const root = pkg([{ id: 'a', extra: { justification: 'On <i>The Book</i>' } }], { a: { bibliography: 'Line one<br/>line two', description: '<p style="x">Text</p>' } });
  const r = scanPackage(root);
  assert.equal(r.html.bad, 3);
  assert.deepEqual(r.html.samples.map((s) => s.tag).sort(), ['<br/>', '<i>', '<p style="x">']);
});

test('the HTML pattern ignores comparisons, autolinks and e-mail brackets', () => {
  for (const ok of ['a < b > c', '<https://x.org>', '<a@b.org>', '<5 cm>', 'Ibn <Ali>']) assert.equal(HTML_TAG.test(ok), false, ok);
  for (const bad of ['<br>', '<BR />', '</p>', '<a href="x">', '<span class="y">', '<strong>']) assert.equal(HTML_TAG.test(bad), true, bad);
});

// ---- diff-runs: the baseline gate
function report(fields, sets = []) {
  return { fields, sets: sets.map(([name, onlyLegacy, onlyPkg]) => ({ name, onlyLegacy: Array(onlyLegacy).fill('k'), onlyPkg: Array(onlyPkg).fill('k') })) };
}
function run(dir, sites, packages) {
  for (const [slug, r] of Object.entries(sites)) write(`${dir}/${slug}/report.json`, r);
  write(`${dir}/overview.json`, { rows: Object.keys(sites).map((slug) => ({ slug, real: 0, unexp: 0, setsOff: [] })) });
  if (packages) write(`${dir}/packages.json`, { packages: 'latest', sites: packages });
}
const clean = { images: { total: 1, bad: 0, samples: [] }, html: { total: 1, bad: 0, samples: [] } };
const diff = (...args) => spawnSync(process.execPath, [`${TOOLS}/diff-runs.mjs`, ...args], { encoding: 'utf8' });

test('diff-runs passes when nothing grows, and its output serves as the next baseline', () => {
  const base = mkdtempSync(join(tmpdir(), 'parity-base-'));
  const now = mkdtempSync(join(tmpdir(), 'parity-run-'));
  run(base, { carpets: report({ 'item.author': { same: 5, different: 3 } }, [['items', 1, 0]]) });
  run(now, { carpets: report({ 'item.author': { same: 6, different: 2 } }, [['items', 1, 0]]) }, { carpets: clean });
  const r = diff(base, now);
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(readFileSync(`${now}/diff-runs.json`, 'utf8'));
  assert.equal(out.perSite.carpets.fields['item.author'].real, 2);
  assert.equal(diff(`${now}/diff-runs.json`, now).status, 0);
});

test('diff-runs takes the run from --run, so it is never mistaken for the baseline', () => {
  const base = mkdtempSync(join(tmpdir(), 'parity-base-'));
  const now = mkdtempSync(join(tmpdir(), 'parity-run-'));
  run(base, { carpets: report({ 'item.author': { different: 1 } }) });
  run(now, { carpets: report({ 'item.author': { different: 4 } }) }, { carpets: clean });
  const r = diff(base, '--run', now);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /item\.author 1 → 4/);
});

test('diff-runs fails when a field or a record set grows', () => {
  const base = mkdtempSync(join(tmpdir(), 'parity-base-'));
  const now = mkdtempSync(join(tmpdir(), 'parity-run-'));
  run(base, { carpets: report({ 'item.author': { different: 2 } }, [['items', 0, 0]]), glass: report({ 'item.name': { same: 1 } }) });
  run(now, { carpets: report({ 'item.author': { different: 2, 'missing-in-package': 1 } }, [['items', 0, 2]]), glass: report({ 'item.name': { same: 1 } }) }, { carpets: clean, glass: clean });
  const r = diff(base, now);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /carpets: field item\.author 2 → 3/);
  assert.match(r.stderr, /carpets: set report: items: only in the package 0 → 2/);
  // --only narrows the gate to the sites named.
  assert.equal(diff(base, now, '--only', 'glass').status, 0);
});

test('diff-runs fails on a package gate, and when the package gates did not run', () => {
  const base = mkdtempSync(join(tmpdir(), 'parity-base-'));
  const now = mkdtempSync(join(tmpdir(), 'parity-run-'));
  run(base, { carpets: report({}) });
  run(now, { carpets: report({}) });
  assert.match(diff(base, now).stderr, /package gates did not run/);
  const bad = { images: { total: 1, bad: 1, samples: [{ where: 'items.json: [0].url', value: '/pub/x.jpg' }] }, html: clean.html };
  run(now, { carpets: report({}) }, { carpets: bad });
  const r = diff(base, now);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /image URLs not \/pub\/<uuid>/);
  assert.equal(diff(base, now, '--no-gate').status, 0);
});
