import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { afterEach, describe, expect, it } from 'vitest'

import { loadHomeSites } from '../../src/core/home-sites.js'

const ISL = '0f0e0d0c-0b0a-4908-8706-050403020100'
const SH = '1f1e1d1c-1b1a-4918-9716-151413121110'

describe('loadHomeSites', () => {
  let dir = ''
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true })
    dir = ''
  })

  function instances(files: Record<string, unknown>) {
    dir = mkdtempSync(join(tmpdir(), 'explore-home-sites-'))
    for (const [name, data] of Object.entries(files)) writeFileSync(join(dir, name), JSON.stringify(data))
    return dir
  }

  it('maps each project to the site whose instance file lists it', () => {
    const homes = loadHomeSites(
      instances({
        'islamicart.json': { slug: 'islamicart', project_ids: [ISL] },
        'sharinghistory.json': { slug: 'sharinghistory', project_ids: [SH] },
        'explore.json': { slug: 'explore' },
        'notes.md': 'not an instance',
      })
    )
    expect([...homes]).toEqual([
      [ISL, 'islamicart'],
      [SH, 'sharinghistory'],
    ])
  })

  it('refuses a project two sites claim as home', () => {
    const path = instances({
      'a.json': { slug: 'a', project_ids: [ISL] },
      'b.json': { slug: 'b', project_ids: [ISL] },
    })
    expect(() => loadHomeSites(path)).toThrow(/already the home of "a"/)
  })

  it('refuses project ids that are not lowercase UUIDs', () => {
    const path = instances({ 'a.json': { slug: 'a', project_ids: ['ISL'] } })
    expect(() => loadHomeSites(path)).toThrow(/lowercase UUIDs/)
  })

  it("reads the repository's own instance files", () => {
    const homes = loadHomeSites(fileURLToPath(new URL('../../../instances', import.meta.url)))
    expect(homes.size).toBeGreaterThan(0)
  })
})
