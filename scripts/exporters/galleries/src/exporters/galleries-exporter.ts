import type { ExportResult, GalleryAnchor, GalleryChrome } from '../core/types.js'
import { parseJson } from '../core/database.js'
import { BaseExporter } from './base-exporter.js'

/** The purpose that marks the root every gallery hangs under (importer phase 10). */
export const GALLERIES_ROOT_PURPOSE = 'galleries-root'

interface GalleryRow {
  id: string
  backward_compatibility: string
  extra: unknown
}

interface TranslationRow {
  collection_id: string
  language_id: string
  title: string | null
  extra: unknown
}

export interface HubGallery {
  id: string
  backward_compatibility: string
  slug: string | null
  legacy_host: string | null
  names: Record<string, string>
  languages: string[]
  image_path: string | null
  featured: boolean
  live_date: string | null
}

/**
 * `galleries.json` — every gallery the hub lists.
 *
 * The children of the galleries root, of type `gallery`, that legacy shows:
 * status `A`. Exhibitions hang under their own root and legacy's hub never
 * listed them. Each entry carries the same fields as a gallery package's
 * `sibling_galleries`, from the same sources: the anchor on
 * `collections.extra.thg_gallery` and the chrome on
 * `collection_translations.extra.thg_gallery`.
 *
 * `legacy_host` is a reference, never a built URL (decision Q3): the website
 * links a gallery the way the gallery sites link their siblings.
 */
export class GalleriesExporter extends BaseExporter {
  getName(): string {
    return 'Galleries'
  }

  async export(): Promise<ExportResult> {
    this.logger.info('Exporting galleries.json...')

    const galleries = await this.db.query<GalleryRow>(
      `SELECT g.id, g.backward_compatibility, g.extra
       FROM collections g
       JOIN collections root ON root.id = g.parent_id
       WHERE root.purpose = ?
         AND g.type = 'gallery'
       ORDER BY g.backward_compatibility`,
      [GALLERIES_ROOT_PURPOSE]
    )

    if (galleries.length === 0) {
      throw new Error(
        `No gallery under the '${GALLERIES_ROOT_PURPOSE}' root — check that the importer's phase 10 ran against this database.`
      )
    }

    const ids = galleries.map(g => g.id)
    const translations = await this.db.query<TranslationRow>(
      // Row order is unspecified; sorted so each gallery's `names` key order and
      // the "first row wins" chrome pick are byte-identical across two exports.
      `SELECT collection_id, language_id, title, extra
       FROM collection_translations
       WHERE collection_id IN (${this.placeholders(ids.length)})
       ORDER BY collection_id, language_id`,
      ids
    )

    const langCodeMap = await this.buildLangCodeMap()
    const namesById = new Map<string, Record<string, string>>()
    const chromeById = new Map<string, GalleryChrome>()
    for (const row of translations) {
      const code = langCodeMap.get(row.language_id)
      if (code && row.title) {
        const names = namesById.get(row.collection_id) ?? {}
        names[code] = row.title
        namesById.set(row.collection_id, names)
      }
      if (!chromeById.has(row.collection_id)) {
        const chrome = parseJson<{ thg_gallery?: GalleryChrome }>(row.extra)?.thg_gallery
        if (chrome) chromeById.set(row.collection_id, chrome)
      }
    }

    const output = listedGalleries(
      galleries.map(gallery => {
        const anchor = parseJson<{ thg_gallery?: GalleryAnchor }>(gallery.extra)?.thg_gallery ?? {}
        const chrome = chromeById.get(gallery.id) ?? {}
        const names = namesById.get(gallery.id) ?? {}
        return {
          gallery: {
            id: gallery.id,
            backward_compatibility: gallery.backward_compatibility,
            slug: anchor.slug ?? null,
            legacy_host: anchor.host ?? null,
            names,
            languages: Object.keys(names).sort(),
            image_path: chrome.image ?? null,
            featured: isFeatured(chrome.featured),
            live_date: chrome.live_date ?? null,
          },
          hidden: isHidden(chrome.status),
        }
      })
    )

    await this.writeJson('galleries.json', output)
    this.logger.success(
      `galleries.json (${output.length} galleries of ${galleries.length} under the root)`
    )

    return { file: 'galleries.json', count: output.length }
  }
}

/**
 * The galleries the hub shows, in the order it shows them: hidden ones
 * dropped, then English name A to Z.
 *
 * Legacy ordered by `thg_gallery.sort_order`, which the importer does not
 * carry. That order was itself English-name A–Z order (checked against the
 * live list on 2026-09-28), so sorting by name reproduces it. A gallery
 * without an English name sorts by its backward-compatibility key, after the
 * named ones.
 */
export function listedGalleries(
  candidates: { gallery: HubGallery; hidden: boolean }[]
): HubGallery[] {
  return candidates
    .filter(candidate => !candidate.hidden)
    .map(candidate => candidate.gallery)
    .sort((a, b) => {
      const nameA = a.names['en']
      const nameB = b.names['en']
      if (nameA && nameB) {
        const byName = nameA.localeCompare(nameB, 'en', { sensitivity: 'base' })
        if (byName !== 0) return byName
      } else if (nameA || nameB) {
        return nameA ? -1 : 1
      }
      return a.backward_compatibility < b.backward_compatibility ? -1 : 1
    })
}

/**
 * `featured` and `status` are two INDEPENDENT legacy flags sharing the enum
 * ('A','H'): featured = highlighted in the portal strip, status = visible at
 * all. dxa-api reports `featured` inverted; this ships the documented meaning
 * (see `isFeatured` in dxa-gallery's gallery-exporter.ts for the whole story).
 */
export function isFeatured(flag: string | undefined | null): boolean {
  return flag === 'A'
}

/** `status = 'A'` is the visible state; anything else hides the gallery. */
export function isHidden(status: string | undefined | null): boolean {
  return status !== 'A'
}
