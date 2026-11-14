// Tests of the loader against an in-memory Meilisearch (node --test).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { BUILD, LIVE, Meili, PREVIOUS, expandSettings, load, rollback, settingsFingerprint } from '../loader.mjs'
import { LOADER_KEY, SEARCH_KEY } from '../keys.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SETTINGS = JSON.parse(readFileSync(join(HERE, '../settings.json'), 'utf-8'))
const quiet = () => {}

/** An in-memory Meilisearch: indexes, documents, tasks and swaps. */
function fakeMeili() {
  const indexes = new Map()
  const tasks = []
  const task = (status = 'succeeded', error) => {
    tasks.push({ status, error })
    return { taskUid: tasks.length - 1 }
  }
  const json = (status, body) => ({ ok: status < 300, status, text: async () => (body === undefined ? '' : JSON.stringify(body)) })
  const fetchImpl = async (url, { method, body }) => {
    const path = new URL(url).pathname
    const parts = path.split('/').filter(Boolean)
    if (parts[0] === 'tasks') return json(200, tasks[Number(parts[1])])
    if (path === '/swap-indexes') {
      const [a, b] = JSON.parse(body)[0].indexes
      const x = indexes.get(a), y = indexes.get(b)
      if (!x || !y) return json(202, task('failed', { message: 'not found' }))
      indexes.set(a, y); indexes.set(b, x)
      return json(202, task())
    }
    if (path === '/indexes' && method === 'POST') {
      indexes.set(JSON.parse(body).uid, { docs: new Map(), settings: null })
      return json(202, task())
    }
    const uid = parts[1]
    const index = indexes.get(uid)
    if (parts.length === 2) {
      if (!index) return json(404, { message: 'not found' })
      if (method === 'DELETE') { indexes.delete(uid); return json(202, task()) }
      return json(200, { uid })
    }
    if (!index) return json(404, { message: 'not found' })
    if (parts[2] === 'settings') { index.settings = JSON.parse(body); return json(202, task()) }
    if (parts[2] === 'stats') return json(200, { numberOfDocuments: index.docs.size })
    if (parts[2] === 'documents' && method === 'POST') {
      const docs = body.startsWith('[') ? JSON.parse(body) : body.split('\n').filter(Boolean).map(l => JSON.parse(l))
      for (const d of docs) index.docs.set(d.id, d)
      return json(202, task())
    }
    if (parts[2] === 'documents') {
      const doc = index.docs.get(parts[3])
      return doc ? json(200, doc) : json(404, { message: 'not found' })
    }
    if (parts[2] === 'search') {
      const { q } = JSON.parse(body)
      const hits = [...index.docs.values()].filter(d => JSON.stringify(d).includes(q)).slice(0, 5)
      return json(200, { hits })
    }
    return json(404, { message: `unhandled ${method} ${path}` })
  }
  return { meili: new Meili('http://fake', 'key', fetchImpl), indexes }
}

const ID = n => `${n}0000000-0000-5000-8000-00000000000${n}`

/** A valid package folder with `count` documents and a version. */
function writePackage(version, names) {
  const dir = mkdtempSync(join(tmpdir(), 'search-data-'))
  mkdirSync(join(dir, 'documents'))
  const docs = names.map((name, i) => ({
    id: ID(i + 1), type: 'object', parent_id: null, backward_compatibility: null, mwnf_reference: null, owner_reference: null,
    start_date: null, end_date: null, partner_id: null, country_id: null, picture: null,
    sites: [{ site: 'islamicart', path: `/item/${ID(i + 1)}` }], languages: ['en'], tags: [],
    texts: { en: { name, names: [], short_description: [], description: [], type: [], holder: [], dates: [], place: [], dynasty: [], artist: [], history: [], keywords: [], materials: [], tags: [], partner: [], country: null } },
  }))
  const shards = []
  for (const hex of '0123456789abcdef') {
    const lines = docs.filter(d => d.id.startsWith(hex)).map(d => JSON.stringify(d))
    const content = lines.length ? lines.join('\n') + '\n' : ''
    writeFileSync(join(dir, `documents/${hex}.ndjson`), content)
    shards.push({ file: `documents/${hex}.ndjson`, documents: lines.length, sha256: createHash('sha256').update(content).digest('hex') })
  }
  writeFileSync(join(dir, 'sites.json'), JSON.stringify({ schema: 'mwnf.search/1', sites: [{ slug: 'islamicart', name: 'Islamic Art', kind: 'standalone', parent: null, origin: 'https://x.test/islamicart', item_path: '/item/:id' }] }))
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ schema: 'mwnf.search/1', name: '@museumwnf/search-data', languages: ['en'], counts: { documents: docs.length, excluded_no_site: 0, by_type: {}, by_language: {}, sites: 1 }, shards }))
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: '@museumwnf/search-data', version }))
  return dir
}

const probe = name => [{ why: 'test', lang: 'en', q: name, name }]

test('loads a version, keeps the previous one, and does nothing when it is already live', async () => {
  const { meili, indexes } = fakeMeili()
  const one = await load({ meili, dir: writePackage('1.0.1', ['Bowl', 'Ewer']), settings: SETTINGS, probes: probe('Bowl'), log: quiet })
  assert.deepEqual(one, { changed: true, version: '1.0.1', documents: 2 })
  assert.equal(indexes.get(LIVE).docs.size, 2)
  assert.equal(indexes.has(BUILD), false)

  const again = await load({ meili, dir: writePackage('1.0.1', ['Bowl', 'Ewer']), settings: SETTINGS, probes: probe('Bowl'), log: quiet })
  assert.equal(again.changed, false)

  await load({ meili, dir: writePackage('1.0.2', ['Bowl', 'Ewer', 'Lamp']), settings: SETTINGS, probes: probe('Lamp'), log: quiet })
  assert.equal(indexes.get(LIVE).docs.size, 3)
  assert.equal(indexes.get(PREVIOUS).docs.size, 2)
  const state = await meili.state()
  assert.equal(state.live.version, '1.0.2')
  assert.equal(state.previous.version, '1.0.1')
})

test('a change of settings alone loads the live version again, with the new settings', async () => {
  const { meili, indexes } = fakeMeili()
  await load({ meili, dir: writePackage('1.0.1', ['Bowl']), settings: SETTINGS, probes: probe('Bowl'), log: quiet })
  const changed = { ...SETTINGS, filterable: [...SETTINGS.filterable, 'extra_field'] }
  const again = await load({ meili, dir: writePackage('1.0.1', ['Bowl']), settings: changed, probes: probe('Bowl'), log: quiet })
  assert.equal(again.changed, true)
  assert.deepEqual(indexes.get(LIVE).settings.filterableAttributes, changed.filterable)
  const state = await meili.state()
  assert.equal(state.live.settings, settingsFingerprint(changed))
  assert.equal(state.previous.settings, settingsFingerprint(SETTINGS))

  const unchanged = await load({ meili, dir: writePackage('1.0.1', ['Bowl']), settings: changed, probes: probe('Bowl'), log: quiet })
  assert.equal(unchanged.changed, false)
})

test('the dates are filterable, for the search site\'s From/To years', () => {
  assert.ok(SETTINGS.filterable.includes('start_date'))
  assert.ok(SETTINGS.filterable.includes('end_date'))
})

test('a failing probe leaves the live index as it was', async () => {
  const { meili, indexes } = fakeMeili()
  await load({ meili, dir: writePackage('1.0.1', ['Bowl']), settings: SETTINGS, probes: probe('Bowl'), log: quiet })
  await assert.rejects(
    load({ meili, dir: writePackage('1.0.2', ['Vase']), settings: SETTINGS, probes: probe('Bowl'), log: quiet }),
    /probes failed/
  )
  assert.equal([...indexes.get(LIVE).docs.values()][0].texts.en.name, 'Bowl')
  assert.equal(indexes.has(BUILD), false)
  assert.equal((await meili.state()).live.version, '1.0.1')
})

test('a package that fails its checks is never loaded', async () => {
  const { meili, indexes } = fakeMeili()
  const dir = writePackage('1.0.1', ['Bowl'])
  writeFileSync(join(dir, 'documents/1.ndjson'), readFileSync(join(dir, 'documents/1.ndjson'), 'utf-8').replace('Bowl', 'Bawl'))
  await assert.rejects(load({ meili, dir, settings: SETTINGS, probes: [], log: quiet }), /SHA-256/)
  assert.equal(indexes.size, 0)
})

test('a count that differs from the manifest stops the load', async () => {
  const { meili, indexes } = fakeMeili()
  const dir = writePackage('1.0.1', ['Bowl'])
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf-8'))
  manifest.counts.documents = 1
  // A shard the manifest says is empty but that holds a document is caught by the package check.
  manifest.shards[1].documents = 0
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest))
  await assert.rejects(load({ meili, dir, settings: SETTINGS, probes: [], log: quiet }))
  assert.equal(indexes.has(LIVE), false)
})

test('rollback swaps the previous version back, and refuses when there is none', async () => {
  const { meili, indexes } = fakeMeili()
  await load({ meili, dir: writePackage('1.0.1', ['Bowl']), settings: SETTINGS, probes: [], log: quiet })
  await assert.rejects(rollback({ meili, log: quiet }), /no previous version/)
  await load({ meili, dir: writePackage('1.0.2', ['Bowl', 'Ewer']), settings: SETTINGS, probes: [], log: quiet })
  await rollback({ meili, log: quiet })
  assert.equal(indexes.get(LIVE).docs.size, 1)
  assert.equal((await meili.state()).live.version, '1.0.1')
  assert.equal((await meili.state()).previous.version, '1.0.2')
})

test('settings expand every texts.* field to each language, with its locale', () => {
  const s = expandSettings(SETTINGS, ['ar', 'en'])
  assert.deepEqual(s.searchableAttributes.slice(0, 4), ['texts.ar.name', 'texts.en.name', 'texts.ar.names', 'texts.en.names'])
  assert.ok(s.searchableAttributes.includes('mwnf_reference'))
  assert.deepEqual(s.localizedAttributes, [
    { attributePatterns: ['texts.ar.*'], locales: ['ara'] },
    { attributePatterns: ['texts.en.*'], locales: ['eng'] },
  ])
  assert.deepEqual(s.typoTolerance.disableOnAttributes, ['mwnf_reference', 'owner_reference', 'backward_compatibility', 'id'])
  assert.equal(s.pagination.maxTotalHits, 1000)
})

test('the public key can only search the items index', () => {
  assert.deepEqual(SEARCH_KEY.actions, ['search'])
  assert.deepEqual(SEARCH_KEY.indexes, ['items'])
  for (const action of ['keys.create', 'keys.get', 'dumps.create', 'snapshots.create', '*']) {
    assert.equal(LOADER_KEY.actions.includes(action), false, action)
  }
})

test('the local compose stack runs the same Meilisearch as the server', () => {
  const version = readFileSync(join(HERE, '../meilisearch.version'), 'utf-8').trim()
  const compose = readFileSync(join(HERE, '../../../compose.yml'), 'utf-8')
  assert.ok(compose.includes(`image: getmeili/meilisearch:${version}\n`), `compose.yml pins Meilisearch ${version}`)
})
