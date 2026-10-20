// Runs in the parity service (mcr.microsoft.com/playwright:v1.63.0-jammy):
//   node tools/capture.mjs <jobs.json> [--force]
// jobs.json: [{ id, url, width? }]. For each: shots/<id>.jpg (viewport + up to 3,000px of the page)
// and shots/<id>.json, a style signature independent of the DOM:
//   bg       painted background colour per grid sample (48×32 points), images counted apart
//   text     text colour weighted by visible text length
//   fonts    first font family weighted by visible text length
//   marks    computed styles of landmarks (body, header, nav, h1–h3, links, buttons, footer)
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { SHOTS } from './lib/paths.mjs';

const [jobsFile] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const force = process.argv.includes('--force');
const jobs = JSON.parse(readFileSync(jobsFile, 'utf8'));
mkdirSync(`${SHOTS}`, { recursive: true });

// Cookie banners are hidden, not answered.
const HIDE = '#termsfeed-com---nb, .termsfeed-com---nb, .termsfeed-com---palette-dark, .termsfeed-com---palette-light, #cookie-consent, .cc-window, .cookie-banner { display: none !important; }';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1, locale: 'en-GB' });
let done = 0;
for (const job of jobs) {
  const out = `${SHOTS}/${job.id}`;
  if (!force && existsSync(`${out}.json`)) { done++; continue; }
  const page = await ctx.newPage();
  if (job.width) await page.setViewportSize({ width: job.width, height: 900 });
  const t = Date.now();
  let status = null;
  let error = null;
  try {
    const res = await page.goto(job.url, { waitUntil: 'networkidle', timeout: 60000 });
    status = res?.status() ?? null;
  } catch (e) {
    error = String(e).split('\n')[0];
  }
  try {
    await page.addStyleTag({ content: HIDE });
    await page.waitForTimeout(2500); // SPA renders, lazy images, web fonts
    const sig = await page.evaluate(signature);
    const height = Math.min(await page.evaluate(() => document.documentElement.scrollHeight), 3000);
    await page.screenshot({ path: `${out}.jpg`, type: 'jpeg', quality: 62, clip: { x: 0, y: 0, width: page.viewportSize().width, height: Math.max(900, height) }, fullPage: true });
    writeFileSync(`${out}.json`, JSON.stringify({ ...job, status, error, finalUrl: page.url(), ms: Date.now() - t, ...sig }));
  } catch (e) {
    writeFileSync(`${out}.json`, JSON.stringify({ ...job, status, error: error ?? String(e).split('\n')[0] }));
  }
  await page.close();
  if (++done % 10 === 0) console.error(`  … ${done}/${jobs.length}`);
}
await browser.close();
console.log(`captured ${done}/${jobs.length}`);

// ---- in the page
function signature() {
  const parse = (c) => {
    const m = String(c).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return a < 0.05 ? null : `#${[r, g, b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join('')}`;
  };
  const bgOf = (el) => {
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage && cs.backgroundImage !== 'none' && /url\(/.test(cs.backgroundImage)) return 'image';
      const c = parse(cs.backgroundColor);
      if (c) return c;
    }
    return parse(getComputedStyle(document.documentElement).backgroundColor) ?? '#ffffff';
  };
  const add = (m, k, n = 1) => { m[k] = (m[k] ?? 0) + n; };
  const W = innerWidth;
  const H = innerHeight;
  const bg = {};
  for (let y = 0; y < 32; y++) for (let x = 0; x < 48; x++) {
    const el = document.elementFromPoint((x + 0.5) * W / 48, (y + 0.5) * H / 32);
    if (!el) continue;
    const tag = el.tagName;
    add(bg, tag === 'IMG' || tag === 'VIDEO' || tag === 'CANVAS' || tag === 'svg' || tag === 'IFRAME' ? 'image' : bgOf(el));
  }
  const text = {};
  const fonts = {};
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const s = n.textContent.trim();
    if (!s) continue;
    const el = n.parentElement;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || r.top > H * 3) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
    const c = parse(cs.color);
    if (c) add(text, c, s.length);
    add(fonts, cs.fontFamily.split(',')[0].replace(/["']/g, '').trim().toLowerCase(), s.length);
  }
  const mark = (sel) => {
    const el = [...document.querySelectorAll(sel)].find((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
    if (!el) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return { color: parse(cs.color), bg: bgOf(el), font: cs.fontFamily.split(',')[0].replace(/["']/g, '').trim().toLowerCase(), size: cs.fontSize, weight: cs.fontWeight, transform: cs.textTransform, height: Math.round(r.height), top: Math.round(r.top + scrollY) };
  };
  const marks = {
    body: mark('body'), header: mark('header, .header, #header, [role=banner]'), nav: mark('nav, .navbar, .menu, [role=navigation]'),
    h1: mark('h1'), h2: mark('h2'), h3: mark('h3'), link: mark('main a[href], #app a[href], a[href]'), button: mark('button, .btn, .button, .mwnf-button'), footer: mark('footer, .footer, #footer, [role=contentinfo]'),
  };
  return { title: document.title, bg, text, fonts, marks, scrollHeight: document.documentElement.scrollHeight };
}
