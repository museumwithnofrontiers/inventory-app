#!/usr/bin/env node
/**
 * What a Discover Islamic Art or Discover Baroque Art virtual exhibition
 * configured for itself alone, written into a copy of minisite-template and
 * into this repository's exporter instances.
 *
 * Every exhibition of a family ran on the same pages (exhibitions/ISL/ or
 * exhibitions/BAR/generic_*.php); what set one apart is its folder:
 * libs/config.inc.php (which exhibition it is, the curators its home page
 * credits, HOMELOGOS, and for Baroque Art who designed it), index.php (where
 * the home menu's second column starts), its stylesheets and its pictures, and
 * the family's libs/config.inc.php (whether its introduction has a map).
 * Discover Islamic Art's Artistic Introduction (gai/ISL/) is read the same way,
 * for what it set: its home menu, its stylesheet, its pictures and the
 * social-media links its home page wrote out. This reads them and writes:
 *
 *   <site>/src/minisite.json          the exhibition's settings
 *   <site>/theme/tokens.css           its stylesheet's values (legacy-theme.mjs)
 *   <site>/theme/assets/legacy/       the frame's pictures, each byte for byte
 *                                     the file legacy serves, and SOURCES.json
 *   <site>/README.md                  the site's own README
 *   <instances>/<slug>.json           the exporter instance of its data package
 *
 * The ids are the importer's own: a record's id is the UUIDv5 of its
 * backward_compatibility (scripts/importer/src/utils/deterministic-uuid.ts),
 * so the exhibition's collection and each curator's partner are named here
 * without a database.
 *
 * Usage (Docker, no Node on the host; it reads the legacy pictures over HTTPS):
 *   node scripts/minisites/legacy-minisite.mjs <legacy exhibition folder> --name "<English title>" \
 *     [--site <minisite repository>] [--instances scripts/exporters/instances]
 * e.g. .legacy-code/islamicart/www.discoverislamicart.org/exhibitions/ISL/the_abbasids --name "The Abbasids"
 *      .legacy-code/baroqueart/www.discoverbaroqueart.org/exhibitions/BAR/absolutism --name "Absolutism"
 *      .legacy-code/islamicart/www.discoverislamicart.org/gai/ISL --name "Artistic Introduction"
 */
import { createHash } from 'node:crypto'
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { themeCss } from './legacy-theme.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '../..')

// The families, by the folder their exhibitions sit in: where legacy serves
// them, the site that carried them, and its name; the viewer-i18n class its
// mini-sites read (each family has a label set of its own) and the window
// title legacy's pages opened with (ve_isl_windowstitle, ve_bar_windowstitle).
export const FAMILIES = {
  ISL: {
    exhibitions: 'https://islamicart.museumwnf.org/exhibitions/ISL',
    parent: 'islamicart',
    site: 'Discover Islamic Art',
    labels: 'minisite',
    windowTitle: 'Discover Islamic Art Virtual Exhibitions',
  },
  BAR: {
    exhibitions: 'https://baroqueart.museumwnf.org/exhibitions/BAR',
    parent: 'baroqueart',
    site: 'Discover Baroque Art',
    labels: 'minisiteBaroque',
    windowTitle: 'Discover Baroque Art Virtual Museum',
  },
  // Discover Islamic Art's Artistic Introduction (gai/ISL/): one site, in the
  // exhibitions' frame, on pages of its own (artintro()).
  GAI: {
    exhibitions: 'https://islamicart.museumwnf.org/gai',
    parent: 'islamicart',
    site: 'Discover Islamic Art',
    labels: 'minisiteArtIntro',
    windowTitle: 'Discover Islamic Art',
  },
}

// The folder each family's sites sit in, when it is not the family's own name.
const FAMILY_FOLDERS = { gai: 'GAI' }

/**
 * A site's package.json, index.html and src/texts.js, with its family's
 * viewer-i18n class, window title and label bundle: minisite-template's are
 * Discover Islamic Art's.
 */
export function familyFiles({ packageJson, indexHtml }, family) {
  const pkg = JSON.parse(packageJson)
  pkg.viewerI18n = { ...pkg.viewerI18n, class: family.labels }
  return {
    packageJson: `${JSON.stringify(pkg, null, 2)}\n`,
    indexHtml: indexHtml.replace(/<title>[^|<]*\|/, `<title>${family.windowTitle} |`),
    texts:
      `// The label set this website reads from viewer-i18n: ${family.site}'s own,\n` +
      `// written by inventory-app's scripts/minisites/legacy-minisite.mjs.\n` +
      `export { catalogues } from '@museumwnf/viewer-i18n/${family.labels}'\n`,
  }
}

/** The family of a legacy exhibition folder: the folder it sits in. */
export function familyOf(folder) {
  const parentFolder = basename(dirname(resolve(folder)))
  const key = FAMILY_FOLDERS[parentFolder] ?? parentFolder
  const family = FAMILIES[key]
  if (!family) throw new Error(`${folder} is in no known family (exhibitions/ISL/, exhibitions/BAR/ or gai/).`)
  return { key, ...family }
}

// scripts/importer/src/utils/deterministic-uuid.ts: frozen, like the ids it makes.
const IMPORTER_UUID_NAMESPACE = 'bc112041-0784-4475-80b2-0c96425ac5ea'

// The pictures the shared pages draw from an exhibition's images/ folder: the
// frame (strips, logos per language, icons) and the backgrounds of the home
// page, the introduction and the exhibition pages, each with its Arabic mirror.
const LANGUAGES = ['ar', 'de', 'en', 'es', 'fr', 'it', 'pt', 'se', 'tr']
const FRAME = [
  'arrow_inner_black.gif', 'bg_fading_left.gif', 'bg_fading_right.gif', 'ico_item.gif', 'ico_item_selected.gif',
  'print_dark.gif', 'home_bg.jpg', 'home_bg_ar.jpg', 'intro_bg.jpg', 'intro_bg_ar.jpg', 'exhibition_bg.jpg',
  'exhibition_bg_ar.jpg', ...LANGUAGES.map((lang) => `logo_${lang}.gif`),
]

/** RFC 4122 UUIDv5, as the `uuid` package's v5() computes it. */
export function deterministicUuid(name) {
  const namespace = Buffer.from(IMPORTER_UUID_NAMESPACE.replace(/-/g, ''), 'hex')
  const hash = createHash('sha1').update(Buffer.concat([namespace, Buffer.from(name, 'utf8')])).digest()
  hash[6] = (hash[6] & 0x0f) | 0x50
  hash[8] = (hash[8] & 0x3f) | 0x80
  const hex = hash.subarray(0, 16).toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** PHP source without its comments, so a commented-out assignment is not read. */
export function stripPhpComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*(#|\/\/).*$/gm, '')
}

/** The exhibition the folder's pages load: the last `$_SESSION["exhibition"] = N;`. */
export function exhibitionId(config) {
  const ids = [...stripPhpComments(config).matchAll(/\$_SESSION\["exhibition"\]\s*=\s*(\d+)\s*;/g)].map((m) => m[1])
  if (!ids.length) throw new Error('libs/config.inc.php names no exhibition ($_SESSION["exhibition"] = N;).')
  return ids.at(-1)
}

/** The legacy two-letter country codes the importer maps (scripts/importer/src/utils/code-mappings.ts). */
export function countryCodes(source) {
  const block = source.match(/COUNTRY_CODE_MAP[^{]*\{([\s\S]*?)\n\}/)
  if (!block) throw new Error('COUNTRY_CODE_MAP not found in code-mappings.ts.')
  return Object.fromEntries([...block[1].matchAll(/^\s*'?([a-z]{2})'?\s*:\s*'([a-z]{3})'/gm)].map((m) => [m[1], m[2]]))
}

/**
 * HOMELOGOS, the curators the home page credits, in legacy's order: a partner
 * (getMuseumName("Mus01;tn") or getInstitutionName("Mon11;hu"), its page on
 * the parent site; with Baroque Art, the city and country printed after its
 * name), or a name and a country legacy wrote out, with the link legacy gave
 * it ("" or "#"); each with its logo and the space after it.
 */
export function curators(config, countries) {
  const source = stripPhpComments(config)
  const start = source.indexOf('$HOMELOGOS')
  if (start < 0) throw new Error('libs/config.inc.php has no $HOMELOGOS.')
  const entries = source.slice(start).split(/array\s*\(/).slice(2)
  return entries.map((entry) => {
    const field = (key) => entry.match(new RegExp(`"${key}"\\s*=>\\s*([^\\n]*?),?\\s*$`, 'm'))?.[1]?.trim() ?? ''
    const image = field('image').match(/sponsor_logo\/([^"]+)"/)?.[1]
    if (!image) throw new Error(`A HOMELOGOS entry has no sponsor_logo image: ${entry.trim().slice(0, 120)}`)
    const space = Number(field('rightmargin').replace(/"/g, '')) || 0
    const logo = `legacy/${image}`
    const partner = field('name').match(/get(Museum|Institution)Name\("([^";]+);([a-z]{2})"/)
    if (partner) {
      const table = partner[1] === 'Museum' ? 'museums' : 'institutions'
      const id = deterministicUuid(`partner:mwnf3:${table}:${partner[2]}:${partner[3]}`.toLowerCase())
      // Baroque Art printed the partner's name followed by a city legacy wrote
      // out and the country: `getMuseumName(…).", Brno, ".$NAVLNGCOUNTRIES['cz']`.
      const at = field('name').match(/\.\s*"\s*,\s*([^",]+?)\s*,\s*"\s*\.\s*\$NAVLNGCOUNTRIES\['([a-z]{2})'\]/)
      if (at && !countries[at[2]]) throw new Error(`No ISO code for legacy country "${at[2]}" (${partner[2]}).`)
      return { partner: id, ...(at ? { place: at[1], country: countries[at[2]] } : {}), logo, space }
    }
    const name = [...field('name').matchAll(/"([^"]*)"/g)].map((m) => m[1]).join('').replace(/,\s*$/, '').trim()
    const country = field('name').match(/\$NAVLNGCOUNTRIES\['([a-z]{2})'\]/)?.[1]
    if (country && !countries[country]) throw new Error(`No ISO code for legacy country "${country}" (${name}).`)
    const href = [...field('link').matchAll(/"([^"]*)"/g)].map((m) => m[1]).join('')
    return { name, ...(country ? { country: countries[country] } : {}), href, logo, space }
  })
}

/**
 * Who designed the exhibition, as a Baroque Art home page credits it beside
 * the curators: $designBy, its logo in the shared sponsor_logo folder and
 * $designUrl. Null for an exhibition that names no designer (every ISL one).
 */
export function design(config) {
  const source = stripPhpComments(config)
  const value = (name) => source.match(new RegExp(`\\$${name}\\s*=\\s*'([^']*)'\\s*;`))?.[1]?.trim() ?? ''
  const name = value('designBy')
  if (!name) return null
  const image = value('designLogo').match(/sponsor_logo\/(.+)$/)?.[1]
  if (!image) throw new Error(`$designLogo is not in sponsor_logo: ${value('designLogo')}`)
  return { name, logo: `legacy/${image}`, href: value('designUrl') }
}

/**
 * Discover Baroque Art's home picture: the stylesheet's #banner draws the
 * folder's images/banner.png against the footer. None where the stylesheet
 * draws none, or names a file the folder lacks (legacy showed nothing).
 */
export function banner(styles, images) {
  const rule = styles.replace(/\/\*[\s\S]*?\*\//g, '').match(/#banner\s*\{([^}]*)\}/)?.[1] ?? ''
  return /url\(\s*['"]?images\/banner\.png['"]?\s*\)/.test(rule) && images.includes('banner.png') ? 'legacy/banner.png' : null
}

/** $_HOME_MENU_COL2 from the folder's index.php; legacy's pages fell back to one column without it. */
export function menuSecondColumnFrom(index) {
  const value = stripPhpComments(index).match(/\$_HOME_MENU_COL2\s*=\s*(\d+)\s*;/)?.[1]
  return value ? Number(value) : null
}

/** How many maps the introduction opens: none unless the family's libs/config.inc.php lists the exhibition. */
export function mapCount(islConfig, id, images) {
  const listed = stripPhpComments(islConfig).match(/\$INTROPAGE_HAVEMAP\s*=\s*array\(([^)]*)\)/)?.[1] ?? ''
  if (![...listed.matchAll(/"(\d+)"/g)].some((m) => m[1] === id)) return 0
  let count = 1
  while (images.includes(`map${count + 1}_en.jpg`)) count++
  return count
}

async function download(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
  return Buffer.from(await response.arrayBuffer())
}

function option(args, name) {
  const at = args.indexOf(name)
  return at >= 0 ? args[at + 1] : undefined
}

async function main(args) {
  const folder = args[0]
  const name = option(args, '--name')
  if (!folder || !name) {
    console.error('usage: node legacy-minisite.mjs <legacy exhibition folder> --name "<English title>" [--site <dir>] [--instances <dir>]')
    process.exit(64)
  }
  const family = familyOf(folder)
  if (family.key === 'GAI') return artintro(folder, name, args, family)
  const legacyFolder = basename(resolve(folder))
  const slug = `${family.parent}-${legacyFolder.replace(/_/g, '-')}`
  const legacyUrl = `${family.exhibitions}/${legacyFolder}/`
  const read = (file) => readFileSync(join(folder, file), 'utf8')

  const config = read('libs/config.inc.php')
  const id = exhibitionId(config)
  const countries = countryCodes(readFileSync(join(REPO, 'scripts/importer/src/utils/code-mappings.ts'), 'utf8'))
  const credited = curators(config, countries)
  const designer = design(config)
  const images = readdirSync(join(folder, 'images'))
  const maps = mapCount(readFileSync(join(folder, '../libs/config.inc.php'), 'utf8'), id, images)
  const homePicture = banner(read('_styles.css'), images)
  const settings = {
    legacy: legacyUrl,
    family: family.key,
    menuSecondColumnFrom: menuSecondColumnFrom(read('index.php')),
    curators: credited,
    ...(designer ? { design: designer } : {}),
    ...(homePicture ? { banner: homePicture } : {}),
    maps,
  }

  const instance = {
    kind: 'minisite',
    slug,
    name,
    exporter: family.parent,
    parent: family.parent,
    collection_id: deterministicUuid(`collection:mwnf3:exhibitions:${id}`),
    partner_ids: credited.filter((c) => c.partner).map((c) => c.partner),
    package_name: `@museumwnf/${slug}-data`,
    legacy_url: legacyUrl,
  }
  const instances = resolve(option(args, '--instances') ?? join(REPO, 'scripts/exporters/instances'))
  writeFileSync(join(instances, `${slug}.json`), `${JSON.stringify(instance, null, 2)}\n`)
  console.log(`instance  ${join(instances, `${slug}.json`)} (exhibition ${id})`)

  const site = option(args, '--site')
  if (!site) return
  writeFileSync(join(site, 'src/minisite.json'), `${JSON.stringify(settings, null, 2)}\n`)
  writeFileSync(join(site, 'theme/tokens.css'), themeCss(folder, name))
  const own = familyFiles(
    { packageJson: readFileSync(join(site, 'package.json'), 'utf8'), indexHtml: readFileSync(join(site, 'index.html'), 'utf8') },
    family,
  )
  writeFileSync(join(site, 'package.json'), own.packageJson)
  writeFileSync(join(site, 'index.html'), own.indexHtml)
  writeFileSync(join(site, 'src/texts.js'), own.texts)

  // The frame's pictures, the maps, and the curators' (and the designer's)
  // logos from the exhibitions' shared sponsor_logo folder; legacy's copy, not
  // the repository's.
  const pictures = [...FRAME, ...(homePicture ? ['banner.png'] : [])]
  if (maps) {
    pictures.push('intro_map_thumb.jpg')
    for (let n = 1; n <= maps; n++) {
      for (const lang of LANGUAGES) {
        const file = n === 1 ? `map_${lang}.jpg` : `map${n}_${lang}.jpg`
        if (images.includes(file)) pictures.push(file)
      }
    }
  }
  const missing = pictures.filter((file) => !images.includes(file))
  if (missing.length) throw new Error(`${legacyFolder}/images lacks ${missing.join(', ')}.`)

  const assets = join(site, 'theme/assets/legacy')
  rmSync(assets, { recursive: true, force: true })
  mkdirSync(assets, { recursive: true })
  const files = {}
  const sources = [
    ...pictures.map((file) => [file, `${legacyUrl}images/${file}`]),
    ...[...credited, ...(designer ? [designer] : [])].map((c) => [
      basename(c.logo),
      `${family.exhibitions}/sponsor_logo/${basename(c.logo)}`,
    ]),
  ].sort(([a], [b]) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
  for (const [file, url] of sources) {
    const bytes = await download(url)
    writeFileSync(join(assets, file), bytes)
    files[`theme/assets/legacy/${file}`] = { source: url, sha256: createHash('sha256').update(bytes).digest('hex') }
  }
  const noSwedishMap = maps && !images.includes('map_se.jpg')
  const about =
    `The frame this website takes from legacy ${family.site}'s virtual exhibition ${name} ` +
    `(exhibitions/${family.key}/${legacyFolder}/), each file as legacy serves it, byte for byte; the ` +
    `${designer ? "curators' and the designer's" : "curators'"} logos come ` +
    `from the exhibitions' shared sponsor_logo folder. tests/assets.test.js checks every file against its hash.` +
    (noSwedishMap ? ' Legacy drew no Swedish map (map_se.jpg): the map window shows none in Swedish.' : '')
  writeFileSync(join(assets, 'SOURCES.json'), `${JSON.stringify({ about, files }, null, 2)}\n`)
  writeFileSync(join(site, 'README.md'), siteReadme({ slug, name, legacyFolder, family }))
  console.log(`site      ${resolve(site)}: minisite.json, tokens.css, ${sources.length} pictures, package.json, index.html, texts.js, README.md`)
}

// The pictures the Artistic Introduction's pages draw from gai/ISL/images/:
// the frame (strips, logos in its languages, the view icons), the home page's
// picture with its Arabic mirror and the bar over each page.
const ARTINTRO_LANGUAGES = ['ar', 'en', 'es', 'fr']
const ARTINTRO_FRAME = [
  'bg_fading_left.gif', 'bg_fading_right.gif', 'ico_item.gif', 'ico_item_selected.gif', 'home_bg.jpg',
  'home_bg_ar.jpg', 'page_block1_bg.gif', ...ARTINTRO_LANGUAGES.map((lang) => `logo_${lang}.gif`),
]

/** The introduction the folder's pages load: the last `$_SESSION["artintro"] = N;`. */
export function artintroId(config) {
  const ids = [...stripPhpComments(config).matchAll(/\$_SESSION\["artintro"\]\s*=\s*(\d+)\s*;/g)].map((m) => m[1])
  if (!ids.length) throw new Error('libs/config.inc.php names no introduction ($_SESSION["artintro"] = N;).')
  return ids.at(-1)
}

/**
 * The home page's links to MWNF's social media (generic_index.php's
 * #social-media, outside its comments): each link's address and its icon,
 * the SVG legacy wrote into the page, as a file of its own. `aspect` is the
 * icon's width over its height, from its viewBox.
 */
export function socialLinks(index) {
  const page = index.replace(/<!--[\s\S]*?-->/g, '')
  const block = page.match(/<div id="social-media">([\s\S]*?)<\/div>/)?.[1]
  if (!block) throw new Error('generic_index.php has no #social-media.')
  return [...block.matchAll(/<a href="([^"]+)"[^>]*>\s*(<svg[\s\S]*?<\/svg>)\s*<\/a>/g)].map(([, href, svg]) => {
    const name = svg.match(/data-icon="([^"]+)"/)?.[1]
    const box = svg.match(/viewBox="0 0 (\d+) (\d+)"/)
    if (!name || !box) throw new Error(`A social-media icon has no data-icon or viewBox: ${href}`)
    return { href: href.replace(/&amp;/g, '&'), name, svg, aspect: Math.round((Number(box[1]) / Number(box[2])) * 1000) / 1000 }
  })
}

/**
 * Discover Islamic Art's Artistic Introduction (gai/ISL/): one site, whose
 * folder holds neither curators nor maps. Its settings are the home menu's
 * second column — its libs/config.inc.php, read after index.php, sets the one
 * the pages use — and the links to MWNF's social media its home page wrote
 * out; its stylesheet is gai/ISL/_styles.css, then the site-wide
 * font-awesome.css the pages loaded after it.
 */
async function artintro(folder, name, args, family) {
  const slug = `${family.parent}-artistic-introduction`
  const legacyUrl = `${family.exhibitions}/${basename(resolve(folder))}/`
  const read = (file) => readFileSync(join(folder, file), 'utf8')
  const config = read('libs/config.inc.php')
  const id = artintroId(config)
  const social = socialLinks(readFileSync(join(folder, '../generic_index.php'), 'utf8'))
  const settings = {
    legacy: legacyUrl,
    family: family.key,
    menuSecondColumnFrom: menuSecondColumnFrom(config) ?? menuSecondColumnFrom(read('index.php')),
    social: social.map((link) => ({ href: link.href, icon: `legacy/social/${link.name}.svg`, aspect: link.aspect })),
  }

  const instance = {
    kind: 'minisite',
    slug,
    name,
    exporter: family.parent,
    parent: family.parent,
    collection_id: deterministicUuid(`collection:mwnf3:artintros:${id}`),
    partner_ids: [],
    package_name: `@museumwnf/${slug}-data`,
    legacy_url: legacyUrl,
  }
  const instances = resolve(option(args, '--instances') ?? join(REPO, 'scripts/exporters/instances'))
  writeFileSync(join(instances, `${slug}.json`), `${JSON.stringify(instance, null, 2)}\n`)
  console.log(`instance  ${join(instances, `${slug}.json`)} (introduction ${id})`)

  const site = option(args, '--site')
  if (!site) return
  writeFileSync(join(site, 'src/minisite.json'), `${JSON.stringify(settings, null, 2)}\n`)
  writeFileSync(join(site, 'theme/tokens.css'), themeCss(folder, name, { after: ['../../css/font-awesome.css'], artintro: true }))
  const own = familyFiles(
    { packageJson: readFileSync(join(site, 'package.json'), 'utf8'), indexHtml: readFileSync(join(site, 'index.html'), 'utf8') },
    family,
  )
  writeFileSync(join(site, 'package.json'), own.packageJson)
  writeFileSync(join(site, 'index.html'), own.indexHtml)
  writeFileSync(join(site, 'src/texts.js'), own.texts)

  const images = readdirSync(join(folder, 'images'))
  const missing = ARTINTRO_FRAME.filter((file) => !images.includes(file))
  if (missing.length) throw new Error(`${folder}/images lacks ${missing.join(', ')}.`)
  const assets = join(site, 'theme/assets/legacy')
  rmSync(assets, { recursive: true, force: true })
  mkdirSync(join(assets, 'social'), { recursive: true })
  const files = {}
  for (const file of ARTINTRO_FRAME) {
    const url = `${legacyUrl}images/${file}`
    const bytes = await download(url)
    writeFileSync(join(assets, file), bytes)
    files[`theme/assets/legacy/${file}`] = { source: url, sha256: createHash('sha256').update(bytes).digest('hex') }
  }
  for (const link of social) {
    // A file of its own needs the namespace a page's inline SVG may leave out.
    const svg = /^<svg[^>]* xmlns=/.test(link.svg) ? link.svg : link.svg.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"')
    const bytes = Buffer.from(svg)
    writeFileSync(join(assets, 'social', `${link.name}.svg`), bytes)
    files[`theme/assets/legacy/social/${link.name}.svg`] = {
      source: `${legacyUrl} (gai/generic_index.php, #social-media)`,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    }
  }
  const about =
    `The frame this website takes from legacy ${family.site}'s Artistic Introduction (gai/ISL/), each ` +
    `picture as legacy serves it, byte for byte; the social-media icons are the SVGs its home page wrote ` +
    `into its markup (gai/generic_index.php), each in a file of its own. tests/assets.test.js checks every ` +
    `file against its hash.`
  writeFileSync(join(assets, 'SOURCES.json'), `${JSON.stringify({ about, files }, null, 2)}\n`)
  writeFileSync(join(site, 'README.md'), artintroReadme({ slug, name, family }))
  console.log(`site      ${resolve(site)}: minisite.json, tokens.css, ${Object.keys(files).length} pictures, package.json, index.html, texts.js, README.md`)
}

/** The Artistic Introduction's own README: what it is, and how each role works on it. */
export function artintroReadme({ slug, name, family }) {
  return `# ${slug}

**${name}**, ${family.site}'s introduction to the art and architecture of
each Islamic dynasty of the Mediterranean, as a website of its own. On legacy
it lived inside ${family.site} (\`${family.exhibitions.replace(/^https:\/\//, '')}/ISL/\`);
here it is a product in its own right, and ${family.site} links to it.

It shows what legacy showed, the way legacy showed it: the home page, each
theme's pages (Monuments, Objects) and the zoom window. Nothing on it is
written for it: every record comes from the data package, every text from
viewer-i18n or \`locales/\`.

Its pages are the Artistic Introduction's, in the frame of ${family.site}'s
virtual exhibitions, from
[\`minisite-template\`](https://github.com/museumwithnofrontiers/minisite-template)
and the mini-site family layer (\`@museumwnf/viewer-layout/minisite\`). What
is this site's own is written from its legacy folder by inventory-app's
\`scripts/minisites/legacy-minisite.mjs\`.

| Package | Role |
| --- | --- |
| \`@museumwnf/${slug}-data\` | the introduction: its collection, its themes and pages, the items they place |
| \`@museumwnf/viewer-core\` | application engine (routing, data access, texts, language) |
| \`@museumwnf/viewer-layout\` | the pages and frame (\`./minisite\`) |
| \`@museumwnf/viewer-i18n\` | the texts the Artistic Introduction shows (\`./${family.labels}\`) |

---

## Translator — editing the website's texts

The texts the pages show — the header, the panel's tooltips, the footer — are
in [\`viewer-i18n\`](https://github.com/museumwithnofrontiers/viewer-i18n)'s
\`${family.labels}/\` folder, and are edited there. The introduction's own
texts — its titles, quotes, essays and captions — arrive translated in the
data package and are not edited anywhere. \`locales/\` holds this website's
own texts, one file per language; it starts empty, and an entry written there
overrides the shared one of the same name for this website alone. See
\`minisite-template\`'s README, "Translator", for the steps in the browser.

---

## Webdesigner — theming the website

The website's look is legacy's, kept as it was:

- \`theme/tokens.css\` — every value legacy's \`gai/ISL/_styles.css\` set (then
  the site's \`font-awesome.css\`, and \`_styles_ar.css\` for Arabic), as
  \`--minisite-*\` tokens;
- \`theme/assets/legacy/\` — legacy's own pictures of the frame and the
  social-media icons; \`SOURCES.json\` names where each file was taken from
  and its hash, and \`tests/assets.test.js\` checks every file against it;
- \`theme/overrides.css\` — the escape hatch, empty until a need cannot be
  expressed with a token.

A change to the pages' layout itself is a request for
[\`viewer-layout\`](https://github.com/museumwithnofrontiers/viewer-layout)'s
\`./minisite\`. To preview, run \`docker compose up\` and open
**http://localhost:5173**.

---

## Developer notes

- \`src/dataset.config.js\` is the whole declaration and needs no edit;
  \`src/minisite.json\` holds what legacy configured for this site alone (its
  address, the home menu's second column, the social-media links).
- Every caption legacy prints is in its pages' \`pageItems\` script, all views
  included; a page here can be compared field by field with the page there,
  in every language.

\`\`\`bash
docker run --rm -v "\${PWD}:/app" -w /app node:24-alpine sh -c "npm ci && npm test && npm run lint && npm run build"
\`\`\`

## Licence

See [LICENSE.md](LICENSE.md).
`
}

/** The mini-site's own README: what it is, and how each role works on it. */
export function siteReadme({ slug, name, legacyFolder, family = { key: 'ISL', ...FAMILIES.ISL } }) {
  const legacyAddress = `${family.exhibitions.replace(/^https:\/\//, '')}/${legacyFolder}/`
  return `# ${slug}

**${name}**, a virtual exhibition of ${family.site}, as a website of its
own. On legacy it lived inside ${family.site}
(\`${legacyAddress}\`); here it is a
product in its own right, and ${family.site} links to it.

It shows what legacy showed, the way legacy showed it: the exhibition's home
page, its introduction, its pages theme by theme, and the three windows those
pages open — the credits, the map and the zoom. Nothing on it is written for
it: every record comes from the data package, every text from viewer-i18n or
\`locales/\`.

Its pages are every mini-site's, from
[\`minisite-template\`](https://github.com/museumwithnofrontiers/minisite-template)
and the mini-site family layer: a change to how a page is drawn is made once,
in \`@museumwnf/viewer-layout/minisite\`, for every mini-site. What is this
exhibition's own is written from its legacy folder by inventory-app's
\`scripts/minisites/legacy-minisite.mjs\`.

| Package | Role |
| --- | --- |
| \`@museumwnf/${slug}-data\` | the exhibition: its collection, its themes and pages, the items they place, the curators it credits |
| \`@museumwnf/viewer-core\` | application engine (routing, data access, texts, language) |
| \`@museumwnf/viewer-layout\` | the mini-site pages and frame (\`./minisite\`) |
| \`@museumwnf/viewer-i18n\` | the texts every ${family.site} mini-site shows (\`./${family.labels}\`) |

---

## Translator — editing the website's texts

The texts every ${family.site} mini-site shows — the menu, the navigation, the credits
window's labels — are shared, in
[\`viewer-i18n\`](https://github.com/museumwithnofrontiers/viewer-i18n)'s
\`${family.labels}/\` folder, and are edited there. The exhibition's own texts — its
titles, quotes, essays and captions — arrive translated in the data package
and are not edited anywhere. \`locales/\` holds this website's own texts, one
file per language; it starts empty, and an entry written there overrides the
shared one of the same name for this website alone. See
\`minisite-template\`'s README, "Translator", for the steps in the browser.

---

## Webdesigner — theming the website

The website's look is legacy's exhibition frame, kept as it was:

- \`theme/tokens.css\` — every value legacy's \`${legacyFolder}/_styles.css\`
  set (and \`_styles_ar.css\` over it for Arabic), as \`--minisite-*\` tokens;
- \`theme/assets/legacy/\` — legacy's own pictures of the frame, the maps and
  the curators' logos; \`SOURCES.json\` names where each file was taken from
  and its hash, and \`tests/assets.test.js\` checks every file against it;
- \`theme/overrides.css\` — the escape hatch, empty until a need cannot be
  expressed with a token.

A change to the pages' layout itself is a change to every mini-site: a
request for [\`viewer-layout\`](https://github.com/museumwithnofrontiers/viewer-layout)'s
\`./minisite\`. To preview, run \`docker compose up\` and open
**http://localhost:5173**.

---

## Developer notes

- \`src/dataset.config.js\` is the whole declaration and needs no edit;
  \`src/minisite.json\` holds what legacy configured for this exhibition alone
  (its address, the home menu's second column, the curators the home page
  credits, the maps of its introduction).
- Every caption legacy prints is in its pages' \`pageItems\` script, all views
  included; a page here can be compared field by field with the page there,
  in every language.

\`\`\`bash
docker run --rm -v "\${PWD}:/app" -w /app node:24-alpine sh -c "npm ci && npm test && npm run lint && npm run build"
\`\`\`

## Licence

See [LICENSE.md](LICENSE.md).
`
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main(process.argv.slice(2))
}
