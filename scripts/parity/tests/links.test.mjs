// The links gate's verdicts (inventory-app#2482), on a small sitemap. No network.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isMwnfHost, judge, portedTargets } from '../tools/lib/links.mjs';

const sites = [
  { slug: 'ceramics', kind: 'gallery', legacyUrl: 'https://ceramics.museumwnf.org', newUrl: 'https://museumwithnofrontiers.github.io/ceramics/' },
  { slug: 'water-in-islam', kind: 'exhibition', legacyUrl: 'https://exhibitions.museumwnf.org/water_in_islam/en/', newUrl: 'https://museumwithnofrontiers.github.io/water-in-islam/' },
  { slug: 'islamicart', kind: 'standalone', legacyUrl: 'https://islamicart.museumwnf.org', newUrl: 'https://museumwithnofrontiers.github.io/islamicart/' },
  { slug: 'galleries', kind: 'standalone', legacyUrl: 'https://galleries.museumwnf.org', newUrl: 'https://museumwithnofrontiers.github.io/galleries/' },
  { slug: 'islamicart-the-abbasids', kind: 'minisite', legacyUrl: null, newUrl: 'https://museumwithnofrontiers.github.io/islamicart-the-abbasids/' },
  { slug: 'publications', kind: 'standalone', legacyUrl: 'https://books.museumwnf.org', newUrl: 'https://museumwithnofrontiers.github.io/publications/' },
  { slug: 'travels', kind: 'standalone', legacyUrl: 'https://travels.museumwnf.org/travel_et_home.php', newUrl: 'https://museumwithnofrontiers.github.io/travels/' },
];
const targets = portedTargets(sites);

test('a link to a ported legacy site fails the gate, with the site it should go to', () => {
  assert.deepEqual(
    [judge('https://ceramics.museumwnf.org/', targets).kind, judge('https://ceramics.museumwnf.org/', targets).target.slug],
    ['ported', 'ceramics'],
  );
  assert.equal(judge('https://galleries.museumwnf.org/list', targets).target.slug, 'galleries');
  assert.equal(judge('http://www.islamicart.museumwnf.org/database.php', targets).target.slug, 'islamicart');
});

test('legacy books are Publications; only the Exhibition Trails of travels are Travels', () => {
  assert.equal(judge('https://books.museumwnf.org/book/5/en', targets).target.slug, 'publications');
  assert.equal(judge('https://travels.museumwnf.org/travel_et_trailDetail.php?id=IAM;tn;1;en&fl=its', targets).target.slug, 'travels');
  assert.equal(judge('https://travels.museumwnf.org/travel_et_home.php', targets).kind, 'ported');
  assert.equal(judge('https://travels.museumwnf.org/booking_form.php', targets).kind, 'legacy');
  assert.equal(judge('https://travels.museumwnf.org/', targets).kind, 'legacy');
});

test("legacy's own domains count as their site's", () => {
  assert.equal(judge('https://www.discoverislamicart.org/index.php', targets).target.slug, 'islamicart');
});

test('an exhibition is matched by its path on the shared host', () => {
  assert.equal(judge('https://exhibitions.museumwnf.org/water_in_islam/en/theme/2', targets).target.slug, 'water-in-islam');
  assert.equal(judge('https://exhibitions.museumwnf.org/other_exhibition/en/', targets).kind, 'legacy');
});

test('an MWNF page with no new site is reported, not gated; other links are not judged', () => {
  assert.equal(judge('https://www.museumwnf.org/about/credits', targets).kind, 'legacy');
  assert.equal(judge('https://museumwithnofrontiers.github.io/ceramics/#/', targets).kind, null);
  assert.equal(judge('https://www.example.org/', targets).kind, null);
  assert.equal(judge('mailto:info@museumwnf.org', targets).kind, null);
  assert.equal(isMwnfHost('museumwnf.org'), true);
});

test('the allow list keeps a ported link on purpose, with its reason', () => {
  const allow = [{ href: '^https://ceramics\\.museumwnf\\.org/legacy-only', reason: 'kept' }];
  assert.deepEqual(
    [judge('https://ceramics.museumwnf.org/legacy-only', targets, allow).kind, judge('https://ceramics.museumwnf.org/legacy-only', targets, allow).reason],
    ['allowed', 'kept'],
  );
});
