// Runs in the Playwright container: node tools/assets.mjs <jobs.json> [--force]
// For each page: every image the page loads (network), where it is used (<img>, CSS background,
// favicon) with its rendered box, saved under assets/<sha1>.<ext>; inventory in assets/<id>.json.
// Curatorial pictures (objects, monuments, partners, the inventory's /pub) are recorded but flagged.
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { ASSETS } from './lib/paths.mjs';

const [jobsFile] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const force = process.argv.includes('--force');
const jobs = JSON.parse(readFileSync(jobsFile, 'utf8'));
mkdirSync(`${ASSETS}/files`, { recursive: true });

const CONTENT = /images\.museumwnf\.org\/[^/]+\/+(objects|monuments|museums|institutions|sharing_history\/sh_(objects|monuments|partners)|explore\/monuments|travels|partners)\/|inventory\.metanull\.eu\/pub\/|tile\.openstreetmap|maps\.(googleapis|gstatic)\.com|khms|\.tile\./i;
const ext = (ct, url) => (/svg/.test(ct) ? 'svg' : /png/.test(ct) ? 'png' : /gif/.test(ct) ? 'gif' : /webp/.test(ct) ? 'webp' : /icon/.test(ct) || /\.ico(\?|$)/.test(url) ? 'ico' : 'jpg');

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: 'en-GB' });
let n = 0;
for (const job of jobs) {
  const out = `${ASSETS}/${job.id}.json`;
  if (!force && existsSync(out)) { n++; continue; }
  const page = await ctx.newPage();
  const files = new Map(); // url → { sha, bytes, type }
  page.on('response', async (res) => {
    const ct = res.headers()['content-type'] ?? '';
    const url = res.url();
    if (!/^image\//.test(ct) && !/\.(png|jpe?g|gif|svg|webp|ico)(\?|$)/i.test(url)) return;
    try {
      const body = await res.body();
      const sha = createHash('sha1').update(body).digest('hex');
      const name = `${sha}.${ext(ct, url)}`;
      if (!existsSync(`${ASSETS}/files/${name}`)) writeFileSync(`${ASSETS}/files/${name}`, body);
      files.set(url, { file: name, bytes: body.length, type: ct, status: res.status() });
    } catch {
      // The response body is gone (redirect, aborted request): nothing to keep.
    }
  });
  let error = null;
  try {
    await page.goto(job.url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000);
    // Scroll once to the bottom so lazy footers and sponsor strips load.
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } scrollTo(0, 0); });
    await page.waitForTimeout(1500);
  } catch (e) { error = String(e).split('\n')[0]; }
  let uses = [];
  try {
    uses = await page.evaluate(() => {
      const abs = (u) => { try { return new URL(u, location.href).href; } catch { return u; } };
      const region = (r) => (r.top + scrollY < 140 ? 'header' : r.top + scrollY < 620 ? 'banner' : r.top + scrollY > document.documentElement.scrollHeight - 260 ? 'footer' : 'body');
      const list = [];
      for (const img of document.querySelectorAll('img')) {
        const r = img.getBoundingClientRect();
        if (!img.currentSrc && !img.src) continue;
        list.push({ how: 'img', url: abs(img.currentSrc || img.src), alt: img.alt || '', w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top + scrollY), region: region(r), visible: r.width > 0 && r.height > 0, cls: String(img.className || '').slice(0, 60) });
      }
      for (const el of document.querySelectorAll('*')) {
        const bg = getComputedStyle(el).backgroundImage;
        if (!bg || bg === 'none') continue;
        for (const m of bg.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
          const r = el.getBoundingClientRect();
          list.push({ how: 'css', url: abs(m[1]), alt: '', w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top + scrollY), region: region(r), visible: r.width > 0 && r.height > 0, cls: `${el.tagName.toLowerCase()}.${String(el.className || '').slice(0, 50)}` });
        }
      }
      for (const l of document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]')) list.push({ how: 'icon', url: abs(l.href), alt: l.rel, w: 0, h: 0, top: 0, region: 'icon', visible: true, cls: l.getAttribute('sizes') || '' });
      return list;
    });
  } catch {
    // The page never rendered: its error is already recorded above.
  }
  // Favicons are not always requested by a headless page: fetch the declared ones.
  for (const u of uses.filter((x) => x.how === 'icon' && !files.has(x.url))) {
    try {
      const r = await ctx.request.get(u.url);
      const body = await r.body();
      const sha = createHash('sha1').update(body).digest('hex');
      const name = `${sha}.${ext(r.headers()['content-type'] ?? '', u.url)}`;
      if (!existsSync(`${ASSETS}/files/${name}`)) writeFileSync(`${ASSETS}/files/${name}`, body);
      files.set(u.url, { file: name, bytes: body.length, type: r.headers()['content-type'], status: r.status() });
    } catch {
      // A declared icon that does not answer is recorded without a file.
    }
  }
  const rows = uses.filter((u) => !u.url.startsWith('data:') || u.how === 'icon').map((u) => ({ ...u, content: CONTENT.test(u.url), ...(files.get(u.url) ?? {}) }));
  writeFileSync(out, JSON.stringify({ ...job, error, finalUrl: page.url(), assets: rows }));
  await page.close();
  if (++n % 10 === 0) console.error(`  … ${n}/${jobs.length}`);
}
await browser.close();
console.log(`recorded ${n}/${jobs.length}`);
