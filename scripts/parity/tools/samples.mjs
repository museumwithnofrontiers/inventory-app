// node tools/samples.mjs <field> [n] — per-site counts and a few samples of a field's real
// differences in the latest run (out/*/report.json).
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { OUT } from './lib/paths.mjs';

const [field, n = '6'] = process.argv.slice(2);
const per = [];
const samples = [];
for (const slug of readdirSync(OUT)) {
  const file = `${OUT}/${slug}/report.json`;
  if (!existsSync(file)) continue;
  const r = JSON.parse(readFileSync(file, 'utf8'));
  const v = r.fields?.[field];
  if (!v) continue;
  const real = (v.different ?? 0) + (v['missing-in-package'] ?? 0) + (v['extra-in-package'] ?? 0);
  if (real) per.push(`${slug}:${real}`);
  for (const verdict of ['different', 'missing-in-package', 'extra-in-package']) {
    for (const s of r.samples?.[`${field}|${verdict}`] ?? []) samples.push({ slug, verdict, ...s });
  }
}
console.log(`${field}: ${per.join(' ')}`);
for (const s of samples.slice(0, Number(n))) {
  const cut = (x) => (x == null ? '∅' : String(x).replace(/\s+/g, ' ').slice(0, 160));
  console.log(`- [${s.slug} ${s.verdict}] ${s.where ?? ''}\n    legacy: ${cut(s.legacy)}\n    pkg:    ${cut(s.pkg)}${s.why ? `\n    why: ${s.why}` : ''}`);
}
