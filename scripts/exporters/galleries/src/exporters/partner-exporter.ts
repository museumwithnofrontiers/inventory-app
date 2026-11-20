import type {
  ExportResult,
  Partner,
  PartnerContactPerson,
  PartnerImage,
  PartnerLogo,
  PartnerUrl,
} from '../core/types.js'
import { parseJson } from '../core/database.js'
import { partnerWebsites } from '../../../shared/partner-websites.mjs'
import { partnerParents } from '../../../shared/partner-parents.mjs'
import { BaseExporter } from './base-exporter.js'
import { partnerColumnsSelect, restorePartnerColumns } from '../../../shared/partner-columns.mjs'

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
  copyright: string | null
  photographer: string | null
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
 * `item_count` counts the hub's objects a partner holds (`memberItemIds`),
 * which gives it legacy's "View objects". `own_project` is the partner
 * project, its name and the partner's tier in it: the badge legacy drew under
 * each name ("MWNF Galleries Partner" / "Affiliate").
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

    const memberPh = this.placeholders(Math.max(this.memberItemIds.length, 1))
    const [partnerTranslations, images, logos, levels, parentMap, heldItems, projectRows] = await Promise.all([
      this.db.query<PartnerTranslationRow>(
        // Row order is unspecified; sorted so two exports of one database are
        // byte-identical (also makes the "first row wins" extra pick deterministic).
        `SELECT partner_id, language_id, name, description, city_display, address_notes,
                contact_website, contact_phone, contact_fax, contact_email_general, extra,
                ${partnerColumnsSelect('partner_translations')}
         FROM partner_translations
         WHERE partner_id IN (${partnerPh})
         ORDER BY partner_id, language_id`,
        partnerIds
      ),
      this.db.query<PartnerImageRow>(
        `SELECT partner_id, path, alt_text, display_order, copyright, photographer, extra
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
      // The partner each member belongs to (legacy's associated partners): the
      // project-tier row's parent_partner_id (M16 J2).
      partnerParents((sql, params) => this.db.query(sql, params), [this.partnerProjectId], partnerIds),
      // The hub's objects each partner holds.
      this.memberItemIds.length > 0
        ? this.db.query<{ partner_id: string; item_count: number }>(
            `SELECT partner_id, COUNT(*) AS item_count
             FROM items
             WHERE id IN (${memberPh}) AND partner_id IN (${partnerPh})
             GROUP BY partner_id
             ORDER BY partner_id`,
            [...this.memberItemIds, ...partnerIds]
          )
        : Promise.resolve([] as { partner_id: string; item_count: number }[]),
      this.db.query<{ name: string; backward_compatibility: string | null }>(
        `SELECT internal_name AS name, backward_compatibility FROM projects WHERE id = ?`,
        [this.partnerProjectId]
      ),
    ])
    const translations = restorePartnerColumns(partnerTranslations)

    const translationMap = new Map<string, Record<string, Record<string, string | null>>>()
    // Contact persons, extra URLs and the portal flag are properties of the
    // museum, not of a language, but the importer copies them onto every
    // language row — so the first row seen wins.
    // The partner's other websites: its links since M16 F3 (`extra.urls` before).
    const websites = await partnerWebsites((sql, params) => this.db.query(sql, params), partnerIds)
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
        photographer: image.photographer ?? extra?.photographer ?? null,
        // The column holds legacy's text with the mark the burn adds (M16 I4, #2659).
        copyright: extra?.copyright ?? withoutCopyrightMark(image.copyright),
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
    const heldMap = new Map(heldItems.map(row => [row.partner_id, Number(row.item_count)]))
    const project = projectRows[0] ?? null

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
        item_count: heldMap.get(partner.id) ?? 0,
        own_project: project
          ? {
              id: this.partnerProjectId,
              name: project.name,
              backward_compatibility: project.backward_compatibility,
              level: levelMap.get(partner.id) ?? null,
              exhibition: false,
            }
          : null,
        featured: extra?.portal_display?.toLowerCase() === 'y',
        languages: Object.keys(translationMap.get(partner.id) ?? {}).sort(),
        contact_persons: contactPersons(extra),
        additional_urls: websites.get(partner.id) ?? extra?.urls ?? [],
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
 * The partner's contact persons in legacy order (person 1 first), leaving
 * out the ones it doesn't have — the way DXA's API builds `contactPerson`.
 */
function contactPersons(extra: PartnerExtraFields | undefined): PartnerContactPerson[] {
  return [extra?.contact_person_1, extra?.contact_person_2].filter(
    (person): person is PartnerContactPerson => person != null
  )
}

/**
 * A partner picture's copyright as legacy wrote it: the image row's column
 * holds it with the "© " the importer adds for the burn (toImageCopyright).
 */
export function withoutCopyrightMark(copyright: string | null | undefined): string | null {
  if (!copyright) return null
  return copyright.startsWith('© ') ? copyright.slice(2) : copyright
}
