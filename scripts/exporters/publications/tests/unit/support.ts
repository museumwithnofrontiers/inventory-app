import type { Site } from '../../../shared/sites.mjs'
import type { Logger } from '../../src/core/logger.js'
import type { PublicationsScope } from '../../src/core/scope.js'
import type { Database } from '../../src/core/database.js'
import type { ExportContext } from '../../src/core/types.js'

export const quietLogger = {
  info: () => {},
  success: () => {},
  warning: () => {},
  error: () => {},
} as unknown as Logger

export const SITES: Site[] = [
  {
    slug: 'islamicart',
    kind: 'standalone',
    origin: 'https://example.test/islamicart',
    itemPath: '/item/:id',
    rule: { type: 'project', projectIds: ['isl'] },
  },
  { slug: 'publications', kind: 'standalone', origin: 'https://example.test/publications', itemPath: '/item/:id', rule: null },
  {
    slug: 'travels',
    kind: 'standalone',
    origin: 'https://example.test/travels',
    itemPath: '/item/:id',
    rule: { type: 'tree', rootPurpose: 'travels-root', memberOf: ['location'] },
  },
]

export function scopeWith(overrides: Partial<PublicationsScope> = {}): PublicationsScope {
  return {
    publicationIds: [],
    projectIds: [],
    trailsByPublication: new Map(),
    catalogueByPublication: new Map(),
    trailIds: [],
    entriesByTrail: new Map(),
    referenceIds: [],
    ...overrides,
  }
}

export function contextWith(db: Database, outputDir: string, scope: PublicationsScope): ExportContext {
  return {
    db,
    outputDir,
    scope,
    projectIds: scope.projectIds,
    projectKeys: ['publications'],
    baseUrl: 'https://example.test',
    logger: quietLogger,
    sites: SITES,
  }
}

/** A fake database answering each query by the first fragment its SQL contains. */
export function fakeDb(answers: [string, unknown[]][]): Database {
  return {
    query: async (sql: string) => {
      for (const [fragment, rows] of answers) if (sql.includes(fragment)) return rows
      return []
    },
  } as unknown as Database
}
