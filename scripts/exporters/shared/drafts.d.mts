/** Types of `drafts.mjs`. */
import type { Query } from './sites.mjs'

export function itemShipped(alias: string): string

export function itemIdShipped(column: string, alias: string): string

export function textShipped(alias: string): string

export function loadDraftCollectionIds(query: Query): Promise<Set<string>>

export function loadDraftItemIds(query: Query): Promise<Set<string>>

export function assertNoDraftItems(query: Query, outputDir: string): Promise<void>
