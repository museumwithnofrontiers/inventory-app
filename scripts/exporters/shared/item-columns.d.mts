/** Types of `item-columns.mjs`. */

export const ITEM_TRANSLATION_COLUMNS: readonly { readonly key: string; readonly column: string }[]

export function itemColumnsSelect(alias: string): string

export function withItemTranslationColumns(extra: unknown, row: Record<string, unknown>): unknown

export function restoreItemColumns<T extends { extra?: unknown }>(rows: T[]): T[]
