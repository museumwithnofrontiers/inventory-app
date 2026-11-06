import { bannerRefToBackwardCompatibility } from '../core/banner-reference.js'
import { parseJson } from '../core/database.js'
import type { ExportResult } from '../core/types.js'
import { BaseExporter } from './base-exporter.js'

/** The `thg_gallery` fields the importer copies onto every language row of the hub's collection. */
interface HubChrome {
  banner_item?: string
  homepage_item?: string
  image?: string
  banner_image?: string
  homepage_image?: string
  live_date?: string
}

/**
 * `gallery.json` — the hub's own record in the shape of a gallery package's
 * (dxa-gallery's `GalleryExporter`): legacy's hub is DXA gallery 45, and the
 * gallery family's shell and pages read this file — its names, its banner
 * picture and the object the banner shows, whose sheet captions it
 * (#2425). The hub lists its galleries in `galleries.json`, so it names no
 * siblings here, and it has no timeline of its own.
 */
export class GalleryRecordExporter extends BaseExporter {
  getName(): string {
    return 'Gallery'
  }

  async export(): Promise<ExportResult> {
    this.logger.info('Exporting gallery.json...')

    const langCodeMap = await this.buildLangCodeMap()
    const [collections, translations] = await Promise.all([
      this.db.query<{ extra: unknown }>(`SELECT extra FROM collections WHERE id = ?`, [this.hub.id]),
      this.db.query<{ language_id: string; title: string | null; extra: unknown }>(
        `SELECT language_id, title, extra FROM collection_translations WHERE collection_id = ? ORDER BY language_id`,
        [this.hub.id]
      ),
    ])

    const names: Record<string, string> = {}
    let chrome: HubChrome = {}
    for (const row of translations) {
      const code = langCodeMap.get(row.language_id)
      if (code && row.title) names[code] = row.title
      // The fields describe the gallery, not the language: the first row wins.
      const parsed = parseJson<{ thg_gallery?: HubChrome }>(row.extra)
      if (!chrome.banner_image && parsed?.thg_gallery) chrome = parsed.thg_gallery
    }
    const anchor = parseJson<{ thg_gallery?: { slug?: string; host?: string } }>(collections[0]?.extra)?.thg_gallery ?? {}

    const [bannerItemId, homepageItemId] = await Promise.all([
      this.resolveItemReference(chrome.banner_item),
      this.resolveItemReference(chrome.homepage_item),
    ])

    const output = {
      id: this.hub.id,
      backward_compatibility: this.hub.backwardCompatibility,
      kind: 'gallery',
      slug: anchor.slug ?? null,
      legacy_host: anchor.host ?? null,
      mwnf3_project_id: null,
      project_id: this.partnerProjectId,
      languages: Object.keys(names).sort(),
      names,
      banner_item_id: bannerItemId,
      homepage_item_id: homepageItemId,
      image_path: chrome.image ?? null,
      banner_image_path: chrome.banner_image ?? null,
      homepage_image_path: chrome.homepage_image ?? null,
      has_timeline: false,
      has_country_timeline: false,
      featured: false,
      hidden: false,
      live_date: chrome.live_date ?? null,
      sibling_galleries: [],
    }

    await this.writeJson('gallery.json', output)
    this.logger.success(`gallery.json (${output.slug ?? output.backward_compatibility}, banner object ${bannerItemId ?? 'none'})`)
    return { file: 'gallery.json', count: 1 }
  }

  /** A `thg_gallery` item reference (`mwnf#obj#GALLERIES;sw;Mus01;42`), resolved to the item's id. */
  private async resolveItemReference(reference: string | undefined): Promise<string | null> {
    const backwardCompatibility = bannerRefToBackwardCompatibility(reference)
    if (!backwardCompatibility) {
      if (reference) this.logger.warning(`Unparseable gallery item reference, dropped: ${reference}`)
      return null
    }
    const rows = await this.db.query<{ id: string }>(`SELECT id FROM items WHERE backward_compatibility = ?`, [
      backwardCompatibility,
    ])
    if (!rows[0]) {
      this.logger.warning(`Gallery item reference does not resolve: ${backwardCompatibility}`)
      return null
    }
    return rows[0].id
  }
}
