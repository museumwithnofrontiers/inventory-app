# Amulets Exporter

Reads the `inventory-app` database directly and writes a set of denormalized,
static JSON files for the rebuilt **Amulets and Talismans** website — no API
server, no auth, no runtime database dependency. Optionally packages and
publishes that output as a public npm package (`@museumwnf/amulets-data`) on
npmjs.

This is the first of the DXA gallery exporters
([epic #1539](https://github.com/museumwithnofrontiers/inventory-app/issues/1539),
[story #1542](https://github.com/museumwithnofrontiers/inventory-app/issues/1542)). It
replaces one legacy deployment of `dxa-api` + `dxa-client`:
<https://amulets.museumwnf.org>. The package specification it implements is
[`../docs/dxa-gallery-data-package.md`](../docs/dxa-gallery-data-package.md);
the legacy behaviour it reproduces is analyzed in
[`../docs/dxa-legacy-analysis.md`](../docs/dxa-legacy-analysis.md).

## What makes a gallery exporter different

The three earlier exporters (islamicart, baroqueart, sharinghistory) each
export a **project**. This one exports a **collection**, and almost everything
else follows from that.

- **The item universe is a membership union, not a project.** Legacy computed
  visibility as an OR predicate — items of the gallery's own mwnf3 project OR
  items listed in the six `thg_gallery_*` link tables. The importer
  materializes that union in `collection_item` ([#1517](https://github.com/museumwithnofrontiers/inventory-app/issues/1517),
  gap G1), so the exporter reads it as a plain join.
- **Amulets owns none of its content.** All 45 objects are borrowed: 24 from
  EPM, 13 from ISL, 5 from Sharing History and 3 from DCA. The source project
  shown on each sheet, and the context that selects a record's canonical
  translation, are therefore resolved **per item** rather than fixed per
  export.
- **EPM is the short description.** Legacy keeps the short text in
  `objects.description2`, which the importer files as a translation in the EPM
  context (`planTranslations` in `object-transformer.ts`). So the EPM-context
  row is the short description for every item — including EPM-native items,
  whose only row is that one and whose long description is legitimately empty.
- **Facet tags and sheet tags are different things.** `item_tag` carries both
  the THG tags that drive the five search facets (English-only, `thg:tags:*`)
  and the per-language `keyword`/`material` tags parsed out of the object
  records. `tags.json` holds the first; the second ship as `keywords` and
  `materials` inside the item translations. Mixing them would put 188
  unfaceted values into the Material dropdown on amulets alone.
- **Outbound links are references, never URLs** (decision Q3). Sibling
  galleries, "also on display in" galleries and related items outside the
  package are exported as identity plus whatever metadata the import carried
  (slug, legacy host, project key, `backward_compatibility`). Legacy resolved
  these from a manually-maintained table that has no counterpart in the new
  model, so an exporter cannot build the URLs — but it must not drop the
  links either. Related items carry `in_package` so the viewer knows which it
  can open locally.
- **The timeline is not gallery-specific, and it is a merge of two
  chronologies.** Legacy serves it from `mwnf3.hcr` *plus* `sh_hcr`
  exhibition 2, keyed by country and independent of any project, which is why
  the live amulets site answers `/events/countries` with the worldwide list
  even though its `hasCountryBasedTimeline` flag is false. Every gallery
  package carries the same 37 timelines over 26 countries (1,390 events) —
  see below.
- **`featured` and `status` are different flags** that share the enum
  `('A','H')`. `status` is site-wide visibility (A = active, H = hidden);
  `featured` is membership of the portal's highlight strip (A = highlighted,
  default H). dxa-api reports `featured` inverted — it copied the `hidden`
  projection without flipping it — so the live API claims amulets is featured
  when the record says otherwise. The package ships the documented meaning:
  amulets is `featured: false`. See `isFeatured` in
  `src/exporters/gallery-exporter.ts` and its tests.

## Two rules this exporter originally got wrong

The first release of this exporter ([#1542](https://github.com/museumwithnofrontiers/inventory-app/issues/1542))
shipped two behaviours that do not match the live API. Both were found while
building the amulets viewer ([#1566](https://github.com/museumwithnofrontiers/inventory-app/issues/1566)),
first corrected in the carpets fork, and are now corrected here.

### The global timeline is a merge of two chronologies, not one

`/v2/events` is served by `App\MWNF\DAO\v2\Events`, which queries **two**
sources and merges them sorted by year:

| Source | Legacy SQL | Importer keyspace | Timelines | Events |
|---|---|---|---|---|
| Discover Islamic Art country chronologies | `app/MWNF/SQL/mwnf3/Events.blade.php` | `mwnf3:hcr:country:<cc>` | 18 | 1,075 |
| Sharing History, **exhibition 2 only** | `app/MWNF/SQL/sh/Events.blade.php` | `mwnf3_sharing_history:sh_hcr:country:<cc>:exhibition:2` | 19 | 315 |

The SH half is pinned by a `where h.exhibition_id = 2` that the legacy source
labels a "HARDCODED BUSINESS DECISION" — exhibition 2 is *Political Context*.
Match only the first family (the rule this exporter used to apply) and 8
countries and 315 events vanish; widen to a bare `mwnf3:hcr:%` and the Baroque
Art chronology (`mwnf3:hcr:bar:country:*`) walks in. Two exact families, no
wildcard in the middle — see `GLOBAL_TIMELINE_LIKE_PATTERNS` in
`src/exporters/timeline-exporter.ts` and `tests/unit/timeline-scope.test.ts`.

The corrected set is **37 timelines over 26 countries, 1,390 events**, matching
the live `/events/count` exactly. North Macedonia is the case that proves the
rule: it has SH exhibitions 4/5/8/9 and no exhibition 2, and the live
`/events/count?ic[]=mc` answers 0.

Each row in `timelines.json` carries a `source` (`mwnf3` | `sharing_history`)
so a viewer can present one merged list per country the way legacy did.

### `countries.json` must cover the timeline too

Three sets of countries need names on a gallery site: the member items' own
countries, their holding museums' countries, and the countries of the global
timeline. This exporter used to ship only the first two, so the viewer fell
back to `Intl.DisplayNames` for every timeline-only country. On amulets the
item/partner union is 19 and the timeline set is 26; the union of all three is
**31** — the timeline alone contributes cze, egy, esp, fra, hun, ita, lbn, prt,
pse, sau, syr and tun.

## Package contents

| File | Contents |
|---|---|
| `manifest.json` | Export metadata, the gallery's UI languages, item count. Also `projects`: one entry per referenced project UUID, with a per-language name and the three URL columns (epic #1727 phase 2, additive) |
| `gallery.json` | Site anchor: slug, legacy host, names, banner/homepage item, chrome flags, sibling galleries |
| `items.json` | The 45 member items — full sheets, facet tag ids, images, references |
| `tags.json` | 115 THG facet tags with their category (artist/dynasty/material/subject/type) |
| `partners.json` | The 26 museums holding member items. One shape across every dataset (museumwithnofrontiers/inventory-app#1699): `featured`, `item_count`, plus `level`/`parent_id`/`project_uuids` from the curated hierarchy where the data has one |
| `countries.json` | The 31 countries the members, their holders and the timeline reference |
| `languages.json` | The 9 languages the site can display, flagged `site_language` |
| `dynasties.json` | The 10 dynasties member items reference |
| `glossary.json` | The 80 terms reachable from member item texts, with spelling lists |
| `timelines.json` / `timeline_events.json` | 37 country timelines over 26 countries, 1,390 events |
| `translations/<entity>.<lang>.json` | All human-readable text, one file per entity per language |

Entity files hold language-independent data; every human-readable string lives
under `translations/`. Image URLs are absolute, built from `BASE_URL`. A file
is absent when that entity has no translation in that language — viewers must
tolerate this.

Gallery chrome images (`image_path`, `banner_image_path`) are the exception to
the absolute-URL rule: they live on the legacy media server and were never
imported, so the package carries the legacy path only and the viewer supplies
the host, exactly as the legacy client did through `VUE_APP_IMAGES_URL`.

## Run

The exporters run inside Docker; there is no host-side Node tooling.

```bash
docker compose --profile jobs run --rm exporter amulets --force
```

Add `--publish` to bump the version, generate `package.json`/`README.md` and
push to npmjs — see [`NPM_PUBLISH.md`](NPM_PUBLISH.md).

The compose service points at the **staging** database
(`staging-mysql`), which is where the exporter should be developed and
verified. `scripts/exporters/amulets/.env` is only consulted when running
outside compose, and by convention those files point at **production** — read
it before running anything that way.

## Naming

The folder and package are `amulets` / `@museumwnf/amulets-data` — the site's
public identity (`amulets.museumwnf.org`) and the name fixed by decision Q4.
The legacy slug is `amulets_and_talismans`, and that is what `gallery.json`
carries as `slug`: data values keep legacy identity verbatim, folder names do
not.

## Known gaps

Verified during implementation, none blocking:

- **EPM author attribution.** Legacy shows `preparedBy`/`copyEditedBy` on the
  English sheet; the importer files those names only on the Arabic row for EPM
  items, so `author`/`copy_editor` are missing from the English translations
  of EPM-native records. Importer-side, not exporter-side.
- **`notice` and `notice_c`** are not imported at all. Empty on every amulets
  item, and neither is worth importing — `notice` holds one typo'd `&nbps;` on
  every row that has it, `notice_c` was never rendered by any legacy client.
  **`notice_b` used to be listed here and does not belong:** it is not a
  copyedit notice but the image rights line legacy renders as "Additional
  Copyright Information", and it is imported and exported as `copyright` since
  [#1629](https://github.com/museumwithnofrontiers/inventory-app/issues/1629). The
  2026-08-27 validation found no amulets item carrying one, so the row is
  expected to stay empty here — worth re-checking against the next import
  rather than assumed.
- **Museums with no items (MWNF-384) — implemented, and inert here.** Legacy's
  partner list has a third branch: museums created in the gallery's own project
  appear even when they hold nothing. The exporter reproduces it
  (`p.type = 'museum' AND p.project_id = <the gallery's project>`, resolved from
  the gallery's own anchor), on the museum→project link the importer now carries
  from `mwnf3.museums.project_id`. It selects nobody on amulets — no
  `mwnf3.museums` row has `project_id = 'AMU'`, and the export is 26 partners
  with or without it — but it is not inert generally (carpets goes 70 → 72), and
  this fork is the one the next gallery is copied from.
- **Legacy's two hardcoded partner exclusions** (`uk/Mus51`, `us/Mus51`, in
  `Partners.blade.php`) are not reproduced; neither holds an amulets member.

## Validation

[`tools/VALIDATION-2026-08-27.md`](tools/VALIDATION-2026-08-27.md) records the
export checked field by field against the live legacy API.

## Licence

The published package is Content of the MWNF Website under the
[MWNF legal notice](https://www.museumwnf.org/about/legal-notice) (story
museumwithnofrontiers/inventory-app#1690): `package.json`'s `license` defaults to
`SEE LICENSE IN LICENSE.md` (override with `PACKAGE_LICENSE`), the notice
text itself ships as `LICENSE.md` — a copy of the single shared
`scripts/exporters/docs/LICENSE.md.template` all seven exporters copy from,
so the terms cannot drift between packages — and `manifest.json` carries a
`rights` block (`rights_holder`, `terms_url`, `attribution`) a consuming
website reads to render a source credit.
