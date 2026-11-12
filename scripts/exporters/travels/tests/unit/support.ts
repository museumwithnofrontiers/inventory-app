import type { Site } from '../../../shared/sites.mjs'
import type { Logger } from '../../src/core/logger.js'
import type { TravelsScope } from '../../src/core/scope.js'
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

export function scopeWith(overrides: Partial<TravelsScope> = {}): TravelsScope {
  return {
    travelsContextId: 'travels-context',
    rootId: 'root',
    collectionIds: ['root'],
    trailIds: [],
    itemIds: [],
    entriesByTrail: new Map(),
    entryIds: [],
    projectIds: [],
    partnerIds: [],
    contextIds: ['travels-context'],
    ...overrides,
  }
}

export function contextWith(db: Database, outputDir: string, scope: TravelsScope): ExportContext {
  return {
    db,
    outputDir,
    scope,
    projectIds: scope.projectIds,
    contextIds: scope.contextIds,
    projectKeys: ['travels'],
    baseUrl: 'https://example.test',
    logger: quietLogger,
    sites: SITES,
  }
}
