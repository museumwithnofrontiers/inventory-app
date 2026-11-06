/**
 * Language keys inside `extra` JSON as the package writes them
 * (inventory-app#2394).
 *
 * The package keys every language by its legacy code
 * (`languages.backward_compatibility`: `en`, `se`, `ch`). Some importers
 * still write that code into `extra`, others the inventory's language id
 * (`eng`, `swe`, `zho`), and #2394 moves them all to the id. So a key is
 * taken either way: an id becomes its legacy code, anything else (a legacy
 * code already, or a language without one) stays as it is.
 */
export type LanguageKey = (key: string) => string

/** `codes`: language id → legacy code, as `buildLangCodeMap()` returns it. */
export function languageKeyer(codes: Map<string, string>): LanguageKey {
  return key => codes.get(key) ?? key
}

/**
 * A language-keyed map with its keys as the package writes them, in their
 * order. Should a record hold one language under both spellings, the first
 * stays.
 */
export function rekeyLanguages<T>(map: Record<string, T>, key: LanguageKey): Record<string, T> {
  const out: Record<string, T> = {}
  for (const [lang, value] of Object.entries(map)) {
    const code = key(lang)
    if (!(code in out)) out[code] = value
  }
  return out
}

/** `value` re-keyed when it is a language-keyed map (a plain object), else as it is. */
export function rekeyIfMap(value: unknown, key: LanguageKey): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  return rekeyLanguages(value as Record<string, unknown>, key)
}

/**
 * A map whose values are language-keyed maps (`image_captions.{image}.{lang}`,
 * `map_descriptions.map_{id}.{lang}`): each inner map re-keyed.
 */
export function rekeyNested(value: unknown, key: LanguageKey): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const out: Record<string, unknown> = {}
  for (const [name, inner] of Object.entries(value as Record<string, unknown>))
    out[name] = rekeyIfMap(inner, key)
  return out
}
