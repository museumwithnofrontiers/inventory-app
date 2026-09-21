/**
 * The website layout: one site's texts, in the keys the viewer-i18n dictionary
 * does not already provide.
 *
 * Almost everything a scaffolded site renders comes from `@museumwnf/viewer-i18n`'s
 * shared gallery/exhibition bundle — the common UI labels, `galleryPartners`,
 * `searchHowTo`, `thg_about_text`, `txt*`, all of it. Only two legacy keys are a
 * site's own editorial copy: its credits — `galleryCredits` for a gallery,
 * `exhibitionCredits` for an exhibition — and, for a gallery only, `galleryAbout`
 * — `standardRoutes('exhibition', …)` has no About page (blocked on the Theme
 * epic, inventory-app#1729). This module maps those into the keys the live sites
 * already carry in `locales/<lang>.json` (verified against
 * carpets/amulets/water-in-islam/the-use-of-colours-in-art on `origin/main`,
 * 2026-09-21) and reports everything else as not emitted, so a reviewer can see
 * what the site does not own without diffing 450 keys by hand.
 */
import type { MessageCatalogue, SiteKind } from './core/types.js'

/**
 * The legacy key -> viewer-i18n key mapping for a site, given its kind and its
 * chosen namespace.
 *
 * Credits are namespaced per site (`<ns>.credits.body`) because every site's
 * credits are its own text, but the legacy source key depends on kind: a
 * gallery's credits are `galleryCredits`, while an exhibition's are
 * `exhibitionCredits` — the legacy exhibitions client renders that key, and
 * that is the text the two live exhibition sites (the-use-of-colours-in-art,
 * water-in-islam) actually carry, not the common group's `galleryCredits`
 * fallback. `galleryAbout` maps to the fixed `gallery.about.body` — not
 * namespaced — because the About page markup itself is shared across every
 * gallery; only an exhibition has none.
 */
export function websiteKeyMapping(kind: SiteKind, namespace: string): Record<string, string> {
  if (kind === 'exhibition') {
    return {
      exhibitionCredits: `${namespace}.credits.body`,
    }
  }
  return {
    galleryCredits: `${namespace}.credits.body`,
    galleryAbout: 'gallery.about.body',
  }
}

export interface WebsiteCatalogue {
  /** Per-locale messages in viewer-i18n keys, one file per locale legacy actually has a value for. */
  locales: MessageCatalogue
  /** Legacy keys present in the merged catalogue that the website layout does not own and does not emit. */
  notEmitted: string[]
  /** Site-owned legacy keys (galleryCredits/exhibitionCredits/galleryAbout) with no English value, so omitted rather than left blank. */
  missing: string[]
}

/**
 * Build a site's website-layout catalogue from its merged (flat) message
 * catalogue.
 *
 * `messages` is the same catalogue `mergeTranslationGroups` already produced —
 * common group as the base, site group overriding and adding — so values have
 * already passed through `convertHtmlToMarkdown` exactly once; this function does
 * not convert again.
 */
export function buildWebsiteCatalogue(
  messages: MessageCatalogue,
  kind: SiteKind,
  namespace: string
): WebsiteCatalogue {
  const mapping = websiteKeyMapping(kind, namespace)
  const ownedLegacyKeys = Object.keys(mapping)

  const locales: MessageCatalogue = {}
  for (const locale of Object.keys(messages).sort()) {
    const source = messages[locale]!
    const localeMessages: Record<string, string> = {}
    for (const legacyKey of ownedLegacyKeys) {
      const value = source[legacyKey]
      if (value !== undefined) {
        localeMessages[mapping[legacyKey]!] = value
      }
    }
    if (Object.keys(localeMessages).length === 0) {
      continue
    }
    const sorted: Record<string, string> = {}
    for (const key of Object.keys(localeMessages).sort()) {
      sorted[key] = localeMessages[key]!
    }
    locales[locale] = sorted
  }

  const englishSource = messages['en'] ?? {}
  const missing = ownedLegacyKeys.filter((legacyKey) => englishSource[legacyKey] === undefined).sort()

  const notEmittedSet = new Set<string>()
  for (const locale of Object.keys(messages)) {
    for (const legacyKey of Object.keys(messages[locale]!)) {
      if (!ownedLegacyKeys.includes(legacyKey)) {
        notEmittedSet.add(legacyKey)
      }
    }
  }

  return { locales, notEmitted: [...notEmittedSet].sort(), missing }
}

/** One lowercase-led word of letters and digits — a namespace, not a class or a slug. */
export const NAMESPACE_PATTERN = /^[a-z][a-zA-Z0-9]*$/
