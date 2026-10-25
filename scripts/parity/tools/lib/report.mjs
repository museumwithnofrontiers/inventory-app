// Collects findings and writes report.json + report.md for one site.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dataError } from './data-errors.mjs';

export class Report {
  constructor(slug, meta) {
    this.slug = slug;
    this.meta = meta;
    this.sets = []; // record-set comparisons
    this.fields = {}; // entity.field → verdict counts
    this.samples = {}; // entity.field.verdict → up to N examples
    this.notCompared = {}; // legacy fields with a value and no package counterpart
    this.notes = [];
  }

  set(name, legacyKeys, pkgKeys, { expected } = {}) {
    const L = new Set(legacyKeys);
    const P = new Set(pkgKeys);
    const onlyLegacy = [...L].filter((k) => !P.has(k));
    const onlyPkg = [...P].filter((k) => !L.has(k));
    this.sets.push({ name, legacy: L.size, pkg: P.size, onlyLegacy, onlyPkg, expected: expected ?? null });
    return { onlyLegacy, onlyPkg };
  }

  field(entity, field, result, where, max = result.why ? 3 : 12) {
    const k = `${entity}.${field}`;
    // A difference that comes from an error in the legacy data, tracked for a fix there.
    const known = !['same', 'both-empty', 'format'].includes(result.verdict) && !result.verdict.startsWith('expected') ? dataError(where, k) : null;
    if (known) result = { ...result, verdict: `expected:${known}` };
    const f = (this.fields[k] ??= {});
    f[result.verdict] = (f[result.verdict] ?? 0) + 1;
    if (result.why) {
      const w = ((this.reasons ??= {})[`${k}|${result.verdict}`] ??= {});
      const reason = result.why.replace(/ \("[^"]*…"\)$/, '').replace(/\b(ar|el|tr|de|fr|es|it|pt|se|cs) (spelling)/, '<lang> $2').replace(/of \d+ names/, 'of several names');
      w[reason] = (w[reason] ?? 0) + 1;
    }
    if (['same', 'both-empty'].includes(result.verdict)) return;
    const s = (this.samples[`${k}|${result.verdict}`] ??= []);
    if (s.length < max) s.push({ where, ...result });
  }

  unmapped(entity, field, where) {
    const k = `${entity}.${field}`;
    const u = (this.notCompared[k] ??= { count: 0, examples: [] });
    u.count++;
    if (u.examples.length < 3) u.examples.push(where);
  }

  note(text) {
    this.notes.push(text);
  }

  write(dir, base = "report") {
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/${base}.json`, JSON.stringify(this, null, 1));
    const md = [];
    md.push(`# ${this.slug} — curatorial parity`, '');
    for (const [k, v] of Object.entries(this.meta)) md.push(`- **${k}:** ${v}`);
    md.push('', '## Record sets', '', '| Set | Legacy | Package | Only legacy | Only package | Expected |', '|---|---|---|---|---|---|');
    for (const s of this.sets) md.push(`| ${s.name} | ${s.legacy} | ${s.pkg} | ${s.onlyLegacy.length}${s.onlyLegacy.length ? ' — ' + s.onlyLegacy.slice(0, 4).join(', ') + (s.onlyLegacy.length > 4 ? ' …' : '') : ''} | ${s.onlyPkg.length}${s.onlyPkg.length ? ' — ' + s.onlyPkg.slice(0, 4).join(', ') + (s.onlyPkg.length > 4 ? ' …' : '') : ''} | ${s.expected ?? ''} |`);
    md.push('', '## Fields', '', '| Field | same | format only | different | missing in package | extra in package | expected | both empty |', '|---|---|---|---|---|---|---|---|');
    for (const [k, v] of Object.entries(this.fields).sort()) {
      const exp = Object.entries(v).filter(([x]) => x.startsWith('expected')).reduce((n, [, c]) => n + c, 0);
      md.push(`| ${k} | ${v.same ?? 0} | ${v.format ?? 0} | **${v.different ?? 0}** | **${v['missing-in-package'] ?? 0}** | ${v['extra-in-package'] ?? 0} | ${exp} | ${v['both-empty'] ?? 0} |`);
    }
    if (this.reasons && Object.keys(this.reasons).length) {
      md.push('', '## Known reasons inside the counts above', '', '| Field | Verdict | Reason | Count |', '|---|---|---|---|');
      for (const [k, v] of Object.entries(this.reasons).sort()) for (const [why, n] of Object.entries(v)) md.push(`| ${k.split('|')[0]} | ${k.split('|')[1]} | ${why} | ${n} |`);
    }
    if (Object.keys(this.notCompared).length) {
      md.push('', '## Legacy fields with a value and no package counterpart', '', '| Field | Records | e.g. |', '|---|---|---|');
      for (const [k, v] of Object.entries(this.notCompared).sort((a, b) => b[1].count - a[1].count)) md.push(`| ${k} | ${v.count} | ${v.examples.join('; ')} |`);
    }
    md.push('', '## Samples', '');
    for (const [k, list] of Object.entries(this.samples).sort()) {
      if (k.endsWith('|format')) continue;
      md.push(`### ${k}`, '');
      for (const s of list) {
        md.push(`- \`${s.where}\`${s.similarity !== undefined ? ` (similarity ${s.similarity})` : ''}${s.why ? ` — ${s.why}` : ''}`);
        if (s.legacy !== undefined) md.push(`  - legacy: ${clip(s.legacy)}`);
        if (s.pkg !== undefined) md.push(`  - package: ${clip(s.pkg)}`);
      }
      md.push('');
    }
    if (this.notes.length) md.push('## Notes', '', ...this.notes.map((n) => `- ${n}`), '');
    writeFileSync(`${dir}/${base}.md`, md.join('\n'));
  }
}

const clip = (s) => {
  const t = String(s).replace(/\n/g, ' ⏎ ');
  return t.length > 300 ? t.slice(0, 300) + '…' : t;
};
