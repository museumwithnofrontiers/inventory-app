// Cached, throttled GET. Every legacy URL is fetched once: the answer (status + body)
// is kept under cache/, so reruns cost the legacy servers nothing.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

export const stats = { hit: 0, fetched: 0, failed: 0 };

export async function get(url, { refresh = false } = {}) {
  const key = createHash('sha1').update(url).digest('hex');
  const file = join(CACHE, key.slice(0, 2), key + '.json');
  if (!refresh && existsSync(file)) {
    stats.hit++;
    return JSON.parse(readFileSync(file, 'utf8'));
  }
  return slot(async () => {
    let last;
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        const res = await fetch(url, { headers: { 'user-agent': 'mwnf-parity-check/0.1 (read-only)' }, redirect: 'follow' });
        const body = await res.text();
        // Server errors are retried; a 404 is an answer and is cached like any other.
        if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
        const entry = { url, status: res.status, finalUrl: res.url, fetchedAt: new Date().toISOString(), body };
        mkdirSync(join(CACHE, key.slice(0, 2)), { recursive: true });
        writeFileSync(file, JSON.stringify(entry));
        stats.fetched++;
        if (stats.fetched % 50 === 0) console.error(`  … ${stats.fetched} fetched, ${stats.hit} cached`);
        return entry;
      } catch (e) {
        last = e;
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
