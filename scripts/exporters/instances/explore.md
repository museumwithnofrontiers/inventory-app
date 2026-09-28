# Explore (instance explore)

The package `@museumwnf/explore-data` is produced by the standalone exporter
[`explore`](../explore/README.md). The package specification is
[`../docs/explore-data-package.md`](../docs/explore-data-package.md), and the
legacy analysis behind it
[`../docs/explore-legacy-analysis.md`](../docs/explore-legacy-analysis.md).
This note keeps what is specific to this site.

It replaces <https://explore.museumwnf.org>, a Vue client on its own API
(`/api/…`). The old PHP site under `.legacy-code/explore/` served
explorewithmwnf.net, a domain that now serves an unrelated gambling site:
never link it. Epic [#1745](https://github.com/museumwithnofrontiers/inventory-app/issues/1745).

## Numbers

From the staging export of 2026-09-28, against the live API crawled the same
day:
- **6 themes, 23 countries, 18 territories, 649 locations** — as live.
- **12 itineraries and 114 sub-itineraries** (109 exhibition trails and 5
  location routes) — as live.
- **1,691 of the 1,693 live monument ids**, on the location memberships.
  1682 (no name in legacy) and 1801 (its target was never imported) are left
  for the comparison story.
- **3,191 items**: 1,982 monuments, 878 details, 331 linked objects.
- **Determinism:** two exports were byte-identical, apart from `generatedAt`.

## Decisions

- **D1 (Pascal, 2026-09-28):** the whole travel layer ships.
- **D2:** the six text pages go to the site's locales (`site-i18n`
  `extract:explore`); the home banners and the featured partnerships go in the
  package.
- **D3:** the package ships the records Explore's monuments resolve to,
  Travels "Exhibition Trails" included.
- **Site records (Pascal, 2026-09-28):** on a new root collection,
  `mwnf3_explore:root`, parent of the three section roots.
- **Maps:** Leaflet and OpenStreetMap, with no key; legacy's Google Maps key
  is not reused.

## Known gaps

- Travel Book covers are not carried: no rule in the data explains legacy's
  pick among the Books database's covers.
- Sub-itinerary 3 shows book 31 in the package's rule but not on live (see
  the analysis doc).
