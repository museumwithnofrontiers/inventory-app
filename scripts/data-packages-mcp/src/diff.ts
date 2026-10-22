import { displayName, paginate } from './browse.js'
import { isRec, type JsonValue, type PackageView, type Rec } from './package-view.js'

export interface FieldChange {
  path: string
  change: 'added' | 'removed' | 'changed'
  before?: JsonValue
  after?: JsonValue
}

/**
 * Fields that change on every export whatever the data did. They are reported
 * apart, so a version whose only change is its build stamp reads as unchanged.
 */
const VOLATILE: Record<string, string[]> = {
  'manifest.json': ['generatedAt', 'version'],
  'package.json': ['version'],
}

/** Keys that identify an element of an array of objects, in order of preference. */
const ELEMENT_KEYS = ['id', 'picture_item_id', 'legacy_id', 'url', 'code']

export function deepEqual(a: JsonValue | undefined, b: JsonValue | undefined): boolean {
  if (a === b) return true
  if (a === undefined || b === undefined || a === null || b === null) return false
  if (Array.isArray(a)) {
    return Array.isArray(b) && a.length === b.length && a.every((x, i) => deepEqual(x, b[i]))
  }
  if (isRec(a)) {
    if (!isRec(b)) return false
    const ka = Object.keys(a)
    if (ka.length !== Object.keys(b).length) return false
    return ka.every(k => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]))
  }
  return false
}

const clip = (value: JsonValue | undefined, max = 400): JsonValue | undefined => {
  if (value === undefined) return undefined
  if (typeof value === 'string')
    return value.length > max ? `${value.slice(0, max)}… (${value.length} chars)` : value
  const text = JSON.stringify(value)
  return text.length > max ? `${text.slice(0, max)}… (${text.length} chars of JSON)` : value
}

const elementKey = (list: JsonValue[]): string | null => {
  if (list.length === 0 || !list.every(isRec)) return null
  for (const key of ELEMENT_KEYS) {
    const values = list.map(e => (e as Rec)[key])
    if (
      values.every(v => typeof v === 'string' || typeof v === 'number') &&
      new Set(values).size === values.length
    ) {
      return key
    }
  }
  return null
}

/** Field-by-field differences between two JSON values, as paths. */
export function deepDiff(
  a: JsonValue | undefined,
  b: JsonValue | undefined,
  path = '',
  out: FieldChange[] = [],
  limit = 500
): FieldChange[] {
  if (out.length >= limit || deepEqual(a, b)) return out
  if (a === undefined) {
    out.push({ path: path || '.', change: 'added', after: clip(b) })
    return out
  }
  if (b === undefined) {
    out.push({ path: path || '.', change: 'removed', before: clip(a) })
    return out
  }
  if (isRec(a) && isRec(b)) {
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      deepDiff(a[key], b[key], path ? `${path}.${key}` : key, out, limit)
    }
    return out
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    const key = elementKey(a) && elementKey(b) === elementKey(a) ? elementKey(a) : null
    if (key) {
      const before = new Map(a.map(e => [String((e as Rec)[key]), e]))
      const after = new Map(b.map(e => [String((e as Rec)[key]), e]))
      for (const k of new Set([...before.keys(), ...after.keys()])) {
        deepDiff(before.get(k), after.get(k), `${path}[${key}=${k}]`, out, limit)
      }
      const orderBefore = [...before.keys()].filter(k => after.has(k))
      const orderAfter = [...after.keys()].filter(k => before.has(k))
      if (orderBefore.join('\u0000') !== orderAfter.join('\u0000')) {
        out.push({
          path: `${path}[order]`,
          change: 'changed',
          before: clip(orderBefore),
          after: clip(orderAfter),
        })
      }
      return out
    }
    if (
      a.every(e => !isRec(e) && !Array.isArray(e)) &&
      b.every(e => !isRec(e) && !Array.isArray(e))
    ) {
      out.push({ path, change: 'changed', before: clip(a), after: clip(b) })
      return out
    }
    for (let i = 0; i < Math.max(a.length, b.length); i++)
      deepDiff(a[i], b[i], `${path}[${i}]`, out, limit)
    return out
  }
  out.push({ path: path || '.', change: 'changed', before: clip(a), after: clip(b) })
  return out
}

type Shape = 'records' | 'keyed' | 'object' | 'text'

interface Loaded {
  shape: Shape
  entries: Map<string, JsonValue>
  text?: string
}

function load(view: PackageView, file: string): Loaded {
  if (!file.endsWith('.json')) return { shape: 'text', entries: new Map(), text: view.text(file) }
  const value = view.json(file)
  if (Array.isArray(value)) {
    const key = elementKey(value)
    return {
      shape: 'records',
      entries: new Map(value.map((e, i) => [key ? String((e as Rec)[key]) : `#${i}`, e])),
    }
  }
  if (isRec(value) && file.startsWith('translations/')) {
    return { shape: 'keyed', entries: new Map(Object.entries(value)) }
  }
  return { shape: 'object', entries: new Map([['', value]]) }
}

const entityOf = (file: string) => file.replace(/^translations\//, '').replace(/\..*$/, '')

function label(view: PackageView, file: string, key: string, value: JsonValue | undefined) {
  const entity = entityOf(file)
  const rec = isRec(value) ? value : undefined
  const base = file.startsWith('translations/')
    ? view.records(entity).find(r => r.id === key.split('/')[0])
    : rec
  return {
    key,
    backward_compatibility:
      base && typeof base.backward_compatibility === 'string' ? base.backward_compatibility : null,
    name:
      (rec &&
        ['name', 'title', 'word']
          .map(k => rec[k])
          .find((v): v is string => typeof v === 'string' && v !== '')) ??
      (base ? displayName(view, entity, base) : null),
  }
}

function stripVolatile(file: string, value: JsonValue | undefined): JsonValue | undefined {
  const fields = VOLATILE[file]
  if (!fields || !isRec(value)) return value
  return Object.fromEntries(Object.entries(value).filter(([key]) => !fields.includes(key)))
}

interface FileComparison {
  file: string
  shape: Shape
  before: number
  after: number
  added: string[]
  removed: string[]
  changed: string[]
  changed_fields: Record<string, number>
  volatile: FieldChange[]
}

function compareFile(a: PackageView, b: PackageView, file: string): FileComparison {
  const left = load(a, file)
  const right = load(b, file)
  const result: FileComparison = {
    file,
    shape: right.shape,
    before: left.entries.size,
    after: right.entries.size,
    added: [],
    removed: [],
    changed: [],
    changed_fields: {},
    volatile: [],
  }
  if (left.shape === 'text' || right.shape === 'text') {
    if (left.text !== right.text) result.changed.push('')
    return result
  }
  for (const key of right.entries.keys()) if (!left.entries.has(key)) result.added.push(key)
  for (const key of left.entries.keys()) if (!right.entries.has(key)) result.removed.push(key)
  for (const [key, before] of left.entries) {
    const after = right.entries.get(key)
    if (after === undefined || deepEqual(before, after)) continue
    if (VOLATILE[file]) {
      result.volatile = deepDiff(before, after).filter(c =>
        VOLATILE[file].includes(c.path.split('.')[0])
      )
      if (deepEqual(stripVolatile(file, before), stripVolatile(file, after))) continue
    }
    result.changed.push(key)
    const fields = new Set<string>()
    for (const change of deepDiff(stripVolatile(file, before), stripVolatile(file, after))) {
      fields.add(change.path.split(/[.[]/)[0] || '.')
    }
    for (const f of fields) result.changed_fields[f] = (result.changed_fields[f] ?? 0) + 1
  }
  return result
}

const isChanged = (c: FileComparison) => c.added.length + c.removed.length + c.changed.length > 0

export interface DiffOptions {
  file?: string
  id?: string
  page?: number
  page_size?: number
  include_unchanged?: boolean
}

/**
 * What changed between two published versions. Three levels:
 * - no `file`/`id`: one line per changed file, with counts and the fields that moved;
 * - `file`: the records added, removed and changed in that file (paged);
 * - `id` (optionally with `file`): that record field by field, in every file that holds it.
 */
export function diffVersions(a: PackageView, b: PackageView, options: DiffOptions = {}) {
  const head = { from: a.label, to: b.label }
  const filesA = new Set(a.listFiles())
  const filesB = new Set(b.listFiles())
  const common = [...filesB].filter(f => filesA.has(f))

  if (options.id) return { ...head, ...recordDiff(a, b, options.id, options.file) }

  if (options.file) {
    const file = options.file
    if (!filesA.has(file) && !filesB.has(file)) throw new Error(`Neither version ships "${file}"`)
    if (!filesA.has(file) || !filesB.has(file)) {
      return { ...head, file, status: filesA.has(file) ? 'removed' : 'added' }
    }
    const c = compareFile(a, b, file)
    const describe = (view: PackageView, keys: string[]) => {
      const loaded = load(view, file)
      return keys.map(k => label(view, file, k, loaded.entries.get(k)))
    }
    const changedPage = paginate(c.changed, options.page, options.page_size)
    const left = load(a, file)
    const right = load(b, file)
    return {
      ...head,
      file,
      shape: c.shape,
      counts: {
        before: c.before,
        after: c.after,
        added: c.added.length,
        removed: c.removed.length,
        changed: c.changed.length,
      },
      changed_fields: c.changed_fields,
      volatile: c.volatile,
      added: paginate(describe(b, c.added), options.page, options.page_size),
      removed: paginate(describe(a, c.removed), options.page, options.page_size),
      changed: {
        ...changedPage,
        results: changedPage.results.map(key => ({
          ...label(b, file, key, right.entries.get(key)),
          fields: [
            ...new Set(
              deepDiff(
                stripVolatile(file, left.entries.get(key)),
                stripVolatile(file, right.entries.get(key))
              ).map(ch => ch.path)
            ),
          ],
        })),
      },
      hint: 'Pass id=<key> (with this file) for the field-by-field values.',
    }
  }

  const comparisons = common.map(f => compareFile(a, b, f))
  const changed = comparisons.filter(isChanged)
  const totals = { added: 0, removed: 0, changed: 0 }
  for (const c of changed) {
    totals.added += c.added.length
    totals.removed += c.removed.length
    totals.changed += c.changed.length
  }
  return {
    ...head,
    files_added: [...filesB].filter(f => !filesA.has(f)),
    files_removed: [...filesA].filter(f => !filesB.has(f)),
    files_changed: changed.length,
    files_unchanged: comparisons.length - changed.length,
    records: totals,
    files: changed.map(c => ({
      file: c.file,
      before: c.before,
      after: c.after,
      added: c.added.length,
      removed: c.removed.length,
      changed: c.changed.length,
      changed_fields: c.changed_fields,
    })),
    unchanged: options.include_unchanged
      ? comparisons.filter(c => !isChanged(c)).map(c => c.file)
      : undefined,
    volatile: comparisons.flatMap(c => c.volatile.map(v => ({ file: c.file, ...v }))),
    hint: 'Pass file=<path> to list the records behind a line, then id=<key> for one record.',
  }
}

function recordDiff(a: PackageView, b: PackageView, id: string, file: string | undefined) {
  const files = file
    ? [file]
    : [...new Set([...a.listFiles(), ...b.listFiles()])].filter(f => f.endsWith('.json'))
  const results: { file: string; status: string; record?: JsonValue; changes?: FieldChange[] }[] =
    []
  for (const f of files) {
    const left = a.has(f) ? load(a, f) : null
    const right = b.has(f) ? load(b, f) : null
    let before = left?.entries.get(id)
    let after = right?.entries.get(id)
    // A legacy key works as well as an inventory id for record files.
    if (
      before === undefined &&
      after === undefined &&
      (left?.shape === 'records' || right?.shape === 'records')
    ) {
      const byBc = (l: Loaded | null) =>
        l
          ? [...l.entries.values()].find(v => isRec(v) && v.backward_compatibility === id)
          : undefined
      before = byBc(left)
      after = byBc(right)
    }
    if (before === undefined && after === undefined) continue
    if (before === undefined) results.push({ file: f, status: 'added', record: after })
    else if (after === undefined) results.push({ file: f, status: 'removed', record: before })
    else if (deepEqual(before, after)) results.push({ file: f, status: 'unchanged' })
    else results.push({ file: f, status: 'changed', changes: deepDiff(before, after) })
  }
  if (results.length === 0)
    throw new Error(`No record "${id}" in either version${file ? ` of ${file}` : ''}`)
  return { id, files: results }
}
