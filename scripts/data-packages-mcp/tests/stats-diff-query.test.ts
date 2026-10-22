import { describe, expect, it } from 'vitest'
import { deepDiff, diffVersions } from '../src/diff.js'
import { runQuery } from '../src/query.js'
import { entityStats, packageStats } from '../src/stats.js'
import { exhibitionFiles, hubFiles, projectV1, projectV2, viewOf } from './helpers/fixtures.js'

type Paged = Record<string, { results: unknown[] }>

describe('packageStats', () => {
  const view = viewOf(projectV1())

  it('counts records, coverage and empty fields', () => {
    const stats = packageStats(view)
    expect(stats.family).toBe('project')
    const items = stats.entities.items as Record<string, unknown>
    expect(items.count).toBe(3)
    expect(items.by_type).toEqual({ object: 2, monument: 1 })
    expect(items.empty_fields).toMatchObject({ images: 1, parent_id: 3, tags: 1 })
    expect(items.translations).toEqual({
      en: { records: 3, coverage_pct: 100, orphans: 0 },
      fr: { records: 1, coverage_pct: 33.3, orphans: 0 },
    })
    expect(stats.checks.items).toMatchObject({
      without_images: 1,
      without_any_translation: 0,
      declared_languages_differ_from_translations: 1,
      partner_not_in_package: 0,
    })
    expect(stats.checks.partners).toMatchObject({ item_count_differs_from_items_json: 1 })
  })

  it('goes in depth on one entity, per language field fill rates included', () => {
    const items = entityStats(view, 'items.json') as unknown as {
      translations: Record<string, { field_filled_pct: Record<string, number> }>
    }
    expect(items.translations.en.field_filled_pct).toEqual({ name: 100, description: 33.3 })
  })

  it('works on a package without items', () => {
    const stats = packageStats(viewOf(hubFiles()))
    expect(stats.checks.items).toBeUndefined()
    expect((stats.entities.galleries as { count: number }).count).toBe(2)
  })
})

describe('deepDiff', () => {
  it('reports paths, matching array elements by key', () => {
    expect(
      deepDiff(
        {
          a: 1,
          b: [
            { id: 'x', v: 1 },
            { id: 'y', v: 2 },
          ],
        },
        {
          a: 2,
          b: [
            { id: 'y', v: 3 },
            { id: 'x', v: 1 },
          ],
        }
      )
    ).toEqual([
      { path: 'a', change: 'changed', before: 1, after: 2 },
      { path: 'b[id=y].v', change: 'changed', before: 2, after: 3 },
      { path: 'b[order]', change: 'changed', before: ['x', 'y'], after: ['y', 'x'] },
    ])
    expect(deepDiff({ t: ['a'] }, { t: ['a', 'b'], n: null })).toEqual([
      { path: 't', change: 'changed', before: ['a'], after: ['a', 'b'] },
      { path: 'n', change: 'added', after: null },
    ])
  })
})

describe('diffVersions', () => {
  const v1 = viewOf(projectV1(), '@museumwnf/islamicart-data', '1.0.1')
  const v2 = viewOf(projectV2(), '@museumwnf/islamicart-data', '1.0.2')

  it('summarises per file, keeping the build stamp apart', () => {
    const summary = diffVersions(v1, v2) as Record<string, unknown> & { files: { file: string }[] }
    expect(summary.files_added).toEqual(['translations/items.de.json'])
    expect(summary.files_removed).toEqual([])
    const byFile = Object.fromEntries(summary.files.map(f => [f.file, f]))
    expect(byFile['items.json']).toMatchObject({
      before: 3,
      after: 3,
      added: 1,
      removed: 1,
      changed: 1,
      changed_fields: { images: 1, tags: 1 },
    })
    expect(byFile['translations/items.en.json']).toMatchObject({
      added: 1,
      removed: 1,
      changed: 1,
      changed_fields: { description: 1 },
    })
    expect(byFile['translations/items.fr.json']).toMatchObject({ added: 1, changed: 0 })
    expect(byFile['partners.json']).toMatchObject({ changed: 2, changed_fields: { item_count: 2 } })
    expect(byFile['manifest.json']).toBeUndefined()
    expect(byFile['package.json']).toBeUndefined()
    expect(byFile['glossary.json']).toBeUndefined()
    expect(summary.volatile).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ file: 'manifest.json', path: 'generatedAt' }),
      ])
    )
  })

  it('lists the records behind one file', () => {
    const items = diffVersions(v1, v2, { file: 'items.json' }) as unknown as Paged
    expect(items.added.results).toEqual([
      { key: 'i4', backward_compatibility: 'mwnf3:objects:ISL:sy:Mus03:2', name: 'Mosque lamp' },
    ])
    expect(items.removed.results).toEqual([
      { key: 'i3', backward_compatibility: 'mwnf3:objects:ISL:es:Mus02:7', name: 'Tile panel' },
    ])
    expect(items.changed.results).toEqual([
      {
        key: 'i1',
        backward_compatibility: 'mwnf3:objects:ISL:eg:Mus01:1',
        name: 'Bowl with a bird',
        fields: ['images[order]', 'tags'],
      },
    ])
    const translations = diffVersions(v1, v2, {
      file: 'translations/items.en.json',
    }) as unknown as Paged
    expect(translations.changed.results).toEqual([
      {
        key: 'i1',
        backward_compatibility: 'mwnf3:objects:ISL:eg:Mus01:1',
        name: 'Bowl with a bird',
        fields: ['description'],
      },
    ])
  })

  it('shows one record field by field in every file that holds it, by id or legacy key', () => {
    const record = diffVersions(v1, v2, { id: 'i1' }) as {
      files: { file: string; status: string; changes?: unknown[] }[]
    }
    const byFile = Object.fromEntries(record.files.map(f => [f.file, f]))
    expect(byFile['translations/items.en.json']).toEqual({
      file: 'translations/items.en.json',
      status: 'changed',
      changes: [
        {
          path: 'description',
          change: 'changed',
          before: 'A lustre bowl.',
          after: 'A lustre-painted bowl.',
        },
      ],
    })
    expect(byFile['translations/items.de.json'].status).toBe('added')
    expect(byFile['translations/items.fr.json'].status).toBe('unchanged')
    const removed = diffVersions(v1, v2, {
      id: 'mwnf3:objects:ISL:es:Mus02:7',
      file: 'items.json',
    }) as { files: { status: string }[] }
    expect(removed.files).toEqual([expect.objectContaining({ status: 'removed' })])
    expect(() => diffVersions(v1, v2, { id: 'nothing' })).toThrow(/No record/)
  })

  it('handles added and removed files at file level', () => {
    expect(diffVersions(v1, v2, { file: 'translations/items.de.json' })).toMatchObject({
      status: 'added',
    })
  })

  it('reports an unchanged version as unchanged', () => {
    const again = viewOf(projectV1(), '@museumwnf/islamicart-data', '1.0.1')
    const summary = diffVersions(v1, again) as { files_changed: number; records: unknown }
    expect(summary.files_changed).toBe(0)
    expect(summary.records).toEqual({ added: 0, removed: 0, changed: 0 })
  })

  it('works on other families: exhibition themes keyed by id', () => {
    const a = viewOf(exhibitionFiles())
    const changed = exhibitionFiles()
    ;(changed['themes.json'] as { display_order: number }[])[0].display_order = 2
    const b = viewOf(changed)
    const summary = diffVersions(a, b) as {
      files: { file: string; changed_fields: Record<string, number> }[]
    }
    expect(summary.files).toEqual([
      expect.objectContaining({
        file: 'themes.json',
        changed: 1,
        changed_fields: { display_order: 1 },
      }),
    ])
  })
})

describe('runQuery', () => {
  const view = viewOf(projectV1())

  it('runs JMESPath over any JSON file and pages array results', () => {
    expect(runQuery(view, 'items.json', 'length(@)')).toMatchObject({ result: 3 })
    expect(runQuery(view, 'items.json', "[?type=='object'].backward_compatibility")).toMatchObject({
      total: 2,
      results: ['mwnf3:objects:ISL:eg:Mus01:1', 'mwnf3:objects:ISL:es:Mus02:7'],
    })
    expect(runQuery(view, 'translations/items.en.json', 'keys(@)', { page_size: 2 })).toMatchObject(
      { total: 3, pages: 2 }
    )
    expect(runQuery(view, 'items.json', '[?length(images)==`0`].id')).toMatchObject({
      results: ['i2'],
    })
  })

  it('runs the README examples', () => {
    expect(
      runQuery(view, 'translations/items.en.json', 'values(@)[?!description] | length(@)')
    ).toMatchObject({ result: 2 })
    expect(
      runQuery(view, 'partners.json', '[?item_count==`5`].backward_compatibility')
    ).toMatchObject({ results: ['mwnf3:institutions:Ins02:es'] })
    expect(
      runQuery(view, 'items.json', '[?length(images)==`0`].{id: id, bc: backward_compatibility}')
    ).toMatchObject({ results: [{ id: 'i2', bc: 'mwnf3:monuments:ISL:eg:Mon01' }] })
    expect(runQuery(view, 'items.json', "[?type=='monument'] | length(@)")).toMatchObject({
      result: 1,
    })
  })

  it('explains a bad expression', () => {
    expect(() => runQuery(view, 'items.json', '[?')).toThrow(/Invalid JMESPath/)
    expect(() => runQuery(view, 'README.md', '@')).toThrow(/JSON files only/)
  })
})
