/** Types of `collection-columns.mjs`. */

export const COLLECTION_TRANSLATION_COLUMNS: readonly { readonly key: string; readonly column: string }[]

export function collectionColumnsSelect(alias: string): string

export function withCollectionTranslationColumns(extra: unknown, row: Record<string, unknown>): unknown

export function restoreCollectionColumns<T extends { extra?: unknown }>(rows: T[]): T[]
