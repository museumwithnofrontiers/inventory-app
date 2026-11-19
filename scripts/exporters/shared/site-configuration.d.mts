/** Types of `site-configuration.mjs`. */

export interface SiteRecord {
  extra?: Record<string, unknown>
  translation_extra?: Record<string, unknown>
  translations?: Record<string, Record<string, unknown>>
}

export function setSiteConfiguration(records: Map<string, SiteRecord> | null): void

export function loadSiteConfiguration(directory?: string): Map<string, SiteRecord>

export function withSiteCollectionExtra(
  extra: unknown,
  collectionId: string,
  records?: Map<string, SiteRecord>
): unknown

export function withSiteTranslationExtra(
  extra: unknown,
  collectionId: string,
  languageId: string | undefined,
  records?: Map<string, SiteRecord>
): unknown

export function restoreSiteTranslations<T extends { collection_id: string; language_id?: string; extra?: unknown }>(
  rows: T[]
): T[]

export function restoreSiteCollections<T extends { id: string; extra?: unknown }>(rows: T[]): T[]

export function galleryProjectCode(collectionId: string): string | null
