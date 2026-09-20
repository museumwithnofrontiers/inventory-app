import type { Database } from './database.js'
import type { Logger } from './logger.js'

export interface ExportContext {
  db: Database
  outputDir: string
  projectIds: string[]
  contextIds: string[]
  projectKeys: string[]
  baseUrl: string
  logger: Logger
}

export interface ExportResult {
  file: string
  count: number
}

export interface TranslationMap {
  [langCode: string]: Record<string, string | null>
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
 * `project_uuids` from the legacy projects the partner belongs to; `item_count`
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
  /** Project UUIDs the partner belongs to. */
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
