import { search, type JSONValue } from '@jmespath-community/jmespath'
import { paginate } from './browse.js'
import type { PackageView } from './package-view.js'

/**
 * JMESPath over one JSON file of the package.
 *
 * JMESPath rather than JSONPath: it has one written specification with a
 * compliance suite, so an expression means the same thing everywhere, while
 * JSONPath implementations disagreed for years before RFC 9535. It can also
 * reshape and aggregate (`length(@)`, `sort_by`, multi-select hashes) where
 * JSONPath only selects nodes, and assessment questions are mostly counts and
 * projections.
 */
export function runQuery(
  view: PackageView,
  file: string,
  expression: string,
  options: { page?: number; page_size?: number } = {}
) {
  if (!file.endsWith('.json')) throw new Error('query works on JSON files only')
  const data = view.json(file) as JSONValue
  let result: JSONValue
  try {
    result = search(data, expression)
  } catch (error) {
    throw new Error(`Invalid JMESPath expression "${expression}": ${(error as Error).message}`, {
      cause: error,
    })
  }
  if (Array.isArray(result)) {
    return {
      package: view.label,
      file,
      expression,
      ...paginate(result, options.page, options.page_size ?? 100),
    }
  }
  return { package: view.label, file, expression, result }
}
