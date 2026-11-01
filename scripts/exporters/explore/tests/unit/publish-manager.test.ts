import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'child_process'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import { PublishManager, assertPublishableBaseUrl, prettyJson } from '../../src/core/publish-manager.js'
import { Logger } from '../../src/core/logger.js'

vi.mock('child_process', () => ({ spawnSync: vi.fn() }))

const templatePath = resolve(dirname(fileURLToPath(import.meta.url)), '../../../docs/LICENSE.md.template')

const registrySays = (version: string) =>
  vi.mocked(spawnSync).mockReturnValue({ status: 0, stdout: version + '\n' } as never)

const registrySilent = () => vi.mocked(spawnSync).mockReturnValue({ status: 1, stdout: '' } as never)

/** An export as the exporters write it: compact JSON, .gz companions, generatedAt in the manifest. */
function exportDir(items: unknown[] = [{ id: 'a' }]): string {
  const dir = mkdtempSync(join(tmpdir(), 'export-'))
  mkdirSync(join(dir, 'translations'))
  writeFileSync(
    join(dir, 'manifest.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), counts: { items: items.length } })
  )
  writeFileSync(join(dir, 'items.json'), JSON.stringify(items))
  writeFileSync(join(dir, 'items.json.gz'), 'not json')
  writeFileSync(join(dir, 'translations', 'items.en.json'), JSON.stringify({ a: { name: 'A' } }))
  return dir
}

/** An empty data-packages checkout: what assertDataPackagesCheckout() looks for. */
function dataPackagesDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'data-packages-'))
  mkdirSync(join(dir, 'scripts'))
  writeFileSync(join(dir, 'scripts', 'check.mjs'), '')
  return dir
}

function manager(outputDir = exportDir(), dataPackages = dataPackagesDir(), license?: string) {
  return new PublishManager({
    outputDir,
    dataPackagesDir: dataPackages,
    packageName: '@museumwnf/explore-data',
    projectKeys: ['ISL'],
    logger: new Logger('test'),
    registry: 'https://registry.npmjs.org',
    license,
  })
}

const read = (path: string) => readFileSync(path, 'utf-8')

describe('choosing the next version', () => {
  beforeEach(() => vi.mocked(spawnSync).mockReset())

  it('follows the registry when data-packages is behind it', () => {
    // A checkout that was not pulled since the last release.
    registrySays('1.0.61')
    const dataPackages = dataPackagesDir()
    manager(exportDir(), dataPackages).stage('1.0.40')
    expect(manager(exportDir([{ id: 'b' }]), dataPackages).getNextVersion()).toBe('1.0.62')
  })

  it('follows data-packages when it is ahead of the registry', () => {
    // A merged pull request whose release run has not published yet.
    registrySays('1.0.61')
    const dataPackages = dataPackagesDir()
    manager(exportDir(), dataPackages).stage('1.0.62')
    expect(manager(exportDir([{ id: 'b' }]), dataPackages).getNextVersion()).toBe('1.0.63')
  })

  it('falls back to data-packages when the registry does not answer', () => {
    registrySilent()
    const dataPackages = dataPackagesDir()
    manager(exportDir(), dataPackages).stage('1.2.1')
    expect(manager(exportDir([{ id: 'b' }]), dataPackages).getNextVersion()).toBe('1.2.2')
  })

  it('falls back when the registry answers with something that is not a version', () => {
    vi.mocked(spawnSync).mockReturnValue({ status: 0, stdout: 'npm warn ...\n' } as never)
    expect(manager().getNextVersion()).toBe('1.0.1')
  })

  it('asks the registry for this package, at this registry', () => {
    registrySays('1.0.3')
    manager().getNextVersion()

    const [command, args] = vi.mocked(spawnSync).mock.calls[0]
    expect(command).toBe('npm')
    expect(args).toEqual(['view', '@museumwnf/explore-data', 'version', '--registry', 'https://registry.npmjs.org'])
  })

  it('refuses an explicit version that is not one', () => {
    expect(() => manager().setVersion('latest')).toThrow(/Invalid version/)
  })
})

describe('the data-packages checkout', () => {
  it('refuses a directory that is not one', () => {
    const notACheckout = mkdtempSync(join(tmpdir(), 'elsewhere-'))
    expect(() => manager(exportDir(), notACheckout).assertDataPackagesCheckout()).toThrow(/data-packages/)
  })

  it('accepts one', () => {
    expect(() => manager().assertDataPackagesCheckout()).not.toThrow()
  })

  it('holds the package in packages/<name without the scope>', () => {
    const dataPackages = dataPackagesDir()
    expect(manager(exportDir(), dataPackages).packageDir).toBe(resolve(dataPackages, 'packages', 'explore-data'))
  })
})

/**
 * data-packages commits pretty-printed JSON so that a new version is a line
 * diff; its release workflow compacts it again and sets generatedAt from the
 * commit time, so what npm receives keeps the layout the exporters write.
 */
describe('staging an export', () => {
  beforeEach(() => registrySays('1.0.61'))

  it('writes pretty-printed JSON, without generatedAt or the .gz companions', () => {
    const publisher = manager()
    const staged = publisher.stage()

    expect(staged).toEqual({ changed: true, version: '1.0.62', packageDir: publisher.packageDir })
    expect(read(join(publisher.packageDir, 'items.json'))).toBe(prettyJson([{ id: 'a' }]))
    expect(read(join(publisher.packageDir, 'translations', 'items.en.json'))).toBe(prettyJson({ a: { name: 'A' } }))
    expect(JSON.parse(read(join(publisher.packageDir, 'manifest.json')))).toEqual({ counts: { items: 1 } })
    expect(existsSync(join(publisher.packageDir, 'items.json.gz'))).toBe(false)
  })

  it('writes the package.json data-packages publishes from', () => {
    const publisher = manager()
    publisher.stage()

    const pkg = JSON.parse(read(join(publisher.packageDir, 'package.json')))
    expect(pkg['name']).toBe('@museumwnf/explore-data')
    expect(pkg['version']).toBe('1.0.62')
    // npm provenance refuses a repository other than the one the release runs in.
    expect(pkg['repository']).toEqual({
      type: 'git',
      url: 'git+https://github.com/museumwithnofrontiers/data-packages.git',
      directory: 'packages/explore-data',
    })
    expect(read(join(publisher.packageDir, 'package.json'))).toBe(prettyJson(pkg))
  })

  it('replaces what the folder held, so a file the export no longer writes goes', () => {
    const dataPackages = dataPackagesDir()
    const first = manager(exportDir(), dataPackages)
    first.stage()
    writeFileSync(join(first.packageDir, 'timelines.json'), prettyJson([]))

    manager(exportDir([{ id: 'b' }]), dataPackages).stage()
    expect(existsSync(join(first.packageDir, 'timelines.json'))).toBe(false)
  })

  it('writes nothing and keeps the version when the export is unchanged', () => {
    // Two exports of the same data differ only in generatedAt.
    const dataPackages = dataPackagesDir()
    manager(exportDir(), dataPackages).stage()
    const again = manager(exportDir(), dataPackages).stage()

    expect(again.changed).toBe(false)
    expect(again.version).toBe('1.0.62')
  })

  it('honours an explicit version', () => {
    expect(manager().stage('2.0.0').version).toBe('2.0.0')
  })
})

/**
 * The MWNF legal notice permits non-commercial/educational use, which
 * 'UNLICENSED' (all rights reserved) contradicts — see story #1690. No SPDX
 * identifier matches the notice's actual terms, so 'SEE LICENSE IN
 * LICENSE.md' is the encoding, and the file it points at must actually ship.
 */
describe('licence', () => {
  beforeEach(() => registrySays('1.0.61'))

  it('defaults package.json license to the custom-terms marker', () => {
    expect(manager().generatePackageJson('1.0.1')['license']).toBe('SEE LICENSE IN LICENSE.md')
  })

  it('still honours an explicit PACKAGE_LICENSE override', () => {
    expect(manager(exportDir(), dataPackagesDir(), 'MIT').generatePackageJson('1.0.1')['license']).toBe('MIT')
  })

  it('stages a README with a Terms of use section linking the notice', () => {
    const publisher = manager()
    publisher.stage()
    const readme = read(join(publisher.packageDir, 'README.md'))
    expect(readme).toContain('## Terms of use')
    expect(readme).toContain('https://www.museumwnf.org/about/legal-notice')
  })

  it('stages LICENSE.md as an exact copy of the shared template', () => {
    const publisher = manager()
    publisher.stage()
    expect(read(join(publisher.packageDir, 'LICENSE.md'))).toBe(read(templatePath))
  })
})

/**
 * On 2026-10-19 a publish ran without --base-url, fell back to `./images` and
 * shipped relative image URLs to every website at once. A publish refuses that.
 */
describe('assertPublishableBaseUrl', () => {
  it('refuses the relative fallback and other non-https bases', () => {
    expect(() => assertPublishableBaseUrl('./images')).toThrow('--base-url')
    expect(() => assertPublishableBaseUrl('/images')).toThrow()
    expect(() => assertPublishableBaseUrl('')).toThrow()
    expect(() => assertPublishableBaseUrl('http://inventory.metanull.eu')).toThrow()
    expect(() => assertPublishableBaseUrl('file:///var/www/images')).toThrow()
  })

  it('accepts an absolute https base', () => {
    expect(() => assertPublishableBaseUrl('https://inventory.metanull.eu')).not.toThrow()
    expect(() => assertPublishableBaseUrl('https://inventory.metanull.eu/')).not.toThrow()
  })
})
