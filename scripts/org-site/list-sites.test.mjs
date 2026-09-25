import assert from 'node:assert/strict'
import { test } from 'node:test'

import { buildSiteList, readInstances } from './list-sites.mjs'

const OWNER = 'museumwithnofrontiers'
const TEMPLATE = `${OWNER}/website-template`

const instances = new Map([
  ['carpets', { title: 'Carpets', kind: 'gallery' }],
  ['amulets', { title: 'Amulets', kind: 'gallery' }],
  ['islamicart', { title: 'Discover Islamic Art', kind: 'standalone' }],
  ['water-in-islam', { title: 'Water in Islam', kind: 'exhibition' }],
])

const site = (name, extra = {}) => ({
  name,
  template: TEMPLATE,
  hasPages: true,
  pagesUrl: `https://${OWNER}.github.io/${name}/`,
  ...extra,
})

test('lists only repositories created from the website template', () => {
  const sites = buildSiteList(OWNER, [site('carpets'), site('viewer-core', { template: '' })], instances)
  assert.deepEqual(sites.map((s) => s.slug), ['carpets'])
})

test('lists a site from any of the three site templates, and none from another template', () => {
  const repos = [
    site('amulets', { template: `${OWNER}/gallery-template` }),
    site('water-in-islam', { template: `${OWNER}/exhibition-template` }),
    site('islamicart'),
    site('carpets', { template: 'someone-else/gallery-template' }),
    site('new-site', { template: `${OWNER}/some-other-template` }),
  ]
  const sites = buildSiteList(OWNER, repos, instances)
  assert.deepEqual(sites.map((s) => s.slug), ['islamicart', 'water-in-islam', 'amulets'])
})

test('leaves out a site whose GitHub Pages is not enabled yet', () => {
  const sites = buildSiteList(OWNER, [site('carpets'), site('amulets', { hasPages: false })], instances)
  assert.deepEqual(sites.map((s) => s.slug), ['carpets'])
})

test('takes title and kind from the exporter instance, address from Pages', () => {
  const [carpets] = buildSiteList(OWNER, [site('carpets')], instances)
  assert.deepEqual(carpets, {
    slug: 'carpets',
    title: 'Carpets',
    kind: 'gallery',
    url: `https://${OWNER}.github.io/carpets/`,
    repository: `https://github.com/${OWNER}/carpets`,
  })
})

test('still lists a site with no exporter instance, under its repository name', () => {
  const [newSite] = buildSiteList(OWNER, [site('new-site', { pagesUrl: '' })], instances)
  assert.equal(newSite.title, 'new-site')
  assert.equal(newSite.kind, 'other')
  assert.equal(newSite.url, `https://${OWNER}.github.io/new-site/`)
})

test('sorts by kind (standalone, exhibition, gallery, then others), then by title', () => {
  const repos = ['carpets', 'new-site', 'water-in-islam', 'amulets', 'islamicart'].map((n) => site(n))
  const sites = buildSiteList(OWNER, repos, instances)
  assert.deepEqual(sites.map((s) => s.slug), ['islamicart', 'water-in-islam', 'amulets', 'carpets', 'new-site'])
})

test('fails when nothing is found, instead of writing an empty list', () => {
  assert.throws(() => buildSiteList('someone-else', [site('carpets')], instances), /no published website/)
})

test('every exporter instance has the title and kind the page needs', () => {
  const all = readInstances()
  assert.ok(all.size > 0)
  for (const [slug, { title, kind }] of all) {
    assert.ok(title, `${slug} has no name`)
    assert.ok(kind, `${slug} has no kind`)
  }
})
