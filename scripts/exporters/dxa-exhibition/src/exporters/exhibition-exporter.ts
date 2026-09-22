import type { ExportResult } from '../core/types.js'
import { bannerRefToBackwardCompatibility } from '../core/banner-reference.js'
import { BaseExporter } from './base-exporter.js'

interface TranslationRow {
  collection_id: string
  language_id: string
  title: string | null
  description: string | null
}

export interface LogoRow {
  id: string
  path: string
  original_name: string | null
  alt_text: string | null
  display_order: number
  extra: unknown
}

/**
 * The passenger data the importer files on a sponsor logo's `collection_images`
 * row (museumwithnofrontiers/inventory-app#1592). Language maps are keyed by the inventory's
 * 3-char language id (`eng`), NOT by the 2-char code this package emits.
 */
interface LogoExtra {
  link?: string | null
  category_id?: number | null
  category_name?: string | null
  visible?: boolean | null
  labels?: Record<string, string> | null
  alts?: Record<string, string> | null
  further_readings?: Record<string, string> | null
}

/** One entry of `exhibition.json.logos[]`. */
export interface ExhibitionLogo {
  id: string
  image_url: string
  legacy_path: string | null
  /** The column's single alt string — the fallback when `alt_texts` is empty. */
  alt_text: string | null
  /** `exhibition_logo.link`: the logo is a hyperlink to the sponsor's site. */
  url: string | null
  /** The rendered sponsor caption, language-keyed by 2-char code. */
  labels: Record<string, string>
  alt_texts: Record<string, string>
  further_readings: Record<string, string>
  /** Banner slot, e.g. "Footer 2" (`exhibition_logo_category`). */
  category: string | null
  category_id: number | null
  visible: boolean
  display_order: number
}

interface PartnerStripRow {
  partner_id: string
  level: string | null
  visible: number | boolean | null
}

interface SiblingRow {
  id: string
  backward_compatibility: string
  type: string
  extra: unknown
}

interface SiblingChromeRow {
  collection_id: string
  extra: unknown
}

/**
 * `exhibition.json` — the site anchor, richer than a gallery's.
 *
 * Legacy kept this in four places at once: the per-deployment scope-pinning
 * environment variable, the `thg_gallery` row, `thg_gallery_url`, and the
 * curated per-language `exhibition_i18n` row. A data package is a pre-scoped
 * API instance, so all of it collapses into one file.
 *
 * Two fields deserve their own note because they are easy to conflate:
 *
 * - **`languages`** is the site's UI language roster (`thg_gallery_lang`), and
 *   **`languages_enabled`** is the subset legacy actually publishes
 *   (`exhibition_i18n.enabled = 'Y'`). The two can differ — a roster language
 *   the exhibition never enabled proves the difference is load bearing rather
 *   than cosmetic: the live instance for it answers `exhibitionTitle: null`,
 *   an empty item count and no events, i.e. it is a shell. Per decision Q2 the
 *   websites ship as per-language builds, so this is the field that decides
 *   which builds exist. The package still carries the curated texts for a
 *   roster language even when it is not enabled, so that build becomes
 *   possible the day someone flips `enabled`.
 *
 * - **`featured`** and `hidden` are two independent legacy flags sharing one
 *   enum — see isFeatured/isHidden below.
 *
 * An instance's `languagesEnabled` override (see `core/instance.ts`) is
 * authoritative over `exhibition_i18n.enabled` when set: legacy may enable no
 * language for an exhibition whose content is under development, and the
 * instance can then say what the site offers instead of shipping an empty,
 * buildless roster.
 */
export class ExhibitionExporter extends BaseExporter {
  getName(): string {
    return 'Exhibition'
  }

  async export(): Promise<ExportResult> {
    this.logger.info('Exporting exhibition.json...')

    const langCodeMap = await this.buildLangCodeMap()
    const chrome = this.exhibition.chrome

    const languagesOverride = this.context.languagesEnabled
    if (languagesOverride) {
      const knownCodes = new Set(langCodeMap.values())
      for (const code of languagesOverride) {
        if (!knownCodes.has(code)) {
          throw new Error(
            `Instance override 'languages_enabled' names an unknown language code '${code}'`
          )
        }
      }
    }

    const translations = await this.db.query<TranslationRow>(
      `SELECT collection_id, language_id, title, description
       FROM collection_translations
       WHERE collection_id = ?
       ORDER BY language_id`,
      [this.exhibition.id]
    )

    const titles: Record<string, string> = {}
    const subtitles: Record<string, string> = {}
    const headlines: Record<string, string> = {}
    const abouts: Record<string, string> = {}
    const languagesEnabled: string[] = []
    let missingSplitFields = 0

    for (const row of translations) {
      const code = langCodeMap.get(row.language_id)
      if (!code) continue
      if (row.title) titles[code] = row.title

      const i18n = this.exhibition.i18n.get(row.language_id)
      if (!languagesOverride && i18n?.enabled === 'Y') languagesEnabled.push(code)

      // The three curated texts, as separate fields when the import preserved
      // them and as a single blob when it did not — see the fallback note below.
      if (i18n?.subtitle || i18n?.heading || i18n?.about) {
        if (i18n.subtitle) subtitles[code] = i18n.subtitle
        if (i18n.heading) headlines[code] = i18n.heading
        if (i18n.about) abouts[code] = i18n.about
      } else if (row.description) {
        // Fallback for a database imported before museumwithnofrontiers/inventory-app#1546:
        // ThgGalleryTranslationImporter joined subtitle + heading + about into
        // `description` with blank lines between them, and that join is not
        // reversible — `about` contains blank lines of its own. Rather than
        // guess a split, the whole blob ships as `abouts` (the field whose
        // legacy counterpart is a free-text body) and the run logs how many
        // languages are degraded, so a package built on a stale database is
        // visibly rather than silently incomplete.
        abouts[code] = row.description
        missingSplitFields += 1
      }
    }

    if (missingSplitFields > 0) {
      this.logger.warning(
        `exhibition.json: ${missingSplitFields} language(s) carry no split ` +
          `subtitle/heading/about — this database predates the exhibition_i18n ` +
          `text fix. Run the importer's 'exhibition-i18n-text-backfill' step ` +
          `(or a fresh import) and re-export to populate them.`
      )
    }

    const [bannerItemId, homepageItemId] = await Promise.all([
      this.resolveItemReference(chrome.banner_item),
      this.resolveItemReference(chrome.homepage_item),
    ])

    const [logos, partners] = await Promise.all([this.exportLogos(), this.exportPartnerStrip()])

    // popup_logo / popup_logo_show are per-language HTML blocks, so they follow
    // the same per-language shape as the texts above rather than a single flag.
    const popupLogos: Record<string, string> = {}
    const popupLogoShow: Record<string, boolean> = {}
    const bannerCaptions: Record<string, string> = {}
    for (const [languageId, i18n] of this.exhibition.i18n) {
      const code = langCodeMap.get(languageId)
      if (!code) continue
      if (i18n.popup_logo) popupLogos[code] = i18n.popup_logo
      popupLogoShow[code] = i18n.popup_logo_show === 'Y'
      if (i18n.exh_img_caption) bannerCaptions[code] = i18n.exh_img_caption
    }

    const output = {
      id: this.exhibition.id,
      backward_compatibility: this.exhibition.backwardCompatibility,
      kind: 'exhibition',
      // The legacy slug is load-bearing identity, kept verbatim (underscores and
      // all) even though the package and folder name is its kebab-cased form.
      slug: this.exhibition.slug,
      legacy_host: this.exhibition.host,
      mwnf3_project_id: this.exhibition.mwnf3ProjectId,
      project_id: this.exhibition.projectId,
      languages: Object.keys(titles).sort(),
      languages_enabled: languagesOverride ? [...languagesOverride].sort() : languagesEnabled.sort(),
      titles,
      subtitles,
      headlines,
      abouts,
      popup_logos: popupLogos,
      popup_logo_show: popupLogoShow,
      banner_captions: bannerCaptions,
      banner_item_id: bannerItemId,
      homepage_item_id: homepageItemId,
      // Site chrome images live on the legacy media server and were never
      // imported, so the package carries the legacy path only — the viewer
      // supplies the host, exactly as the legacy client did through
      // VUE_APP_IMAGES_URL. Sponsor logos are the exception: those WERE
      // imported, so `logos[].image_url` below is a resolved absolute URL.
      image_path: chrome.image ?? null,
      banner_image_path: chrome.banner_image ?? null,
      homepage_image_path: chrome.homepage_image ?? null,
      has_timeline: bitToBoolean(chrome.has_timeline),
      has_country_timeline: bitToBoolean(chrome.has_country_timeline),
      featured: isFeatured(chrome.featured),
      hidden: isHidden(chrome.status),
      live_date: chrome.live_date ?? null,
      logos,
      partners,
      hidden_partner_ids: await this.resolveHiddenPartnerIds(),
      sibling_sites: await this.exportSiblings(langCodeMap),
    }

    await this.writeJson('exhibition.json', output)
    this.logger.success(
      `exhibition.json (${this.exhibition.slug ?? this.exhibition.backwardCompatibility}, ` +
        `${output.languages.length} languages / ${output.languages_enabled.length} enabled, ` +
        `${logos.length} logos, ${partners.length} strip partners, ` +
        `${output.sibling_sites.length} siblings)`
    )

    return { file: 'exhibition.json', count: 1 }
  }

  /**
   * `exhibition_logo` → `collection_images`, the sponsor logos on the bottom
   * banner: the image, its hyperlink, its per-language caption and its banner
   * slot.
   *
   * Two mechanisms carry that, both introduced by museumwithnofrontiers/inventory-app#1592
   * and both already used elsewhere in the schema:
   *
   * - **Typing via tags.** A collection can own images that are not sponsor
   *   logos, so the query is scoped to the `image-type` / `logo` tag through
   *   `collection_image_tag`. The join is on the tag's IDENTITY
   *   (`internal_name` + `category`) rather than on its
   *   `backward_compatibility`, because that string carries a language segment
   *   (`mwnf3:tags:image-type:eng:logo`) and the tag table is unique per
   *   `(internal_name, category, language_id)` — matching on identity keeps
   *   working whichever language's tag row the importer created. `EXISTS`
   *   rather than a plain join so an image tagged through more than one such
   *   row is still exported once.
   * - **Passenger data via `extra`.** Everything legacy keeps beside the image
   *   (`link`, `category_id`, `visible`, and the per-language `label`, `alt`
   *   and `further_reading` of `exhibition_logo_i18n`) rides in the JSON
   *   column, parsed by buildLogoEntry below.
   *
   * Hidden logos (`visible: false`) ship too — the inventory is the system of
   * record and filtering is the viewer's job.
   */
  private async exportLogos(): Promise<ExhibitionLogo[]> {
    const langCodeMap = await this.buildLangCodeMap()

    const [rows, totals] = await Promise.all([
      this.db.query<LogoRow>(
        `SELECT ci.id, ci.path, ci.original_name, ci.alt_text, ci.display_order, ci.extra
         FROM collection_images ci
         WHERE ci.collection_id = ?
           AND EXISTS (
             SELECT 1
             FROM collection_image_tag cit
             JOIN tags t ON t.id = cit.tag_id
             WHERE cit.collection_image_id = ci.id
               AND t.internal_name = 'logo'
               AND t.category = 'image-type'
           )
         ORDER BY ci.display_order, ci.id`,
        [this.exhibition.id]
      ),
      this.db.query<{ total: number }>(
        `SELECT COUNT(*) AS total FROM collection_images WHERE collection_id = ?`,
        [this.exhibition.id]
      ),
    ])

    // Images but no logo-tagged image is the signature of a database the logo
    // import (or its phase-11 backfill) has not run against yet. Say so rather
    // than shipping an empty strip that looks like a legitimately logo-less
    // exhibition. Only the all-or-nothing case is detectable: an untagged image
    // is not necessarily a logo, so a count mismatch would fire on any
    // collection that legitimately owns another kind of image.
    if (rows.length === 0 && (totals[0]?.total ?? 0) > 0) {
      this.logger.warning(
        `exhibition.json: this collection has ${totals[0]?.total ?? 0} image(s) but none ` +
          `carries the 'image-type: logo' tag, so no sponsor logo ships. This database ` +
          `predates museumwithnofrontiers/inventory-app#1592 — run the importer's phase-11 logo ` +
          `backfill (or a fresh import) and re-export.`
      )
    }

    return rows.map(row => buildLogoEntry(row, this.imageUrl(row.path), langCodeMap))
  }

  /**
   * `exhibition_partner` → `collection_partner`, the partner strip legacy
   * renders on every page. `level` is the legacy category — an exhibition's
   * strip can include an `other_contributor` (an institution) alongside its
   * museum partners, not just museums.
   */
  private async exportPartnerStrip(): Promise<unknown[]> {
    const rows = await this.db.query<PartnerStripRow>(
      `SELECT partner_id, level, visible
       FROM collection_partner
       WHERE collection_id = ?
       ORDER BY level, partner_id`,
      [this.exhibition.id]
    )

    return rows.map((row, index) => ({
      partner_id: row.partner_id,
      category: row.level,
      visible: row.visible === 1 || row.visible === true,
      display_order: index + 1,
    }))
  }

  /**
   * Gap E6 — `exhibition_hidden_mwnf3_museums`, imported into
   * `extra.thg_gallery.hidden_partners`. Such a partner is excluded from every
   * list and profile page while its items still render, so the package flags
   * them rather than dropping them. Empty on most exhibitions, and the field
   * ships anyway so a viewer written against this package handles the case
   * without a shape change.
   */
  private async resolveHiddenPartnerIds(): Promise<string[]> {
    const raw = (this.exhibition.anchor as { hidden_partners?: unknown }).hidden_partners
    if (!Array.isArray(raw) || raw.length === 0) return []

    const keys = raw
      .map(entry =>
        typeof entry === 'string'
          ? entry
          : ((entry as { backward_compatibility?: string })?.backward_compatibility ?? null)
      )
      .filter((key): key is string => !!key)

    if (keys.length === 0) return []

    const rows = await this.db.query<{ id: string; backward_compatibility: string }>(
      `SELECT id, backward_compatibility FROM partners
       WHERE backward_compatibility IN (${this.placeholders(keys.length)})`,
      keys
    )

    if (rows.length !== keys.length) {
      this.logger.warning(
        `exhibition.json: ${keys.length - rows.length} hidden-partner reference(s) did not resolve`
      )
    }

    // Returned in the curated `keys` order, not the query's row order (which
    // an IN (...) list does not guarantee) — sorted so two exports of one
    // database are byte-identical.
    const idByKey = new Map(rows.map(row => [row.backward_compatibility, row.id]))
    return keys.map(key => idByKey.get(key)).filter((id): id is string => !!id)
  }

  /**
   * `thg_gallery.banner_item` / `homepage_item` name an item by its legacy
   * composite key. Unlike the cross-site links of decision Q3 this one resolves
   * locally — the referenced item is in the same inventory database — so the
   * package ships the resolved UUID and the viewer needs no lookup table.
   */
  private async resolveItemReference(reference: string | undefined): Promise<string | null> {
    const backwardCompatibility = bannerRefToBackwardCompatibility(reference)
    if (!backwardCompatibility) {
      if (reference) {
        this.logger.warning(`Unparseable item reference, dropped: ${reference}`)
      }
      return null
    }

    const rows = await this.db.query<{ id: string }>(
      `SELECT id FROM items WHERE backward_compatibility = ?`,
      [backwardCompatibility]
    )

    if (!rows[0]) {
      this.logger.warning(`Item reference does not resolve: ${backwardCompatibility}`)
      return null
    }
    return rows[0].id
  }

  /**
   * The sibling strip — the other DXA sites, galleries and exhibitions alike.
   *
   * Per decision Q3 each entry is a REFERENCE, not a link: the exporter records
   * identity plus whatever metadata the import carried (slug, legacy host, kind)
   * and never constructs a target URL. Resolution is a later, separate
   * mechanism, and a viewer degrades gracefully where a reference cannot be
   * resolved yet.
   */
  private async exportSiblings(langCodeMap: Map<string, string>): Promise<unknown[]> {
    const siblings = await this.db.query<SiblingRow>(
      `SELECT id, backward_compatibility, type, extra
       FROM collections
       WHERE type IN ('gallery', 'exhibition')
         AND id <> ?
         AND backward_compatibility LIKE 'mwnf3\\_thematic\\_gallery:thg\\_gallery:%'
       ORDER BY backward_compatibility`,
      [this.exhibition.id]
    )

    if (siblings.length === 0) return []

    const siblingIds = siblings.map(s => s.id)
    const placeholders = this.placeholders(siblingIds.length)

    const [titles, chromeRows] = await Promise.all([
      this.db.query<TranslationRow>(
        // Row order is unspecified; sorted so each sibling's `names` key order
        // is byte-identical across two exports of one database.
        `SELECT collection_id, language_id, title, description
         FROM collection_translations
         WHERE collection_id IN (${placeholders})
         ORDER BY collection_id, language_id`,
        siblingIds
      ),
      this.db.query<SiblingChromeRow>(
        // Row order is unspecified; sorted so the "first row wins" pick below is deterministic.
        `SELECT collection_id, extra
         FROM collection_translations
         WHERE collection_id IN (${placeholders}) AND extra IS NOT NULL
         ORDER BY collection_id, language_id`,
        siblingIds
      ),
    ])

    const namesById = new Map<string, Record<string, string>>()
    for (const row of titles) {
      const code = langCodeMap.get(row.language_id)
      if (!code || !row.title) continue
      if (!namesById.has(row.collection_id)) namesById.set(row.collection_id, {})
      namesById.get(row.collection_id)![code] = row.title
    }

    const chromeById = new Map<string, Record<string, unknown>>()
    for (const row of chromeRows) {
      if (chromeById.has(row.collection_id)) continue
      const parsed = parseJson<{ thg_gallery?: Record<string, unknown> }>(row.extra)
      if (parsed?.thg_gallery) chromeById.set(row.collection_id, parsed.thg_gallery)
    }

    return siblings
      .map(sibling => {
        const anchor =
          parseJson<{ thg_gallery?: Record<string, unknown> }>(sibling.extra)?.thg_gallery ?? {}
        const chrome = chromeById.get(sibling.id) ?? {}
        return {
          id: sibling.id,
          backward_compatibility: sibling.backward_compatibility,
          kind: sibling.type,
          slug: (anchor['slug'] as string | undefined) ?? null,
          // Imported metadata, NOT a resolved link (decision Q3).
          legacy_host: (anchor['host'] as string | undefined) ?? null,
          names: namesById.get(sibling.id) ?? {},
          image_path: (chrome['image'] as string | undefined) ?? null,
          featured: isFeatured(chrome['featured'] as string | undefined),
          hidden: isHidden(chrome['status'] as string | undefined),
          live_date: (chrome['live_date'] as string | undefined) ?? null,
        }
      })
      .filter(sibling => !sibling.hidden)
  }
}

/**
 * `featured` and `status` are two INDEPENDENT flags that happen to share the
 * enum('A','H'), which is why they are easy to conflate:
 *
 *   status:   A = Active, H = Hidden — visibility of the site everywhere.
 *   featured: A = highlighted in the portal's "featured galleries" strip,
 *             H = not highlighted. Default 'H'.
 *
 * Both meanings are spelled out in the column comments of
 * `.legacy-database/ddl/creation/mwnf3_thematic_gallery_thg_gallery.sql`.
 *
 * dxa-api gets `featured` WRONG: `WithTHGTemporaryTables.php` copies the
 * `hidden` projection — `CASE WHEN featured = 'A' THEN 0 ELSE 1 END` — without
 * flipping the polarity, so its JSON reports the inverse of the record on
 * every DXA site, in whichever direction that site's own record happens to
 * point. The defect never surfaces on the legacy sites (the featured endpoint
 * ignores the flag and dxa-client never reads it), so packages ship the
 * documented meaning rather than the bug — this is the one field where a
 * live-API parity check is expected to disagree.
 */
export function isFeatured(flag: string | undefined | null): boolean {
  return flag === 'A'
}

/** `status = 'A'` is the visible state; anything else hides the site. */
export function isHidden(status: string | undefined | null): boolean {
  return status !== 'A'
}

/**
 * Builds one `logos[]` entry from a `collection_images` row.
 *
 * Free function rather than a method so it is testable without a database:
 * everything interesting here is the reading of `extra`, whose contract is the
 * importer's and whose failure modes (absent column, NULL, malformed JSON,
 * missing `link`, a language the package does not carry) all have to degrade to
 * a still-renderable entry instead of throwing mid-export.
 *
 * `langCodeMap` is the 3-char language id → 2-char code map of BaseExporter:
 * `extra` speaks the inventory's `eng`, the package emits `en`.
 */
export function buildLogoEntry(
  row: LogoRow,
  imageUrl: string,
  langCodeMap: Map<string, string>
): ExhibitionLogo {
  const extra = parseJson<LogoExtra>(row.extra)

  return {
    id: row.id,
    image_url: imageUrl,
    legacy_path: row.original_name,
    alt_text: row.alt_text,
    // The importer omits an empty link; an older row may still hold ''.
    url: typeof extra?.link === 'string' && extra.link !== '' ? extra.link : null,
    labels: toLanguageCodes(extra?.labels, langCodeMap),
    alt_texts: toLanguageCodes(extra?.alts, langCodeMap),
    further_readings: toLanguageCodes(extra?.further_readings, langCodeMap),
    category: extra?.category_name ?? null,
    category_id: extra?.category_id ?? null,
    // A logo whose row carries no `visible` at all is shown: legacy's default
    // is 'Y', and only an explicit false hides one.
    visible: typeof extra?.visible === 'boolean' ? extra.visible : true,
    display_order: row.display_order,
  }
}

/**
 * Re-keys one of `extra`'s language maps from language id to the 2-char code.
 * A language the inventory has no `backward_compatibility` for is skipped —
 * emitting the raw id would put a key no other field of the package uses into
 * the same object as `en`.
 */
function toLanguageCodes(
  map: Record<string, string> | null | undefined,
  langCodeMap: Map<string, string>
): Record<string, string> {
  const out: Record<string, string> = {}
  if (!map || typeof map !== 'object') return out

  for (const [languageId, value] of Object.entries(map)) {
    const code = langCodeMap.get(languageId)
    if (!code || typeof value !== 'string' || value === '') continue
    out[code] = value
  }
  return out
}

/**
 * `has_timeline` / `has_country_timeline` are MySQL bit(1) columns. The importer
 * normalizes them to JSON booleans, but rows written before that fix still hold
 * the raw mysql2 Buffer shape (`{"type":"Buffer","data":[1]}`), so both forms
 * are accepted here rather than silently reading a truthy object as `true`.
 */
export function bitToBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') return value === '1' || value.toLowerCase() === 'true'
  if (value && typeof value === 'object') {
    const data = (value as { data?: unknown }).data
    if (Array.isArray(data)) return data[0] === 1
  }
  return false
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
