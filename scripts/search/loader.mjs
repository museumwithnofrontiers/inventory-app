#!/usr/bin/env node
// @ts-check
/**
 * The search loader (M15 B3, ADR 005): loads one version of
 * @museumwnf/search-data into Meilisearch, and nothing else ever writes to it.
 *
 *   node loader.mjs                 load the pinned package (node_modules), unless it is live
 *   node loader.mjs --from-dir <d>  load a local export instead (local Docker only)
 *   node loader.mjs --force         load even when that version is live
 *   node loader.mjs --rollback      swap back to the previous version
 *
 * Environment: MEILI_URL (default http://127.0.0.1:7700), and the loader's key
 * in MEILI_KEY or in the file MEILI_KEY_FILE. The key is restricted to the
 * `items*` and `search_state` indexes; the master key is never used here.
 *
 * Steps (a failure at any step leaves the live index untouched):
 *   1. the package is checked against mwnf.search/1, shard SHA-256 included;
 *   2. `items_build` is created with settings.json, expanded to the package's languages;
 *   3. the documents are added, shard by shard, and every task is awaited;
 *   4. the count is checked against the manifest and probes.json is run;
 *   5. `items_build` is swapped with `items`, and what was live becomes `items_previous`.
 *
 * Integrity and provenance of the npm tarball are checked before this runs,
 * by `npm ci` (the lockfile's integrity) and `npm audit signatures` (see
 * deploy-search-ovh.yml and the README).
 */

import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { validatePackage } from '../exporters/search/schema/validate.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
export const LIVE = 'items'
export const BUILD = 'items_build'
export const PREVIOUS = 'items_previous'
export const STATE = 'search_state'

/**
 * Meilisearch settings from settings.json: every `texts.*.` field expanded
 * to each language, in order.
 *
 * @param {any} template settings.json
 * @param {string[]} languages the package's languages
 */
export function expandSettings(template, languages) {
  /** @param {string[]} fields */
  const expand = fields => fields.flatMap(f => (f.startsWith('texts.*.') ? languages.map(l => f.replace('*', l)) : [f]))
  const localizedAttributes = languages
    .filter(l => template.locales[l])
    .map(l => ({ attributePatterns: [`texts.${l}.*`], locales: [template.locales[l]] }))
  return {
    searchableAttributes: expand(template.searchable),
    displayedAttributes: expand(template.displayed),
    filterableAttributes: template.filterable,
    sortableAttributes: template.sortable,
    localizedAttributes,
    synonyms: template.synonyms,
    typoTolerance: { disableOnAttributes: template.exact },
    pagination: { maxTotalHits: template.maxTotalHits },
  }
}

/** A minimal Meilisearch client: JSON in and out, every task awaited. */
export class Meili {
  /**
   * @param {string} url
   * @param {string} key
   * @param {typeof fetch} [fetchImpl]
   */
  constructor(url, key, fetchImpl = fetch) {
    this.url = url.replace(/\/+$/, '')
    this.key = key
    this.fetch = fetchImpl
  }

  /**
   * @param {string} method
   * @param {string} path
   * @param {unknown} [body]
   * @param {{ raw?: string, contentType?: string, allow404?: boolean }} [options]
   */
  async request(method, path, body, options = {}) {
    const headers = { Authorization: `Bearer ${this.key}` }
    let payload
    if (options.raw !== undefined) {
      payload = options.raw
      headers['Content-Type'] = options.contentType ?? 'application/x-ndjson'
    } else if (body !== undefined) {
      payload = JSON.stringify(body)
      headers['Content-Type'] = 'application/json'
    }
    const response = await this.fetch(`${this.url}${path}`, { method, headers, body: payload })
    if (response.status === 404 && options.allow404) return null
    const text = await response.text()
    const json = text ? JSON.parse(text) : null
    if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${json?.message ?? text}`)
    return json
  }

  /** @param {{ taskUid: number } | null} task */
  async wait(task, timeoutMs = 30 * 60 * 1000) {
    if (!task) return null
    const started = Date.now()
    for (let delay = 50; ; delay = Math.min(delay * 2, 2000)) {
      const t = await this.request('GET', `/tasks/${task.taskUid}`)
      if (t.status === 'succeeded') return t
      if (t.status === 'failed' || t.status === 'canceled') throw new Error(`task ${task.taskUid} ${t.status}: ${t.error?.message ?? ''}`)
      if (Date.now() - started > timeoutMs) throw new Error(`task ${task.taskUid} did not finish in time`)
      await new Promise(r => setTimeout(r, delay))
    }
  }

  /** @param {string} uid */
  async exists(uid) {
    return (await this.request('GET', `/indexes/${uid}`, undefined, { allow404: true })) !== null
  }

  /** @param {string} uid */
  async drop(uid) {
    // Meilisearch enqueues the deletion of a missing index and fails the task, so ask first.
    if (!(await this.exists(uid))) return
    await this.wait(await this.request('DELETE', `/indexes/${uid}`))
  }

  /** @param {string} uid */
  async create(uid) {
    await this.wait(await this.request('POST', '/indexes', { uid, primaryKey: 'id' }))
  }

  /** @param {string} a @param {string} b */
  async swap(a, b) {
    await this.wait(await this.request('POST', '/swap-indexes', [{ indexes: [a, b] }]))
  }

  /** @returns {Promise<{ live: any, previous: any }>} */
  async state() {
    const doc = (await this.exists(STATE)) ? await this.request('GET', `/indexes/${STATE}/documents/state`, undefined, { allow404: true }) : null
    return { live: doc?.live ?? null, previous: doc?.previous ?? null }
  }

  /** @param {{ live: any, previous: any }} state */
  async saveState(state) {
    if (!(await this.exists(STATE))) await this.create(STATE)
    await this.wait(await this.request('POST', `/indexes/${STATE}/documents`, [{ id: 'state', ...state }]))
  }
}

/** The version of a package folder: its package.json's, or a local export's hash. */
export function versionOf(dir) {
  const pkg = join(dir, 'package.json')
  if (existsSync(pkg)) return JSON.parse(readFileSync(pkg, 'utf-8')).version
  return `local-${createHash('sha256').update(readFileSync(join(dir, 'manifest.json'))).digest('hex').slice(0, 12)}`
}

/** The pinned package's folder in this directory's node_modules. */
export function pinnedDir() {
  const require = createRequire(join(HERE, 'package.json'))
  return dirname(require.resolve('@museumwnf/search-data/package.json'))
}

/**
 * Runs the probes against an index; returns the failures.
 *
 * @param {Meili} meili
 * @param {string} uid
 * @param {any[]} probes
 * @param {Record<string, string>} locales
 */
export async function runProbes(meili, uid, probes, locales) {
  const failures = []
  for (const probe of probes) {
    const body = {
      q: probe.q,
      limit: probe.top ?? 5,
      matchingStrategy: 'all',
      attributesToRetrieve: ['id', `texts.${probe.lang}.name`],
      filter: `languages = "${probe.lang}"`,
      ...(locales[probe.lang] ? { locales: [locales[probe.lang]] } : {}),
    }
    const result = await meili.request('POST', `/indexes/${uid}/search`, body)
    const hits = result?.hits ?? []
    const names = hits.map((/** @type {any} */ h) => h.texts?.[probe.lang]?.name ?? '')
    let ok = hits.length > 0
    if (probe.id) ok = ok && hits.some((/** @type {any} */ h) => h.id === probe.id)
    if (probe.name) ok = ok && names.some((/** @type {string} */ n) => n.includes(probe.name))
    if (!ok) failures.push(`${probe.why}: "${probe.q}" (${probe.lang}) gave ${JSON.stringify(names)}`)
  }
  return failures
}

/**
 * Loads a package folder into Meilisearch.
 *
 * @param {{ meili: Meili, dir: string, settings: any, probes: any[], force?: boolean, log?: (m: string) => void }} options
 * @returns {Promise<{ changed: boolean, version: string, documents: number }>}
 */
export async function load({ meili, dir, settings, probes, force = false, log = console.log }) {
  const { errors, documents } = validatePackage(dir)
  if (errors.length > 0) throw new Error(`the package is not mwnf.search/1:\n  ${errors.slice(0, 20).join('\n  ')}`)
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf-8'))
  const version = versionOf(dir)

  const state = await meili.state()
  if (!force && state.live?.version === version && (await meili.exists(LIVE))) {
    const stats = await meili.request('GET', `/indexes/${LIVE}/stats`)
    if (stats.numberOfDocuments === documents) {
      log(`${version} is already live (${documents} documents): nothing to load`)
      return { changed: false, version, documents }
    }
  }

  log(`loading ${version}: ${documents} documents in ${manifest.languages.length} languages`)
  await meili.drop(BUILD)
  await meili.create(BUILD)
  await meili.wait(await meili.request('PATCH', `/indexes/${BUILD}/settings`, expandSettings(settings, manifest.languages)))
  for (const shard of manifest.shards) {
    if (shard.documents === 0) continue
    const raw = readFileSync(join(dir, shard.file), 'utf-8')
    await meili.wait(await meili.request('POST', `/indexes/${BUILD}/documents?primaryKey=id`, undefined, { raw }))
  }

  const stats = await meili.request('GET', `/indexes/${BUILD}/stats`)
  if (stats.numberOfDocuments !== documents) {
    await meili.drop(BUILD)
    throw new Error(`${BUILD} holds ${stats.numberOfDocuments} documents, the manifest says ${documents}`)
  }
  const failures = await runProbes(meili, BUILD, probes, settings.locales)
  if (failures.length > 0) {
    await meili.drop(BUILD)
    throw new Error(`probes failed, the live index is unchanged:\n  ${failures.join('\n  ')}`)
  }

  if (!(await meili.exists(LIVE))) await meili.create(LIVE)
  await meili.swap(LIVE, BUILD)
  // BUILD now holds what was live: keep it as the previous version.
  await meili.drop(PREVIOUS)
  await meili.create(PREVIOUS)
  await meili.swap(BUILD, PREVIOUS)
  await meili.drop(BUILD)
  await meili.saveState({
    live: { version, documents, loaded_at: new Date().toISOString() },
    previous: state.live,
  })
  log(`${version} is live${state.live ? `; ${state.live.version} kept as the previous version` : ''}`)
  return { changed: true, version, documents }
}

/**
 * Swaps the previous version back in.
 *
 * @param {{ meili: Meili, log?: (m: string) => void }} options
 */
export async function rollback({ meili, log = console.log }) {
  const state = await meili.state()
  if (!state.previous || !(await meili.exists(PREVIOUS))) throw new Error('there is no previous version to roll back to')
  await meili.swap(LIVE, PREVIOUS)
  await meili.saveState({ live: state.previous, previous: state.live })
  log(`${state.previous.version} is live again; ${state.live?.version ?? 'nothing'} is now the previous version`)
}

function readKey() {
  if (process.env['MEILI_KEY']) return process.env['MEILI_KEY']
  const file = process.env['MEILI_KEY_FILE']
  if (file && existsSync(file)) return readFileSync(file, 'utf-8').trim()
  throw new Error('set MEILI_KEY or MEILI_KEY_FILE to the loader key')
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2)
  const has = (/** @type {string} */ flag) => args.includes(flag)
  const fromDir = args.includes('--from-dir') ? args[args.indexOf('--from-dir') + 1] : null
  try {
    const meili = new Meili(process.env['MEILI_URL'] ?? 'http://127.0.0.1:7700', readKey())
    if (has('--rollback')) {
      await rollback({ meili })
    } else {
      const settings = JSON.parse(readFileSync(join(HERE, 'settings.json'), 'utf-8'))
      const probes = JSON.parse(readFileSync(join(HERE, 'probes.json'), 'utf-8')).probes
      const dir = fromDir ? resolve(fromDir) : pinnedDir()
      await load({ meili, dir, settings, probes, force: has('--force') })
    }
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }
}
