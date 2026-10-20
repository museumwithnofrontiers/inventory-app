// node tools/aggregate.mjs — one overview across every site report under out/: record sets,
// fields with real differences, and the known causes counted per site. Writes out/overview.md
// and out/overview.json.
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';

import { OUT } from './lib/paths.mjs';
const sitemap = JSON.parse(readFileSync(`${OUT}/sitemap.json`, 'utf8')).sites;
const kindOf = new Map(sitemap.map((s) => [s.slug, s.kind]));
const order = ['standalone', 'gallery', 'exhibition'];
const sites = readdirSync(OUT).filter((d) => existsSync(`${OUT}/${d}/report.json`)).sort((a, b) => order.indexOf(kindOf.get(a)) - order.indexOf(kindOf.get(b)) || a.localeCompare(b));

const REAL = ['different', 'missing-in-package'];
const rows = [];
const causes = {}; // reason → site → count
const unexplained = {}; // field → site → count
for (const slug of sites) {
  const reports = ['report', 'collections', 'partners'].filter((b) => existsSync(`${OUT}/${slug}/${b}.json`)).map((b) => JSON.parse(readFileSync(`${OUT}/${slug}/${b}.json`, 'utf8')));
  let sets = 0;
  let setsOff = [];
  let compared = 0;
  let real = 0;
  let unexp = 0;
  for (const r of reports) {
    for (const s of r.sets) {
      sets++;
      if (s.onlyLegacy.length || s.onlyPkg.length) setsOff.push(`${s.name}: −${s.onlyLegacy.length}/+${s.onlyPkg.length}`);
    }
    for (const [f, v] of Object.entries(r.fields)) {
      const total = Object.values(v).reduce((a, b) => a + b, 0);
      compared += total - (v['both-empty'] ?? 0);
      const bad = REAL.reduce((n, k) => n + (v[k] ?? 0), 0);
      real += bad;
      // How much of the bad count a known reason explains.
      let explained = 0;
      for (const [k, reasons] of Object.entries(r.reasons ?? {})) {
        const [field, verdict] = k.split('|');
        if (field !== f) continue;
        for (const [why, n] of Object.entries(reasons)) {
          const label = `${field.replace(/^(item|detail|partner|theme)\./, '$1 ')} — ${why} (${verdict})`;
          ((causes[label] ??= {})[slug] = (causes[label][slug] ?? 0) + n);
          if (REAL.includes(verdict)) explained += n;
        }
      }
      if (bad - explained > 0) { unexp += bad - explained; ((unexplained[f] ??= {})[slug] = (unexplained[f][slug] ?? 0) + bad - explained); }
    }
  }
  rows.push({ slug, kind: kindOf.get(slug) ?? "?", sets, setsOff, compared, real, unexp });
}

const md = [`# Curatorial parity — overview (${new Date().toISOString().slice(0, 10)})`, ''];
md.push('Counts are field comparisons (record × language × field). "Real" = different or missing in the package, before subtracting known, deliberate or legacy-side causes.', '');
md.push('| Site | Kind | Record sets | Sets that differ | Fields compared | Real differences | of which no known cause |', '|---|---|---|---|---|---|---|');
const pct = (n, d) => (d ? ((100 * n) / d).toFixed(1) : '0.0') + '%';
for (const r of rows) md.push(`| ${r.slug} | ${r.kind} | ${r.sets} | ${r.setsOff.length ? r.setsOff.join('; ') : '✓ all equal'} | ${r.compared} | ${r.real} (${pct(r.real, r.compared)}) | ${r.unexp} (${pct(r.unexp, r.compared)}) |`);
md.push('', '## Causes found, by number of sites', '', '| Cause | Sites | Total | Per site |', '|---|---|---|---|');
for (const [label, per] of Object.entries(causes).sort((a, b) => Object.keys(b[1]).length - Object.keys(a[1]).length || Object.values(b[1]).reduce((x, y) => x + y, 0) - Object.values(a[1]).reduce((x, y) => x + y, 0))) {
  md.push(`| ${label} | ${Object.keys(per).length} | ${Object.values(per).reduce((a, b) => a + b, 0)} | ${Object.entries(per).map(([s, n]) => `${s} ${n}`).join(', ')} |`);
}
md.push('', '## Differences with no identified cause yet, by field', '', '| Field | Sites | Total | Per site |', '|---|---|---|---|');
for (const [f, per] of Object.entries(unexplained).sort((a, b) => Object.values(b[1]).reduce((x, y) => x + y, 0) - Object.values(a[1]).reduce((x, y) => x + y, 0))) {
  md.push(`| ${f} | ${Object.keys(per).length} | ${Object.values(per).reduce((a, b) => a + b, 0)} | ${Object.entries(per).map(([s, n]) => `${s} ${n}`).join(', ')} |`);
}
writeFileSync(`${OUT}/overview.md`, md.join('\n') + '\n');
writeFileSync(`${OUT}/overview.json`, JSON.stringify({ rows, causes, unexplained }, null, 1));
console.log(`overview: ${rows.length} sites`);
