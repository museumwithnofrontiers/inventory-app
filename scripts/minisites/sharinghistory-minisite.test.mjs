// node --test scripts/minisites/sharinghistory-minisite.test.mjs
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { deterministicUuid } from './legacy-minisite.mjs'
import { historicalProfiles, partnerLinks, partnerLogos, slugOf, STYLE_RULES, stylesOf, tokensCss } from './sharinghistory-minisite.mjs'

test("reads the home band's partner logos, each with its link and its tooltip", () => {
  // As legacy's exh_items.php?eId=8 prints its band.
  const html = `<div id="bottomLogoSectionRight_th2"><img src="images/arrow_curator.gif"></div>
        <div id="bottomLogoSectionRight_th3" align="center" >
                    <a href="https://sharinghistory.museumwnf.org/pm_partner.php?id=TN_01;tn&shpro=AWE&"  onmouseover="ddrivetip('Higher Institute, University of Manouba,&amp;nbsp;Tunis, Tunisia', 280);" onMouseout="hideddrivetip();" ><img src="https://images.museumwnf.org/full/sharing_history/sh_exhibitions/exhibitions/AWE/8/item_logo_18.png" height="74" /></a>
                <img src="images/empty.gif" width="30px" height="74" alt="" />            <img src="https://images.museumwnf.org/full/x/item_logo_28.png" height="74" />
        </div>
    </div>`
  assert.deepEqual(partnerLogos(html), [
    {
      src: 'https://images.museumwnf.org/full/sharing_history/sh_exhibitions/exhibitions/AWE/8/item_logo_18.png',
      link: 'https://sharinghistory.museumwnf.org/pm_partner.php?id=TN_01;tn&shpro=AWE&',
      tip: 'Higher Institute, University of Manouba, Tunis, Tunisia',
    },
    { src: 'https://images.museumwnf.org/full/x/item_logo_28.png', link: '', tip: '' },
  ])
  assert.deepEqual(partnerLogos('<div id="bottomLogoSectionRight_th3"></div>'), [])
})

test("leads a partner logo to the partner's page on the parent site", () => {
  const html = '<a href="https://sharinghistory.museumwnf.org/pm_partner.php?id=AT_01;at&amp;shpro=AWE&amp;"><img></a>'
  const partners = [{ id: 'p-at', backward_compatibility: 'mwnf3_sharing_history:sh_partners:at_01' }]
  assert.deepEqual(partnerLinks(html, partners, 'https://p'), {
    'https://sharinghistory.museumwnf.org/pm_partner.php?id=AT_01;at&shpro=AWE&': 'https://p/#/partner/p-at',
  })
})

test('a slug is the title in kebab case', () => {
  assert.equal(slugOf('Economy and Trade'), 'economy-and-trade')
  assert.equal(slugOf('Travelling'), 'travelling')
  assert.equal(slugOf('Cities and Urban Spaces'), 'cities-and-urban-spaces')
})

test("the exhibition's collection is the importer's id for its sh_exhibitions row", () => {
  assert.match(deterministicUuid('collection:mwnf3_sharing_history:sh_exhibitions:11'), /^[0-9a-f-]{36}$/)
})

// A stylesheet as _styles.css.php prints it: every rule a style is read from,
// with a decoy (a commented-out rule, a longer selector) where legacy has one.
const css = Object.entries(STYLE_RULES)
  .map(([key, [selector, property]], i) => {
    const value = property === 'background-image' ? `url(https://img/${key}.jpg)` : property === 'border' ? `1px solid #00000${i % 10}` : `#0000${String(i).padStart(2, '0')}`
    return `${selector} {\n  ${property}: ${value};\n}`
  })
  .join('\n')
  .concat('\n/* #header { background-color: #FFFFFF; } */\n#header a { background-color: #ABCDEF; }\n')

test('reads each style from the rule that prints it', () => {
  const styles = stylesOf(css)
  assert.equal(styles.headBg, '#000000')
  assert.equal(styles.tooltipBorder, '#000002')
  assert.equal(styles.homeImage, 'https://img/homeImage.jpg')
  assert.equal(Object.keys(styles).length, Object.keys(STYLE_RULES).length)
})

test('fails on a style the stylesheet does not print', () => {
  assert.throws(() => stylesOf('#header { color: #fff; }'), /sets no background-color on #header/)
})

test('writes the styles as the pages’ tokens', () => {
  const tokens = tokensCss(stylesOf(css), 'Travelling', 11)
  assert.match(tokens, /--sh-head-bg: #000000;/)
  assert.match(tokens, /exhibition 11/)
  assert.doesNotMatch(tokens, /homeImage/)
})

test("lists the parent's country profiles by name, each leading to its first page", () => {
  const collections = [
    { id: 'root', purpose: 'historical-profiles-root' },
    { id: 'general', parent_id: 'root', country_id: null },
    { id: 'tn', parent_id: 'root', country_id: 'tun', display_order: 1 },
    { id: 'at', parent_id: 'root', country_id: 'aut', display_order: 2 },
    { id: 'at-2', parent_id: 'at', display_order: 2 },
    { id: 'at-1', parent_id: 'at', display_order: 1 },
  ]
  const countries = { tun: { name: 'Tunisia' }, aut: { name: 'Austria.' } }
  assert.deepEqual(historicalProfiles({ collections, countries }, 'https://p'), [
    { text: 'Austria', href: 'https://p/#/historical-profiles/at/at-1' },
    { text: 'Tunisia', href: 'https://p/#/historical-profiles/tn' },
  ])
})
