/** Types of `collection-relations.mjs`. */
import type { Query } from './sites.mjs'

export const TRANSLATION_LINK_KEYS: readonly { readonly key: string; readonly kind: string; readonly prefix: string }[]

export interface CollectionRelations {
  contextId: string | null
  countries: string[]
  links: Record<string, string[]>
  cover: { item_id: string; backward_compatibility: string | null } | null
  days: number | null
}

export function loadCollectionRelations(query: Query, collectionIds: string[]): Promise<Map<string, CollectionRelations>>

export function withCollectionRelations(extra: unknown, relations: CollectionRelations | undefined): unknown

export function withTranslationRelations(
  extra: unknown,
  relations: CollectionRelations | undefined,
  translation: { collection_id: string; language_id: string; context_id: string }
): unknown
