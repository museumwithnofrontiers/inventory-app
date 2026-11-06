// Runs in the parity service: node tools/layout.mjs <jobs.json>
// Opens each page of jobs-layout.json at its width and applies the layout rules
// (lib/layout-rules.mjs). Writes out/layout.json and out/layout.md.
// Exit 0 when no page breaks a rule outside the allow list (layout-allow.json), 1 when one does,
// 2 when a page could not be opened.
import { chromium } from 'playwright';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { LAYOUT_RULES, allowed, layoutFindings } from './lib/layout-rules.mjs';
import { OUT, TOOLS } from './lib/paths.mjs';

const [jobsFile] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const jobs = JSON.parse(readFileSync(jobsFile, 'utf8'));
const allowFile = `${TOOLS}/layout-allow.json`;
const allowList = existsSync(allowFile) ? JSON.parse(readFileSync(allowFile, 'utf8')) : [];
const CONCURRENCY = 3;

const browser = await chromium.launch();
const results = [];
let next = 0;
async function worker() {
  const ctx = await browser.newContext({ deviceScaleFactor: 1, locale: 'en-GB' });
  while (next < jobs.length) {
    const job = jobs[next++];
    const page = await ctx.newPage();
    await page.setViewportSize({ width: job.width, height: 900 });
    const result = { ...job, error: null, findings: [] };
    try {
      // An error page has no layout to judge: it counts as a page not opened, never as a pass.
      const response = await page.goto(job.url, { waitUntil: 'networkidle', timeout: 60000 });
      if (response && response.status() >= 400) throw new Error(`HTTP ${response.status()}`);
      // The site's own welcome window covers the first visit of a home page: closed, as a visitor would.
      await page.waitForTimeout(2500);
      const close = page.locator('.mwnf-popup-logo__close').first();
      if (await close.isVisible().catch(() => false)) await close.click().catch(() => {});
      if (job.open === 'themes') {
        const expand = page.locator('.mwnf-dxa-themes-page__show-all').first();
        if (await expand.isVisible().catch(() => false)) await expand.click();
        // An accordion drawn with <details> (the composed themes page before 3.63.0) opens too.
        await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
        await page.waitForTimeout(1500);
      }
      // Judged screen by screen down the page (up to 6,000px), each finding once.
      const seen = new Set();
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < Math.min(height, 6000); y += 800) {
        await page.evaluate((top) => window.scrollTo(0, top), y);
        await page.waitForTimeout(150);
        for (const f of await page.evaluate(layoutFindings, LAYOUT_RULES)) {
          const key = `${f.rule}|${f.where}|${f.text}`;
          if (!seen.has(key)) result.findings.push(f);
          seen.add(key);
        }
      }
    } catch (e) {
      result.error = String(e).split('\n')[0];
    }
    for (const f of result.findings) f.allowed = allowed(f, job, allowList)?.reason ?? null;
    results.push(result);
    await page.close();
    if (results.length % 20 === 0) console.error(`  … ${results.length}/${jobs.length}`);
  }
  await ctx.close();
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
await browser.close();

results.sort((a, b) => a.id.localeCompare(b.id));
const failing = results.flatMap((r) => r.findings.filter((f) => !f.allowed).map((f) => ({ ...f, id: r.id, url: r.url })));
const accepted = results.flatMap((r) => r.findings.filter((f) => f.allowed).map((f) => ({ ...f, id: r.id })));
const broken = results.filter((r) => r.error);
writeFileSync(`${OUT}/layout.json`, JSON.stringify({ generatedAt: new Date().toISOString(), rules: LAYOUT_RULES, results }, null, 1));

const cell = (s) => String(s ?? '').replace(/\|/g, '\\|');
const detail = (f) => (f.rule === 'low-contrast' ? `${f.color} on ${f.background}, ${f.ratio}:1`
  : f.rule === 'narrow-text' ? `${f.words} words in ${f.width}px` : `${f.scrollWidth}px wide in ${f.clientWidth}px`);
const md = [
  '# Layout check',
  '',
  `${results.length} pages, ${failing.length} findings to fix, ${accepted.length} accepted (layout-allow.json), ${broken.length} pages not opened.`,
  'Rules: a block of more than 20 words narrower than 200px; text below 3:1 contrast on its background; a page that scrolls sideways.',
  '',
  ...(failing.length ? ['## Findings', '', '| Page | Rule | Where | Text | Detail |', '|---|---|---|---|---|',
    ...failing.map((f) => `| [${f.id}](${f.url}) | ${f.rule} | ${cell(f.where)} | ${cell(f.text)} | ${detail(f)} |`), ''] : []),
  ...(broken.length ? ['## Pages not opened', '', ...broken.map((r) => `- ${r.id}: ${r.error}`), ''] : []),
  ...(accepted.length ? ['## Accepted', '', '| Findings | Pages | Reason | e.g. |', '|---|---|---|---|',
    ...[...Map.groupBy(accepted, (f) => f.allowed)].map(([reason, list]) =>
      `| ${list.length} | ${new Set(list.map((f) => f.id)).size} | ${cell(reason)} | ${cell(list[0].id)}: ${cell(list[0].text)} |`), ''] : []),
];
writeFileSync(`${OUT}/layout.md`, md.join('\n'));
console.log(`layout: ${results.length} pages, ${failing.length} findings, ${accepted.length} accepted, ${broken.length} not opened`);
process.exit(broken.length ? 2 : failing.length ? 1 : 0);
