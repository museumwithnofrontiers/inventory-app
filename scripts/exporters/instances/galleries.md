# MWNF Galleries (instance galleries)

The package `@museumwnf/galleries-data` is produced by the standalone
exporter [`galleries`](../galleries/README.md). The package specification is
[`../docs/galleries-hub-data-package.md`](../docs/galleries-hub-data-package.md).
This note keeps what is specific to this site.

It replaces <https://galleries.museumwnf.org>, which legacy runs as one more
`dxa-api` deployment configured as `thg_gallery` 45 (legacy `link`
`galleries`, "Thematic Galleries", status **H**). The hidden
`gallery-partners.museumwnf.org` already redirects to it (checked on
2026-09-28). Epic [#1744](https://github.com/museumwithnofrontiers/inventory-app/issues/1744).

## Numbers

From the staging export of 2026-09-28, compared with the live legacy API
the same day.

- **37 galleries** in `galleries.json`, out of 42 under the galleries root:
  - the 5 hidden ones (legacy `excluded`, `galleries`, `curiosities`,
    `unclear`, `doubts`) are left out;
  - legacy's `/api/v2/thg/galleries` lists the same 37, and the order,
    English names and hosts match entry for entry.
- **8 partners** in `partners.json`: the museums of the `GALLERIES` project,
  which are legacy's `/api/v2/partners`, matched by legacy key.
  - Seven are at level `partner`.
  - Museu do Caramulo (`pt`/`Mus08`) has no level, which is legacy's
    "Affiliate" (`isPartner: 0`).
- **8 countries**: those of the partners.
- **Languages:** the hub itself is English only. Its collection has an
  English row alone, and legacy's `/api/v2/i18n` carries the hub's own texts
  in English only. Partner and gallery names add 5 more languages to
  `languages.json`.
- **Determinism:** two exports were byte-identical, apart from
  `generatedAt`.

## Decisions

- **Scope (Pascal, 2026-09-28):** galleries and partners only. Legacy's
  partner objects, item sheets and timeline are not rebuilt.
- **Partners (Pascal, 2026-09-28):** legacy's 8, not a union of every
  gallery's partners.
- **Order:** legacy orders galleries by `thg_gallery.sort_order`, which the
  importer does not carry. The exporter sorts by English name instead,
  because that is what `sort_order` encodes today (the list above matches
  legacy's).
- **Random picks:** legacy's featured galleries (4) and featured partners
  (3) are picked at random per request and read no flag. The site reproduces
  that from the full lists.

## Known gaps

- Legacy's gallery-list icons (`<galleryKey>.png`) and the three "Other
  Virtual Museums" pictures live only in the legacy client bundle. They are
  site assets for the site story (H.4), not package data.
