// Runs in the parity service (playwright):
//   node tools/links.mjs <jobs.json> [--force]
// jobs.json: [{ id, url, slug, page }], new pages only (jobs-links.mjs). For each page, every
// anchor it holds once rendered, shown or not (a closed menu's links are links of the site too):
// its address, its words and the landmark it sits in. Writes links/<id>.json, reused on the
// next run unless --force; compare-links.mjs judges them.
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { LINKS } from './lib/paths.mjs';

const [jobsFile] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const force = process.argv.includes('--force');
const jobs = JSON.parse(readFileSync(jobsFile, 'utf8'));
mkdirSync(LINKS, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: 'en-GB' });
let done = 0;
for (const job of jobs) {
  const out = `${LINKS}/${job.id}.json`;
  if (!force && existsSync(out) && JSON.parse(readFileSync(out, 'utf8')).url === job.url) {
    done++;
    continue;
  }
  const page = await ctx.newPage();
  let error = null;
  let anchors = [];
  try {
    await page.goto(job.url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2500); // the SPA renders and loads its package
    anchors = await page.evaluate(() =>
      [...document.querySelectorAll('a[href]')].map((a) => ({
        href: a.href,
        text: (a.textContent || a.getAttribute('aria-label') || a.title || '').replace(/\s+/g, ' ').trim().slice(0, 80),
        shown: a.checkVisibility(),
        in: a.closest('header, nav, footer, aside, main')?.tagName.toLowerCase() ?? null,
      })),
    );
  } catch (e) {
    error = String(e).split('\n')[0];
  }
  writeFileSync(out, JSON.stringify({ ...job, error, anchors }));
  await page.close();
  if (++done % 10 === 0) console.error(`  … ${done}/${jobs.length}`);
}
await browser.close();
console.log(`read ${done}/${jobs.length}`);
