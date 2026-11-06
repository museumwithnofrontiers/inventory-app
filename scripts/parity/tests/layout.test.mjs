// The layout rules (#2379, part A) on small pages that reproduce what the 2026-10-27 review found:
// a theme text squeezed into a narrow column, black theme rows on black, and what must not count.
// Runs Chromium: in the parity service (`docker compose run --rm parity npm test`).
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import { LAYOUT_RULES, allowed, layoutFindings } from '../tools/lib/layout-rules.mjs';

let browser;
let page;
before(async () => {
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
});
after(async () => browser?.close());

const words = (n) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');
const findings = async (body, style = '') => {
  await page.setContent(`<!doctype html><html><head><style>body{margin:0;font:16px sans-serif}${style}</style></head><body>${body}</body></html>`);
  return page.evaluate(layoutFindings, LAYOUT_RULES);
};
const rules = (list) => list.map((f) => f.rule);

test('a long text in a narrow column is found', async () => {
  const list = await findings(`<div style="display:flex"><div style="width:52px"><p>${words(40)}</p></div><div style="flex:1">x</div></div>`);
  const narrow = list.find((f) => f.rule === 'narrow-text');
  assert.ok(narrow);
  assert.equal(narrow.width, 52);
  assert.ok(narrow.words >= 40);
});

test('a short label in a narrow box is not', async () => {
  assert.deepEqual(rules(await findings(`<div style="width:80px"><span>${words(5)}</span></div>`)), []);
});

test('black text on a black row is found, with its colours', async () => {
  const list = await findings('<div style="background:#000;color:#000;padding:10px">Theme I ▪ The railway</div>');
  assert.deepEqual(rules(list), ['low-contrast']);
  assert.equal(list[0].color, '#000000');
  assert.equal(list[0].background, '#000000');
  assert.equal(list[0].ratio, 1);
});

test('a translucent layer is laid over the colour under it', async () => {
  // White text on 55% black over white: grey, about 4.8:1, so it passes.
  const ok = await findings('<div style="background:#fff"><div style="background:rgba(0,0,0,.55);color:#fff;padding:10px">Headline</div></div>');
  assert.deepEqual(rules(ok), []);
  // The same text on 10% black over white does not.
  const faint = await findings('<div style="background:#fff"><div style="background:rgba(0,0,0,.1);color:#fff;padding:10px">Headline</div></div>');
  assert.deepEqual(rules(faint), ['low-contrast']);
});

test('text over a picture is not judged', async () => {
  const pixel = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
  const list = await findings(`<div style="position:relative;width:400px;height:200px;background:#fff"><img src="${pixel}" style="width:400px;height:200px"><p style="position:absolute;top:50px;left:10px;margin:0;color:#fff">Detail from a cushion</p></div>`);
  assert.deepEqual(rules(list), []);
});

test('text under a sticky header is judged on its own background, not the header', async () => {
  const list = await findings('<div style="position:fixed;top:0;left:0;right:0;height:300px;background:#000;z-index:2"></div><p style="margin:100px 0 0;color:#000">Under the header</p>');
  assert.deepEqual(rules(list), []);
});

test('a page wider than the window is found, unless the window clips it', async () => {
  const wide = '<div style="width:1600px;height:10px"></div>';
  assert.deepEqual(rules(await findings(wide)), ['h-scroll']);
  assert.deepEqual(rules(await findings(wide, 'body{overflow-x:hidden}')), []);
});

test('the allow list matches by site, place and colours', () => {
  const job = { slug: 'arts-in-dialogue', page: 'about', width: 1366 };
  const finding = { rule: 'low-contrast', where: 'ul.mwnf-nav__links > li > a.mwnf-nav__link', text: 'Themes', color: '#ffffff', background: '#6495ed' };
  const list = [
    { rule: 'low-contrast', slug: 'arts-in-dialogue', pair: '#ffffff on #6495ed', reason: 'palette' },
    { rule: 'low-contrast', where: 'mwnf-header__title', reason: 'title' },
  ];
  assert.equal(allowed(finding, job, list)?.reason, 'palette');
  assert.equal(allowed(finding, { ...job, slug: 'water-in-islam' }, list), null);
  assert.equal(allowed({ ...finding, where: 'a.mwnf-header__lockup > p.mwnf-header__title' }, { ...job, slug: 'water-in-islam' }, list)?.reason, 'title');
});
