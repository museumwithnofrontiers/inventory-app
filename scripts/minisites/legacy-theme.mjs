#!/usr/bin/env node
/**
 * A mini-site's theme/tokens.css, read from its legacy stylesheets.
 *
 * Discover Islamic Art's (and Discover Baroque Art's) virtual exhibitions ran
 * on one set of pages each, and every exhibition styled them with a
 * stylesheet of its own: its colours, and also where its titles, menus and
 * links sit on its pictures. viewer-layout's `./minisite` (minisite.css) lays
 * the pages out the way those pages did, for every mini-site; every value an
 * exhibition's stylesheet set is a `--minisite-*` token, written here from
 * that stylesheet — `_styles.css` for every language, `_styles_ar.css` over it
 * for Arabic — so a site's theme is legacy's values, transcribed rather than
 * retyped.
 *
 * A property the stylesheet does not set gets no token: minisite.css falls
 * back to what the browser drew for it on legacy.
 *
 * Usage (no dependencies; Docker, no Node on the host):
 *   node scripts/minisites/legacy-theme.mjs <legacy exhibition folder> [--name "<Exhibition>"] > theme/tokens.css
 * e.g. .legacy-code/islamicart/www.discoverislamicart.org/exhibitions/ISL/the_abbasids
 */
import { existsSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'

/** [token, selector, property]: what site.css reads, and where legacy set it. */
export const TOKENS = [
  // The page around the frame, and the links.
  ['page', 'body', 'background-color'],
  ['font', 'body', 'font'],
  ['link', 'a', 'color'],
  // The header.
  ['header', '#header', 'background-color'],
  ['header-logo-left', '#headerLogo', 'left'],
  ['header-nav-left', '#headerNav', 'left'],
  ['header-nav-width', '#headerNav', 'width'],
  ['header-nav-align', '#headerNav', 'text-align'],
  ['header-text', '#headerNavBack', 'color'],
  ['header-back-margin', '#headerNavBack', 'margin'],
  ['header-link', '#headerNavBack a', 'color'],
  ['header-link-font', '.headerLinks', 'font'],
  ['select', '#headerLngSelect', 'background-color'],
  ['select-text', '#headerLngSelect', 'color'],
  ['select-font', '#headerLngSelect', 'font'],
  // The menu over the footer, the line under it, the footer.
  ['menu', '#btmMenu', 'background'],
  ['menu-font', '.nav-in', 'font'],
  ['menu-text', '.nav-in', 'color'],
  ['menu-item-padding', '.nav-in li', 'padding'],
  ['menu-link', '.nav-in li a', 'color'],
  ['strip', '#strip-white', 'background-color'],
  ['footer', '#footer', 'background-color'],
  ['footer-height', '#footer', 'height'],
  ['footer-text', '#footer', 'color'],
  ['footer-font', '#footer', 'font'],
  ['footer-link', '#footer a', 'color'],
  // The tooltip.
  ['tip', '#dhtmltooltip', 'background-color'],
  ['tip-text', '#dhtmltooltip', 'color'],
  ['tip-border', '#dhtmltooltip', 'border'],
  ['tip-font', '#dhtmltooltip', 'font'],
  // The home page.
  ['home-height', '#homePage', 'height'],
  ['home-paper', '#homePage', 'background-color'],
  ['home-bg1-height', '#homeBG1', 'height'],
  ['home-bg1', '#homeBG1', 'background-color'],
  ['home-bg2-height', '#homeBG2', 'height'],
  ['home-title-left', '#homeTitle', 'left'],
  ['home-title-top', '#homeTitle', 'top'],
  ['home-title-width', '#homeTitle', 'width'],
  ['home-title-font', '#homeTitle', 'font'],
  ['home-title-color', '#homeTitle', 'color'],
  ['home-description-left', '#homeDescription', 'left'],
  ['home-description-top', '#homeDescription', 'top'],
  ['home-description-width', '#homeDescription', 'width'],
  ['home-description-font', '#homeDescription', 'font'],
  ['home-description-color', '#homeDescription', 'color'],
  ['home-description-link', '#homeDescription a', 'color'],
  ['home-menu-left', '#homeMenu', 'left'],
  ['home-menu-right', '#homeMenu', 'right'],
  ['home-menu-top', '#homeMenu', 'top'],
  ['home-menu-width', '#homeMenu', 'width'],
  ['home-menu-font', '#homeMenu', 'font'],
  ['home-menu2-left', '#homeMenu2', 'left'],
  ['home-menu2-top', '#homeMenu2', 'top'],
  ['home-menu2-width', '#homeMenu2', 'width'],
  ['home-menu2-font', '#homeMenu2', 'font'],
  ['home-menu-link', '#homeMenu div a', 'color'],
  ['home-menu-link-font', '#homeMenu div a', 'font'],
  ['home-menu-link-hover', '#homeMenu div a:hover', 'color'],
  ['home-menu-link-hover-weight', '#homeMenu div a:hover', 'font-weight'],
  ['home-menu-link-visited', '#homeMenu div a:visited', 'color'],
  ['partners', '#homePartners', 'background-color'],
  ['partners-height', '#homePartners', 'height'],
  ['partners-font', '#homePartners', 'font'],
  ['partners-line-margin-top', '#homePartners .txt', 'margin-top'],
  ['partners-line-margin-bottom', '#homePartners .txt', 'margin-bottom'],
  ['partners-line-font', '#homePartners .txt', 'font'],
  ['partners-link', '#homePartners a', 'color'],
  // Discover Baroque Art's band: the text's colour, the curators' column
  // (curated by, the cooperation line, each curator's name over its logo)
  // ruled off from the designer's.
  ['partners-color', '#homePartners', 'color'],
  ['partners-width', '#homePartners', 'width'],
  ['partners-padding', '#homePartners', 'padding'],
  ['partners-line-color', '#homePartners .txt', 'color'],
  ['partners-line-height', '#homePartners .txt', 'line-height'],
  ['partners-curators-width', '.homePartners_tab_lt', 'width'],
  ['partners-curators-padding', '.homePartners_tab_lt', 'padding'],
  ['partners-curators-margin-right', '.homePartners_tab_lt', 'margin-right'],
  ['partners-curators-rule', '.homePartners_tab_lt', 'border-right'],
  ['partners-tab-width', '.homePartners_tab', 'width'],
  ['partners-tab-font', '.homePartners_tab', 'font'],
  ['partners-tab-color', '.homePartners_tab', 'color'],
  ['partners-tab-spacing', '.homePartners_tab', 'letter-spacing'],
  ['partners-tab-logo-padding-top', '.homePartners_tab img', 'padding-top'],
  ['partners-cooperation-width', '.homePartners_tab01', 'width'],
  ['partners-cooperation-font', '.homePartners_tab01', 'font'],
  ['partners-cooperation-color', '.homePartners_tab01', 'color'],
  ['partners-cooperation-padding-left', '.homePartners_tab01', 'padding-left'],
  ['partners-cooperation-padding-right', '.homePartners_tab01', 'padding-right'],
  ['partners-cooperation-spacing', '.homePartners_tab01', 'letter-spacing'],
  ['partners-cooperation-decoration', '.homePartners_tab01 a', 'text-decoration'],
  ['partners-design-width', '.homePartners_tab_rt', 'width'],
  ['partners-design-padding', '.homePartners_tab_rt', 'padding'],
  ['partners-design-color', '.homePartners_tab_rt', 'color'],
  ['partners-design-font-size', '.homePartners_tab_rt', 'font-size'],
  ['partners-design-spacing', '.homePartners_tab_rt', 'letter-spacing'],
  ['partners-design-line-height', '.homePartners_tab_rt', 'line-height'],
  ['partners-design-tab-color', '.homePartners_tab_rt_tab', 'color'],
  ['partners-design-tab-font-size', '.homePartners_tab_rt_tab', 'font-size'],
  ['partners-design-tab-spacing', '.homePartners_tab_rt_tab', 'letter-spacing'],
  ['partners-design-tab-line-height', '.homePartners_tab_rt_tab', 'line-height'],
  ['partners-design-tab-padding', '.homePartners_tab_rt_tab', 'padding'],
  // Discover Baroque Art's home picture (#banner, images/banner.png), placed
  // against the footer: where each exhibition set it, and its size.
  ['banner-top', '#banner', 'top'],
  ['banner-bottom', '#banner', 'bottom'],
  ['banner-left', '#banner', 'left'],
  ['banner-right', '#banner', 'right'],
  ['banner-width', '#banner', 'width'],
  ['banner-height', '#banner', 'height'],
  ['banner-position', '#banner', 'background-position'],
  // The introduction.
  ['intro-paper', '#IntroPage', 'background-color'],
  ['intro-title-left', '#IntroTitle', 'left'],
  ['intro-title-right', '#IntroTitle', 'right'],
  ['intro-title-top', '#IntroTitle', 'top'],
  ['intro-title-width', '#IntroTitle', 'width'],
  ['intro-title-align', '#IntroTitle', 'text-align'],
  ['intro-title-font', '#IntroTitle', 'font'],
  ['intro-title-color', '#IntroTitle', 'color'],
  ['intro-table-margin', '#IntroPageTable', 'margin'],
  ['intro-nav-start-left', '#introNavLeft', 'left'],
  ['intro-nav-start-top', '#introNavLeft', 'top'],
  ['intro-nav-start-width', '#introNavLeft', 'width'],
  ['intro-nav-start-align', '#introNavLeft', 'text-align'],
  ['intro-nav-start-font', '#introNavLeft', 'font'],
  ['intro-nav-end-left', '#introNavRight', 'left'],
  ['intro-nav-end-top', '#introNavRight', 'top'],
  ['intro-nav-end-width', '#introNavRight', 'width'],
  ['intro-nav-end-align', '#introNavRight', 'text-align'],
  ['intro-nav-end-font', '#introNavRight', 'font'],
  ['intro-nav-color', '#introNavLeft', 'color'],
  ['intro-nav-link-font', '#introNavLeft a', 'font'],
  ['intro-nav-link-color', '#introNavLeft a', 'color'],
  ['intro-item-font', '.IntroItem', 'font'],
  ['intro-item-color', '.IntroItem', 'color'],
  ['intro-item-link', '.IntroItem a', 'color'],
  ['intro-header-font', '.IntroTextTitle', 'font'],
  ['intro-text-font', '.IntroTextContent', 'font'],
  // An exhibition page.
  ['exhibition-paper', '#ExhibitionPage', 'background-color'],
  ['exhibition-head-height', '#ExhibitionBlock1', 'height'],
  ['exhibition-title-left', '#ExhibitionBlock1_title', 'left'],
  ['exhibition-title-right', '#ExhibitionBlock1_title', 'right'],
  ['exhibition-title-top', '#ExhibitionBlock1_title', 'top'],
  ['exhibition-title-width', '#ExhibitionBlock1_title', 'width'],
  ['exhibition-title-align', '#ExhibitionBlock1_title', 'text-align'],
  ['exhibition-title-font', '#ExhibitionBlock1_title', 'font'],
  ['exhibition-title-color', '#ExhibitionBlock1_title', 'color'],
  ['exhibition-nav-start-left', '#ExhibitionBlock1_navLeft', 'left'],
  ['exhibition-nav-start-top', '#ExhibitionBlock1_navLeft', 'top'],
  ['exhibition-nav-start-width', '#ExhibitionBlock1_navLeft', 'width'],
  ['exhibition-nav-start-align', '#ExhibitionBlock1_navLeft', 'text-align'],
  ['exhibition-nav-start-font', '#ExhibitionBlock1_navLeft', 'font'],
  ['exhibition-nav-end-left', '#ExhibitionBlock1_navRight', 'left'],
  ['exhibition-nav-end-top', '#ExhibitionBlock1_navRight', 'top'],
  ['exhibition-nav-end-width', '#ExhibitionBlock1_navRight', 'width'],
  ['exhibition-nav-end-align', '#ExhibitionBlock1_navRight', 'text-align'],
  ['exhibition-nav-end-font', '#ExhibitionBlock1_navRight', 'font'],
  ['exhibition-nav-color', '#ExhibitionBlock1_navLeft', 'color'],
  ['exhibition-nav-link-font', '#ExhibitionBlock1_navLeft a', 'font'],
  ['exhibition-nav-link-color', '#ExhibitionBlock1_navLeft a', 'color'],
  ['exhibition-text-width', '#ExhibitionBlock2TD1', 'width'],
  ['exhibition-text-paper', '#ExhibitionBlock2TD1', 'background-color'],
  ['exhibition-page-title-font', '#ExhibitionBlock2TD1 .Title', 'font'],
  ['exhibition-page-title-color', '#ExhibitionBlock2TD1 .Title', 'color'],
  ['exhibition-thumbs-top', '#ExhibitionBlock2TD1 .ItemLinks', 'border-top'],
  ['exhibition-thumbs-bottom', '#ExhibitionBlock2TD1 .ItemLinks', 'border-bottom'],
  ['exhibition-thumb-margin', '#ExhibitionBlock2TD1 .ItemLinks img', 'margin'],
  ['exhibition-thumb-border', '#ExhibitionBlock2TD1 .ItemLinks img', 'border'],
  ['exhibition-text-font', '#ExhibitionBlock2TD1 .Text', 'font'],
  ['exhibition-quote-font', '#ExhibitionBlock2TD1 .Quote', 'font'],
  ['exhibition-item-paper', '#ExhibitionBlock2TD2', 'background-color'],
  ['exhibition-caption-font', '#exh_item div', 'font'],
  ['exhibition-caption-link', '#exh_item div a', 'color'],
  ['exhibition-more', '#exh_item div .moreinfo', 'color'],
  // The credits window.
  ['credits-color', 'body#Credits', 'color'],
  ['credits-font', 'body#Credits', 'font'],
  ['credits-title-font', 'body#Credits h1', 'font'],
  // The Artistic Introduction (gai/ISL/_styles.css): its home page's subtitle,
  // credits and social-media links (their margin and colour set by the site's
  // font-awesome.css, read after it), and its pages.
  ['artintro-subtitle-left', '#homeSubTitle', 'left'],
  ['artintro-subtitle-top', '#homeSubTitle', 'top'],
  ['artintro-subtitle-font', '#homeSubTitle', 'font'],
  ['artintro-subtitle-color', '#homeSubTitle', 'color'],
  ['artintro-credits-left', '#homeCredits', 'left'],
  ['artintro-credits-top', '#homeCredits', 'top'],
  ['artintro-credits-width', '#homeCredits', 'width'],
  ['artintro-credits-font', '#homeCredits', 'font'],
  ['artintro-credits-color', '#homeCredits', 'color'],
  ['artintro-icons-bottom', '#icons', 'bottom'],
  ['artintro-icons-right', '#icons', 'right'],
  ['artintro-icons-width', '#icons', 'width'],
  ['artintro-icons-padding-right', '#icons', 'padding-right'],
  ['artintro-icons-align', '#icons', 'text-align'],
  ['artintro-social-padding', '#social-media', 'padding'],
  ['artintro-social-link-margin', '#social-media a', 'margin'],
  ['artintro-social-link-size', '#social-media a', 'font-size'],
  ['artintro-social-icon', '.svg-inline--fa', 'color'],
  ['artintro-page-paper', '#GaiPage', 'background-color'],
  ['artintro-head-height', '#GaiBlock1', 'height'],
  ['artintro-head', '#GaiBlock1', 'background-color'],
  ['artintro-back-top', '#GaiBlock1_navLeft', 'top'],
  ['artintro-back-left', '#GaiBlock1_navLeft', 'left'],
  ['artintro-back-font', '#GaiBlock1_navLeft', 'font'],
  ['artintro-back-color', '#GaiBlock1_navLeft', 'color'],
  ['artintro-back-link-font', '#GaiBlock1_navLeft a', 'font'],
  ['artintro-back-link-color', '#GaiBlock1_navLeft a', 'color'],
  ['artintro-text-width', '#GaiBlock2TD1', 'width'],
  ['artintro-text-padding', '#GaiBlock2TD1', 'padding'],
  ['artintro-text-paper', '#GaiBlock2TD1', 'background-color'],
  ['artintro-title-font', '#GaiBlock2TD1 .Title', 'font'],
  ['artintro-title-margin-top', '#GaiBlock2TD1 .Title', 'margin-top'],
  ['artintro-title-margin-bottom', '#GaiBlock2TD1 .Title', 'margin-bottom'],
  ['artintro-pages-margin-top', '#GaiBlock2TD1 #pageNavigation', 'margin-top'],
  ['artintro-pages-margin-bottom', '#GaiBlock2TD1 #pageNavigation', 'margin-bottom'],
  ['artintro-quote-font', '#GaiBlock2TD1 .Quote', 'font'],
  ['artintro-quote-align', '#GaiBlock2TD1 .Quote', 'text-align'],
  ['artintro-quote-margin-top', '#GaiBlock2TD1 .Quote', 'margin-top'],
  ['artintro-quote-margin-bottom', '#GaiBlock2TD1 .Quote', 'margin-bottom'],
  ['artintro-content-font', '#GaiBlock2TD1 .Text', 'font'],
  ['artintro-content-margin-top', '#GaiBlock2TD1 .Text', 'margin-top'],
  ['artintro-content-margin-bottom', '#GaiBlock2TD1 .Text', 'margin-bottom'],
  ['artintro-content-min-height', '#GaiBlock2TD1 .Text', 'min-height'],
  ['artintro-paragraph-font', '#GaiBlock2TD1 .Text p', 'font'],
  ['artintro-paragraph-margin-top', '#GaiBlock2TD1 .Text p', 'margin-top'],
  ['artintro-paragraph-margin-bottom', '#GaiBlock2TD1 .Text p', 'margin-bottom'],
  ['artintro-item-padding', '#GaiBlock2TD2', 'padding'],
  ['artintro-item-paper', '#GaiBlock2TD2', 'background-color'],
  ['artintro-image-width', '#exh_image', 'width'],
  ['artintro-image-height', '#exh_image', 'height'],
  ['artintro-image-margin', '#exh_image', 'margin'],
  ['artintro-image-padding', '#exh_image', 'padding'],
  ['artintro-caption-min-height', '#exh_item', 'min-height'],
  ['artintro-caption-line-margin-bottom', '#exh_item div', 'margin-bottom'],
  ['artintro-caption-color', '#exh_item div', 'color'],
  ['artintro-justification-color', '#exh_item #itemJustification', 'color'],
  ['artintro-thumbs-margin-top', '#GaiBlock2TD2 .ItemLinks', 'margin-top'],
  ['artintro-thumbs-margin-bottom', '#GaiBlock2TD2 .ItemLinks', 'margin-bottom'],
  ['artintro-thumbs-padding-top', '#GaiBlock2TD2 .ItemLinks', 'padding-top'],
  ['artintro-thumbs-border-top', '#GaiBlock2TD2 .ItemLinks', 'border-top'],
  ['artintro-thumb-border', '#GaiBlock2TD2 .ItemLinks img', 'border'],
  ['artintro-thumb-margin', '#GaiBlock2TD2 .ItemLinks img', 'margin'],
]

/** selector → { property: value }, in source order, later declarations winning. */
export function parseCss(css) {
  const rules = new Map()
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const match of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const declarations = {}
    for (const part of match[2].split(';')) {
      const colon = part.indexOf(':')
      if (colon < 0) continue
      const property = part.slice(0, colon).trim().toLowerCase()
      const value = part.slice(colon + 1).replace(/!important/i, '').trim().replace(/\s+/g, ' ')
      if (property && value) declarations[property] = value
    }
    for (const selector of match[1].split(',')) {
      const key = selector.trim().replace(/\s+/g, ' ')
      if (!key) continue
      rules.set(key, { ...(rules.get(key) ?? {}), ...declarations })
    }
  }
  return rules
}

/** A legacy value as CSS a browser of today reads the same way. */
function normalise(property, value) {
  // A length legacy wrote without its unit ("width: 300", "top: 174"), which
  // its browsers read as pixels.
  if (/^-?\d+(\.\d+)?$/.test(value) && value !== '0' && !/weight|line-height/.test(property)) return `${value}px`
  return value
}

export function tokens(rules) {
  const out = []
  for (const [token, selector, property] of TOKENS) {
    const value = rules.get(selector)?.[property]
    if (value !== undefined) out.push([token, normalise(property, value)])
  }
  return out
}

function block(selector, entries) {
  return `${selector} {\n${entries.map(([token, value]) => `  --minisite-${token}: ${value};`).join('\n')}\n}\n`
}

/**
 * `after`: the stylesheets legacy's pages loaded after the folder's own
 * (paths from the folder), whose rules win over it: the Artistic
 * Introduction's site-wide font-awesome.css.
 */
export function themeCss(folder, name, { after = [] } = {}) {
  const read = (file) => (existsSync(join(folder, file)) ? readFileSync(join(folder, file), 'utf8') : '')
  const main = tokens(parseCss([read('_styles.css'), ...after.map(read)].join('\n')))
  const arabic = tokens(parseCss(read('_styles_ar.css')))
  const also = after.length ? `, then ${after.map((file) => basename(file)).join(', ')}` : ''
  const header = `/*
 * The visual identity of ${name ?? basename(folder)}: every value its legacy
 * stylesheet set (${basename(folder)}/_styles.css${also}, and _styles_ar.css over it
 * for Arabic), transcribed by inventory-app's scripts/minisites/legacy-theme.mjs.
 * viewer-layout's minisite.css lays the pages out with them. This file
 * belongs to the webdesigner: change a value here.
 */
`
  return `${header}\n${block(':root', main)}${arabic.length ? `\n${block("[dir='rtl']", arabic)}` : ''}`
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('legacy-theme.mjs')) {
  const [folder, ...rest] = process.argv.slice(2)
  if (!folder) {
    console.error('usage: node legacy-theme.mjs <legacy exhibition folder> [--name "<Exhibition>"]')
    process.exit(64)
  }
  const nameIndex = rest.indexOf('--name')
  process.stdout.write(themeCss(folder, nameIndex >= 0 ? rest[nameIndex + 1] : undefined))
}
