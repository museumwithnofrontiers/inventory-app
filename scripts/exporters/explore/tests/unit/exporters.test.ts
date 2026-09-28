import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import * as exporters from '../../src/exporters/index.js'

const testDir = dirname(fileURLToPath(import.meta.url))
const srcDir = join(testDir, '..', '..', 'src')

/**
 * Explore has no dynasty entity and no timeline. This fork must therefore
 * ship neither exporter; the glossary exporter stays, for the terms the
 * shipped texts use.
 */
describe('explore exporter run list', () => {
  it('exposes no DynastyExporter and no TimelineExporter', () => {
    expect(Object.keys(exporters)).not.toContain('DynastyExporter')
    expect(Object.keys(exporters)).not.toContain('TimelineExporter')
  })

  it('has no dynasty or timeline source file', () => {
    expect(existsSync(join(srcDir, 'exporters', 'dynasty-exporter.ts'))).toBe(false)
    expect(existsSync(join(srcDir, 'exporters', 'timeline-exporter.ts'))).toBe(false)
  })

  it('does not reference them in the CLI run list', () => {
    const cliSource = readFileSync(join(srcDir, 'cli', 'export.ts'), 'utf-8')
    expect(cliSource).not.toMatch(/new (Dynasty|Timeline)Exporter/)
  })

  it('exposes the exporters the Explore package is built from', () => {
    expect(Object.keys(exporters).sort()).toEqual(
      [
        'CollectionExporter',
        'CountryExporter',
        'GlossaryExporter',
        'ItemExporter',
        'LanguageExporter',
        'ManifestExporter',
        'PartnerExporter',
      ].sort()
    )
  })
})
