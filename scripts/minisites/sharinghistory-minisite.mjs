#!/usr/bin/env node
/**
 * What a Sharing History virtual exhibition configured for itself alone,
 * written into a copy of minisite-template and into this repository's
 * exporter instances.
 *
 * Sharing History's exhibitions are a family of their own: every one runs on
 * the same pages (exhibitions/AWE/), named by its id (`eId`), inside the
 * Sharing History frame. What sets one apart is its styles
 * (sh_exhibitions_styles: the frame's colours and the three pictures behind
 * its title), which the pages print into _styles.css.php for the session's
 * exhibition. This reads them from legacy as it serves them, and writes:
 *
 *   <site>/src/minisite.json          the exhibition's settings, the parent
 *                                     site's Historical Profiles for the menu
 *                                     and its partner pages for the logos
 *   <site>/theme/tokens.css           its styles, as --sh-* tokens
 *   <site>/theme/assets/legacy/       the frame's pictures and the exhibition's
 *                                     backgrounds, byte for byte, and SOURCES.json
 *   <site>/package.json, index.html, src/texts.js, README.md
 *   <instances>/<slug>.json           the exporter instance of its data package
 *
 * The exhibition's collection id is the importer's own: the UUIDv5 of its
 * backward_compatibility (see legacy-minisite.mjs).
 *
 * Usage (Docker, no Node on the host; it reads legacy over HTTPS):
 *   node scripts/minisites/sharinghistory-minisite.mjs <eId> --name "<English title>" \
 *     --parent-package <unpacked @museumwnf/sharinghistory-data> [--site <dir>] [--instances <dir>]
 */
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deterministicUuid, familyFiles } from './legacy-minisite.mjs'

const REPO = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..')

export const FAMILY = {
  key: 'SH',
  host: 'https://sharinghistory.museumwnf.org',
  exhibitions: 'https://sharinghistory.museumwnf.org/exhibitions/AWE',
  images: 'https://images.museumwnf.org/full',
  parent: 'sharinghistory',
  parentSite: 'https://museumwithnofrontiers.github.io/sharinghistory',
  site: 'Sharing History',
  labels: 'minisiteSharingHistory',
  windowTitle: 'Sharing History Exhibitions',
}

// The pictures the pages draw from exhibitions/AWE/images/: the frame and its icons.
export const FRAME = [
  'arrow.gif', 'arrow_black.gif', 'arrow_black_down.gif', 'arrow_curator.gif', 'arrow_inner.gif', 'arrow_inner_black.gif',
  'bg.png', 'bg_fading_left.gif', 'bg_fading_right.gif', 'magnify.png', 'mwnfLogoShExIn-en.png', 'print.gif',
]

// Each style the pages print, by the rule that prints it in _styles.css.php
// and the property: sh_exhibitions_styles' field_type as the session names it.
export const STYLE_RULES = {
  headBg: ['#header', 'background-color'],
  headColor: ['.headSHLogo_area h1', 'color'],
  bodyBg: ['body', 'background-color'],
  footerBg: ['#footer', 'background-color'],
  footerColor: ['#footer', 'color'],
  footerIconBg: ['#bottomLogoSection_th', 'background-color'],
  footerIconColor: ['.supportText', 'color'],
  menu1Bg: ['#btmMenu', 'background'],
  menu1Color: ['.nav-in li a', 'color'],
  menu2Bg: ['#subthemePageBlock2TD1 .TitleBtm', 'background-color'],
  menu2Color: ['.nav-in li a:hover', 'color'],
  tooltipBg: ['#dhtmltooltip', 'background-color'],
  tooltipBorder: ['#dhtmltooltip', 'border'],
  tooltipColor: ['#dhtmltooltip', 'color'],
  exhRightBg: ['#exhPageIntro', 'background-color'],
  exhRightColor: ['#SubThemePageAlso', 'background-color'],
  homeImageColor: ['#exhPage #MenuTitleEx', 'color'],
  introImageColor: ['div#IntroTitle', 'color'],
  exhImageColor: ['#innerBannerBgText', 'color'],
  homeImage: ['#homeBgImg', 'background-image'],
  introImage: ['div#IntroPage', 'background-image'],
  exhImage: ['#innerBanner', 'background-image'],
}

// The token each style becomes (minisite-sharinghistory.css names them).
const TOKENS = {
  headBg: '--sh-head-bg', headColor: '--sh-head-color', bodyBg: '--sh-body-bg', footerBg: '--sh-footer-bg',
  footerColor: '--sh-footer-color', footerIconBg: '--sh-footer-icon-bg', footerIconColor: '--sh-footer-icon-color',
  menu1Bg: '--sh-menu1-bg', menu1Color: '--sh-menu1-color', menu2Bg: '--sh-menu2-bg', menu2Color: '--sh-menu2-color',
  tooltipBg: '--sh-tooltip-bg', tooltipBorder: '--sh-tooltip-border', tooltipColor: '--sh-tooltip-color',
  exhRightBg: '--sh-exh-right-bg', exhRightColor: '--sh-exh-right-color', homeImageColor: '--sh-home-image-color',
  introImageColor: '--sh-intro-image-color', exhImageColor: '--sh-exh-image-color',
}

/** The kebab-case slug of a title: "Economy and Trade" → "economy-and-trade". */
export function slugOf(name) {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * The styles _styles.css.php printed for the exhibition: each style's value,
 * read from the first rule with that exact selector that sets the property.
 * A colour is the value's first #hex (a border's colour, a background's).
 */
export function stylesOf(css) {
  const rules = []
  for (const block of css.replace(/\/\*[\s\S]*?\*\//g, '').split('}')) {
    const [selector, body] = block.split('{')
    if (!body) continue
    const declarations = Object.fromEntries(
      body
        .split(';')
        .map((d) => d.split(':'))
        .filter((d) => d.length > 1)
        .map(([p, ...v]) => [p.trim().toLowerCase(), v.join(':').trim()]),
    )
    for (const one of selector.split(',')) rules.push([one.trim().replace(/\s+/g, ' '), declarations])
  }
  const styles = {}
  for (const [key, [selector, property]] of Object.entries(STYLE_RULES)) {
    const value = rules.find(([s, d]) => s === selector && d[property])?.[1][property]
    if (!value) throw new Error(`_styles.css.php sets no ${property} on ${selector} (${key}).`)
    styles[key] = property === 'background-image' ? value.match(/url\(\s*['"]?([^'")]+)/)?.[1] ?? '' : value.match(/#[0-9a-fA-F]{3,6}\b/)?.[0] ?? ''
    if (!styles[key]) throw new Error(`${selector} ${property}: no value in "${value}" (${key}).`)
  }
  return styles
}

/** theme/tokens.css: the exhibition's styles as the pages' tokens. */
export function tokensCss(styles, name, eId) {
  const lines = Object.entries(TOKENS).map(([key, token]) => `  ${token}: ${styles[key]};`)
  return `/*
 * ${name}: its styles, as Sharing History's virtual exhibition pages printed
 * them (exhibitions/AWE/_styles.css.php for exhibition ${eId}, from
 * sh_exhibitions_styles). Written by inventory-app's
 * scripts/minisites/sharinghistory-minisite.mjs.
 */
:root {
${lines.join('\n')}
}
`
}

/**
 * The menu's Historical Profiles, as the parent site lists them (its
 * composables/menu.js): every country profile under the profiles' root, by
 * country name, each leading to its first page.
 */
export function historicalProfiles({ collections, countries }, parentSite) {
  const root = collections.find((c) => c.purpose === 'historical-profiles-root')
  if (!root) return []
  const order = (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0) || String(a.internal_name).localeCompare(String(b.internal_name))
  const children = (id) => collections.filter((c) => c.parent_id === id).sort(order)
  return children(root.id)
    .filter((record) => record.country_id)
    .map((record) => ({ record, text: (countries[record.country_id]?.name ?? '').replace(/\.$/, '') }))
    .sort((a, b) => a.text.localeCompare(b.text))
    .map(({ record, text }) => {
      const first = children(record.id)[0]
      const path = first ? `${record.id}/${first.id}` : record.id
      return { text, href: `${parentSite}/#/historical-profiles/${path}` }
    })
}

async function download(url, init) {
  const response = await fetch(url, init)
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
  return response
}

/**
 * The exhibition's home page and _styles.css.php as legacy serves them for
 * exhibition `eId`: the stylesheet prints the home page's session.
 */
export async function legacyPages(eId) {
  const home = await download(`${FAMILY.exhibitions}/exh_items.php?eId=${eId}`)
  const cookie = (home.headers.getSetCookie?.() ?? [home.headers.get('set-cookie') ?? ''])
    .map((c) => c.split(';')[0])
    .filter(Boolean)
    .join('; ')
  const html = await home.text()
  const css = await (await download(`${FAMILY.exhibitions}/_styles.css.php`, { headers: { cookie } })).text()
  return { html, css }
}

/**
 * Where the home page's partner logos lead on the parent site: legacy linked
 * each to its partner page (pm_partner.php?id=<partner>;<country>), which the
 * parent site rebuilt at #/partner/<id>. Keyed by legacy's address, as the
 * data package's logo carries it (`link`).
 */
export function partnerLinks(html, partners, parentSite) {
  const links = {}
  for (const [, href, key] of html.matchAll(/href="([^"]*pm_partner\.php\?id=([A-Za-z0-9_]+);[^"]*)"/g)) {
    const partner = partners.find((p) => p.backward_compatibility === `mwnf3_sharing_history:sh_partners:${key.toLowerCase()}`)
    if (partner) links[href.replace(/&amp;/g, '&')] = `${parentSite}/#/partner/${encodeURIComponent(partner.id)}`
  }
  return links
}

function option(args, name) {
  const at = args.indexOf(name)
  return at >= 0 ? args[at + 1] : undefined
}

async function main(args) {
  const eId = args[0]
  const name = option(args, '--name')
  const parentPackage = option(args, '--parent-package')
  if (!/^\d+$/.test(eId ?? '') || !name || !parentPackage) {
    console.error('usage: node sharinghistory-minisite.mjs <eId> --name "<English title>" --parent-package <dir> [--site <dir>] [--instances <dir>]')
    process.exit(64)
  }
  const slug = `${FAMILY.parent}-${slugOf(name)}`
  const legacyUrl = `${FAMILY.exhibitions}/exh_items.php?eId=${eId}`

  const instance = {
    kind: 'minisite',
    slug,
    name,
    exporter: FAMILY.parent,
    parent: FAMILY.parent,
    collection_id: deterministicUuid(`collection:mwnf3_sharing_history:sh_exhibitions:${eId}`),
    partner_ids: [],
    package_name: `@museumwnf/${slug}-data`,
    legacy_url: legacyUrl,
  }
  const instances = resolve(option(args, '--instances') ?? join(REPO, 'scripts/exporters/instances'))
  writeFileSync(join(instances, `${slug}.json`), `${JSON.stringify(instance, null, 2)}\n`)
  console.log(`instance  ${join(instances, `${slug}.json`)} (exhibition ${eId})`)

  const site = option(args, '--site')
  if (!site) return
  const readJson = (file) => JSON.parse(readFileSync(join(parentPackage, file), 'utf8'))
  const profiles = historicalProfiles(
    { collections: readJson('collections.json'), countries: readJson('translations/countries.en.json') },
    FAMILY.parentSite,
  )
  const { html, css } = await legacyPages(eId)
  const styles = stylesOf(css)
  const settings = {
    legacy: legacyUrl,
    family: FAMILY.key,
    eId: Number(eId),
    profiles,
    partnerLinks: partnerLinks(html, readJson('partners.json'), FAMILY.parentSite),
  }
  writeFileSync(join(site, 'src/minisite.json'), `${JSON.stringify(settings, null, 2)}\n`)
  writeFileSync(join(site, 'theme/tokens.css'), tokensCss(styles, name, eId))
  const own = familyFiles(
    { packageJson: readFileSync(join(site, 'package.json'), 'utf8'), indexHtml: readFileSync(join(site, 'index.html'), 'utf8') },
    FAMILY,
  )
  writeFileSync(join(site, 'package.json'), own.packageJson)
  writeFileSync(join(site, 'index.html'), own.indexHtml)
  writeFileSync(join(site, 'src/texts.js'), own.texts)

  // The frame's pictures, and the exhibition's three backgrounds under the
  // names the pages draw them by.
  const backgrounds = { 'home_bg.jpg': styles.homeImage, 'intro_bg.jpg': styles.introImage, 'exhibition_bg.jpg': styles.exhImage }
  const sources = [
    ...FRAME.map((file) => [file, `${FAMILY.exhibitions}/images/${file}`]),
    ...Object.entries(backgrounds).map(([file, url]) => [file, new URL(url, `${FAMILY.exhibitions}/`).href]),
  ].sort(([a], [b]) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
  const assets = join(site, 'theme/assets/legacy')
  rmSync(assets, { recursive: true, force: true })
  mkdirSync(assets, { recursive: true })
  const files = {}
  for (const [file, url] of sources) {
    const bytes = Buffer.from(await (await download(url)).arrayBuffer())
    writeFileSync(join(assets, file), bytes)
    files[`theme/assets/legacy/${file}`] = { source: url, sha256: createHash('sha256').update(bytes).digest('hex') }
  }
  const about =
    `The frame this website takes from legacy Sharing History's virtual exhibition ${name} ` +
    `(exhibitions/AWE/, exhibition ${eId}), each file as legacy serves it, byte for byte: the pages' ` +
    `icons and strips, and the three pictures behind the exhibition's title (its styles' home_image, ` +
    `intro_image and exh_image). tests/assets.test.js checks every file against its hash.`
  writeFileSync(join(assets, 'SOURCES.json'), `${JSON.stringify({ about, files }, null, 2)}\n`)
  writeFileSync(join(site, 'README.md'), siteReadme({ slug, name, eId }))
  console.log(`site      ${resolve(site)}: minisite.json (${profiles.length} profiles), tokens.css, ${sources.length} pictures, package.json, index.html, texts.js, README.md`)
}

/** The mini-site's own README: what it is, and how each role works on it. */
export function siteReadme({ slug, name, eId }) {
  return `# ${slug}

**${name}**, a virtual exhibition of Sharing History, as a website of its
own. On legacy it lived inside Sharing History
(\`sharinghistory.museumwnf.org/exhibitions/AWE/exh_items.php?eId=${eId}\`);
here it is a product in its own right, and Sharing History links to it.

It shows what legacy showed, the way legacy showed it: the exhibition's home
page, its introduction, each theme's overview and subthemes, its further
reading, and the windows those pages open — the curators, the cover image and
the zoom — inside the Sharing History frame. Nothing on it is written for it:
every record comes from the data package, every text from viewer-i18n or
\`locales/\`.

Its pages are every Sharing History mini-site's, from
[\`minisite-template\`](https://github.com/museumwithnofrontiers/minisite-template)
and the Sharing History pages of the mini-site layer: a change to how a page
is drawn is made once, in \`@museumwnf/viewer-layout/minisite\`, for every
Sharing History mini-site. What is this exhibition's own is written from
legacy by inventory-app's \`scripts/minisites/sharinghistory-minisite.mjs\`.

| Package | Role |
| --- | --- |
| \`@museumwnf/${slug}-data\` | the exhibition: its collection, its themes and subthemes, the items they place |
| \`@museumwnf/viewer-core\` | application engine (routing, data access, texts, language) |
| \`@museumwnf/viewer-layout\` | the mini-site pages and frame (\`./minisite\`) |
| \`@museumwnf/viewer-i18n\` | the texts every Sharing History mini-site shows (\`./${FAMILY.labels}\`) |

---

## Translator — editing the website's texts

The texts every Sharing History mini-site shows — the frame, the menu, the
navigation, the windows' headings — are shared, in
[\`viewer-i18n\`](https://github.com/museumwithnofrontiers/viewer-i18n)'s
\`${FAMILY.labels}/\` folder, and are edited there. The exhibition's own
texts — its titles, quotes, essays and captions — arrive in the data package
and are not edited anywhere. \`locales/\` holds this website's own texts, one
file per language; it starts empty, and an entry written there overrides the
shared one of the same name for this website alone. See
\`minisite-template\`'s README, "Translator", for the steps in the browser.

---

## Webdesigner — theming the website

The website's look is legacy's exhibition frame, kept as it was:

- \`theme/tokens.css\` — the exhibition's styles (legacy's
  \`sh_exhibitions_styles\`, as its pages printed them), as \`--sh-*\` tokens;
- \`theme/assets/legacy/\` — legacy's own pictures of the frame and the
  three pictures behind the exhibition's title; \`SOURCES.json\` names where
  each file was taken from and its hash, and \`tests/assets.test.js\` checks
  every file against it;
- \`theme/overrides.css\` — the escape hatch, empty until a need cannot be
  expressed with a token.

A change to the pages' layout itself is a change to every Sharing History
mini-site: a request for
[\`viewer-layout\`](https://github.com/museumwithnofrontiers/viewer-layout)'s
\`./minisite\`. To preview, run \`docker compose up\` and open
**http://localhost:5173**.

---

## Developer notes

- \`src/dataset.config.js\` is the whole declaration and needs no edit;
  \`src/minisite.json\` holds what is this exhibition's own (its legacy
  address and id) and the parent site's Historical Profiles its menu lists.

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
