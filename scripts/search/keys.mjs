#!/usr/bin/env node
// @ts-check
/* global process, console, fetch, setTimeout */
/**
 * Creates the two restricted Meilisearch keys (M15 B5, ADR 005) and writes
 * them where their readers expect them. Run with the master key, once per
 * host and again after a fresh data directory; it is idempotent.
 *
 *   MEILI_URL=… MEILI_MASTER_KEY_FILE=… node keys.mjs --loader-key <file> --edge-include <file>
 *
 * - the loader key may build, swap and drop indexes, add documents and
 *   settings, and read tasks; it cannot manage keys, dumps or snapshots:
 *   written to --loader-key, for the loader;
 * - the search key may only search `items`: written as an nginx
 *   `proxy_set_header` line to --edge-include, so the edge adds it and no
 *   browser ever holds a key.
 *
 * Both keys have a fixed uid, so Meilisearch derives the same key from the
 * same master key every time: a re-run changes nothing.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export const LOADER_KEY = {
  uid: '6d77e6f1-5a1e-4c00-8000-000000000001',
  name: 'search-loader',
  description: 'M15 loader: builds, swaps and drops the items indexes (ADR 005)',
  actions: [
    'search', 'documents.add', 'documents.get', 'indexes.create', 'indexes.get', 'indexes.delete',
    'indexes.swap', 'indexes.update', 'settings.get', 'settings.update', 'stats.get', 'tasks.get',
  ],
  // Every index: Meilisearch shows a key only the tasks of its indexes, and an
  // index swap belongs to no index, so a key bound to `items*` could never see
  // its own swap finish. This Meilisearch holds nothing but the search indexes,
  // and the key still cannot manage keys, dumps or snapshots.
  indexes: ['*'],
  expiresAt: null,
}

export const SEARCH_KEY = {
  uid: '6d77e6f1-5a1e-4c00-8000-000000000002',
  name: 'search-public',
  description: 'M15 edge: searches the items index only (ADR 005)',
  actions: ['search'],
  indexes: ['items'],
  expiresAt: null,
}

/**
 * @param {string} url
 * @param {string} master
 * @param {typeof LOADER_KEY} spec
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<string>} the key
 */
export async function ensureKey(url, master, spec, fetchImpl = fetch) {
  const headers = { Authorization: `Bearer ${master}`, 'Content-Type': 'application/json' }
  const existing = await fetchImpl(`${url}/keys/${spec.uid}`, { headers })
  if (existing.ok) {
    const key = await existing.json()
    const same = JSON.stringify([...key.actions].sort()) === JSON.stringify([...spec.actions].sort()) &&
      JSON.stringify([...key.indexes].sort()) === JSON.stringify([...spec.indexes].sort())
    if (same) return key.key
    // Actions and indexes cannot be changed on a key: replace it.
    await fetchImpl(`${url}/keys/${spec.uid}`, { method: 'DELETE', headers })
  }
  const created = await fetchImpl(`${url}/keys`, { method: 'POST', headers, body: JSON.stringify(spec) })
  if (!created.ok) throw new Error(`creating ${spec.name}: ${created.status} ${await created.text()}`)
  return (await created.json()).key
}

/** @param {string} url */
async function waitHealthy(url) {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${url}/health`)).ok) return
    } catch {
      // not up yet
    }
    await new Promise(r => setTimeout(r, 1000))
  }
  throw new Error(`${url} is not healthy`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2)
  const arg = (/** @type {string} */ name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined)
  const url = (process.env['MEILI_URL'] ?? 'http://127.0.0.1:7700').replace(/\/+$/, '')
  const masterFile = process.env['MEILI_MASTER_KEY_FILE']
  const master = process.env['MEILI_MASTER_KEY'] ?? (masterFile && existsSync(masterFile) ? readFileSync(masterFile, 'utf-8').trim() : '')
  const loaderOut = arg('--loader-key')
  const edgeOut = arg('--edge-include')
  if (!master || !loaderOut || !edgeOut) {
    console.error('usage: MEILI_MASTER_KEY[_FILE]=… node keys.mjs --loader-key <file> --edge-include <file>')
    process.exit(64)
  }
  try {
    await waitHealthy(url)
    const loader = await ensureKey(url, master, LOADER_KEY)
    const search = await ensureKey(url, master, SEARCH_KEY)
    writeFileSync(loaderOut, `${loader}\n`, { mode: 0o600 })
    writeFileSync(edgeOut, `proxy_set_header Authorization "Bearer ${search}";\n`, { mode: 0o640 })
    console.log(`keys ready: ${LOADER_KEY.name} → ${loaderOut}, ${SEARCH_KEY.name} → ${edgeOut}`)
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }
}
