# Travels (instance travels)

The package `@museumwnf/travels-data` is produced by the standalone exporter
[`travels`](../travels/README.md), a fork of `explore`. The package
specification is
[`../docs/travels-data-package.md`](../docs/travels-data-package.md). This
note keeps what is specific to this site.

It replaces the Exhibition Trails of <https://travels.museumwnf.org> (the
frozen PHP site), and keeps that domain when it moves (D-T1, D-E1; the
cutover comes when parity passes). Until then it is served on GitHub Pages,
as every site, and its instance file names no `origin`. Epic
[#2514](https://github.com/museumwithnofrontiers/inventory-app/issues/2514).

## Membership

`item_scope` says which items the site shows, for the shared rule
(`../shared/sites.mjs`): the members of the locations under the collection of
purpose `travels-root`. A trail's own members, its entries, are Islamic Art's
records (legacy `objects_trails`, `monuments_trails`): the rule does not name
Travels for them, and the package ships them as references.

## Decisions (Pascal, 2026-11-12, #2517)

- **D-T2:** guides and agencies are not in the inventory, nor the 2013 tour
  offers.
- **D-T3:** the Travels items carry their legacy project (IAM, GPA). Neither
  project is listed in this file's `project_ids`: that rule names a site for
  every item of a project, and IAM has records outside the Travels tree.
- **D-T4:** Explore's tour teasers stay in the Explore package while
  travels.museumwnf.org serves the tours.
- **D-T6:** each trail links to its "Starting point" partner.
