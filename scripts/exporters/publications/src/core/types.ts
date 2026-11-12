import type { Site } from '../../../shared/sites.mjs'
import type { Database } from './database.js'
import type { Logger } from './logger.js'
import type { PublicationsScope } from './scope.js'

export interface ExportContext {
  db: Database
  outputDir: string
  /** The publications, their trails and the items the package references. */
  scope: PublicationsScope
  /** The publications' projects (`scope.projectIds`). */
  projectIds: string[]
  projectKeys: string[]
  baseUrl: string
  logger: Logger
  /** Every site of the instance files (`shared/sites.mjs`). */
  sites: Site[]
  /** Each project's home site, by project UUID (`loadHomeSites`); none where it is left out. */
  homeSites?: ReadonlyMap<string, string>
}

export interface ExportResult {
  file: string
  count: number
}

/** A cover or a sample page, as a `/pub` rendition. */
export interface PublicationImage {
  url: string
  alt_text: string | null
  photographer: string | null
  display_order: number
  /** The edition it belongs to; null when legacy does not say. */
  edition_id: string | null
}

/** A sample or credits PDF, at its public `/doc` URL. */
export interface PublicationDocument {
  id: string
  kind: string
  url: string
  /** Its language code; null when it has none. */
  language: string | null
}
