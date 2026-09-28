import type {
  ExportResult,
  Partner,
  PartnerContactPerson,
  PartnerImage,
  PartnerLogo,
  PartnerUrl,
} from '../core/types.js'
import { parseJson } from '../core/database.js'
import { BaseExporter } from './base-exporter.js'

interface PartnerRow {
  id: string
  type: string
  internal_name: string
  backward_compatibility: string | null
  country_id: string | null
  latitude: string | null
  longitude: string | null
  map_zoom: number | null
  monument_item_id: string | null
}

interface PartnerTranslationRow {
  partner_id: string
  language_id: string
  name: string
  description: string | null
  city_display: string | null
  address_notes: string | null
  contact_website: string | null
  contact_phone: string | null
  contact_fax: string | null
  contact_email_general: string | null
  extra: unknown
}

interface PartnerExtraFields {
  contact_person_1?: PartnerContactPerson
  contact_person_2?: PartnerContactPerson
  urls?: PartnerUrl[]
  /** Legacy `museums.portal_display`. */
  portal_display?: string
}

interface PartnerImageRow {
  partner_id: string
  path: string
  alt_text: string | null
  display_order: number
  extra: unknown
}

interface PartnerLogoRow {
  partner_id: string
  path: string
  logo_type: string
  alt_text: string | null
  display_order: number
}

interface PartnerLevelRow {
  partner_id: string
  level: string | null
}

interface GroupMembershipRow {
  collection_id: string
  partner_id: string
  level: string | null
}

/**
 * `partners.json` — the hub's partner directory: the museums of the partner
 * project (`GALLERIES`), which is exactly what legacy's hub lists
 * (`/api/v2/partners` served as gallery 45). Pascal chose legacy's list over
 * a union of every gallery's partners on 2026-09-28; each gallery site
 * already lists its own.
 *
 * The record shape is dxa-gallery's (decision D4). `level` and `parent_id`
 * come from the partner project's curated hierarchy (`collection_partner`),
 * read the way the gallery exporter reads a gallery's native project: a
 * partner at level `partner` is legacy's "Partner", one with no level is
 * legacy's "Affiliate".
 *
 * `item_count` is 0 for every partner: it counts the exported items a partner
 * holds, and the hub exports none. That is also what makes viewer-core's
 * partner record leave out the object count and the objects link.
 */
export class PartnerExporter extends BaseExporter {
  getName(): string {
    return 'Partners'
  }

  async export(): Promise<ExportResult> {
    this.logger.info('Exporting partners.json...')

    const partnerIds = await this.partnerIds()
    if (partnerIds.length === 0) {
      throw new Error(
        `The partner project has no museum — check that the importer's mwnf3 museums step ran against this database.`
      )
    }

    const partnerPh = this.placeholders(partnerIds.length)
    const partners = await this.db.query<PartnerRow>(
      `SELECT id, type, internal_name, backward_compatibility,
              country_id, latitude, longitude, map_zoom, monument_item_id
       FROM partners
       WHERE id IN (${partnerPh})
       ORDER BY country_id, internal_name`,
      partnerIds
    )

    const langCodeMap = await this.buildLangCodeMap()

    const [translations, images, logos, levels, groupMemberships] = await Promise.all([
      this.db.query<PartnerTranslationRow>(
        // Row order is unspecified; sorted so two exports of one database are
        // byte-identical (also makes the "first row wins" extra pick deterministic).
        `SELECT partner_id, language_id, name, description, city_display, address_notes,
                contact_website, contact_phone, contact_fax, contact_email_general, extra
         FROM partner_translations
         WHERE partner_id IN (${partnerPh})
         ORDER BY partner_id, language_id`,
        partnerIds
      ),
      this.db.query<PartnerImageRow>(
        `SELECT partner_id, path, alt_text, display_order, extra
         FROM partner_images
         WHERE partner_id IN (${partnerPh})
         ORDER BY partner_id, display_order`,
        partnerIds
      ),
      this.db.query<PartnerLogoRow>(
        `SELECT partner_id, path, logo_type, alt_text, display_order
         FROM partner_logos
         WHERE partner_id IN (${partnerPh})
         ORDER BY partner_id, display_order`,
        partnerIds
      ),
      this.db.query<PartnerLevelRow>(
        `SELECT cp.partner_id, cp.level
         FROM collection_partner cp
         JOIN collections c ON c.id = cp.collection_id
         JOIN projects proj ON proj.context_id = c.context_id
         WHERE cp.collection_type = 'project'
           AND cp.visible = true
           AND proj.id = ?
           AND cp.partner_id IN (${partnerPh})
         ORDER BY cp.partner_id`,
        [this.partnerProjectId, ...partnerIds]
      ),
      this.db.query<GroupMembershipRow>(
        `SELECT cp.collection_id, cp.partner_id, cp.level
         FROM collection_partner cp
         JOIN collections c ON c.id = cp.collection_id
         WHERE cp.collection_type = 'collection'
           AND c.internal_name LIKE 'partner_group:%'
           AND c.context_id = (SELECT p.context_id FROM projects p WHERE p.id = ?)
           AND cp.partner_id IN (${partnerPh})
         ORDER BY cp.collection_id, cp.partner_id`,
        [this.partnerProjectId, ...partnerIds]
      ),
    ])

    const translationMap = new Map<string, Record<string, Record<string, string | null>>>()
    // Contact persons, extra URLs and the portal flag are properties of the
    // museum, not of a language, but the importer copies them onto every
    // language row — so the first row seen wins.
    const extraMap = new Map<string, PartnerExtraFields>()

    for (const row of translations) {
      const code = langCodeMap.get(row.language_id)
      if (code) {
        const byLang = translationMap.get(row.partner_id) ?? {}
        byLang[code] = {
          name: row.name,
          description: row.description,
          city: row.city_display,
          address: row.address_notes,
          website: row.contact_website,
          phone: row.contact_phone,
          fax: row.contact_fax,
          email: row.contact_email_general,
        }
        translationMap.set(row.partner_id, byLang)
      }

      if (!extraMap.has(row.partner_id) && row.extra) {
        const extra = parseJson<PartnerExtraFields>(row.extra)
        if (extra) extraMap.set(row.partner_id, extra)
      }
    }

    const byLang = new Map<string, Record<string, unknown>>()
    for (const [partnerId, langMap] of translationMap) {
      for (const [langCode, fields] of Object.entries(langMap)) {
        const bucket = byLang.get(langCode) ?? {}
        bucket[partnerId] = this.stripNulls(fields as Record<string, unknown>)
        byLang.set(langCode, bucket)
      }
    }
    await this.writeTranslationFiles('partners', byLang)

    const imageMap = new Map<string, PartnerImage[]>()
    for (const image of images) {
      const extra = parseJson<{ photographer?: string; copyright?: string }>(image.extra)
      const entry = {
        url: this.imageUrl(image.path),
        alt_text: image.alt_text,
        display_order: image.display_order,
        photographer: extra?.photographer ?? null,
        copyright: extra?.copyright ?? null,
      }
      imageMap.set(image.partner_id, [...(imageMap.get(image.partner_id) ?? []), entry])
    }

    const logoMap = new Map<string, PartnerLogo[]>()
    for (const logo of logos) {
      const entry = {
        url: this.imageUrl(logo.path),
        logo_type: logo.logo_type,
        alt_text: logo.alt_text,
        display_order: logo.display_order,
      }
      logoMap.set(logo.partner_id, [...(logoMap.get(logo.partner_id) ?? []), entry])
    }

    const levelMap = new Map<string, string>()
    for (const row of levels) {
      if (row.level) levelMap.set(row.partner_id, row.level)
    }
    const parentMap = groupParents(groupMemberships)

    const output: Partner[] = partners.map(partner => {
      const extra = extraMap.get(partner.id)
      return {
        id: partner.id,
        type: partner.type,
        backward_compatibility: partner.backward_compatibility,
        country_id: partner.country_id,
        latitude: partner.latitude !== null ? parseFloat(partner.latitude) : null,
        longitude: partner.longitude !== null ? parseFloat(partner.longitude) : null,
        map_zoom: partner.map_zoom,
        monument_item_id: partner.monument_item_id,
        level: levelMap.get(partner.id) ?? null,
        parent_id: parentMap.get(partner.id) ?? null,
        project_uuids: [this.partnerProjectId],
        item_count: 0,
        featured: extra?.portal_display?.toLowerCase() === 'y',
        languages: Object.keys(translationMap.get(partner.id) ?? {}).sort(),
        contact_persons: contactPersons(extra),
        additional_urls: extra?.urls ?? [],
        images: imageMap.get(partner.id) ?? [],
        logos: logoMap.get(partner.id) ?? [],
      }
    })

    await this.writeJson('partners.json', output)
    const affiliates = output.filter(p => p.level === null).length
    this.logger.success(
      `partners.json (${output.length} partners, ${output.length - affiliates} at a curated level, ${affiliates} affiliates)`
    )

    return { file: 'partners.json', count: output.length }
  }
}

/**
 * partner_id → parent partner_id: the owner of the curated group a partner
 * belongs to (the member at level `partner`), excluding a group it owns
 * itself.
 */
export function groupParents(memberships: GroupMembershipRow[]): Map<string, string> {
  const owners = new Map<string, string>()
  for (const row of memberships) {
    if (row.level === 'partner') owners.set(row.collection_id, row.partner_id)
  }
  const parents = new Map<string, string>()
  for (const row of memberships) {
    if (row.level === 'partner') continue
    const owner = owners.get(row.collection_id)
    if (owner && owner !== row.partner_id) parents.set(row.partner_id, owner)
  }
  return parents
}

/**
 * The partner's contact persons in legacy order (person 1 first), leaving
 * out the ones it doesn't have — the way DXA's API builds `contactPerson`.
 */
function contactPersons(extra: PartnerExtraFields | undefined): PartnerContactPerson[] {
  return [extra?.contact_person_1, extra?.contact_person_2].filter(
    (person): person is PartnerContactPerson => person != null
  )
}
