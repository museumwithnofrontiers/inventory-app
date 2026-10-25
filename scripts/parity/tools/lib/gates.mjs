// Package checks that need no legacy side: they read only the data package, so they catch a bad
// export before anything is published. Both caught a regression that reached production on
// 2026-10-19 (relative image URLs, raw HTML in texts).
import { readFileSync, readdirSync, statSync } from 'node:fs';

// The stable public route: the npm packages bake it in, so it never changes.
export const GOOD_IMAGE_URL = /^https:\/\/inventory\.metanull\.eu\/pub\/[0-9a-f-]{36}\.(jpe?g|png|gif|webp)$/i;
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|svg)$/i;

// Legacy markup the importer converts to Markdown. Only real tag shapes count, so "< 5 cm" or a
// Markdown autolink (<https://…>) is not a hit.
const TAGS = 'p|br|i|b|em|strong|span|div|a|ul|ol|li|sup|sub|font|u|h[1-6]|table|thead|tbody|tr|td|th|img|blockquote|small|center|hr|pre|code|iframe|object|embed|script|style';
export const HTML_TAG = new RegExp(`<\\/?(${TAGS})(\\s[^<>]*)?\\/?>`, 'i');

// Gallery anchors, portal images and book covers keep the legacy image path on purpose: the
// viewers resolve it on the legacy image host. Only an image named under `url`, or anything that
// points at the inventory, must be a /pub/<uuid> file.
const isImageRef = (key, value) => (key === 'url' && IMAGE_EXT.test(value)) || /inventory\.metanull\.eu|(^|\/)pub\//.test(value);

function* jsonFiles(root, dir = '') {
  for (const name of readdirSync(`${root}/${dir}`).sort()) {
    const rel = dir ? `${dir}/${name}` : name;
    if (name === 'node_modules') continue;
    if (statSync(`${root}/${rel}`).isDirectory()) yield* jsonFiles(root, rel);
    else if (name.endsWith('.json') && name !== 'package.json') yield rel;
  }
}

function* strings(value, path = '', key = '') {
  if (typeof value === 'string') yield { path, key, value };
  else if (Array.isArray(value)) for (let i = 0; i < value.length; i++) yield* strings(value[i], `${path}[${i}]`, key);
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) yield* strings(v, path ? `${path}.${k}` : k, k);
}

// Scans every JSON file of an unpacked package (or an exporter's output directory).
export function scanPackage(root, { max = 20 } = {}) {
  const images = { total: 0, bad: 0, samples: [] };
  const html = { total: 0, bad: 0, samples: [] };
  for (const file of jsonFiles(root)) {
    const data = JSON.parse(readFileSync(`${root}/${file}`, 'utf8'));
    for (const { path, key, value } of strings(data)) {
      if (isImageRef(key, value)) {
        images.total++;
        if (!GOOD_IMAGE_URL.test(value)) {
          images.bad++;
          if (images.samples.length < max) images.samples.push({ where: `${file}: ${path}`, value });
        }
        continue;
      }
      html.total++;
      const m = value.match(HTML_TAG);
      if (m) {
        html.bad++;
        if (html.samples.length < max) html.samples.push({ where: `${file}: ${path}`, tag: m[0], value: value.length > 160 ? value.slice(0, 160) + '…' : value });
      }
    }
  }
  return { images, html };
}
