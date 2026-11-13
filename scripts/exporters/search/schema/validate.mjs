// @ts-check
/* global process, console */
/**
 * Checks a @museumwnf/search-data folder against mwnf.search/1
 * (mwnf.search-1.schema.json, ADR 005), with no dependency, so that the
 * exporter's tests, the loader (scripts/search) and data-packages' CI can
 * all run it. data-packages keeps a copy in scripts/search-data.mjs: change
 * both together.
 *
 *   node validate.mjs <package-dir>   exits 1 and prints every error
 */

import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export const SCHEMA = 'mwnf.search/1'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/
const LANG = /^[a-z]{2}$/
const ORIGIN = /^https:\/\/[^/?#@]+(\/[^/?#]+)*$/
const TYPES = ['object', 'monument', 'detail']
const DOC_KEYS = [
  'id', 'type', 'parent_id', 'backward_compatibility', 'mwnf_reference', 'owner_reference', 'start_date',
  'end_date', 'partner_id', 'country_id', 'picture', 'sites', 'languages', 'tags', 'texts',
]
const TEXT_LISTS = [
  'names', 'short_description', 'description', 'type', 'holder', 'dates', 'place', 'dynasty', 'artist',
  'history', 'keywords', 'materials', 'tags', 'partner',
]
const SHARDS = '0123456789abcdef'.split('').map(h => `documents/${h}.ndjson`)

/** @param {unknown} v */
const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v)
/** @param {unknown} v */
const isStrings = v => Array.isArray(v) && v.every(s => typeof s === 'string' && s !== '')
/** @param {unknown} v */
const nullableString = v => v === null || typeof v === 'string'

/**
 * The errors of one document; empty when it is valid.
 *
 * @param {unknown} doc
 * @param {Set<string>} slugs
 * @returns {string[]}
 */
export function documentErrors(doc, slugs) {
  if (!isObject(doc)) return ['not an object']
  const d = /** @type {Record<string, unknown>} */ (doc)
  const errors = []
  const keys = Object.keys(d)
  for (const key of DOC_KEYS) if (!keys.includes(key)) errors.push(`missing "${key}"`)
  for (const key of keys) if (!DOC_KEYS.includes(key)) errors.push(`unknown "${key}"`)
  if (typeof d['id'] !== 'string' || !UUID.test(d['id'])) errors.push('"id" is not a UUID')
  if (!TYPES.includes(/** @type {string} */ (d['type']))) errors.push(`"type" ${JSON.stringify(d['type'])} is not searched`)
  for (const key of ['parent_id', 'partner_id']) {
    if (d[key] !== null && (typeof d[key] !== 'string' || !UUID.test(/** @type {string} */ (d[key])))) errors.push(`"${key}" is not a UUID or null`)
  }
  for (const key of ['backward_compatibility', 'mwnf_reference', 'owner_reference', 'country_id']) {
    if (!nullableString(d[key])) errors.push(`"${key}" is not a string or null`)
  }
  for (const key of ['start_date', 'end_date']) {
    if (d[key] !== null && !Number.isInteger(d[key])) errors.push(`"${key}" is not an integer or null`)
  }
  if (d['picture'] !== null && (typeof d['picture'] !== 'string' || !d['picture'].startsWith('https://'))) {
    errors.push('"picture" is not an https address or null')
  }
  const sites = d['sites']
  if (!Array.isArray(sites) || sites.length === 0) errors.push('"sites" is empty: an item no site shows is left out')
  else {
    for (const link of sites) {
      if (!isObject(link) || Object.keys(link).sort().join() !== 'path,site') { errors.push('a site link is not {site, path}'); continue }
      const site = /** @type {Record<string, unknown>} */ (link)['site']
      const path = /** @type {Record<string, unknown>} */ (link)['path']
      if (typeof site !== 'string' || !slugs.has(site)) errors.push(`site ${JSON.stringify(site)} is not in sites.json`)
      if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) errors.push(`path ${JSON.stringify(path)} is not a route`)
    }
  }
  const languages = d['languages']
  const texts = d['texts']
  if (!Array.isArray(languages) || !languages.every(l => typeof l === 'string' && LANG.test(l))) errors.push('"languages" is not a list of codes')
  if (!isStrings(d['tags'])) errors.push('"tags" is not a list of strings')
  if (!isObject(texts)) errors.push('"texts" is not an object')
  else {
    const t = /** @type {Record<string, unknown>} */ (texts)
    if (Array.isArray(languages) && Object.keys(t).sort().join() !== [...languages].sort().join()) errors.push('"texts" and "languages" differ')
    for (const [lang, value] of Object.entries(t)) {
      if (!isObject(value)) { errors.push(`texts.${lang} is not an object`); continue }
      const v = /** @type {Record<string, unknown>} */ (value)
      if (typeof v['name'] !== 'string') errors.push(`texts.${lang}.name is not a string`)
      if (!nullableString(v['country'])) errors.push(`texts.${lang}.country is not a string or null`)
      for (const key of TEXT_LISTS) if (!isStrings(v[key])) errors.push(`texts.${lang}.${key} is not a list of strings`)
      for (const key of Object.keys(v)) if (key !== 'name' && key !== 'country' && !TEXT_LISTS.includes(key)) errors.push(`texts.${lang}: unknown "${key}"`)
    }
  }
  return errors
}

/**
 * Every error of a package folder; empty when it is valid.
 *
 * @param {string} dir
 * @returns {{ errors: string[], documents: number, ids: string[] }}
 */
export function validatePackage(dir) {
  /** @type {string[]} */
  const errors = []
  /** @param {string} file */
  const read = file => {
    const path = join(dir, file)
    if (!existsSync(path)) { errors.push(`${file}: missing`); return null }
    return readFileSync(path, 'utf-8')
  }
  /** @param {string} file */
  const readJson = file => {
    const text = read(file)
    if (text === null) return null
    try { return JSON.parse(text) } catch (err) { errors.push(`${file}: invalid JSON (${err instanceof Error ? err.message : err})`); return null }
  }

  const manifest = readJson('manifest.json')
  const sitesFile = readJson('sites.json')
  const slugs = new Set()
  if (sitesFile) {
    if (sitesFile.schema !== SCHEMA) errors.push(`sites.json: schema ${JSON.stringify(sitesFile.schema)} is not ${SCHEMA}`)
    for (const site of Array.isArray(sitesFile.sites) ? sitesFile.sites : []) {
      if (typeof site?.slug !== 'string' || !SLUG.test(site.slug)) { errors.push(`sites.json: slug ${JSON.stringify(site?.slug)} is not a slug`); continue }
      if (slugs.has(site.slug)) errors.push(`sites.json: slug ${site.slug} twice`)
      slugs.add(site.slug)
      if (typeof site.origin !== 'string' || !ORIGIN.test(site.origin)) errors.push(`sites.json: ${site.slug}'s origin is not a plain https address`)
      if (typeof site.item_path !== 'string' || !site.item_path.startsWith('/') || !site.item_path.includes(':id')) errors.push(`sites.json: ${site.slug}'s item_path is not a route with :id`)
      if (site.parent !== null && (typeof site.parent !== 'string' || !SLUG.test(site.parent))) errors.push(`sites.json: ${site.slug}'s parent is not a slug or null`)
      if (typeof site.name !== 'string' || site.name === '') errors.push(`sites.json: ${site.slug} has no name`)
    }
  }
  if (manifest && manifest.schema !== SCHEMA) errors.push(`manifest.json: schema ${JSON.stringify(manifest.schema)} is not ${SCHEMA}`)

  const ids = []
  const shardInfo = new Map((Array.isArray(manifest?.shards) ? manifest.shards : []).map((/** @type {any} */ s) => [s.file, s]))
  for (const file of SHARDS) {
    const text = read(file)
    if (text === null) continue
    const info = /** @type {any} */ (shardInfo.get(file))
    const sha = createHash('sha256').update(text, 'utf-8').digest('hex')
    if (!info) errors.push(`manifest.json: no entry for ${file}`)
    else if (info.sha256 !== sha) errors.push(`${file}: SHA-256 differs from the manifest`)
    if (text !== '' && !text.endsWith('\n')) errors.push(`${file}: does not end with a newline`)
    const lines = text === '' ? [] : text.slice(0, -1).split('\n')
    if (info && info.documents !== lines.length) errors.push(`${file}: ${lines.length} documents, the manifest says ${info.documents}`)
    let previous = ''
    lines.forEach((line, i) => {
      let doc
      try { doc = JSON.parse(line) } catch { errors.push(`${file}:${i + 1}: invalid JSON`); return }
      const id = typeof doc?.id === 'string' ? doc.id : ''
      for (const e of documentErrors(doc, slugs)) errors.push(`${file}:${i + 1} (${id}): ${e}`)
      if (id && id.charAt(0) !== file.charAt(10)) errors.push(`${file}:${i + 1}: ${id} belongs in another shard`)
      if (id && id <= previous) errors.push(`${file}:${i + 1}: ${id} is out of order or repeated`)
      previous = id
      ids.push(id)
    })
  }
  if (manifest?.counts && manifest.counts.documents !== ids.length) {
    errors.push(`manifest.json: counts.documents is ${manifest.counts.documents}, the shards hold ${ids.length}`)
  }
  return { errors, documents: ids.length, ids }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const dir = process.argv[2]
  if (!dir) { console.error('usage: node validate.mjs <package-dir>'); process.exit(64) }
  const { errors, documents } = validatePackage(dir)
  for (const e of errors.slice(0, 200)) console.error(`error: ${e}`)
  if (errors.length > 200) console.error(`… and ${errors.length - 200} more`)
  console.log(errors.length === 0 ? `ok: ${documents} documents, ${SCHEMA}` : `${errors.length} errors`)
  process.exit(errors.length === 0 ? 0 : 1)
}
