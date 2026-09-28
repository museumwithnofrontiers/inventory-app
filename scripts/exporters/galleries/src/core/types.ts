import type { Database } from './database.js'
import type { Logger } from './logger.js'

/**
 * The hub's own collection: legacy gallery 45, which dxa-api served the hub
 * as. The package reads its name, languages and i18n groups from it and
 * nothing else — its membership is not the hub's content.
 */
export interface Hub {
  /** Collection UUID. */
  id: string
  backwardCompatibility: string
}

export interface ExportContext {
  db: Database
  outputDir: string
  hub: Hub
  /** The site slug — `manifest.site.key`'s source. */
  siteKey: string
  /** UUID of the project whose museums make up the partner directory. */
  partnerProjectId: string
  baseUrl: string
  logger: Logger
}

export interface ExportResult {
  file: string
  count: number
}

/**
 * The per-language `thg_gallery` fields the importer copies onto every
 * `collection_translations.extra.thg_gallery` row of a gallery. They describe
 * the gallery, not the language, so the first row read wins.
 */
export interface GalleryChrome {
  image?: string
  /** Legacy 'A'/'H' flags — see `isFeatured` / `isHidden` for the mapping. */
  featured?: string
  status?: string
  live_date?: string
}

/** The gallery anchor stored on `collections.extra.thg_gallery`. */
export interface GalleryAnchor {
  slug?: string
  host?: string
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
 * museumwithnofrontiers/inventory-app#1699). A dataset with nothing for a field
 * reports its empty value (`null` / `0` / `false` / `[]`), never omits the key.
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
  /** The owning partner's id, for a member of a curated group; `null` otherwise. */
  parent_id: string | null
  /** Project UUIDs the partner belongs to. */
  project_uuids: string[]
  /** Exported items this partner holds — always 0 here: the hub exports no items. */
  item_count: number
  /** Legacy `portal_display === 'y'`. */
  featured: boolean
  /** Languages the partner has a translation in (codes, sorted). */
  languages: string[]
  /** Contact persons in legacy order (person 1 first); `[]` for none. */
  contact_persons: PartnerContactPerson[]
  additional_urls: PartnerUrl[]
  images: PartnerImage[]
  logos: PartnerLogo[]
}
