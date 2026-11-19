/** Types of `explore-monuments.mjs`. */

export function exploreMonumentsSelect(alias: string): string

export function exploreMonumentKeys(value: unknown, source: unknown): Record<string, unknown>

export function withExploreMonuments(extra: unknown, row: Record<string, unknown>): unknown

export function restoreExploreMonuments<T extends { extra?: unknown }>(rows: T[]): T[]
