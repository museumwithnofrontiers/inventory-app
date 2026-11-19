/** Types of `partner-columns.mjs`. */

export function partnerColumnsSelect(alias: string): string

export function withPartnerColumns(extra: unknown, row: Record<string, unknown>): unknown

export function restorePartnerColumns<T extends { extra?: unknown }>(rows: T[]): T[]
