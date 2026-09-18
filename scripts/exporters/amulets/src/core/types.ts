import type { Database } from './database.js'
import type { Logger } from './logger.js'

/**
 * The gallery anchor stored on `collections.extra.thg_gallery` by the importer's
 * ThgGalleryImporter — the attributes that identify the gallery itself rather
 * than one of its language rows.
 */
export interface GalleryAnchor {
  mwnf3_project_id?: string
  slug?: string
  host?: string
  i18n_group_id?: number
  i18n_common_group_id?: number
}

/**
 * The per-language `thg_gallery` fields the importer copies onto every
 * `collection_translations.extra.thg_gallery` row. They describe the gallery,
 * not the language, so the exporter reads them once from any language row.
 */
export interface GalleryChrome {
  image?: string
  banner_image?: string
  banner_item?: string
  homepage_image?: string
  homepage_item?: string
  has_timeline?: unknown
  has_country_timeline?: unknown
  /** Legacy 'A'/'H' flags — see Gallery.isFeatured / isHidden for the mapping. */
  featured?: string
  status?: string
  live_date?: string
}

/** The resolved gallery this exporter is pinned to. */
export interface Gallery {
  /** Collection UUID. */
  id: string
  backwardCompatibility: string
  /** Legacy slug from `thg_gallery.link` (e.g. `amulets_and_talismans`). */
  slug: string | null
  /** Canonical public host from `thg_gallery_url` (e.g. `https://amulets.museumwnf.org`). */
  host: string | null
  /** Legacy mwnf3 project the gallery was created under (e.g. `AMU`). */
  mwnf3ProjectId: string | null
  /**
   * Inventory UUID of that same project, or null when the gallery has no
   * mwnf3 project or the project was never imported. `partners.project_id` is
   * compared against this to reproduce legacy's MWNF-384 partner branch — see
   * PartnerExporter.
   */
  projectId: string | null
  anchor: GalleryAnchor
  chrome: GalleryChrome
}

export interface ExportContext {
  db: Database
  outputDir: string
  gallery: Gallery
  /** Item UUIDs of the gallery's membership union (native project ∪ link tables). */
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
 * museumwithnofrontiers/inventory-app#1699). `level` / `parent_id` come from the curated
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
