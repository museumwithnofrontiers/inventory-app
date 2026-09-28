import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import * as exporters from '../../src/exporters/index.js'

const testDir = dirname(fileURLToPath(import.meta.url))
const srcDir = join(testDir, '..', '..', 'src')

/**
 * Sharing History has no dynasty entity at all (dynasty survives only as a
 * legacy free-text field). This fork must therefore ship no dynasty exporter.
 * The glossary exporter STAYS: SH content carries ~2,800 glossary spelling
 * links (usage-scoped; verified on production 2026-08-22).
 */
describe('sharinghistory exporter run list', () => {
  it('exposes no DynastyExporter', () => {
    expect(Object.keys(exporters)).not.toContain('DynastyExporter')
  })

  it('has no dynasty-exporter source file', () => {
    expect(existsSync(join(srcDir, 'exporters', 'dynasty-exporter.ts'))).toBe(false)
  })

  it('does not reference DynastyExporter in the CLI run list', () => {
    const cliSource = readFileSync(join(srcDir, 'cli', 'export.ts'), 'utf-8')
    expect(cliSource).not.toMatch(/new DynastyExporter/)
  })

  it('exposes the exporters the SH package is built from (incl. glossary)', () => {
    expect(Object.keys(exporters).sort()).toEqual(
      [
        'CollectionExporter',
        'CountryExporter',
        'GlossaryExporter',
        'ItemExporter',
        'LanguageExporter',
        'ManifestExporter',
        'PartnerExporter',
        'TimelineExporter',
      ].sort()
    )
  })
})
