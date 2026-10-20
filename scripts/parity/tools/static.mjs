// Runs in the Playwright container: node tools/static.mjs <jobs.json> [--force]
// For each page: the main text as paragraphs (header, menus, footer and cookie banners removed),
// every link with its text, and for new sites the text of the JavaScript the page loads (the i18n
// dictionaries are bundled there). With crawl: true, also records the same-site static pages the
// page links to (one level). Writes static/<id>.json and static/<slug>--bundle.txt.
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { STATIC } from './lib/paths.mjs';

const [jobsFile] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const force = process.argv.includes('--force');
let jobs = JSON.parse(readFileSync(jobsFile, 'utf8'));
mkdirSync(`${STATIC}`, { recursive: true });
const STATIC_LINK = /about|sponsor|team|chronology|mission|recommended|credit|support|topics|bibliograph|contact|legal|policy|cookies|introduction/i;
const CURATORIAL = /database_item|database_results|pm_partner|hcr_|hb_result|pc_entrance|pclist|glossary|googlemap|export|popup|mycollection|partners\.php|database\.php|dynasties|gai\//i;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: 'en-GB' });
const seen = new Set();
for (let i = 0; i < jobs.length; i++) {
  const job = jobs[i];
  const out = `${STATIC}/${job.id}.json`;
  if (seen.has(job.url)) continue;
  seen.add(job.url);
  if (!force && existsSync(out) && !job.crawl) continue;
  const page = await ctx.newPage();
  const scripts = [];
  if (job.side === 'new') page.on('response', async (r) => { if (/\.m?js(\?|$)/.test(r.url()) && r.url().startsWith(new URL(job.url).origin)) { try { scripts.push(await r.text()); } catch { /* body already gone */ } } });
  let error = null;
  try {
    await page.goto(job.url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000);
  } catch (e) { error = String(e).split('\n')[0]; }
  let res = { paragraphs: [], links: [] };
  try {
    res = await page.evaluate(() => {
      const links = [...document.querySelectorAll('a[href]')].map((a) => ({ text: a.innerText.trim().replace(/\s+/g, ' '), href: a.href, inFooter: !!a.closest('footer, .footer, #footer, [role=contentinfo]') }));
      const root = (document.querySelector('main') ?? document.querySelector('#app') ?? document.body).cloneNode(true);
      root.querySelectorAll('header, nav, footer, script, style, noscript, [role=banner], [role=navigation], [role=contentinfo], .header, #header, .footer, #footer, .navbar, .menu, .cookie, [class*="cookie"], [id*="cookie"], [class*="termsfeed"], select, button').forEach((e) => e.remove());
      document.body.appendChild(root);
      root.style.cssText = 'position:absolute;left:-99999px;top:0;width:1200px';
      const text = root.innerText;
      root.remove();
      return { title: document.title, paragraphs: text.split(/\n+/).map((s) => s.replace(/\s+/g, ' ').trim()).filter((s) => s.length >= 3), links };
    });
  } catch {
    // The page never rendered: its error is already recorded.
  }
  if (job.side === 'new' && scripts.length && !existsSync(`${STATIC}/${job.slug}--bundle.txt`)) {
    const unescape = (s) => s.replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\'/g, "'");
    writeFileSync(`${STATIC}/${job.slug}--bundle.txt`, unescape(scripts.join('\n')));
  }
  writeFileSync(out, JSON.stringify({ ...job, error, finalUrl: page.url(), ...res }));
  // One level of same-site static pages (legacy PHP sites).
  if (job.crawl) {
    const origin = new URL(job.url).origin;
    for (const l of res.links) {
      if (!l.href.startsWith(origin) || CURATORIAL.test(l.href) || !STATIC_LINK.test(l.href) || /\.(jpg|png|pdf)$/i.test(l.href)) continue;
      const key = new URL(l.href).pathname.split('/').pop().replace(/\.php$/, '') + (new URL(l.href).search ? '-' + new URL(l.href).searchParams.toString().replace(/[^a-z0-9]+/gi, '_') : '');
      if (!jobs.some((j) => j.url === l.href)) jobs.push({ id: `${job.slug}--${key}--legacy`, url: l.href, slug: job.slug, page: key, side: 'legacy', crawl: job.depth ? false : true, depth: (job.depth ?? 0) + 1 });
    }
  }
  await page.close();
  if ((i + 1) % 10 === 0) console.error(`  … ${i + 1}/${jobs.length}`);
}
await browser.close();
console.log(`recorded ${seen.size} pages`);
