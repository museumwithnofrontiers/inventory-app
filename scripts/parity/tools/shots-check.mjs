// node tools/shots-check.mjs [--theme-fix] — list captures that failed or look like error pages;
// with --theme-fix, write out/jobs-fix.json with the new-side exhibition theme jobs.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { OUT, SHOTS } from './lib/paths.mjs';
if (process.argv.includes('--theme-fix')) {
  const j = JSON.parse(readFileSync(`${OUT}/jobs-pages.json`, 'utf8'));
  writeFileSync(`${OUT}/jobs-fix.json`, JSON.stringify(j.filter((x) => x.page === 'theme' && x.id.endsWith('--new'))));
  console.log('fix jobs written');
} else {
  for (const f of readdirSync(`${SHOTS}`).filter((f) => f.endsWith('.json'))) {
    const j = JSON.parse(readFileSync(`${SHOTS}/${f}`, 'utf8'));
    const t = j.title ?? '';
    if (j.error || (j.status && j.status >= 400) || /not found|404|forbidden|error/i.test(t) || (j.scrollHeight ?? 0) < 950) {
      console.log(f.replace('.json', ''), j.status, (j.error ?? '').slice(0, 70), '|', t.slice(0, 50), '| h', j.scrollHeight);
    }
  }
}
