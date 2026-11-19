/** Types of `visit-information.mjs`. */

export const VISIT_INFORMATION_COLUMN: string

export function visitInformationSelect(alias: string, ownerColumn: 'item_id' | 'collection_id' | 'partner_id'): string

export function withVisitInformation(extra: unknown, row: Record<string, unknown>): unknown

export function restoreVisitInformation<T extends { extra?: unknown }>(rows: T[]): T[]
