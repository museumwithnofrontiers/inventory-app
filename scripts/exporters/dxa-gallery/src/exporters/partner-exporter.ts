import type {
  ExportResult,
  Partner,
  PartnerContactPerson,
  PartnerImage,
  PartnerLogo,
  PartnerUrl,
} from '../core/types.js'
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
  item_count: number
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
  /** Legacy `museums.portal_display` — 'y' drives the home page featured strip. */
  portal_display?: string
  opening_hours?: string
  how_to_reach?: string
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

// The curated legacy hierarchy (partner / associated_partner / minor_contributor,
// same partner_group:… collections the standalone exporters read) scoped to the
// gallery's own single native project — a gallery has at most one, unlike the
// project-scoped exporters which can carry several (e.g. ISL + EPM).
interface PartnerLevelRow {
  partner_id: string
  level: string | null
}

interface GroupMembershipRow {
  collection_id: string
  partner_id: string
  level: string | null
}

// item_id -> partner_id, for the member items actually held here — item_count
// and project_uuids are both derived from this same set, so they never
// disagree about which items back them. project_id is the item's own project
// UUID, resolved into project_uuids below.
interface PartnerHeldItemRow {
  partner_id: string
  item_id: string
  project_id: string | null
}

/**
 * `partners.json` — the museums the gallery's partner list shows.
 *
 * Legacy builds this list (app/MWNF/SQL/mwnf3/Partners.blade.php) as a
 * three-branch UNION: partners holding an object of the gallery's native
 * project, UNION partners holding an object linked to the gallery, UNION
 * museums created in the gallery's own project even when they hold nothing
 * (the branch legacy's own comment labels MWNF-384).
 *
 * The first two branches are exactly "holds a member item" — the membership
 * union is already materialized in `collection_item`, so they reduce to a join
 * against `memberItemIds`.
 *
 * The third branch is `partners.project_id = <the gallery's project>`, and it
 * is why the query is a LEFT JOIN with an OR rather than a plain join: such a
 * partner has `item_count: 0` and would otherwise be dropped. It is INERT on
 * some galleries (no museum was ever created under their native project) and
 * fires on others — a museum created under the gallery's own project, holding
 * no member item, carries `hasObjects: 0` in the legacy JSON and would
 * otherwise be silently missing from the exported list. Leaving the branch out
 * is how a gallery fork silently ships a short partner list; it is implemented
 * unconditionally here so every gallery gets it, whether or not it happens to
 * fire.
 *
 * `p.type = 'museum'` is part of that branch, not decoration: legacy selects it
 * from `mwnf3.museums` alone, while `partners.project_id` is also set on the
 * ISL schools — a gallery whose native project were ISL would otherwise list
 * schools legacy never shows.
 *
 * The project is `gallery.projectId`, resolved from the gallery's own
 * `extra.thg_gallery.mwnf3_project_id` anchor, never a hardcoded project code.
 * When a gallery has no mwnf3 project, it is null, `project_id = NULL` is
 * never true, and the branch contributes nothing.
 *
 * Legacy's other two filters were checked against the reference galleries this
 * exporter was built from and found to be no-ops there: the MWNF-371
 * not-live-project exclusion, and the hardcoded `uk/Mus51` / `us/Mus51`
 * exclusions. Neither is reproduced; re-check them if a future gallery's
 * partner count looks short.
 */
export class PartnerExporter extends BaseExporter {
  getName(): string {
    return 'Partners'
  }

  async export(): Promise<ExportResult> {
    this.logger.info('Exporting partners.json...')

    if (this.memberItemIds.length === 0) {
      await this.writeJson('partners.json', [])
      this.logger.warning('partners.json (0 — gallery has no member items)')
      return { file: 'partners.json', count: 0 }
    }

    const itemPh = this.placeholders(this.memberItemIds.length)
    const galleryProjectId = this.gallery.projectId

    const partners = await this.db.query<PartnerRow>(
      `SELECT p.id, p.type, p.internal_name, p.backward_compatibility,
              p.country_id, p.latitude, p.longitude, p.map_zoom, p.monument_item_id,
              COUNT(i.id) AS item_count
       FROM partners p
       LEFT JOIN items i ON i.partner_id = p.id AND i.id IN (${itemPh})
       WHERE i.id IS NOT NULL
          OR (p.type = 'museum' AND p.project_id = ?)
       GROUP BY p.id, p.type, p.internal_name, p.backward_compatibility,
                p.country_id, p.latitude, p.longitude, p.map_zoom, p.monument_item_id
       ORDER BY p.country_id, p.internal_name`,
      [...this.memberItemIds, galleryProjectId]
    )

    if (partners.length === 0) {
      await this.writeJson('partners.json', [])
      this.logger.warning('partners.json (0 partners)')
      return { file: 'partners.json', count: 0 }
    }

    const partnerIds = partners.map(p => p.id)
    const partnerPh = this.placeholders(partnerIds.length)
    const langCodeMap = await this.buildLangCodeMap()

    const [translations, images, logos, levels, groupMemberships, heldItems] = await Promise.all([
      this.db.query<PartnerTranslationRow>(
        // Row order is unspecified; sorted so two exports of one database are
        // byte-identical (also makes the "first row wins" extra-fields pick below deterministic).
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
      // level/parent_id: the same curated partner_group:… hierarchy the
      // standalone (project-scoped) exporters read, scoped to this gallery's
      // one native project. Skipped entirely when the gallery has none (43,
      // 45) — there is no project to curate the hierarchy under.
      galleryProjectId
        ? this.db.query<PartnerLevelRow>(
            `SELECT cp.partner_id, cp.level
             FROM collection_partner cp
             JOIN collections c ON c.id = cp.collection_id
             JOIN projects proj ON proj.context_id = c.context_id
             WHERE cp.collection_type = 'project'
               AND cp.visible = true
               AND proj.id = ?
               AND cp.partner_id IN (${partnerPh})`,
            [galleryProjectId, ...partnerIds]
          )
        : Promise.resolve([] as PartnerLevelRow[]),
      galleryProjectId
        ? this.db.query<GroupMembershipRow>(
            `SELECT cp.collection_id, cp.partner_id, cp.level
             FROM collection_partner cp
             JOIN collections c ON c.id = cp.collection_id
             WHERE cp.collection_type = 'collection'
               AND c.internal_name LIKE 'partner_group:%'
               AND c.context_id = (SELECT p.context_id FROM projects p WHERE p.id = ?)
               AND cp.partner_id IN (${partnerPh})`,
            [galleryProjectId, ...partnerIds]
          )
        : Promise.resolve([] as GroupMembershipRow[]),
      // The member items counted into item_count, by partner — resolved to
      // project_uuids below. Row order is unspecified; sorted so `project_uuids`
      // is byte-identical across two exports of one database.
      this.db.query<PartnerHeldItemRow>(
        `SELECT partner_id, id AS item_id, project_id
         FROM items
         WHERE partner_id IN (${partnerPh})
           AND id IN (${itemPh})
         ORDER BY partner_id, project_id`,
        [...partnerIds, ...this.memberItemIds]
      ),
    ])

    const translationMap = new Map<string, Record<string, Record<string, string | null>>>()
    // Contact details, opening hours and the portal flag are properties of the
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
      const bucket = imageMap.get(image.partner_id)
      if (bucket) bucket.push(entry)
      else imageMap.set(image.partner_id, [entry])
    }

    const logoMap = new Map<string, PartnerLogo[]>()
    for (const logo of logos) {
      const entry = {
        url: this.imageUrl(logo.path),
        logo_type: logo.logo_type,
        alt_text: logo.alt_text,
        display_order: logo.display_order,
      }
      const bucket = logoMap.get(logo.partner_id)
      if (bucket) bucket.push(entry)
      else logoMap.set(logo.partner_id, [entry])
    }

    // partner_id -> level (uncurated where the hierarchy has nothing to say)
    const levelMap = new Map<string, string>()
    for (const row of levels) {
      if (row.level) levelMap.set(row.partner_id, row.level)
    }

    // collection_id -> owner partner_id (the member with level='partner')
    const groupOwnerMap = new Map<string, string>()
    for (const row of groupMemberships) {
      if (row.level === 'partner') groupOwnerMap.set(row.collection_id, row.partner_id)
    }
    // partner_id -> parent partner_id (the owner of the group this partner
    // belongs to, excluding a group it owns itself)
    const parentMap = new Map<string, string>()
    for (const row of groupMemberships) {
      if (row.level === 'partner') continue
      const owner = groupOwnerMap.get(row.collection_id)
      if (owner && owner !== row.partner_id) parentMap.set(row.partner_id, owner)
    }

    // partner_id -> project UUIDs of the member items it holds here (each
    // item resolves to its OWN project — that's what "the projects this
    // partner belongs to" means for a partner whose held items were borrowed
    // from elsewhere, not just the gallery's own), same MWNF-384 fallback below.
    const projectUuidsMap = new Map<string, Set<string>>()
    for (const row of heldItems) {
      if (row.project_id) {
        if (!projectUuidsMap.has(row.partner_id)) projectUuidsMap.set(row.partner_id, new Set())
        projectUuidsMap.get(row.partner_id)!.add(row.project_id)
      }
    }

    const output: Partner[] = partners.map(partner => {
      const extra = extraMap.get(partner.id)
      const itemCount = Number(partner.item_count)
      // A partner with no held item here only appears via the MWNF-384
      // branch, which means it belongs to the gallery's own project even
      // though it contributes nothing to project_uuids above. gallery.projectId
      // is already the inventory UUID of that same native project.
      const heldProjectUuids = projectUuidsMap.get(partner.id)
      const projectUuids =
        heldProjectUuids && heldProjectUuids.size > 0
          ? [...heldProjectUuids]
          : itemCount === 0 && this.gallery.projectId
            ? [this.gallery.projectId]
            : []
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
        project_uuids: projectUuids,
        // Member items held here — the count the partners list prints, and the
        // reason a partner appears at all.
        item_count: itemCount,
        // Legacy `showOnPortal`. The home page shows a random subset of the
        // featured partners, so the package ships the flag and the viewer picks.
        featured: extra?.portal_display?.toLowerCase() === 'y',
        // Same derivation as each item's languages in items.json
        languages: Object.keys(translationMap.get(partner.id) ?? {}).sort(),
        contact_person_1: extra?.contact_person_1 ?? null,
        contact_person_2: extra?.contact_person_2 ?? null,
        contact_persons: contactPersons(extra),
        additional_urls: extra?.urls ?? [],
        images: imageMap.get(partner.id) ?? [],
        logos: logoMap.get(partner.id) ?? [],
      }
    })

    await this.writeJson('partners.json', output)
    // The zero-item count is called out because it is the MWNF-384 branch's
    // whole contribution: if it silently goes to 0 on a gallery whose project
    // owns museums, the museum→project link is missing from the database.
    const withoutItems = output.filter(p => p.item_count === 0).length
    this.logger.success(
      `partners.json (${output.length} partners, ${output.filter(p => p.featured).length} featured, ` +
        `${withoutItems} holding no member item)`
    )

    return { file: 'partners.json', count: output.length }
  }
}

/**
 * Parses a MySQL JSON column value. mysql2 auto-decodes native JSON columns
 * into JS objects already, so `raw` is usually an object/array, not a string
 * — only fall back to JSON.parse for the (defensive) string case.
 */
function parseJson<T>(raw: unknown): T | null {
  if (raw == null) return null
  if (typeof raw === 'object') return raw as T
  try {
    return JSON.parse(raw as string) as T
  } catch {
    return null
  }
}

/**
 * The partner's contact persons in legacy order (person 1 first), leaving
 * out the ones it doesn't have - the way DXA's API builds `contactPerson`.
 * A list keeps that order visible once one of the two is missing, which two
 * nullable keys can't.
 */
function contactPersons(extra: PartnerExtraFields | undefined): PartnerContactPerson[] {
  return [extra?.contact_person_1, extra?.contact_person_2].filter(
    (person): person is PartnerContactPerson => person != null
  )
}
