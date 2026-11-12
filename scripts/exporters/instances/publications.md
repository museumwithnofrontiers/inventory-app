# Publications (instance publications)

The package `@museumwnf/publications-data` is produced by the standalone
exporter [`publications`](../publications/README.md). The package
specification is
[`../docs/publications-data-package.md`](../docs/publications-data-package.md).
This note keeps what is specific to this site.

It replaces <https://books.museumwnf.org> (book-client on the book-api), and
keeps that domain when it moves (D-E1; the cutover comes when parity passes).
Until then it is served on GitHub Pages, as every site, and its instance file
names no `origin`. Epic
[#2514](https://github.com/museumwithnofrontiers/inventory-app/issues/2514).

## Membership

The site shows no item of its own: its instance file has neither
`project_ids` nor `item_scope`, so the shared rule (`../shared/sites.mjs`)
never names it for an item. Its catalogue entries and trail entries are
references to the items' own sites. Publications are not in Search or My
Collection in v1 (D-E2).

## Decisions (Pascal, 2026-11-12, #2517)

- **D-P1:** all 28 works, the five third-party "Other Books" included.
- **D-P2:** the seven versions legacy hides are in the inventory with
  `visible` false; the package leaves them out.
- **D-P6:** covers, sample pages and the sample and credits PDFs all ship.
- **D-P8:** the shop links stay in the inventory's holding area and are not
  exported.
- **D-P9:** an edition's own texts ship on the edition, as `texts`.
