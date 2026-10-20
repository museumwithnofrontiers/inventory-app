// Cached, throttled GET. Every legacy URL is fetched once: the answer (status + body)
// is kept under cache/, so reruns cost the legacy servers nothing.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { CACHE } from './paths.mjs';
mkdirSync(CACHE, { recursive: true });

let active = 0;
const queue = [];
const LIMIT = Number(process.env.PARITY_CONCURRENCY ?? 3);
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

async function slot(fn) {
  if (active >= LIMIT) await new Promise((r) => queue.push(r));
  active++;
  try {
    return await fn();
  } finally {
    active--;
    queue.shift()?.();
  }
}

// The only hosts the tool reads: the legacy sites, the inventory's public images, the npm
// registry and jsDelivr, the org site's sites.json and the new sites. Most URLs come out of
// packages and legacy pages, so one pointing anywhere else is refused, never fetched; so is
// a redirect that leaves these hosts.
const HOSTS = /^(?:[a-z0-9-]+\.)*museumwnf\.org$|^(?:inventory\.metanull\.eu|registry\.npmjs\.org|cdn\.jsdelivr\.net|museumwithnofrontiers\.github\.io|raw\.githubusercontent\.com)$/;
export function allowedUrl(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  return u.protocol === 'https:' && HOSTS.test(u.hostname) ? u : null;
}

export const stats = { hit: 0, fetched: 0, failed: 0, refused: 0 };
const HEADERS = { 'user-agent': 'mwnf-parity-check/0.1 (read-only)' };

// Follows redirects by hand, so that every hop is checked against the allowed hosts.
async function fetchAllowed(start) {
  let target = start;
  for (let hop = 0; hop < 6; hop++) {
    const res = await fetch(target.href, { headers: HEADERS, redirect: 'manual' });
    const location = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;
    if (!location) return { res, finalUrl: target.href };
    await res.body?.cancel();
    target = allowedUrl(new URL(location, target).href);
    if (!target) throw Object.assign(new Error(`redirect to a host the tool does not read: ${location}`), { refused: true });
  }
  throw new Error('too many redirects');
}

export async function get(url, { refresh = false } = {}) {
  const safe = allowedUrl(url);
  if (!safe) {
    stats.refused++;
    return { url, status: 'refused', error: 'not a host the tool reads', body: '' };
  }
  const key = createHash('sha1').update(url).digest('hex');
  const file = join(CACHE, key.slice(0, 2), key + '.json');
  if (!refresh) {
    try {
      const entry = JSON.parse(readFileSync(file, 'utf8'));
      stats.hit++;
      return entry;
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
  }
  return slot(async () => {
    let last;
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        const { res, finalUrl } = await fetchAllowed(safe);
        const body = await res.text();
        // Server errors are retried; a 404 is an answer and is cached like any other.
        if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
        const entry = { url, status: res.status, finalUrl, fetchedAt: new Date().toISOString(), body };
        mkdirSync(join(CACHE, key.slice(0, 2)), { recursive: true });
        writeFileSync(file, JSON.stringify(entry));
        stats.fetched++;
        if (stats.fetched % 50 === 0) console.error(`  … ${stats.fetched} fetched, ${stats.hit} cached`);
        return entry;
      } catch (e) {
        last = e;
        if (e.refused) break;
        await pause(1500 * attempt);
      }
    }
    stats.failed++;
    return { url, status: 0, error: String(last), body: '' };
  });
}

export async function getJson(url, opts) {
  const r = await get(url, opts);
  if (r.status !== 200) return { status: r.status, json: null };
  try {
    return { status: 200, json: JSON.parse(r.body) };
  } catch {
    return { status: 'not-json', json: null };
  }
}

// Run fn over items with the shared concurrency limit; keeps input order.
export async function mapAll(items, fn) {
  return Promise.all(items.map((x, i) => fn(x, i)));
}
