/**
 * The standalone sites' texts that legacy composes from its own tables, each
 * by the same rules as the PHP that prints it, named in the PHP's own terms so
 * a reader can hold the two side by side:
 * - `baroqueartSponsors`: Discover Baroque Art's local sponsors
 *   (atrium_sponsor_detail.php?id=BAR&flg=local, Sponsors::LoadSponsors), as
 *   the data file the site lists them from;
 * - `sharinghistoryAbout`: Sharing History's About text (Project::Load,
 *   `sh_project_names`);
 * - `sharinghistoryTeam`: its Team page (about_team.php: the categories of
 *   `sh_project_about_team_to_category`, each person's line by the page's own
 *   rules);
 * - `sharinghistorySponsors`: its sponsors' names and remarks (`sh_sponsors`).
 *
 * Legacy prints all of them in English only (`$LNGLIST = array("en")`), and
 * every query names English as the PHP's do.
 */
import type { MessageCatalogue } from './core/types.js'
import { entryValue, type StandaloneSite, type TableOutput } from './standalone.js'

/** The read access a builder needs: one SELECT at a time. */
export interface TableDatabase {
  select<T>(sql: string, params?: (string | number)[]): Promise<T[]>
}

export interface TableContext {
  db: TableDatabase
  site: StandaloneSite
  namespace: string
  warn: (message: string) => void
}

type Builder = (context: TableContext) => Promise<TableOutput>

const text = (value: string | null | undefined, site?: StandaloneSite) => entryValue(value ?? '', site)

// ── Discover Baroque Art: the local sponsors ────────────────────────────────

interface SponsorRow {
  sponsors_id: number
  remarks: string | null
  spname: string
  web: string | null
  path: string | null
  cname: string
  regionname: string | null
}

/** One row of Baroque Art's Sponsors page, in display order. */
export interface SponsorEntry {
  /** The country (or "ITALY/" and the region) heading the row, on a group's first row only; Markdown. */
  label: string
  /** The region line legacy prints above a non-Italian sponsor's name, when it has one. */
  region: string
  name: string
  /** The bare `web` value; legacy links it as `http://<web>`. */
  web: string
  /** Markdown; legacy prints it in italics. */
  remarks: string
  /** The logo's legacy path (`sponsors/34.jpg`), the site's file under `theme/assets/`. */
  logo: string
}

/**
 * atrium_sponsor_detail.php's local list: the countries in the order the
 * database answers `SELECT DISTINCT country_id`, each country's sponsors as
 * LoadSponsors reads them; Italy's grouped by region in order of first
 * appearance, under "ITALY/<br/>REGION"; every other country's under its name
 * in capitals. A heading is printed on a group's first row only.
 */
export function composeBaroqueSponsors(
  countries: { code: string; name: string; rows: SponsorRow[] }[]
): SponsorEntry[] {
  const entry = (row: SponsorRow, label: string, region: string): SponsorEntry => ({
    label: text(label),
    region: region ? text(region) : '',
    name: text(row.spname),
    web: (row.web ?? '').trim(),
    remarks: text(row.remarks),
    logo: (row.path ?? '').trim(),
  })
  const out: SponsorEntry[] = []
  for (const country of countries) {
    if (country.code === 'it') {
      const regions = [...new Set(country.rows.map((row) => row.regionname ?? ''))]
      for (const region of regions) {
        country.rows
          .filter((row) => (row.regionname ?? '') === region)
          .forEach((row, index) => out.push(entry(row, index === 0 ? `Italy/<br/>${region}`.toUpperCase() : '', '')))
      }
    } else {
      country.rows.forEach((row, index) =>
        out.push(entry(row, index === 0 ? country.name.toUpperCase() : '', row.regionname ?? ''))
      )
    }
  }
  return out
}

const baroqueartSponsors: Builder = async ({ db }) => {
  const project = 'BAR'
  const codes = await db.select<{ country_id: string }>(
    'SELECT DISTINCT country_id FROM mwnf3.sponsors WHERE virtual_project_id = ?',
    [project]
  )
  const countries = []
  for (const { country_id: code } of codes) {
    // The local page leaves the international sponsors ('ww') to the other one.
    if (code === 'ww') continue
    const [name] = await db.select<{ name: string }>(
      "SELECT name FROM mwnf3.countrynames WHERE country = ? AND country <> 'ww' AND lang = 'en' LIMIT 1",
      [code]
    )
    const rows = await db.select<SponsorRow>(
      `SELECT DISTINCT s.sponsors_id, s.remarks, s.name AS spname, s.web, s.path, c.name AS cname,
              (SELECT r.name FROM mwnf3.regionnames r WHERE r.region = s.region_id AND r.lang = 'en') AS regionname
         FROM mwnf3.sponsors s, mwnf3.countrynames c
        WHERE s.virtual_project_id = ? AND c.country = s.country_id AND s.country_id = ? AND c.lang = 'en'
        ORDER BY c.name`,
      [project, code]
    )
    if (name) countries.push({ code, name: name.name, rows })
  }
  return { files: { 'data/sponsors.json': composeBaroqueSponsors(countries) } }
}

// ── Sharing History: the About text ─────────────────────────────────────────

const sharinghistoryAbout: Builder = async ({ db, site, namespace }) => {
  const [project] = await db.select<{ title: string | null; about_text: string | null }>(
    "SELECT title, about_text FROM mwnf3_sharing_history.sh_project_names WHERE project_id = 'AWE' AND lang = 'en'"
  )
  if (!project) return {}
  return {
    entries: {
      en: {
        [`${namespace}.about.projectName`]: text(project.title, site),
        [`${namespace}.about.body`]: text(project.about_text, site),
      },
    },
  }
}

// ── Sharing History: the Team page ──────────────────────────────────────────

/** A person of the team, as `getAboutTeams` reads them. */
export interface TeamRow {
  country: string
  given_name: string | null
  family_name: string | null
  position: string | null
  Institution: string | null
  city: string | null
}

/** Each category's entry, by legacy's `cat_id`. */
export const TEAM_CATEGORY_KEYS: Record<number, string> = {
  1: 'curatorialCommittee',
  2: 'projectTeam',
  3: 'webTeam',
  4: 'translations',
  5: 'localTeams',
  6: 'idea',
  7: 'historicalBackground',
}

const filled = (value: string | null | undefined) => typeof value === 'string' && value !== ''

/**
 * One person's line in a category other than the local teams, by
 * about_team.php's rules: the country first in the curatorial committee; the
 * city after the name in translations, after the institution elsewhere; the
 * position after the country in the web team, after the name elsewhere; a
 * comma before the institution except Preigo Fover Technologies'.
 */
export function teamLine(category: string, person: TeamRow, countries: Record<string, string>): string {
  let line = ''
  if (category === 'International Curatorial Committee' && filled(person.country)) {
    line += `<b>${countries[person.country] ?? ''}</b> | `
  }
  if (filled(person.given_name)) line += ` ${person.given_name}`
  if (filled(person.family_name)) line += ` ${person.family_name}`
  if (category === 'Translations and Editing' && filled(person.city)) line += `, ${person.city}`
  if (category !== 'MWNF Web Team' && filled(person.position)) line += ` ${person.position}`
  if (filled(person.Institution)) {
    if (person.Institution !== 'Preigo Fover Technologies') line += ','
    line += ` ${person.Institution}`
  }
  if (category !== 'Translations and Editing' && filled(person.city)) line += `, ${person.city}`
  if (category === 'MWNF Web Team' && filled(person.country)) line += `, ${countries[person.country] ?? ''}`
  if (category === 'MWNF Web Team' && filled(person.position)) line += ` ${person.position}`
  return line
}

/** One person's line in a local team: name, institution, city, position. */
export function localTeamLine(person: TeamRow): string {
  let line = ''
  if (filled(person.given_name)) line += ` ${person.given_name}`
  if (filled(person.family_name)) line += ` ${person.family_name}`
  if (filled(person.Institution)) line += `, ${person.Institution}`
  if (filled(person.city)) line += `, ${person.city}`
  if (filled(person.position)) line += ` ${person.position}`
  return line
}

/** A country's name as an entry segment: "United Kingdom" → unitedKingdom, "Türkiye" → turkiye. */
export function countryKey(name: string): string {
  const words = name.normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^A-Za-z0-9]+/).filter(Boolean)
  return words.map((word, index) => (index === 0 ? word.toLowerCase() : word[0]!.toUpperCase() + word.slice(1).toLowerCase())).join('')
}

/** A Markdown body: one paragraph per line. */
const paragraphs = (lines: string[]) => lines.map((line) => text(line.trim())).filter(Boolean).join('\n\n')

const sharinghistoryTeam: Builder = async ({ db, namespace, warn }) => {
  const db1 = 'mwnf3_sharing_history'
  const countries: Record<string, string> = {}
  for (const row of await db.select<{ country: string; name: string }>(
    "SELECT country, name FROM mwnf3.countrynames WHERE lang = 'en'"
  )) {
    countries[row.country] = row.name
  }
  const links = await db.select<{ cat_id: number }>(
    `SELECT c.cat_id FROM ${db1}.sh_project_about_team_to_category c WHERE c.project_id = 'AWE' ORDER BY c.sort_order ASC`
  )
  const categories = [...new Set(links.map((link) => link.cat_id))]
  const entries: Record<string, string> = {}
  for (const catId of categories) {
    const [category] = await db.select<{ cat_name: string }>(
      `SELECT cn.cat_name FROM ${db1}.sh_project_about_team_category c, ${db1}.sh_project_about_team_category_texts cn
        WHERE c.cat_id = ? AND cn.cat_id = c.cat_id AND cn.lang = 'en'`,
      [catId]
    )
    const name = category?.cat_name ?? ''
    const key = TEAM_CATEGORY_KEYS[catId] ?? `category${catId}`
    if (!(catId in TEAM_CATEGORY_KEYS)) warn(`team category ${catId} ("${name}") has no entry name: written as ${key}`)
    entries[`${namespace}.team.${key}.title`] = text(name)
    const local = name === 'Local Project Teams (other collaborations)'
    const people = await db.select<TeamRow>(
      `SELECT c.country, cn.given_name, cn.family_name, cn.position, cn.Institution, cn.city
         FROM ${db1}.sh_project_about_team c, ${db1}.sh_project_about_team_texts cn, ${db1}.sh_project_about_team_to_category ct
        WHERE c.project_id = 'AWE' AND ct.cat_id = ? AND ct.team_id = c.team_id AND cn.team_id = c.team_id AND cn.lang = 'en'
        ORDER BY ${local ? 'c.country, cn.family_name ASC' : 'c.sort_order, c.country ASC'}`,
      [catId]
    )
    if (!local) {
      entries[`${namespace}.team.${key}.body`] = paragraphs(people.map((person) => teamLine(name, person, countries)))
      continue
    }
    // The local teams: one accordion section per country, in the order the
    // query answers them.
    const byCountry = new Map<string, TeamRow[]>()
    for (const person of people) byCountry.set(person.country, [...(byCountry.get(person.country) ?? []), person])
    for (const [code, members] of byCountry) {
      const country = countries[code] ?? code
      entries[`${namespace}.team.local.${countryKey(country)}.title`] = text(country)
      entries[`${namespace}.team.local.${countryKey(country)}.body`] = paragraphs(members.map(localTeamLine))
    }
  }
  return { entries: { en: entries } }
}

// ── Sharing History: the sponsors ───────────────────────────────────────────

const sharinghistorySponsors: Builder = async ({ db, site, namespace }) => {
  const rows = await db.select<{ sponsors_id: number; name: string; remarks: string | null }>(
    "SELECT sponsors_id, name, remarks FROM mwnf3_sharing_history.sh_sponsors WHERE project_id = 'AWE' ORDER BY sponsors_id"
  )
  const entries: Record<string, string> = {}
  for (const row of rows) {
    entries[`${namespace}.sponsors.s${row.sponsors_id}.name`] = text(row.name, site)
    const remarks = text(row.remarks, site)
    if (remarks) entries[`${namespace}.sponsors.s${row.sponsors_id}.remarks`] = remarks
  }
  return { entries: { en: entries } }
}

export const STANDALONE_TABLES: Record<string, Builder> = {
  baroqueartSponsors,
  sharinghistoryAbout,
  sharinghistoryTeam,
  sharinghistorySponsors,
}

/** Runs a site's table builders, merging their entries and files. */
export async function runTables(context: TableContext): Promise<{ entries: MessageCatalogue; files: Record<string, unknown> }> {
  const entries: MessageCatalogue = {}
  const files: Record<string, unknown> = {}
  for (const name of context.site.tables ?? []) {
    const builder = STANDALONE_TABLES[name]
    if (!builder) throw new Error(`Unknown table builder "${name}"`)
    const output = await builder(context)
    for (const [language, messages] of Object.entries(output.entries ?? {})) {
      Object.assign((entries[language] ??= {}), messages)
    }
    Object.assign(files, output.files ?? {})
  }
  return { entries, files }
}
