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
 * refused it — having already burned the number in the file, because it is
 * written before the publish runs.
 */

const registrySays = (version: string) =>
  vi.mocked(spawnSync).mockReturnValue({ status: 0, stdout: version + '\n' } as never)

const registrySilent = () =>
  vi.mocked(spawnSync).mockReturnValue({ status: 1, stdout: '' } as never)

function manager(fileContent?: string) {
  const versionFile = join(mkdtempSync(join(tmpdir(), 'publish-')), '.version-baroqueart')
  if (fileContent !== undefined) writeFileSync(versionFile, fileContent, 'utf-8')
  const publisher = new PublishManager({
    outputDir: '.',
    versionFile,
    packageName: '@museumwnf/baroqueart-data',
    projectKeys: ['baroqueart'],
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
    expect(readFileSync(versionFile, 'utf-8')).toBe('1.0.4')
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
      '@museumwnf/baroqueart-data',
      'version',
      '--registry',
      'https://npm.pkg.github.com',
    ])
  })
})

describe('setting a version explicitly', () => {
  beforeEach(() => vi.mocked(spawnSync).mockReset())

  it('writes it without asking the registry', () => {
    const { publisher, versionFile } = manager('1.0.0')

    expect(publisher.setVersion('1.0.3')).toBe('1.0.3')
    expect(readFileSync(versionFile, 'utf-8')).toBe('1.0.3')
    expect(spawnSync).not.toHaveBeenCalled()
  })

  it('refuses something that is not a version', () => {
    expect(() => manager('1.0.0').publisher.setVersion('latest')).toThrow(/Invalid version/)
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
    const versionFile = join(mkdtempSync(join(tmpdir(), 'publish-')), '.version-baroqueart')
    const publisher = new PublishManager({
      outputDir: '.',
      versionFile,
      packageName: '@museumwnf/baroqueart-data',
      projectKeys: ['baroqueart'],
      logger: new Logger('test'),
      license: 'MIT',
    })
    expect(publisher.generatePackageJson('1.0.1')['license']).toBe('MIT')
  })

  it('generates a README with a Terms of use section linking the notice', () => {
    const { publisher } = manager('1.0.0')
    const readme = publisher.generateReadme('@museumwnf/baroqueart-data')
    expect(readme).toContain('## Terms of use')
    expect(readme).toContain('https://www.museumwnf.org/about/legal-notice')
  })

  it('writes LICENSE.md as an exact copy of the shared template', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'publish-output-'))
    const versionFile = join(mkdtempSync(join(tmpdir(), 'publish-')), '.version-baroqueart')
    const publisher = new PublishManager({
      outputDir,
      versionFile,
      packageName: '@museumwnf/baroqueart-data',
      projectKeys: ['baroqueart'],
      logger: new Logger('test'),
    })

    publisher.writeLicense()

    const written = readFileSync(join(outputDir, 'LICENSE.md'), 'utf-8')
    const template = readFileSync(templatePath, 'utf-8')
    expect(written).toBe(template)
    expect(written).toContain('https://www.museumwnf.org/about/legal-notice')
  })
})
