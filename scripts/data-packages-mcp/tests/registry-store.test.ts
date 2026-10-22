import { existsSync, mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { PackageView } from '../src/package-view.js'
import { RegistryClient, RegistryError } from '../src/registry.js'
import { compareSemver } from '../src/semver.js'
import { PackageStore } from '../src/store.js'
import { fakeRegistry, galleryFiles, projectV1, projectV2 } from './helpers/fixtures.js'

const limits = {
  maxTarballBytes: 10 * 1024 * 1024,
  maxExtractedBytes: 50 * 1024 * 1024,
  maxEntries: 1000,
}

function setup(
  options: Parameters<typeof fakeRegistry>[1] = {},
  extra: Parameters<typeof fakeRegistry>[0] = {}
) {
  const fake = fakeRegistry(
    {
      '@museumwnf/islamicart-data': {
        versions: { '1.0.1': projectV1(), '1.0.2': projectV2() },
        tags: { next: '1.0.2' },
      },
      '@museumwnf/carpets-data': { versions: { '1.0.9': galleryFiles() } },
      '@museumwnf/viewer-core': { versions: { '2.5.2': { 'index.js': 'x' } } },
      ...extra,
    },
    options
  )
  const registry = new RegistryClient(
    { registryUrl: fake.base, scope: 'museumwnf' },
    fake.fetchImpl
  )
  const cacheDir = mkdtempSync(path.join(tmpdir(), 'dpmcp-cache-'))
  const store = new PackageStore({ cacheDir, ...limits }, registry)
  return { fake, registry, store, cacheDir }
}

describe('RegistryClient', () => {
  it('lists only *-data packages of the scope, from search and the org listing', async () => {
    const { registry } = setup(
      {
        orgOnly: ['@museumwnf/carpets-data'],
        searchExtra: ['@other/x-data', '@museumwnf/viewer-i18n'],
      },
      {}
    )
    const names = (await registry.listDataPackages()).map(p => p.name)
    expect(names).toEqual(['@museumwnf/carpets-data', '@museumwnf/islamicart-data'])
  })

  it('pages through search results', async () => {
    const many = Object.fromEntries(
      Array.from({ length: 260 }, (_, i) => [
        `@museumwnf/site${i}-data`,
        { versions: { '1.0.0': { 'manifest.json': {} } } },
      ])
    )
    const { registry, fake } = setup({}, many)
    const listed = await registry.listDataPackages()
    expect(listed.length).toBe(262)
    expect(fake.calls.filter(c => c.includes('/-/v1/search')).length).toBe(2)
  })

  it('normalises short names and refuses anything that is not a data package', () => {
    const { registry } = setup()
    expect(registry.normaliseName('islamicart')).toBe('@museumwnf/islamicart-data')
    expect(registry.normaliseName('islamicart-data')).toBe('@museumwnf/islamicart-data')
    expect(registry.normaliseName('@museumwnf/carpets-data')).toBe('@museumwnf/carpets-data')
    expect(() => registry.normaliseName('@other/x-data')).toThrow(RegistryError)
    expect(() => registry.normaliseName('../../etc')).toThrow(RegistryError)
  })

  it('reads versions oldest first with their dist-tags, and resolves tags', async () => {
    const { registry } = setup()
    const packument = await registry.packument('@museumwnf/islamicart-data')
    expect(packument.versions.map(v => v.version)).toEqual(['1.0.1', '1.0.2'])
    expect(packument.versions[1].tags.sort()).toEqual(['latest', 'next'])
    expect((await registry.resolve('@museumwnf/islamicart-data')).version).toBe('1.0.2')
    expect((await registry.resolve('@museumwnf/islamicart-data', '1.0.1')).version).toBe('1.0.1')
    await expect(registry.resolve('@museumwnf/islamicart-data', '9.9.9')).rejects.toThrow(
      /no published version/
    )
  })

  it('requests a packument as one path segment, and only for a data package', async () => {
    const { registry, fake } = setup()
    await registry.packument('@museumwnf/islamicart-data')
    expect(fake.calls).toContain(`${fake.base}/@museumwnf%2Fislamicart-data`)
    for (const name of [
      '@museumwnf/islamicart-data/../../-/whoami',
      '@museumwnf/a/b-data',
      '@other/x-data',
    ]) {
      await expect(registry.packument(name)).rejects.toThrow(RegistryError)
    }
    expect(fake.calls.filter(c => !c.endsWith('%2Fislamicart-data'))).toEqual([])
  })

  it('reports a registry error with its status', async () => {
    const { registry } = setup()
    await expect(registry.packument('@museumwnf/missing-data')).rejects.toThrow(/404/)
  })

  it('orders semver numerically', () => {
    expect(['1.0.10', '1.0.9', '1.0.0-rc.1', '1.0.0', '2.0.0'].sort(compareSemver)).toEqual([
      '1.0.0-rc.1',
      '1.0.0',
      '1.0.9',
      '1.0.10',
      '2.0.0',
    ])
  })
})

describe('PackageStore', () => {
  it('downloads, verifies and extracts a version into the cache', async () => {
    const { store, cacheDir } = setup()
    const cached = await store.ensure('@museumwnf/islamicart-data', 'latest')
    expect(cached.version).toBe('1.0.2')
    expect(cached.dir).toBe(
      path.join(cacheDir, '@museumwnf', 'islamicart-data', '1.0.2', 'package')
    )
    const view = new PackageView(cached.name, cached.version, cached.dir)
    expect(view.listFiles()).toContain('translations/items.de.json')
    expect(
      existsSync(path.join(cacheDir, '@museumwnf', 'islamicart-data', '1.0.2', 'meta.json'))
    ).toBe(true)
  })

  it('serves an exact cached version without asking the registry again', async () => {
    const { store, fake } = setup()
    await store.ensure('@museumwnf/islamicart-data', '1.0.1')
    const before = fake.calls.length
    await store.ensure('@museumwnf/islamicart-data', '1.0.1')
    expect(fake.calls.length).toBe(before)
  })

  it('downloads a version once when asked concurrently', async () => {
    const { store, fake } = setup()
    await Promise.all([
      store.ensure('@museumwnf/carpets-data', '1.0.9'),
      store.ensure('@museumwnf/carpets-data', '1.0.9'),
    ])
    expect(fake.calls.filter(c => c.endsWith('.tgz')).length).toBe(1)
  })

  it('caches nothing when the integrity check fails', async () => {
    const { store, cacheDir } = setup(
      {},
      {
        '@museumwnf/broken-data': {
          versions: { '1.0.0': { 'manifest.json': {} } },
          badIntegrity: ['1.0.0'],
        },
      }
    )
    await expect(store.ensure('@museumwnf/broken-data', '1.0.0')).rejects.toThrow(
      /Integrity mismatch/
    )
    const dir = path.join(cacheDir, '@museumwnf', 'broken-data')
    expect(existsSync(dir) ? readdirSync(dir) : []).toEqual([])
  })

  it('refuses a tarball hosted outside the registry', async () => {
    const { store } = setup(
      {},
      {
        '@museumwnf/elsewhere-data': {
          versions: { '1.0.0': { 'manifest.json': {} } },
          tarballOrigin: 'https://evil.test',
        },
      }
    )
    await expect(store.ensure('@museumwnf/elsewhere-data', '1.0.0')).rejects.toThrow(
      /outside the registry/
    )
  })
})
