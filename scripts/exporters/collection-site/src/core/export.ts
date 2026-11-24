import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  assertNoDraftItems,
  itemShipped,
  loadDraftCollectionIds,
  textShipped,
} from '../../../shared/drafts.mjs'
import type { CollectionSiteInstance } from './instance.js'
import { collectTree, compact, groupBy, memberIds, pickTexts, toNumber, topOf } from './rules.js'
import type { PlacedItem } from './rules.js'

/** Runs one read-only query; `?` placeholders, values escaped by the driver. */
export type Query = <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>

export interface ExportOptions {
  outputDir: string
  baseUrl: string
  /** The package version written into the manifest. */
  version: string
  log?: (line: string) => void
}

export interface ExportSummary {
  files: number
  collections: number
  placements: number
  members: number
  items: number
  partners: number
  languages: string[]
}

/**
 * The format this exporter writes. A consumer checks it before reading the
 * package; any change a consumer must know about raises it.
 */
export const FORMAT = 'collection-site'
export const FORMAT_VERSION = 1

/** The item text columns, each shipped under its own name (ADR 006, rule R9). */
export const ITEM_TEXT_COLUMNS = [
  'name',
  'alternate_name',
  'original_name',
  'description',
  'short_description',
  'type',
  'holder',
  'holder_original_name',
  'owner',
  'initial_owner',
  'dates',
  'location',
  'region',
  'dimensions',
  'materials',
  'dynasty',
  'keywords',
  'artist',
  'artist_period_of_activity',
  'artist_birth_date',
  'artist_birth_place',
  'artist_death_date',
  'artist_death_place',
  'workshop',
  'scribe',
  'patrons',
  'architects',
  'image_rights',
  'external_sources',
  'place_of_production',
  'method_for_datation',
  'method_for_provenance',
  'provenance',
  'obtention',
  'bibliography',
  'archival_reference',
  'history',
  'catalogue_references',
  'notice',
  'external_notice',
  'author_id',
  'text_copy_editor_id',
  'translator_id',
  'translation_copy_editor_id',
  'author_credit',
  'copy_editor_credit',
  'translator_credit',
  'translation_copy_editor_credit',
] as const

const COLLECTION_TEXT_COLUMNS = ['title', 'subtitle', 'description', 'introduction', 'quote', 'cover_caption', 'duration', 'url'] as const

const PLACEMENT_TEXT_COLUMNS = [
  'title',
  'description',
  'caption',
  'justification',
  'curator_justification',
  'partner_justification',
  'item_name',
  'item_date',
  'item_location',
  'item_museum',
  'item_dynasty',
  'item_artist',
  'item_material',
] as const

const PARTNER_TEXT_COLUMNS = [
  'name',
  'also_known_as',
  'description',
  'city_display',
  'address_line_1',
  'address_line_2',
  'postal_code',
  'address_notes',
  'contact_name',
  'contact_email_general',
  'contact_email_press',
  'contact_phone',
  'contact_fax',
  'contact_website',
  'contact_notes',
  'contact_emails',
  'contact_phones',
] as const

const VISIT_TEXT_COLUMNS = [
  'how_to_reach',
  'opening_hours',
  'contact',
  'address',
  'institution',
  'practical_information',
  'phone',
  'fax',
  'email',
  'website',
] as const

const LINK_COLUMNS =
  'l.id, l.linkable_type, l.linkable_id, l.language_id, l.type, l.title, l.url, l.description, l.authors, l.category, l.resource_type, l.location, l.country_code, l.further_reading, l.display_order'

type Row = Record<string, unknown>

const str = (v: unknown): string => String(v)
const strOrNull = (v: unknown): string | null => (v === null || v === undefined ? null : String(v))

/** `?, ?, ?` for a list; an empty list matches nothing. */
function inList(ids: readonly unknown[]): string {
  return ids.length === 0 ? 'NULL' : ids.map(() => '?').join(', ')
}

function pick(row: Row, columns: readonly string[]): Row {
  return compact(Object.fromEntries(columns.map(c => [c, row[c]])))
}

/**
 * Writes a collection site's package: what the inventory holds for one
 * collection tree, under the model's own names (inventory-app#2727).
 *
 * Every entity is one file (`<entity>.json`, an array ordered by id or by
 * its own order) and its texts are one file per language
 * (`translations/<entity>.<language id>.json`, an object keyed by record
 * id). Language ids are the inventory's (`eng`, `fra` …).
 */
export async function exportCollectionSite(
  query: Query,
  instance: CollectionSiteInstance,
  options: ExportOptions
): Promise<ExportSummary> {
  const log = options.log ?? (() => undefined)
  const out = options.outputDir
  rmSync(out, { recursive: true, force: true })
  mkdirSync(out, { recursive: true })
  let files = 0
  const write = (path: string, data: unknown) => {
    const full = join(out, path)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, JSON.stringify(data, null, 2) + '\n')
    files++
  }
  const writeTexts = (entity: string, byLanguage: Map<string, Record<string, Row>>) => {
    for (const [language, texts] of [...byLanguage.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      write(`translations/${entity}.${language}.json`, sortKeys(texts))
    }
  }
  const imageUrl = (path: unknown) => `${options.baseUrl}/pub/${str(path)}`

  // --- The default context and language -----------------------------------------------
  const [defaultContext] = await query<{ id: string }>('SELECT id FROM contexts WHERE is_default = 1 LIMIT 1')
  const [defaultLanguage] = await query<{ id: string }>('SELECT id FROM languages WHERE is_default = 1 LIMIT 1')
  const defaultContextId = defaultContext?.id ?? null

  // --- R1: the collection tree ---------------------------------------------------------
  const allCollections = await query<Row & { id: string; parent_id: string | null }>(
    `SELECT id, parent_id, type, display_order, context_id, language_id, cover_item_id,
            latitude, longitude, map_zoom, country_id, days
       FROM collections ORDER BY parent_id, display_order, id`
  )
  const draftCollections = await loadDraftCollectionIds(query as never)
  const tree = collectTree(allCollections, instance.collection_id, draftCollections)
  if (tree.length === 0) {
    throw new Error(`collection ${instance.collection_id} does not exist or is a draft`)
  }
  const root = tree[0]!
  const siteContextId = str(root['context_id'])
  const treeIds = tree.map(c => c.id)
  log(`tree: ${tree.length} collections`)

  // --- R2: placements and members ------------------------------------------------------
  const placements = await query<Row & { id: string; item_id: string; collection_id: string }>(
    `SELECT ci.id, ci.collection_id, ci.item_id, ci.display_order, ci.variant_order,
            ci.parent_variant_order, ci.picture_item_id, ci.curator_selected
       FROM collection_item ci JOIN items i ON i.id = ci.item_id
      WHERE ci.collection_id IN (${inList(treeIds)}) AND ${itemShipped('i')}
      ORDER BY ci.collection_id, ci.display_order, ci.variant_order, ci.id`,
    treeIds
  )
  const placedIds = [...new Set(placements.map(p => p.item_id))]
  // The placed items and their ancestors, to find each member (a picture stands for its item).
  const lineage = await query<PlacedItem>(
    `SELECT i.id, i.type, i.parent_id FROM items i WHERE i.id IN (${inList(placedIds)})
     UNION SELECT p.id, p.type, p.parent_id FROM items i JOIN items p ON p.id = i.parent_id WHERE i.id IN (${inList(placedIds)})
     UNION SELECT g.id, g.type, g.parent_id FROM items i JOIN items p ON p.id = i.parent_id JOIN items g ON g.id = p.parent_id
            WHERE i.id IN (${inList(placedIds)})`,
    [...placedIds, ...placedIds, ...placedIds]
  )
  const lineageById = new Map(lineage.map(i => [i.id, i]))
  const placedOrdered = placements.map(p => lineageById.get(p.item_id)).filter((i): i is PlacedItem => i !== undefined)
  const members = memberIds(placedOrdered, lineageById)
  log(`placements: ${placements.length}, members: ${members.length}`)

  // --- Items: the members and everything under them (their pictures and details) --------
  const items = await query<Row & { id: string; parent_id: string | null; project_id: string | null }>(
    `SELECT i.id, i.type, i.parent_id, i.display_order, i.project_id, i.collection_id, i.partner_id,
            i.country_id, i.owner_reference, i.mwnf_reference, i.start_date, i.end_date,
            i.latitude, i.longitude, i.map_zoom
       FROM items i
       LEFT JOIN items p ON p.id = i.parent_id
       LEFT JOIN items g ON g.id = p.parent_id
      WHERE (i.id IN (${inList(members)}) OR p.id IN (${inList(members)}) OR g.id IN (${inList(members)}))
        AND ${itemShipped('i')}
      ORDER BY i.id`,
    [...members, ...members, ...members]
  )
  const itemIds = items.map(i => i.id)
  const itemById = new Map(items.map(i => [i.id, i]))
  const memberSet = new Set(members)

  const projectIds = [...new Set(items.map(i => i.project_id).filter((id): id is string => id !== null))].sort()
  const projects = await query<Row & { id: string; context_id: string | null }>(
    `SELECT id, internal_name, context_id, language_id, site_url, related_database_url, artistic_introduction_url
       FROM projects WHERE id IN (${inList(projectIds)}) ORDER BY id`,
    projectIds
  )
  const projectContext = new Map(projects.map(p => [p.id, p.context_id]))
  const contextOrderFor = (projectId: string | null) => [
    siteContextId,
    projectId === null ? null : (projectContext.get(projectId) ?? null),
    defaultContextId,
  ]

  // R3: each item's text per language, from the first context that has one.
  const itemTexts = await query<Row & { id: string; item_id: string; language_id: string; context_id: string }>(
    `SELECT t.id, t.item_id, t.language_id, t.context_id, ${ITEM_TEXT_COLUMNS.map(c => `t.${c}`).join(', ')}
       FROM item_translations t WHERE t.item_id IN (${inList(itemIds)}) AND ${textShipped('t')}
      ORDER BY t.item_id, t.language_id, t.context_id, t.id`,
    itemIds
  )
  const chosenTexts = new Map<string, Map<string, Row & { id: string; language_id: string; context_id: string }>>()
  for (const [itemId, texts] of groupBy(itemTexts, t => t.item_id)) {
    const item = itemById.get(itemId)
    const projectId = item ? (item.project_id ?? topProject(item, itemById)) : null
    chosenTexts.set(itemId, pickTexts(texts, contextOrderFor(projectId)))
  }
  const chosenTextIds = [...chosenTexts.values()].flatMap(m => [...m.values()].map(t => t.id))
  const textAuthors = await query<{ item_translation_id: string; role: string; author_id: string; display_order: number }>(
    `SELECT item_translation_id, role, author_id, display_order FROM item_translation_author
      WHERE item_translation_id IN (${inList(chosenTextIds)}) ORDER BY item_translation_id, role, display_order, author_id`,
    chosenTextIds
  )
  const authorsByText = groupBy(textAuthors, a => a.item_translation_id)
  const textSpellings = await query<{ item_translation_id: string; spelling_id: string }>(
    `SELECT item_translation_id, spelling_id FROM item_translation_spelling
      WHERE item_translation_id IN (${inList(chosenTextIds)}) ORDER BY item_translation_id, spelling_id`,
    chosenTextIds
  )
  const spellingsByText = groupBy(textSpellings, s => s.item_translation_id)

  const itemTextsByLanguage = new Map<string, Record<string, Row>>()
  for (const [itemId, byLanguage] of chosenTexts) {
    for (const [language, text] of byLanguage) {
      const entry: Row = {
        context_id: text.context_id,
        ...pick(text, ITEM_TEXT_COLUMNS),
      }
      const authors = authorsByText.get(text.id)
      if (authors) entry['authors'] = authors.map(a => ({ role: a.role, author_id: a.author_id }))
      const spellings = spellingsByText.get(text.id)
      if (spellings) entry['glossary_spelling_ids'] = spellings.map(s => s.spelling_id)
      bucket(itemTextsByLanguage, language)[itemId] = entry
    }
  }

  // Item images, tags, dynasties, artists.
  const images = await query<Row & { id: string; item_id: string }>(
    `SELECT id, item_id, path, alt_text, copyright, photographer, credit, display_order
       FROM item_images WHERE item_id IN (${inList(itemIds)}) ORDER BY item_id, display_order, id`,
    itemIds
  )
  const imagesByItem = groupBy(images, i => i.item_id)
  const imageIds = images.map(i => i.id)
  const imageTexts = await query<Row & { image_id: string; language_id: string }>(
    `SELECT image_id, language_id, caption, name, date, museum, location, copyright, photographer
       FROM image_translations WHERE image_type = 'item_image' AND image_id IN (${inList(imageIds)})
      ORDER BY image_id, language_id`,
    imageIds
  )
  const tagLinks = await query<{ item_id: string; tag_id: string }>(
    `SELECT item_id, tag_id FROM item_tag WHERE item_id IN (${inList(itemIds)}) ORDER BY item_id, tag_id`,
    itemIds
  )
  const dynastyLinks = await query<{ item_id: string; dynasty_id: string }>(
    `SELECT item_id, dynasty_id FROM item_dynasty WHERE item_id IN (${inList(itemIds)}) ORDER BY item_id, dynasty_id`,
    itemIds
  )
  const artistLinks = await query<{ item_id: string; artist_id: string }>(
    `SELECT item_id, artist_id FROM artist_item WHERE item_id IN (${inList(itemIds)}) ORDER BY item_id, artist_id`,
    itemIds
  )
  const tagsByItem = groupBy(tagLinks, l => l.item_id)
  const dynastiesByItem = groupBy(dynastyLinks, l => l.item_id)
  const artistsByItem = groupBy(artistLinks, l => l.item_id)

  write(
    'items.json',
    items.map(item =>
      compact({
        id: item.id,
        type: item['type'],
        parent_id: item.parent_id,
        member: memberSet.has(item.id) || undefined,
        display_order: item['display_order'],
        project_id: item.project_id,
        collection_id: item['collection_id'],
        partner_id: item['partner_id'],
        country_id: item['country_id'],
        owner_reference: item['owner_reference'],
        mwnf_reference: item['mwnf_reference'],
        start_date: item['start_date'],
        end_date: item['end_date'],
        latitude: toNumber(item['latitude']),
        longitude: toNumber(item['longitude']),
        map_zoom: item['map_zoom'],
        images: (imagesByItem.get(item.id) ?? []).map(image =>
          compact({
            id: image.id,
            url: imageUrl(image['path']),
            display_order: image['display_order'],
            alt_text: image['alt_text'],
            copyright: image['copyright'],
            photographer: image['photographer'],
            credit: image['credit'],
          })
        ),
        tag_ids: (tagsByItem.get(item.id) ?? []).map(l => l.tag_id),
        dynasty_ids: (dynastiesByItem.get(item.id) ?? []).map(l => l.dynasty_id),
        artist_ids: (artistsByItem.get(item.id) ?? []).map(l => l.artist_id),
      })
    )
  )
  writeTexts('items', itemTextsByLanguage)
  const imageTextsByLanguage = new Map<string, Record<string, Row>>()
  for (const text of imageTexts) {
    bucket(imageTextsByLanguage, text.language_id)[text.image_id] = pick(text, [
      'caption',
      'name',
      'date',
      'museum',
      'location',
      'copyright',
      'photographer',
    ])
  }
  writeTexts('item_images', imageTextsByLanguage)

  // --- The tree and its texts -------------------------------------------------------------
  const collectionTexts = await query<Row & { collection_id: string; language_id: string; context_id: string }>(
    `SELECT collection_id, language_id, context_id, ${COLLECTION_TEXT_COLUMNS.join(', ')}
       FROM collection_translations WHERE collection_id IN (${inList(treeIds)})
      ORDER BY collection_id, language_id, context_id`,
    treeIds
  )
  const collectionById = new Map(tree.map(c => [c.id, c]))
  const collectionTextsByLanguage = new Map<string, Record<string, Row>>()
  for (const [collectionId, texts] of groupBy(collectionTexts, t => t.collection_id)) {
    const own = collectionById.get(collectionId)
    for (const [language, text] of pickTexts(texts, [strOrNull(own?.['context_id']), siteContextId, defaultContextId])) {
      bucket(collectionTextsByLanguage, language)[collectionId] = {
        context_id: text.context_id,
        ...pick(text, COLLECTION_TEXT_COLUMNS),
      }
    }
  }
  write(
    'collections.json',
    tree.map(c =>
      compact({
        id: c.id,
        parent_id: c.id === root.id ? null : c.parent_id,
        type: c['type'],
        display_order: c['display_order'],
        context_id: c['context_id'],
        language_id: c['language_id'],
        cover_item_id: c['cover_item_id'] !== null && itemById.has(str(c['cover_item_id'])) ? c['cover_item_id'] : null,
        latitude: toNumber(c['latitude']),
        longitude: toNumber(c['longitude']),
        map_zoom: c['map_zoom'],
        country_id: c['country_id'],
        days: c['days'],
      })
    )
  )
  writeTexts('collections', collectionTextsByLanguage)

  // Placements and their texts.
  const placementIds = placements.map(p => p.id)
  const placementTexts = await query<Row & { collection_item_id: string; language_id: string }>(
    `SELECT collection_item_id, language_id, ${PLACEMENT_TEXT_COLUMNS.join(', ')}
       FROM collection_item_translations WHERE collection_item_id IN (${inList(placementIds)})
      ORDER BY collection_item_id, language_id`,
    placementIds
  )
  write(
    'placements.json',
    placements.map(p =>
      compact({
        id: p.id,
        collection_id: p.collection_id,
        item_id: p.item_id,
        member_id: topOf(lineageById.get(p.item_id) ?? { id: p.item_id, type: '', parent_id: null }, lineageById).id,
        display_order: p['display_order'],
        variant_order: p['variant_order'],
        parent_variant_order: p['parent_variant_order'],
        picture_item_id: p['picture_item_id'],
        curator_selected: p['curator_selected'] === null ? null : Boolean(p['curator_selected']),
      })
    )
  )
  const placementTextsByLanguage = new Map<string, Record<string, Row>>()
  for (const text of placementTexts) {
    const entry = pick(text, PLACEMENT_TEXT_COLUMNS)
    if (Object.keys(entry).length > 0) bucket(placementTextsByLanguage, text.language_id)[text.collection_item_id] = entry
  }
  writeTexts('placements', placementTextsByLanguage)

  // --- Links of the tree and of the items (R7) ---------------------------------------------
  const links = await query<Row & { id: string }>(
    `SELECT ${LINK_COLUMNS} FROM links l
      WHERE (l.linkable_type = 'collection' AND l.linkable_id IN (${inList(treeIds)}))
         OR (l.linkable_type = 'item' AND l.linkable_id IN (${inList(itemIds)}))
      ORDER BY l.linkable_type, l.linkable_id, l.type, l.display_order, l.id`,
    [...treeIds, ...itemIds]
  )
  write('links.json', links.map(l => compact(l)))

  // --- Contributors of the tree ----------------------------------------------------------
  const contributors = await query<Row & { id: string }>(
    `SELECT id, collection_id, category, display_order, visible FROM contributors
      WHERE collection_id IN (${inList(treeIds)}) ORDER BY collection_id, display_order, id`,
    treeIds
  )
  const contributorIds = contributors.map(c => c.id)
  const contributorTexts = await query<Row & { contributor_id: string; language_id: string; context_id: string }>(
    `SELECT contributor_id, language_id, context_id, name, description, link, alt_text FROM contributor_translations
      WHERE contributor_id IN (${inList(contributorIds)}) ORDER BY contributor_id, language_id, context_id`,
    contributorIds
  )
  write(
    'contributors.json',
    contributors.map(c => compact({ ...c, visible: c['visible'] === null ? null : Boolean(c['visible']) }))
  )
  const contributorTextsByLanguage = new Map<string, Record<string, Row>>()
  for (const [contributorId, texts] of groupBy(contributorTexts, t => t.contributor_id)) {
    for (const [language, text] of pickTexts(texts, [siteContextId, defaultContextId])) {
      bucket(contributorTextsByLanguage, language)[contributorId] = {
        context_id: text.context_id,
        ...pick(text, ['name', 'description', 'link', 'alt_text']),
      }
    }
  }
  writeTexts('contributors', contributorTextsByLanguage)

  // --- R5: partners --------------------------------------------------------------------
  const collectionPartners = await query<Row & { partner_id: string }>(
    `SELECT collection_id, partner_id, level, visible, parent_partner_id FROM collection_partner
      WHERE collection_id IN (${inList(treeIds)}) ORDER BY collection_id, partner_id`,
    treeIds
  )
  const partnerIds = [
    ...new Set([
      ...items.map(i => i['partner_id']).filter((id): id is string => typeof id === 'string'),
      ...collectionPartners.map(cp => cp.partner_id),
      ...collectionPartners.map(cp => cp['parent_partner_id']).filter((id): id is string => typeof id === 'string'),
    ]),
  ].sort()
  const partners = await query<Row & { id: string; project_id: string | null }>(
    `SELECT p.id, p.type, p.category, p.country_id, p.city, p.latitude, p.longitude, p.map_zoom, p.project_id,
            CASE WHEN p.monument_item_id IS NOT NULL AND NOT EXISTS (
                   SELECT 1 FROM items mi WHERE mi.id = p.monument_item_id AND NOT ${itemShipped('mi')})
                 THEN p.monument_item_id END AS monument_item_id
       FROM partners p WHERE p.id IN (${inList(partnerIds)}) ORDER BY p.id`,
    partnerIds
  )
  const partnerProjectIds = partners.map(p => p.project_id).filter((id): id is string => id !== null)
  for (const p of await query<{ id: string; context_id: string | null }>(
    `SELECT id, context_id FROM projects WHERE id IN (${inList(partnerProjectIds)})`,
    partnerProjectIds
  )) {
    if (!projectContext.has(p.id)) projectContext.set(p.id, p.context_id)
  }
  const partnerImages = await query<Row & { partner_id: string }>(
    `SELECT id, partner_id, path, alt_text, copyright, photographer, credit, display_order FROM partner_images
      WHERE partner_id IN (${inList(partnerIds)}) ORDER BY partner_id, display_order, id`,
    partnerIds
  )
  const partnerLogos = await query<Row & { partner_id: string }>(
    `SELECT id, partner_id, path, logo_type, alt_text, display_order FROM partner_logos
      WHERE partner_id IN (${inList(partnerIds)}) ORDER BY partner_id, display_order, id`,
    partnerIds
  )
  const partnerContacts = await query<Row & { partner_id: string }>(
    `SELECT partner_id, display_order, name, title, email, phone, fax FROM partner_contacts
      WHERE partner_id IN (${inList(partnerIds)}) ORDER BY partner_id, display_order`,
    partnerIds
  )
  const imagesByPartner = groupBy(partnerImages, i => i.partner_id)
  const logosByPartner = groupBy(partnerLogos, i => i.partner_id)
  const contactsByPartner = groupBy(partnerContacts, i => i.partner_id)
  const memberCountByPartner = new Map<string, number>()
  for (const item of items) {
    if (memberSet.has(item.id) && typeof item['partner_id'] === 'string') {
      memberCountByPartner.set(item['partner_id'], (memberCountByPartner.get(item['partner_id']) ?? 0) + 1)
    }
  }
  write(
    'partners.json',
    partners.map(p =>
      compact({
        id: p.id,
        type: p['type'],
        category: p['category'],
        country_id: p['country_id'],
        city: p['city'],
        latitude: toNumber(p['latitude']),
        longitude: toNumber(p['longitude']),
        map_zoom: p['map_zoom'],
        project_id: p.project_id,
        monument_item_id: p['monument_item_id'],
        member_count: memberCountByPartner.get(p.id) ?? 0,
        images: (imagesByPartner.get(p.id) ?? []).map(i =>
          compact({ id: i['id'], url: imageUrl(i['path']), ...pick(i, ['alt_text', 'copyright', 'photographer', 'credit', 'display_order']) })
        ),
        logos: (logosByPartner.get(p.id) ?? []).map(i =>
          compact({ id: i['id'], url: imageUrl(i['path']), ...pick(i, ['logo_type', 'alt_text', 'display_order']) })
        ),
        contacts: (contactsByPartner.get(p.id) ?? []).map(c => pick(c, ['name', 'title', 'email', 'phone', 'fax', 'display_order'])),
      })
    )
  )
  write(
    'collection_partners.json',
    collectionPartners.map(cp => compact({ ...cp, visible: Boolean(cp['visible']) }))
  )
  const partnerTexts = await query<Row & { partner_id: string; language_id: string; context_id: string }>(
    `SELECT partner_id, language_id, context_id, ${PARTNER_TEXT_COLUMNS.join(', ')} FROM partner_translations
      WHERE partner_id IN (${inList(partnerIds)}) ORDER BY partner_id, language_id, context_id`,
    partnerIds
  )
  const partnerById = new Map(partners.map(p => [p.id, p]))
  const partnerTextsByLanguage = new Map<string, Record<string, Row>>()
  for (const [partnerId, texts] of groupBy(partnerTexts, t => t.partner_id)) {
    const order = contextOrderFor(partnerById.get(partnerId)?.project_id ?? null)
    // A partner's text may sit in any context; after the rule's order, take the first one there is.
    const fallback = [...new Set(texts.map(t => t.context_id))].sort()
    for (const [language, text] of pickTexts(texts, [...order, ...fallback])) {
      bucket(partnerTextsByLanguage, language)[partnerId] = { context_id: text.context_id, ...pick(text, PARTNER_TEXT_COLUMNS) }
    }
  }
  writeTexts('partners', partnerTextsByLanguage)

  // --- Visit information of the members, partners and tree --------------------------------
  const visits = await query<Row & { id: string; language_id: string; context_id: string }>(
    `SELECT id, item_id, collection_id, partner_id, language_id, context_id, ${VISIT_TEXT_COLUMNS.join(', ')}
       FROM visit_information
      WHERE item_id IN (${inList(members)}) OR partner_id IN (${inList(partnerIds)}) OR collection_id IN (${inList(treeIds)})
      ORDER BY item_id, partner_id, collection_id, language_id, context_id, id`,
    [...members, ...partnerIds, ...treeIds]
  )
  const visitOwner = (v: Row) => str(v['item_id'] ?? v['partner_id'] ?? v['collection_id'])
  const visitsByLanguage = new Map<string, Record<string, Row>>()
  for (const [owner, rows] of groupBy(visits, visitOwner)) {
    const ownerProject = itemById.get(owner)?.project_id ?? partnerById.get(owner)?.project_id ?? null
    for (const [language, v] of pickTexts(rows, contextOrderFor(ownerProject))) {
      bucket(visitsByLanguage, language)[owner] = compact({
        context_id: v.context_id,
        item_id: v['item_id'],
        partner_id: v['partner_id'],
        collection_id: v['collection_id'],
        ...pick(v, VISIT_TEXT_COLUMNS),
      })
    }
  }
  writeTexts('visit_information', visitsByLanguage)

  // --- R6: timelines of the tree --------------------------------------------------------
  const timelines = await query<Row & { id: string }>(
    `SELECT id, collection_id, country_id FROM timelines WHERE collection_id IN (${inList(treeIds)}) ORDER BY id`,
    treeIds
  )
  const timelineIds = timelines.map(t => t.id)
  const events = await query<Row & { id: string }>(
    `SELECT id, timeline_id, year_from, year_to, year_from_ah, year_to_ah, date_from, date_to, display_order
       FROM timeline_events WHERE timeline_id IN (${inList(timelineIds)}) ORDER BY timeline_id, display_order, id`,
    timelineIds
  )
  const eventIds = events.map(e => e.id)
  const eventItems = await query<{ timeline_event_id: string; item_id: string }>(
    `SELECT tei.timeline_event_id, tei.item_id FROM timeline_event_item tei JOIN items i ON i.id = tei.item_id
      WHERE tei.timeline_event_id IN (${inList(eventIds)}) AND ${itemShipped('i')}
      ORDER BY tei.timeline_event_id, tei.item_id`,
    eventIds
  )
  const eventTexts = await query<Row & { timeline_event_id: string; language_id: string }>(
    `SELECT timeline_event_id, language_id, name, description, date_from_description, date_to_description,
            date_from_ah_description FROM timeline_event_translations
      WHERE timeline_event_id IN (${inList(eventIds)}) ORDER BY timeline_event_id, language_id`,
    eventIds
  )
  const itemsByEvent = groupBy(eventItems, e => e.timeline_event_id)
  write('timelines.json', timelines.map(t => compact(t)))
  write(
    'timeline_events.json',
    events.map(e => compact({ ...e, item_ids: (itemsByEvent.get(e.id) ?? []).map(x => x.item_id) }))
  )
  const eventTextsByLanguage = new Map<string, Record<string, Row>>()
  for (const t of eventTexts) {
    bucket(eventTextsByLanguage, t.language_id)[t.timeline_event_id] = pick(t, [
      'name',
      'description',
      'date_from_description',
      'date_to_description',
      'date_from_ah_description',
    ])
  }
  writeTexts('timeline_events', eventTextsByLanguage)

  // --- R8: related pictures, in the site's context, between items that ship ---------------
  const itemLinks = await query<Row & { id: string }>(
    `SELECT id, source_id, target_id, context_id FROM item_item_links
      WHERE context_id = ? AND source_id IN (${inList(itemIds)}) AND target_id IN (${inList(itemIds)})
      ORDER BY source_id, target_id, id`,
    [siteContextId, ...itemIds, ...itemIds]
  )
  const itemLinkIds = itemLinks.map(l => l.id)
  const itemLinkTexts = await query<Row & { item_item_link_id: string; language_id: string }>(
    `SELECT item_item_link_id, language_id, description, reciprocal_description FROM item_item_link_translations
      WHERE item_item_link_id IN (${inList(itemLinkIds)}) ORDER BY item_item_link_id, language_id`,
    itemLinkIds
  )
  write('item_links.json', itemLinks)
  const itemLinkTextsByLanguage = new Map<string, Record<string, Row>>()
  for (const t of itemLinkTexts) {
    const entry = pick(t, ['description', 'reciprocal_description'])
    if (Object.keys(entry).length > 0) bucket(itemLinkTextsByLanguage, t.language_id)[t.item_item_link_id] = entry
  }
  writeTexts('item_links', itemLinkTextsByLanguage)

  // --- Reference data the records above name ------------------------------------------------
  const tagIds = [...new Set(tagLinks.map(l => l.tag_id))].sort()
  write(
    'tags.json',
    (await query<Row>(
      `SELECT id, internal_name, category, language_id, description FROM tags WHERE id IN (${inList(tagIds)}) ORDER BY id`,
      tagIds
    )).map(t => compact(t))
  )

  const dynastyIds = [...new Set(dynastyLinks.map(l => l.dynasty_id))].sort()
  write(
    'dynasties.json',
    (await query<Row>(
      `SELECT id, from_ah, to_ah, from_ad, to_ad FROM dynasties WHERE id IN (${inList(dynastyIds)}) ORDER BY id`,
      dynastyIds
    )).map(d => compact(d))
  )
  const dynastyTextsByLanguage = new Map<string, Record<string, Row>>()
  for (const t of await query<Row & { dynasty_id: string; language_id: string }>(
    `SELECT dynasty_id, language_id, name, also_known_as, area, history, date_description_ah, date_description_ad
       FROM dynasty_translations WHERE dynasty_id IN (${inList(dynastyIds)}) ORDER BY dynasty_id, language_id`,
    dynastyIds
  )) {
    bucket(dynastyTextsByLanguage, t.language_id)[t.dynasty_id] = pick(t, [
      'name',
      'also_known_as',
      'area',
      'history',
      'date_description_ah',
      'date_description_ad',
    ])
  }
  writeTexts('dynasties', dynastyTextsByLanguage)

  const artistIds = [...new Set(artistLinks.map(l => l.artist_id))].sort()
  write(
    'artists.json',
    (await query<Row>(
      `SELECT id, name, place_of_birth, place_of_death, date_of_birth, date_of_death, period_of_activity
         FROM artists WHERE id IN (${inList(artistIds)}) ORDER BY id`,
      artistIds
    )).map(a => compact(a))
  )

  const authorIds = [
    ...new Set([
      ...textAuthors.map(a => a.author_id),
      ...[...chosenTexts.values()].flatMap(m =>
        [...m.values()].flatMap(t =>
          ['author_id', 'text_copy_editor_id', 'translator_id', 'translation_copy_editor_id']
            .map(k => t[k])
            .filter((v): v is string => typeof v === 'string')
        )
      ),
    ]),
  ].sort()
  write(
    'authors.json',
    (await query<Row>(
      `SELECT id, name, firstname, lastname, givenname, originalname FROM authors WHERE id IN (${inList(authorIds)}) ORDER BY id`,
      authorIds
    )).map(a => compact(a))
  )

  // The glossary entries the shipped item texts link, with every spelling and definition.
  const spellingIds = [...new Set(textSpellings.map(s => s.spelling_id))].sort()
  const glossaryIds = (
    await query<{ glossary_id: string }>(
      `SELECT DISTINCT glossary_id FROM glossary_spellings WHERE id IN (${inList(spellingIds)}) ORDER BY glossary_id`,
      spellingIds
    )
  ).map(g => g.glossary_id)
  write(
    'glossary.json',
    (await query<Row>(`SELECT id, internal_name FROM glossaries WHERE id IN (${inList(glossaryIds)}) ORDER BY id`, glossaryIds)).map(
      g => compact(g)
    )
  )
  write(
    'glossary_spellings.json',
    await query<Row>(
      `SELECT id, glossary_id, language_id, spelling FROM glossary_spellings WHERE glossary_id IN (${inList(glossaryIds)})
        ORDER BY glossary_id, language_id, spelling, id`,
      glossaryIds
    )
  )
  const glossaryTextsByLanguage = new Map<string, Record<string, Row>>()
  for (const t of await query<Row & { glossary_id: string; language_id: string }>(
    `SELECT glossary_id, language_id, definition FROM glossary_translations WHERE glossary_id IN (${inList(glossaryIds)})
      ORDER BY glossary_id, language_id`,
    glossaryIds
  )) {
    bucket(glossaryTextsByLanguage, t.language_id)[t.glossary_id] = pick(t, ['definition'])
  }
  writeTexts('glossary', glossaryTextsByLanguage)

  // Projects of the shipped records, and their names.
  const allProjectIds = [...new Set([...projectIds, ...partnerProjectIds])].sort()
  const projectRows = await query<Row & { id: string }>(
    `SELECT id, internal_name, context_id, site_url, related_database_url, artistic_introduction_url
       FROM projects WHERE id IN (${inList(allProjectIds)}) ORDER BY id`,
    allProjectIds
  )
  write('projects.json', projectRows.map(p => compact(p)))
  const projectTextsByLanguage = new Map<string, Record<string, Row>>()
  for (const t of await query<Row & { project_id: string; language_id: string }>(
    `SELECT project_id, language_id, name FROM project_translations WHERE project_id IN (${inList(allProjectIds)})
      ORDER BY project_id, language_id`,
    allProjectIds
  )) {
    bucket(projectTextsByLanguage, t.language_id)[t.project_id] = pick(t, ['name'])
  }
  writeTexts('projects', projectTextsByLanguage)

  // Countries the records name.
  const countryIds = [
    ...new Set(
      [
        ...items.map(i => i['country_id']),
        ...partners.map(p => p['country_id']),
        ...tree.map(c => c['country_id']),
        ...timelines.map(t => t['country_id']),
      ].filter((id): id is string => typeof id === 'string')
    ),
  ].sort()
  write(
    'countries.json',
    (await query<Row>(`SELECT id, internal_name FROM countries WHERE id IN (${inList(countryIds)}) ORDER BY id`, countryIds)).map(c =>
      compact(c)
    )
  )
  const countryTextsByLanguage = new Map<string, Record<string, Row>>()
  for (const t of await query<Row & { country_id: string; language_id: string }>(
    `SELECT country_id, language_id, name FROM country_translations WHERE country_id IN (${inList(countryIds)})
      ORDER BY country_id, language_id`,
    countryIds
  )) {
    bucket(countryTextsByLanguage, t.language_id)[t.country_id] = pick(t, ['name'])
  }
  writeTexts('countries', countryTextsByLanguage)

  // The languages the texts are in.
  const languageIds = [
    ...new Set([...collectionTextsByLanguage.keys(), ...itemTextsByLanguage.keys(), ...placementTextsByLanguage.keys()]),
  ].sort()
  write(
    'languages.json',
    (await query<Row>(`SELECT id, internal_name, is_default FROM languages WHERE id IN (${inList(languageIds)}) ORDER BY id`, languageIds)).map(
      l => ({ ...l, is_default: Boolean(l['is_default']) })
    )
  )

  // --- The manifest ---------------------------------------------------------------------
  write('manifest.json', {
    format: FORMAT,
    format_version: FORMAT_VERSION,
    version: options.version,
    generated_at: new Date().toISOString(),
    site: { slug: instance.slug, name: instance.name, package_name: instance.package_name },
    root_collection_id: root.id,
    context_id: siteContextId,
    default_context_id: defaultContextId,
    default_language_id: defaultLanguage?.id ?? null,
    languages: languageIds,
    // The same static block every data package carries (see docs/LICENSE.md.template).
    rights: {
      rights_holder: 'Museum Ohne Grenzen e.V. (Museum With No Frontiers)',
      terms_url: 'https://www.museumwnf.org/about/legal-notice',
      attribution: 'Content © Museum With No Frontiers, used under the MWNF legal notice.',
    },
    counts: {
      collections: tree.length,
      placements: placements.length,
      members: members.length,
      items: items.length,
      partners: partners.length,
    },
  })

  // The guard every exporter runs: no draft item's id in any file written.
  await assertNoDraftItems(query as never, out)

  return {
    files,
    collections: tree.length,
    placements: placements.length,
    members: members.length,
    items: items.length,
    partners: partners.length,
    languages: languageIds,
  }
}

/** An item with no Project of its own takes its object's or monument's. */
function topProject(item: Row & { parent_id: string | null }, byId: Map<string, Row & { parent_id: string | null }>): string | null {
  let current: (Row & { parent_id: string | null }) | undefined = item
  for (let depth = 0; depth < 3 && current; depth++) {
    if (typeof current['project_id'] === 'string') return current['project_id']
    current = current.parent_id === null ? undefined : byId.get(current.parent_id)
  }
  return null
}

function bucket(map: Map<string, Record<string, Row>>, key: string): Record<string, Row> {
  let entry = map.get(key)
  if (!entry) {
    entry = {}
    map.set(key, entry)
  }
  return entry
}

function sortKeys<T>(record: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)))
}
