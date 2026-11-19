/** Types of `placement-translations.mjs`. */

export function placementTranslationsSelect(alias: string): string

export function descriptionKey(source: unknown): string

export function placementTextKeys(value: unknown, source: unknown): Record<string, unknown>

export function withPlacementTranslations(extra: unknown, row: Record<string, unknown>): unknown

export function restorePlacementTranslations<T extends { extra?: unknown }>(rows: T[]): T[]
