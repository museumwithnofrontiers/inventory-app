/** Types of `collection-flags.mjs`. */
import type { Query } from './sites.mjs'

export interface CollectionFlags {
  visible: boolean
  featured: boolean
  publishedAt: string | null
  contextId: string | null
  backwardCompatibility: string | null
}

export function loadCollectionFlags(query: Query, collectionIds: string[]): Promise<Map<string, CollectionFlags>>

export function withCollectionFlags(
  extra: unknown,
  flags: CollectionFlags | undefined,
  translation?: { language_id?: string; context_id?: string }
): unknown

export function restoreCollectionFlags<
  T extends { collection_id: string; extra?: unknown; language_id?: string; context_id?: string },
>(query: Query, rows: T[]): Promise<T[]>
