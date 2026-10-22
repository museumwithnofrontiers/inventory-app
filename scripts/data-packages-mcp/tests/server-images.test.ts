import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { describe, expect, it } from 'vitest'
import { checkImageUrl, fetchImage } from '../src/images.js'
import { RegistryClient, type FetchLike } from '../src/registry.js'
import { createServer } from '../src/server.js'
import { PackageStore } from '../src/store.js'
import {
  exhibitionFiles,
  fakeRegistry,
  galleryFiles,
  projectV1,
  projectV2,
  viewOf,
} from './helpers/fixtures.js'

const PNG = Buffer.from('89504e470d0a1a0a', 'hex')

const imageFetch: FetchLike = async url => {
  if (url.endsWith('/huge.jpg'))
    return new Response(new Uint8Array(5000), { headers: { 'content-type': 'image/jpeg' } })
  if (url.endsWith('/page.jpg'))
    return new Response('<html>', { headers: { 'content-type': 'text/html' } })
  return new Response(new Uint8Array(PNG), {
    headers: { 'content-type': 'image/png; charset=binary' },
  })
}

describe('view_image URL checks', () => {
  const view = viewOf(projectV1())

  it('accepts /pub/ images on the package’s own image host', async () => {
    const image = await fetchImage(
      view,
      'https://inventory.example.org/pub/img-1.jpg',
      1000,
      imageFetch
    )
    expect(image).toMatchObject({
      mimeType: 'image/png',
      bytes: PNG.length,
      data: PNG.toString('base64'),
    })
  })

  it.each([
    ['another host', 'https://evil.example.org/pub/img-1.jpg'],
    ['another path', 'https://inventory.example.org/storage/img-1.jpg'],
    ['traversal', 'https://inventory.example.org/pub/../.env'],
    ['a query string', 'https://inventory.example.org/pub/img-1.jpg?x=1'],
    ['credentials', 'https://user:pw@inventory.example.org/pub/img-1.jpg'],
    ['another scheme', 'http://inventory.example.org/pub/img-1.jpg'],
    ['not a URL', 'img-1.jpg'],
  ])('refuses %s', (_, url) => {
    expect(() => checkImageUrl(view, url)).toThrow()
  })

  it('caps the size and insists on an image content-type', async () => {
    await expect(
      fetchImage(view, 'https://inventory.example.org/pub/huge.jpg', 1000, imageFetch)
    ).rejects.toThrow(/limit/)
    await expect(
      fetchImage(view, 'https://inventory.example.org/pub/page.jpg', 1000, imageFetch)
    ).rejects.toThrow(/not an image/)
  })
})

async function connect() {
  const fake = fakeRegistry({
    '@museumwnf/islamicart-data': { versions: { '1.0.1': projectV1(), '1.0.2': projectV2() } },
    '@museumwnf/carpets-data': { versions: { '1.0.9': galleryFiles() } },
    '@museumwnf/the-use-of-colours-in-art-data': { versions: { '1.0.3': exhibitionFiles() } },
  })
  const registry = new RegistryClient(
    { registryUrl: fake.base, scope: 'museumwnf' },
    fake.fetchImpl
  )
  const cacheDir = mkdtempSync(path.join(tmpdir(), 'dpmcp-srv-'))
  const store = new PackageStore(
    { cacheDir, maxTarballBytes: 1e7, maxExtractedBytes: 1e8, maxEntries: 1000 },
    registry
  )
  const server = createServer({
    config: { maxImageBytes: 10_000, maxOutputChars: 60_000 },
    registry,
    store,
    fetchImpl: imageFetch,
  })
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 'test', version: '1.0.0' })
  await Promise.all([server.connect(serverSide), client.connect(clientSide)])
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = (await client.callTool({ name, arguments: args })) as {
      isError?: boolean
      content: { type: string; text?: string; data?: string }[]
    }
    const text = result.content.find(c => c.type === 'text')?.text ?? ''
    return {
      result,
      isError: result.isError === true,
      text,
      json: () => JSON.parse(text) as Record<string, unknown>,
    }
  }
  return { client, call }
}

describe('MCP server', () => {
  it('exposes the read-only tool set', async () => {
    const { client } = await connect()
    const tools = (await client.listTools()).tools
    expect(tools.map(t => t.name).sort()).toEqual(
      [
        'diff_versions',
        'get_collection',
        'get_glossary',
        'get_item',
        'get_manifest',
        'get_partner',
        'get_record',
        'get_timeline',
        'list_collections',
        'list_files',
        'list_glossary',
        'list_items',
        'list_packages',
        'list_partners',
        'list_timelines',
        'list_versions',
        'query',
        'read_file',
        'select',
        'stats',
        'view_image',
      ].sort()
    )
    expect(tools.every(t => t.annotations?.readOnlyHint === true)).toBe(true)
  })

  it('lists, selects and browses', async () => {
    const { call } = await connect()
    const packages = (await call('list_packages')).json()
    expect((packages.packages as { name: string }[]).map(p => p.name)).toEqual([
      '@museumwnf/carpets-data',
      '@museumwnf/islamicart-data',
      '@museumwnf/the-use-of-colours-in-art-data',
    ])
    expect((await call('list_versions', { package: 'islamicart' })).json()).toMatchObject({
      dist_tags: { latest: '1.0.2' },
      versions: [{ version: '1.0.2' }, { version: '1.0.1' }],
    })

    expect((await call('get_item', { ref: 'i1' })).text).toMatch(/No package selected/)
    const selected = (await call('select', { package: 'islamicart', version: '1.0.1' })).json()
    expect(selected).toMatchObject({
      selected: { name: '@museumwnf/islamicart-data', version: '1.0.1' },
      family: 'project',
    })

    const item = (await call('get_item', { ref: 'mwnf3:objects:ISL:es:Mus02:7' })).json()
    expect(item).toMatchObject({ id: 'i3', name: 'Tile panel' })
    // Explicit package/version override the selection for one call.
    const carpets = (await call('list_items', { package: 'carpets' })).json()
    expect(carpets).toMatchObject({ family: 'dxa-gallery', total: 2 })
    expect((await call('get_manifest')).json()).toMatchObject({
      package: '@museumwnf/islamicart-data@1.0.1',
    })
    expect(
      (await call('query', { file: 'items.json', expression: 'length(@)' })).json()
    ).toMatchObject({ result: 3 })
    expect((await call('stats')).json()).toMatchObject({ family: 'project' })
    expect(
      (await call('list_collections', { package: 'the-use-of-colours-in-art' })).json()
    ).toMatchObject({ total: 3 })
  })

  it('diffs the selected version against the one before it by default', async () => {
    const { call } = await connect()
    await call('select', { package: 'islamicart' })
    const diff = (await call('diff_versions')).json()
    expect(diff).toMatchObject({
      from: '@museumwnf/islamicart-data@1.0.1',
      to: '@museumwnf/islamicart-data@1.0.2',
      files_added: ['translations/items.de.json'],
    })
    const record = (
      await call('diff_versions', { id: 'i1', file: 'translations/items.en.json' })
    ).json()
    expect(record).toMatchObject({ files: [{ status: 'changed' }] })
    expect((await call('diff_versions', { from: '1.0.2', to: '1.0.2' })).json()).toMatchObject({
      files_changed: 0,
    })
  })

  it('answers concurrent calls, one after the other', async () => {
    const { call } = await connect()
    const results = await Promise.all([
      call('stats', { package: 'islamicart' }),
      call('list_items', { package: 'carpets' }),
      call('diff_versions', { package: 'islamicart' }),
    ])
    expect(results.map(r => r.isError)).toEqual([false, false, false])
  })

  it('returns errors as tool errors, not protocol failures', async () => {
    const { call } = await connect()
    const missing = await call('select', { package: 'nope' })
    expect(missing.isError).toBe(true)
    expect(missing.text).toMatch(/404/)
    expect((await call('select', { package: '@evil/x-data' })).isError).toBe(true)
    await call('select', { package: 'islamicart' })
    expect((await call('read_file', { path: '../../meta.json' })).text).toMatch(
      /Invalid package path/
    )
  })

  it('returns an image as image content', async () => {
    const { call } = await connect()
    await call('select', { package: 'islamicart' })
    const image = await call('view_image', { url: 'https://inventory.example.org/pub/img-1.jpg' })
    expect(image.result.content[0]).toMatchObject({ type: 'image', data: PNG.toString('base64') })
    expect((await call('view_image', { url: 'https://example.com/pub/x.jpg' })).isError).toBe(true)
  })

  it('serves package files as resources', async () => {
    const { client, call } = await connect()
    await call('select', { package: 'carpets' })
    const listed = await client.listResources()
    expect(listed.resources.map(r => r.uri)).toContain(
      'datapackage://carpets-data@1.0.9/gallery.json'
    )
    const read = await client.readResource({
      uri: 'datapackage://islamicart-data@1.0.1/translations/items.fr.json',
    })
    expect(JSON.parse((read.contents[0] as { text: string }).text)).toEqual({
      i1: { name: "Coupe à l'oiseau" },
    })
  })

  it('cuts oversized output with a hint instead of flooding the client', async () => {
    const fake = fakeRegistry({
      '@museumwnf/islamicart-data': { versions: { '1.0.1': projectV1() } },
    })
    const registry = new RegistryClient(
      { registryUrl: fake.base, scope: 'museumwnf' },
      fake.fetchImpl
    )
    const store = new PackageStore(
      {
        cacheDir: mkdtempSync(path.join(tmpdir(), 'dpmcp-cut-')),
        maxTarballBytes: 1e7,
        maxExtractedBytes: 1e8,
        maxEntries: 1000,
      },
      registry
    )
    const server = createServer({
      config: { maxImageBytes: 1, maxOutputChars: 200 },
      registry,
      store,
    })
    const [a, b] = InMemoryTransport.createLinkedPair()
    const client = new Client({ name: 't', version: '1' })
    await Promise.all([server.connect(b), client.connect(a)])
    const result = (await client.callTool({
      name: 'read_file',
      arguments: { package: 'islamicart', path: 'items.json' },
    })) as { content: { text: string }[] }
    expect(result.content[0].text).toMatch(/…\[cut: \d+ more characters/)
  })
})
