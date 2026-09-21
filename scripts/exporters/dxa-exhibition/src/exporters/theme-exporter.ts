import type { ExportResult, Theme } from '../core/types.js'
import { BaseExporter } from './base-exporter.js'

interface ThemeItemRow {
  collection_id: string
  item_id: string
  display_order: number | null
  extra: unknown
}

interface PictureRow {
  id: string
  parent_id: string | null
  backward_compatibility: string | null
}

interface PictureImageRow {
  item_id: string
  path: string
  display_order: number
}

interface ThemeTranslationRow {
  collection_id: string
  language_id: string
  title: string | null
  description: string | null
  quote: string | null
}

interface RelatedLinkRow {
  source_id: string
  target_id: string
  backward_compatibility: string | null
}

interface RelatedLinkTranslationRow {
  item_item_link_id: string
  language_id: string
  description: string | null
  reciprocal_description: string | null
}

/** The per-picture curated texts the importer stores on the pivot row. */
interface ThemeItemExtra {
  contextual_descriptions?: Record<string, string>
  image_captions?: Record<string, string>
}

/**
 * `themes.json` — the curated tree, and the heart of the product.
 *
 * Four things about the shape are decided by the legacy data rather than by
 * taste, and each has a wrong-looking alternative that still produces plausible
 * output:
 *
 * 1. **Nesting is `parent_id`, not `collections.type`.** Every node is
 *    `type = 'theme'`; a top-level theme's parent is the exhibition collection
 *    and a sub-theme's parent is a theme. `type = 'subtheme'` exists in the
 *    enum but belongs to Sharing History, not to THG.
 *
 * 2. **The theme id in the keyspace is not the display order.** Top-level theme
 *    ids can skip numbers or run out of sequence entirely (a site with five
 *    top-level themes need not number them 0–4). Sorting or numbering by the
 *    keyspace id gives the wrong tree.
 *
 * 3. **A theme's members are `picture` items, not objects.** Each selection
 *    points at the picture child, and the page links "see the full record" to
 *    that picture's PARENT item sheet, so both ids ship. The parent is normally
 *    a member of the exhibition — `parent_in_package` says so per picture
 *    rather than leaving the viewer to discover a dead link.
 *
 * 4. **The curated texts are per-language and live on the pivot**
 *    (`theme_item_i18n` → `collection_item.extra`), not on the picture item.
 *    The same picture in two themes carries two different descriptions, which
 *    is why the translation file is keyed `<theme id>/<picture id>`.
 */
export class ThemeExporter extends BaseExporter {
  getName(): string {
    return 'Themes'
  }

  async export(): Promise<ExportResult> {
    this.logger.info('Exporting themes.json...')

    const themes = this.themes
    if (themes.length === 0) {
      await this.writeJson('themes.json', [])
      this.logger.warning('themes.json (0 — the exhibition has no theme collections)')
      return { file: 'themes.json', count: 0 }
    }

    const themeIds = themes.map(theme => theme.id)
    const themePh = this.placeholders(themeIds.length)
    const langCodeMap = await this.buildLangCodeMap()

    const [selections, themeTranslations] = await Promise.all([
      this.db.query<ThemeItemRow>(
        `SELECT collection_id, item_id, display_order, extra
         FROM collection_item
         WHERE collection_id IN (${themePh})
         ORDER BY collection_id, display_order`,
        themeIds
      ),
      this.db.query<ThemeTranslationRow>(
        // Row order is unspecified; sorted so the theme-id key order in each
        // language's translation file is byte-identical across two exports of
        // one database.
        `SELECT collection_id, language_id, title, description, quote
         FROM collection_translations
         WHERE collection_id IN (${themePh})
         ORDER BY collection_id, language_id`,
        themeIds
      ),
    ])

    const pictureIds = [...new Set(selections.map(row => row.item_id))]
    const { parentByPicture, imageByPicture, backwardCompatibilityByPicture } =
      await this.loadPictures(pictureIds)
    const relatedByPicture = await this.loadRelated(pictureIds, langCodeMap)

    const memberIds = new Set(this.memberItemIds)
    let orphanParents = 0

    const selectionsByTheme = new Map<string, ThemeItemRow[]>()
    for (const row of selections) {
      const bucket = selectionsByTheme.get(row.collection_id)
      if (bucket) bucket.push(row)
      else selectionsByTheme.set(row.collection_id, [row])
    }

    // Per-language curated texts, keyed by theme id and `<theme>/<picture>`.
    const byLang = new Map<string, Record<string, unknown>>()
    const bucketFor = (code: string): Record<string, unknown> => {
      const existing = byLang.get(code)
      if (existing) return existing
      const created: Record<string, unknown> = {}
      byLang.set(code, created)
      return created
    }

    for (const row of themeTranslations) {
      const code = langCodeMap.get(row.language_id)
      if (!code) continue
      bucketFor(code)[row.collection_id] = this.stripNulls({
        title: row.title,
        // `collection_translations.description` on a theme is the legacy
        // `presentation` body; `quote` is the pull quote above it.
        presentation: row.description,
        quote: row.quote,
      })
    }

    const buildPictures = (themeId: string): unknown[] =>
      (selectionsByTheme.get(themeId) ?? []).map((row, index) => {
        const extra = parseJson<ThemeItemExtra>(row.extra)
        for (const [languageId, text] of Object.entries(extra?.contextual_descriptions ?? {})) {
          const code = langCodeMap.get(languageId)
          if (code) {
            const key = `${themeId}/${row.item_id}`
            const entry = (bucketFor(code)[key] ?? {}) as Record<string, unknown>
            entry['contextual_description'] = text
            bucketFor(code)[key] = entry
          }
        }
        for (const [languageId, text] of Object.entries(extra?.image_captions ?? {})) {
          const code = langCodeMap.get(languageId)
          if (code) {
            const key = `${themeId}/${row.item_id}`
            const entry = (bucketFor(code)[key] ?? {}) as Record<string, unknown>
            entry['image_caption'] = text
            bucketFor(code)[key] = entry
          }
        }

        const parentId = parentByPicture.get(row.item_id) ?? null
        const parentInPackage = parentId !== null && memberIds.has(parentId)
        if (parentId !== null && !parentInPackage) orphanParents += 1

        const imagePath = imageByPicture.get(row.item_id)

        return {
          picture_item_id: row.item_id,
          backward_compatibility: backwardCompatibilityByPicture.get(row.item_id) ?? null,
          parent_item_id: parentId,
          // The theme page links each picture to its parent's full record. That
          // parent is normally a member, but saying so per picture beats making
          // the viewer find out by rendering a link to nothing.
          parent_in_package: parentInPackage,
          display_order: row.display_order ?? index + 1,
          image_url: imagePath ? this.imageUrl(imagePath) : null,
          related: relatedByPicture.get(row.item_id) ?? [],
        }
      })

    const byParent = new Map<string, Theme[]>()
    for (const theme of themes) {
      if (!theme.parentId) continue
      const bucket = byParent.get(theme.parentId)
      if (bucket) bucket.push(theme)
      else byParent.set(theme.parentId, [theme])
    }

    const node = (theme: Theme, includeChildren: boolean): Record<string, unknown> => ({
      id: theme.id,
      backward_compatibility: theme.backwardCompatibility,
      internal_name: theme.internalName,
      display_order: theme.displayOrder,
      cover_picture_item_id: theme.coverPictureItemId,
      pictures: buildPictures(theme.id),
      ...(includeChildren
        ? {
            sub_themes: (byParent.get(theme.id) ?? [])
              .sort((a, b) => a.displayOrder - b.displayOrder)
              .map(child => node(child, false)),
          }
        : {}),
    })

    const topLevel = (byParent.get(this.exhibition.id) ?? []).sort(
      (a, b) => a.displayOrder - b.displayOrder
    )
    const output = topLevel.map(theme => node(theme, true))

    await this.writeJson('themes.json', output)
    await this.writeTranslationFiles('themes', byLang)

    const subThemeCount = themes.length - topLevel.length
    if (orphanParents > 0) {
      // Not fatal — the picture still renders, only its "full record" link is
      // unresolvable — but it means the membership union and the curated
      // selections disagree, which is worth seeing.
      this.logger.warning(
        `themes.json: ${orphanParents} selected picture(s) have a parent item that is ` +
          `not a member of the exhibition; their record links cannot be resolved locally`
      )
    }
    this.logger.success(
      `themes.json (${topLevel.length} themes + ${subThemeCount} sub-themes, ` +
        `${selections.length} pictures, ${[...byLang.keys()].sort().join('/')})`
    )

    return { file: 'themes.json', count: themes.length }
  }

  /**
   * The selected pictures themselves: their parent item, their single image and
   * their legacy key. A `picture` item carries exactly one image in this model,
   * so the lowest display_order wins rather than an array being shipped.
   */
  private async loadPictures(pictureIds: string[]): Promise<{
    parentByPicture: Map<string, string>
    imageByPicture: Map<string, string>
    backwardCompatibilityByPicture: Map<string, string>
  }> {
    const parentByPicture = new Map<string, string>()
    const imageByPicture = new Map<string, string>()
    const backwardCompatibilityByPicture = new Map<string, string>()

    if (pictureIds.length === 0) {
      return { parentByPicture, imageByPicture, backwardCompatibilityByPicture }
    }

    const picturePh = this.placeholders(pictureIds.length)
    const [pictures, images] = await Promise.all([
      this.db.query<PictureRow>(
        `SELECT id, parent_id, backward_compatibility
         FROM items WHERE id IN (${picturePh})`,
        pictureIds
      ),
      this.db.query<PictureImageRow>(
        `SELECT item_id, path, display_order
         FROM item_images WHERE item_id IN (${picturePh})
         ORDER BY item_id, display_order`,
        pictureIds
      ),
    ])

    for (const picture of pictures) {
      if (picture.parent_id) parentByPicture.set(picture.id, picture.parent_id)
      if (picture.backward_compatibility) {
        backwardCompatibilityByPicture.set(picture.id, picture.backward_compatibility)
      }
    }
    for (const image of images) {
      if (!imageByPicture.has(image.item_id)) imageByPicture.set(image.item_id, image.path)
    }

    return { parentByPicture, imageByPicture, backwardCompatibilityByPicture }
  }

  /**
   * `theme_item_related` → `item_item_links`, the per-picture "related
   * pictures" strip with its directional per-language description.
   *
   * The keyspace is `mwnf3_thematic_gallery:theme_item_related:<gallery>:<theme>:<from>:<to>`,
   * and gap E5 is that some rows point at a picture curated under a DIFFERENT
   * theme. Those are kept: the link is real, the target picture is real, and
   * dropping them was the bug. `theme_backward_compatibility` carries the theme
   * segment of the key so a viewer can tell an in-theme neighbour from a
   * cross-theme jump without re-parsing.
   */
  private async loadRelated(
    pictureIds: string[],
    langCodeMap: Map<string, string>
  ): Promise<Map<string, unknown[]>> {
    const byPicture = new Map<string, unknown[]>()
    if (pictureIds.length === 0) return byPicture

    const picturePh = this.placeholders(pictureIds.length)
    const links = await this.db.query<RelatedLinkRow & { id: string }>(
      `SELECT id, source_id, target_id, backward_compatibility
       FROM item_item_links
       WHERE source_id IN (${picturePh})
         AND backward_compatibility LIKE 'mwnf3\\_thematic\\_gallery:theme\\_item\\_related:%'
       ORDER BY backward_compatibility`,
      pictureIds
    )

    if (links.length === 0) return byPicture

    const linkIds = links.map(link => link.id)
    const translations = await this.db.query<RelatedLinkTranslationRow>(
      // Row order is unspecified; sorted so each link's `descriptions` /
      // `reciprocal_descriptions` key order is byte-identical across two
      // exports of one database.
      `SELECT item_item_link_id, language_id, description, reciprocal_description
       FROM item_item_link_translations
       WHERE item_item_link_id IN (${this.placeholders(linkIds.length)})
       ORDER BY item_item_link_id, language_id`,
      linkIds
    )

    const descriptionsByLink = new Map<string, Record<string, string>>()
    const reciprocalsByLink = new Map<string, Record<string, string>>()
    for (const row of translations) {
      const code = langCodeMap.get(row.language_id)
      if (!code) continue
      if (row.description) {
        const bucket = descriptionsByLink.get(row.item_item_link_id) ?? {}
        bucket[code] = row.description
        descriptionsByLink.set(row.item_item_link_id, bucket)
      }
      if (row.reciprocal_description) {
        const bucket = reciprocalsByLink.get(row.item_item_link_id) ?? {}
        bucket[code] = row.reciprocal_description
        reciprocalsByLink.set(row.item_item_link_id, bucket)
      }
    }

    for (const link of links) {
      const entry = this.stripNulls({
        picture_item_id: link.target_id,
        theme_backward_compatibility: relatedLinkThemeKey(link.backward_compatibility),
        descriptions: descriptionsByLink.get(link.id) ?? {},
        // The text shown when the pair is walked the other way. Legacy stores
        // one row per direction, so this is usually empty; it ships when
        // present rather than being silently discarded.
        reciprocal_descriptions: reciprocalsByLink.get(link.id) ?? {},
      })
      const bucket = byPicture.get(link.source_id)
      if (bucket) bucket.push(entry)
      else byPicture.set(link.source_id, [entry])
    }

    return byPicture
  }
}

/**
 * The theme a `theme_item_related` row was curated under, as a theme
 * backward_compatibility key. `…:theme_item_related:47:10:1:2` is gallery 47,
 * theme 10 — so the theme key is `mwnf3_thematic_gallery:theme:47:10`. Returns
 * null for any key that does not have that shape rather than guessing.
 */
export function relatedLinkThemeKey(backwardCompatibility: string | null): string | null {
  if (!backwardCompatibility) return null
  const segments = backwardCompatibility.split(':')
  // [mwnf3_thematic_gallery, theme_item_related, gallery, theme, from, to]
  if (segments.length < 4 || segments[1] !== 'theme_item_related') return null
  const gallery = segments[2]
  const theme = segments[3]
  if (!gallery || !theme) return null
  return `mwnf3_thematic_gallery:theme:${gallery}:${theme}`
}

function parseJson<T>(raw: unknown): T | null {
  if (raw == null) return null
  if (typeof raw === 'object') return raw as T
  try {
    return JSON.parse(raw as string) as T
  } catch {
    return null
  }
}
