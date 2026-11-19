/** Types of `country-codes.mjs`. */

export const COUNTRY_CODE_MAP: Readonly<Record<string, string>>

export const COUNTRY_CODE_ALIASES: readonly string[]

export function legacyCountryCode(
  iso3: string,
  map?: Readonly<Record<string, string>>,
  aliases?: readonly string[]
): string
