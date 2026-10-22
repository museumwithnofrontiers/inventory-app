import { paginate } from './browse.js'
import { isRec, type PackageView } from './package-view.js'

const TEXT_PAGE = 20_000

export function listFiles(view: PackageView, prefix?: string) {
  const files = view.listFiles().filter(f => !prefix || f.startsWith(prefix))
  return {
    package: view.label,
    count: files.length,
    files: files.map(f => {
      const row: { path: string; bytes: number; records?: number } = {
        path: f,
        bytes: view.size(f),
      }
      if (f.endsWith('.json') && !f.includes('/')) {
        const value = view.json(f)
        if (Array.isArray(value)) row.records = value.length
      }
      return row
    }),
  }
}

/**
 * A file in pages: an array by records, a large object (a translation map) by
 * entries, anything else by characters. A small object comes back whole.
 */
export function readFile(
  view: PackageView,
  file: string,
  options: { page?: number; page_size?: number } = {}
) {
  if (file.endsWith('.json')) {
    const value = view.json(file)
    if (Array.isArray(value)) {
      return {
        package: view.label,
        file,
        unit: 'records',
        ...paginate(value, options.page, options.page_size ?? 25),
      }
    }
    if (isRec(value) && Object.keys(value).length > 50) {
      const entries = Object.entries(value)
      const page = paginate(entries, options.page, options.page_size ?? 50)
      return {
        package: view.label,
        file,
        unit: 'entries',
        ...page,
        results: Object.fromEntries(page.results),
      }
    }
    return { package: view.label, file, unit: 'whole', content: value }
  }
  const text = view.text(file)
  const size = Math.max(1000, Math.min(options.page_size ?? TEXT_PAGE, 100_000))
  const pages = Math.max(1, Math.ceil(text.length / size))
  const page = Math.max(1, Math.min(options.page ?? 1, pages))
  return {
    package: view.label,
    file,
    unit: 'characters',
    total: text.length,
    page,
    page_size: size,
    pages,
    content: text.slice((page - 1) * size, page * size),
  }
}
