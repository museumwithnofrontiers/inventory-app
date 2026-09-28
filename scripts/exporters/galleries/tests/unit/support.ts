import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

import type { Database } from '../../src/core/database.js'
import type { Logger } from '../../src/core/logger.js'
import type { ExportContext } from '../../src/core/types.js'

/** A route of the fake database: the first route whose pattern matches the SQL answers it. */
export type Route = [RegExp, (params: unknown[]) => unknown[]]

/** A Database stand-in that answers each query from the first matching route, and records every call. */
export function fakeDb(routes: Route[]): Database & { calls: { sql: string; params: unknown[] }[] } {
  const calls: { sql: string; params: unknown[] }[] = []
  return {
    calls,
    query: async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params })
      const route = routes.find(([pattern]) => pattern.test(sql))
      if (!route) throw new Error(`Unrouted query: ${sql}`)
      return route[1](params)
    },
  } as unknown as Database & { calls: { sql: string; params: unknown[] }[] }
}

export const LANGUAGES: Route = [
  /FROM languages$/,
  () => [
    { id: 'eng', backward_compatibility: 'en' },
    { id: 'fra', backward_compatibility: 'fr' },
    { id: 'ara', backward_compatibility: 'ar' },
  ],
]

export const silentLogger = {
  info: () => {},
  success: () => {},
  warning: () => {},
  error: () => {},
} as unknown as Logger

export function tempDir(): { dir: string; read: (file: string) => unknown; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'galleries-hub-'))
  return {
    dir,
    read: (file: string) => JSON.parse(readFileSync(join(dir, file), 'utf-8')) as unknown,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  }
}

export function context(db: Database, outputDir: string): ExportContext {
  return {
    db,
    outputDir,
    hub: { id: 'hub-uuid', backwardCompatibility: 'mwnf3_thematic_gallery:thg_gallery:45' },
    siteKey: 'galleries',
    partnerProjectId: 'galleries-project-uuid',
    baseUrl: 'https://example.test',
    logger: silentLogger,
  }
}
