import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'child_process'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import { PublishManager } from '../../src/core/publish-manager.js'
import { Logger } from '../../src/core/logger.js'

vi.mock('child_process', () => ({ spawnSync: vi.fn() }))

/**
 * The next version comes from the registry, not from the counter file.
 *
 * The file is untracked and lives per exporter, and nothing keeps it in step
 * with what was actually published. Four of the seven datasets were found
 * sitting at 1.0.0 while the registry held 1.0.2 and 1.0.3, so the first
 * `--publish` after a rebuild walked straight into a taken number and npm
 * refused it.
 *
 * getNextVersion()/setVersion() only compute a version now; the counter file
 * is written by recordPublished(), called only once publish() has actually
 * succeeded — see "persisting the published version" below.
 */

const registrySays = (version: string) =>
  vi.mocked(spawnSync).mockReturnValue({ status: 0, stdout: version + '\n' } as never)

const registrySilent = () =>
  vi.mocked(spawnSync).mockReturnValue({ status: 1, stdout: '' } as never)

function manager(fileContent?: string) {
  const versionFile = join(mkdtempSync(join(tmpdir(), 'publish-')), '.version-the-use-of-colours-in-art')
  if (fileContent !== undefined) writeFileSync(versionFile, fileContent, 'utf-8')
  const publisher = new PublishManager({
    outputDir: '.',
    versionFile,
    packageName: '@museumwnf/the-use-of-colours-in-art-data',
    projectKeys: ['the-use-of-colours-in-art'],
    logger: new Logger('test'),
    registry: 'https://npm.pkg.github.com',
  })
  return { publisher, versionFile }
}

describe('choosing the next version', () => {
  beforeEach(() => vi.mocked(spawnSync).mockReset())

  it('follows the registry when the counter file is behind', () => {
    registrySays('1.0.3')
    const { publisher, versionFile } = manager('1.0.0')

    expect(publisher.getNextVersion()).toBe('1.0.4')
    // getNextVersion() only computes; nothing is written until recordPublished().
    expect(readFileSync(versionFile, 'utf-8')).toBe('1.0.0')
  })

  it('follows the registry when there is no counter file at all', () => {
    registrySays('1.0.27')
    const { publisher } = manager()

    expect(publisher.getNextVersion()).toBe('1.0.28')
  })

  it('keeps the counter file when it is the one ahead', () => {
    // A version published from elsewhere and since unpublished, or a deliberate
    // jump made with --package-version. Never go backwards.
    registrySays('1.0.3')
    const { publisher } = manager('2.0.1')

    expect(publisher.getNextVersion()).toBe('2.0.2')
  })

  it('falls back to the counter file when the registry does not answer', () => {
    // Unreachable, unauthenticated, or a package that has never been published.
    registrySilent()
    const { publisher } = manager('1.2.1')

    expect(publisher.getNextVersion()).toBe('1.2.2')
  })

  it('falls back when the registry answers with something that is not a version', () => {
    vi.mocked(spawnSync).mockReturnValue({ status: 0, stdout: 'npm warn ...\n' } as never)
    const { publisher } = manager('1.2.1')

    expect(publisher.getNextVersion()).toBe('1.2.2')
  })

  it('asks the registry for this package, at this registry', () => {
    registrySays('1.0.3')
    manager('1.0.0').publisher.getNextVersion()

    const [command, args] = vi.mocked(spawnSync).mock.calls[0]
    expect(command).toBe('npm')
    expect(args).toEqual([
      'view',
      '@museumwnf/the-use-of-colours-in-art-data',
      'version',
      '--registry',
      'https://npm.pkg.github.com',
    ])
  })
})

describe('setting a version explicitly', () => {
  beforeEach(() => vi.mocked(spawnSync).mockReset())

  it('validates without writing or asking the registry', () => {
    const { publisher, versionFile } = manager('1.0.0')

    expect(publisher.setVersion('1.0.3')).toBe('1.0.3')
    // Not persisted until recordPublished() is called after a successful
    // publish — see the "persisting the published version" tests below.
    expect(readFileSync(versionFile, 'utf-8')).toBe('1.0.0')
    expect(spawnSync).not.toHaveBeenCalled()
  })

  it('refuses something that is not a version', () => {
    expect(() => manager('1.0.0').publisher.setVersion('latest')).toThrow(/Invalid version/)
  })
})

describe('confirming the npm session before a slow export', () => {
  beforeEach(() => vi.mocked(spawnSync).mockReset())

  it('throws with the npm login hint when whoami fails', () => {
    vi.mocked(spawnSync).mockReturnValue({ status: 1, stdout: '' } as never)
    const { publisher } = manager('1.0.0')

    expect(() => publisher.assertLoggedIn()).toThrow(/npm login/)
  })

  it('throws when whoami exits zero but answers with no user name', () => {
    vi.mocked(spawnSync).mockReturnValue({ status: 0, stdout: '' } as never)
    const { publisher } = manager('1.0.0')

    expect(() => publisher.assertLoggedIn()).toThrow(/npm login/)
  })

  it('passes and logs the user name when whoami succeeds', () => {
    vi.mocked(spawnSync).mockReturnValue({ status: 0, stdout: 'pascalh\n' } as never)
    const { publisher } = manager('1.0.0')

    expect(() => publisher.assertLoggedIn()).not.toThrow()
  })

  it('asks whoami at the configured registry', () => {
    vi.mocked(spawnSync).mockReturnValue({ status: 0, stdout: 'pascalh\n' } as never)
    const { publisher } = manager('1.0.0')
    publisher.assertLoggedIn()

    const [command, args] = vi.mocked(spawnSync).mock.calls[0]
    expect(command).toBe('npm')
    expect(args).toEqual(['whoami', '--registry', 'https://npm.pkg.github.com'])
  })
})

/**
 * A failed publish must never burn the version number the next run would
 * otherwise walk straight into: getNextVersion()/setVersion() only compute,
 * and the counter file is written by recordPublished() alone, which callers
 * (see src/cli/export.ts) call only once publish() has returned without
 * throwing.
 */
describe('persisting the published version', () => {
  beforeEach(() => vi.mocked(spawnSync).mockReset())

  it('leaves the counter file untouched when the publish that follows fails', () => {
    registrySilent()
    const { publisher, versionFile } = manager('1.0.5')

    const next = publisher.getNextVersion()
    expect(next).toBe('1.0.6')
    expect(readFileSync(versionFile, 'utf-8')).toBe('1.0.5')

    vi.mocked(spawnSync).mockReturnValue({ status: 1 } as never)
    expect(() => publisher.publish()).toThrow(/npm publish exited/)
    expect(readFileSync(versionFile, 'utf-8')).toBe('1.0.5')
  })

  it('holds the published version once publish has actually succeeded', () => {
    registrySilent()
    const { publisher, versionFile } = manager('1.0.5')
    const next = publisher.getNextVersion()

    vi.mocked(spawnSync).mockReturnValue({ status: 0 } as never)
    publisher.publish()
    publisher.recordPublished(next)

    expect(readFileSync(versionFile, 'utf-8')).toBe(next)
  })

  it('persists an explicit --package-version only once recordPublished is called', () => {
    const { publisher, versionFile } = manager('1.0.0')
    const version = publisher.setVersion('2.0.0')
    expect(readFileSync(versionFile, 'utf-8')).toBe('1.0.0')

    publisher.recordPublished(version)
    expect(readFileSync(versionFile, 'utf-8')).toBe('2.0.0')
  })
})

/**
 * The MWNF legal notice permits non-commercial/educational use, which
 * 'UNLICENSED' (all rights reserved) contradicts, see story #1690. No SPDX
 * identifier matches the notice's actual terms, so 'SEE LICENSE IN
 * LICENSE.md' is the encoding, and the file it points at must actually ship.
 */
describe('licence', () => {
  const templatePath = resolve(dirname(fileURLToPath(import.meta.url)), '../../../docs/LICENSE.md.template')

  it('defaults package.json license to the custom-terms marker', () => {
    const { publisher } = manager('1.0.0')
    expect(publisher.generatePackageJson('1.0.1')['license']).toBe('SEE LICENSE IN LICENSE.md')
  })

  it('still honours an explicit PACKAGE_LICENSE override', () => {
    const versionFile = join(mkdtempSync(join(tmpdir(), 'publish-')), '.version-the-use-of-colours-in-art')
    const publisher = new PublishManager({
      outputDir: '.',
      versionFile,
      packageName: '@museumwnf/the-use-of-colours-in-art-data',
      projectKeys: ['the-use-of-colours-in-art'],
      logger: new Logger('test'),
      license: 'MIT',
    })
    expect(publisher.generatePackageJson('1.0.1')['license']).toBe('MIT')
  })

  it('generates a README with a Terms of use section linking the notice', () => {
    const { publisher } = manager('1.0.0')
    const readme = publisher.generateReadme('@museumwnf/the-use-of-colours-in-art-data')
    expect(readme).toContain('## Terms of use')
    expect(readme).toContain('https://www.museumwnf.org/about/legal-notice')
  })

  it('writes LICENSE.md as an exact copy of the shared template', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'publish-output-'))
    const versionFile = join(mkdtempSync(join(tmpdir(), 'publish-')), '.version-the-use-of-colours-in-art')
    const publisher = new PublishManager({
      outputDir,
      versionFile,
      packageName: '@museumwnf/the-use-of-colours-in-art-data',
      projectKeys: ['the-use-of-colours-in-art'],
      logger: new Logger('test'),
    })

    publisher.writeLicense()

    const written = readFileSync(join(outputDir, 'LICENSE.md'), 'utf-8')
    const template = readFileSync(templatePath, 'utf-8')
    expect(written).toBe(template)
    expect(written).toContain('https://www.museumwnf.org/about/legal-notice')
  })
})
