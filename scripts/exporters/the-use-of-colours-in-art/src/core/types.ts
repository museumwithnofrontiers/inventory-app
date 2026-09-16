import type { Database } from './database.js'
import type { Logger } from './logger.js'

/**
 * The site anchor stored on `collections.extra.thg_gallery` by the importer's
 * ThgGalleryImporter — the attributes that identify the site itself rather than
 * one of its language rows.
 *
 * The key is `thg_gallery` for exhibitions too: legacy keeps galleries and
 * exhibitions in the same `thg_gallery` table and tells them apart by
 * `thg_project_id` ('EXH' for the six exhibitions), so the importer writes one
 * shape for both.
 */
export interface ExhibitionAnchor {
  mwnf3_project_id?: string
  slug?: string
  host?: string
  i18n_group_id?: number
  i18n_common_group_id?: number
}

/**
 * The per-language `thg_gallery` fields the importer copies onto every
 * `collection_translations.extra.thg_gallery` row. They describe the site, not
 * the language, so the exporter reads them once from any language row.
 */
export interface ExhibitionChrome {
  image?: string
  banner_image?: string
  banner_item?: string
  homepage_image?: string
  homepage_item?: string
  has_timeline?: unknown
  has_country_timeline?: unknown
  /** Legacy 'A'/'H' flags — see Exhibition.isFeatured / isHidden for the mapping. */
  featured?: string
  status?: string
  live_date?: string
}

/**
 * `collection_translations.extra.exhibition_i18n` — the curated per-language
 * chrome an exhibition has and a gallery does not.
 *
 * `subtitle` / `heading` / `about` are the three legacy `exhibition_i18n`
 * columns the sheet renders separately. The importer originally joined them
 * into the single `collection_translations.description` with blank lines
 * between, which is lossy: `about` itself contains blank lines, so the join
 * cannot be undone. They are preserved individually here as of
 * metanull/inventory-app#1546 — see ExhibitionExporter for what the exporter
 * does on a database imported before that.
 */
export interface ExhibitionI18n {
  /** 'Y' / 'N' — whether this language is public. Colours: en 'Y', de 'N'. */
  enabled?: string
  subtitle?: string
  heading?: string
  about?: string
  popup_logo?: string
  popup_logo_show?: string
  exh_img_caption?: string
}

/** The resolved exhibition this exporter is pinned to. */
export interface Exhibition {
  /** Collection UUID. */
  id: string
  backwardCompatibility: string
  /** Legacy slug from `thg_gallery.link` (e.g. `the_use_of_colours_in_art`). */
  slug: string | null
  /** Canonical public host from `thg_gallery_url`. */
  host: string | null
  /** Legacy mwnf3 project the exhibition was created under (e.g. `EXHCOLOUR`). */
  mwnf3ProjectId: string | null
  /**
   * Inventory UUID of that same project, or null when the exhibition has no
   * mwnf3 project or the project was not imported. `partners.project_id` is
   * compared against this to reproduce legacy's MWNF-384 partner branch — see
   * PartnerExporter.
   */
  projectId: string | null
  anchor: ExhibitionAnchor
  chrome: ExhibitionChrome
  /** Language id ('eng', 'deu') → that language's `exhibition_i18n` block. */
  i18n: Map<string, ExhibitionI18n>
}

/**
 * One node of the curated theme tree. Themes and sub-themes are both
 * `collections.type = 'theme'`; the nesting is `parent_id`, not the type — a
 * sub-theme's parent is a theme, a top-level theme's parent is the exhibition
 * collection itself.
 */
export interface Theme {
  id: string
  backwardCompatibility: string | null
  internalName: string
  displayOrder: number
  parentId: string | null
  /** Resolved from `extra.thg_theme.cover_picture.item_id`. */
  coverPictureItemId: string | null
}

export interface ExportContext {
  db: Database
  outputDir: string
  exhibition: Exhibition
  /** The curated theme tree, flat; nesting is resolved from `parentId`. */
  themes: Theme[]
  /** Item UUIDs of the exhibition's membership union (native project ∪ link tables). */
  memberItemIds: string[]
  /** Item UUID → legacy project key of the item's OWN project (e.g. `EPM`, `ISL`, `awe`). */
  itemProjectKeys: Map<string, string>
  /** Item UUID → context UUID of the item's OWN project, for translation selection. */
  itemOwnContextIds: Map<string, string>
  baseUrl: string
  logger: Logger
}

export interface ExportResult {
  file: string
  count: number
}

/** A partner's contact person, as recorded on the museum/institution row. */
export interface PartnerContactPerson {
  name?: string
  title?: string
  phone?: string
  fax?: string
  email?: string
}

/** One extra link on a partner, beyond its main `contact_website`. */
export interface PartnerUrl {
  url: string
  title?: string
}

export interface PartnerImage {
  url: string
  alt_text: string | null
  display_order: number
  photographer: string | null
  copyright: string | null
}

export interface PartnerLogo {
  url: string
  logo_type: string
  alt_text: string | null
  display_order: number
}

/**
 * `partners.json` row — one shape across every dataset (decision D4,
 * metanull/inventory-app#1699). `level` / `parent_id` come from the curated
 * legacy partner hierarchy (`collection_partner`) where a dataset has one;
 * `project_ids` from the legacy projects the partner belongs to; `item_count`
 * / `featured` are always computed. A dataset with nothing for a field
 * reports its empty value (`null` / `0` / `false` / `[]`), never omits the key
 * — the derivation in viewer-core reads one shape regardless of which family
 * exported the package.
 */
export interface Partner {
  id: string
  type: string
  backward_compatibility: string | null
  country_id: string | null
  latitude: number | null
  longitude: number | null
  map_zoom: number | null
  monument_item_id: string | null
  /** Legacy tier (`partner` / `associated_partner` / `minor_contributor`); `null` where uncurated. */
  level: string | null
  /** The owning partner's id, for a member of a curated group; `null` for an owner or an uncurated partner. */
  parent_id: string | null
  /** Legacy project keys (e.g. `ISL`, `DCA`) the partner belongs to. */
  project_ids: string[]
  /**
   * Project UUIDs the partner belongs to — same membership as `project_ids`,
   * shipped under a new field name during the transition (epic #1727
   * decision 4) so old and new consumers can never silently misread the
   * array. `project_ids` (legacy key strings) stays untouched until the
   * cleanup wave.
   */
  project_uuids: string[]
  /** Exported items this partner holds. */
  item_count: number
  /** Legacy `portal_display === 'y'` — drives the home page featured strip. */
  featured: boolean
  contact_person_1: PartnerContactPerson | null
  contact_person_2: PartnerContactPerson | null
  additional_urls: PartnerUrl[]
  images: PartnerImage[]
  logos: PartnerLogo[]
}
