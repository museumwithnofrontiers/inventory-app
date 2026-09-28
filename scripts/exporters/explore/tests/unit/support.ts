import type { Logger } from '../../src/core/logger.js'
import type { ExploreScope } from '../../src/core/scope.js'
import type { Database } from '../../src/core/database.js'
import type { ExportContext } from '../../src/core/types.js'

export const quietLogger = {
  info: () => {},
  success: () => {},
  warning: () => {},
  error: () => {},
} as unknown as Logger

export function scopeWith(overrides: Partial<ExploreScope> = {}): ExploreScope {
  return {
    exploreContextId: 'explore-context',
    rootId: 'root',
    collectionIds: ['root'],
    itemIds: [],
    projectIds: [],
    contextIds: ['explore-context'],
    ...overrides,
  }
}

export function contextWith(db: Database, outputDir: string, scope: ExploreScope): ExportContext {
  return {
    db,
    outputDir,
    scope,
    projectIds: scope.projectIds,
    contextIds: scope.contextIds,
    projectKeys: ['explore'],
    baseUrl: 'https://example.test',
    logger: quietLogger,
  }
}
