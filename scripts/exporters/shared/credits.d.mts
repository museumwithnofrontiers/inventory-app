/** Types of `credits.mjs`. */
import type { Query } from './sites.mjs'

export const COLLECTION_CREDIT_KEYS: readonly string[]

export function creditKey(collectionId: string, languageId: string, contextId: string): string

export function loadCollectionCredits(
  query: Query,
  collectionIds: string[]
): Promise<Map<string, Record<string, string>>>

export function withCollectionCredits(extra: unknown, credits: Record<string, string> | undefined): unknown

export function mysqlJsonOrder(object: Record<string, unknown>): Record<string, unknown>
