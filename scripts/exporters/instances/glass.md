# Glass (instance glass)

The package `@museumwnf/glass-data` is produced by
[`dxa-gallery`](../dxa-gallery/README.md) from [`glass.json`](glass.json)
next to this file — see
[`../docs/dxa-gallery-data-package.md`](../docs/dxa-gallery-data-package.md)
for the package specification and
[`../dxa-gallery/NPM_PUBLISH.md`](../dxa-gallery/NPM_PUBLISH.md) for the
publish mechanics. This note keeps everything specific to this site: legacy
scope, membership reasoning, decisions and known gaps.

It replaces one legacy deployment of `dxa-api` + `dxa-client`:
<https://glass.museumwnf.org> (`thg_gallery` 18, legacy `link` `glass`,
mwnf3 project `DGA`). Part of M5 wave 2
([epic #1738](https://github.com/museumwithnofrontiers/inventory-app/issues/1738)),
exported through the same shared `dxa-gallery` exporter as every other
gallery site.

## Glass is the hybrid gallery of this wave, like carpets

Every other wave-2 gallery (communication, funerary-objects, woodwork,
gold-silver) is purely curated — their mwnf3 project carries no objects of
its own. Glass is not: `DGA` ("Discover Glass Art") is a real, importer-
modeled project, the same architectural shape as `DCA` (carpets' native
project).

- **466 member items, 312 of them native (`DGA`).** The membership union is
  still items of the gallery's own project OR items listed in the
  `thg_gallery_*` link tables. Read from `items.json` `project_id` against
  `manifest.json`'s `projects` map, the remaining 154 are borrowed:
  - 56 from **Discover Islamic Art** (`ISL`)
  - 43 from **Explore Islamic Art Collections** (`EPM`)
  - 38 from **Sharing History** (`awe`)
  - 7 from **Water in Islam** (`GalEx6`)
  - 6 from **The Table Is Set** (`EXTHE`)
  - 2 from **The Use Of Colours In Art** (`EXHCOLOUR`)
  - 1 from **The Hijaz Railway** (`GalEx5`)
  - 1 from **MWNF Galleries** (the cross-gallery curatorial project)
- **The epic's open question — is `DGA` a second independent main site
  beyond this gallery?** `gallery.json`'s `project_id` field (the UUID of the
  gallery's own project *as a modeled `collections` row*, distinct from
  `mwnf3_project_id`, the bare legacy key) is **non-null** here
  (`ad963031-4a8c-5d06-b797-b7cfc772e3c0`) — the same as it would be for
  carpets/`DCA`, and unlike every other wave-2 gallery, where `project_id` is
  `null` because the gallery's mwnf3 project was never modeled as its own
  collection (it is curatorial-only, e.g. `COM`, `FUN`, `WOO`, `GOL`). This
  export shows `DGA` has 312 of its own objects and its own project
  collection row — evidence consistent with "Discover Glass Art" being a
  real, standalone-able dataset, exactly the `DCA`↔carpets pattern the epic
  flagged. Nothing in this export's scope (a `gallery`-kind instance) creates
  or requires a second, independent `DGA` site; this note only records the
  evidence found, as asked. The decision on whether `DGA` ever becomes its
  own standalone site is out of scope here and belongs to a future wave.
- **Languages: 4 site languages (ar/en/es/fr), 9 languages overall**
  (`languages.json`).
- **`gallery.json`: `featured: true`, `hidden: false`.** The live
  `/api/v2/thg/galleries/self` (fetched 2026-09-21, one call) answers
  `featured: false`, `hidden: false` — the polarity mismatch here runs in the
  **opposite direction** from every other wave-2 gallery (package `true`,
  live `false`), the same direction as documented on
  [`carpets`](carpets.md#carpets-is-the-hybrid-gallery): `dxa-api` copies the
  `hidden` projection into `featured` without flipping it, so which way the
  mismatch runs depends on the record's own stored `featured`/`hidden`
  values, not on any rule about hybrid vs. curatorial galleries. The package
  ships the documented meaning. `hasTimeline`/`hasCountryBasedTimeline` both
  `false` on the live endpoint, matching `has_timeline`/`has_country_timeline`
  in `gallery.json`. The live endpoint also reports one `logos` entry here
  (IYOG — UN International Year of Glass 2022) — the first non-empty `logos`
  array seen across this wave or wave 1; `gallery.json` does not carry a
  `logos` field, consistent with the package spec (the legacy `thg_gallery_logos`
  table is otherwise dead, per `dxa-legacy-analysis.md`), so nothing to fix here.
- **37 timelines, 26 countries, 1,390 events** in `timelines.json` /
  `timeline_events.json` — the same corrected totals as every other DXA
  gallery so far.
- **33 countries** in `countries.json`.
- **77 partners**, 22 `featured`, 0 with `item_count: 0` — the MWNF-384
  branch (a museum created under the gallery's own project but holding
  nothing) is inert here too: either no `mwnf3.museums` row carries
  `project_id = 'DGA'`, or every one that does already holds a member item.
  Which of the two applies was not distinguished during this export (it was
  on carpets, where the branch does fire); recorded as observed rather than
  investigated further.
- **352 tags** (artist 100, dynasty 39, material 93, subject 19, type 101),
  **22 dynasties**, **123 glossary entries**.

## Known gaps

Verified during this export, none blocking:

- **234 items have an empty English (`en`) description**, out of 466
  (`translations/items.en.json` against `items.json`) — the largest fraction
  of any DXA gallery site so far (50%). It splits three ways:
  - **189 of the 312 native `DGA` items** (61%) — **not** the EPM
    short-description rule (these are native, not EPM-context, records).
    This is a new, gallery-specific gap not seen on carpets, amulets,
    coins-medals or the rest of this wave, and it was not investigated
    further during this export; recorded as an open question for the
    gallery epic. Ten sample ids: `6c64959a-ef24-5b36-b22d-27aafad34901`,
    `252aad9a-d776-5abc-83d7-3b5203d07d80`,
    `8bd2685c-4d66-5da7-a343-412c67377856`,
    `97370ac7-3f59-5457-bb14-761465a5b657`,
    `abe30f06-2ba6-5d8c-9a97-e779785c8cc6`,
    `723a1b51-de0e-51a4-bd20-5f0e3f390f2e`,
    `73591acc-1e71-5f44-af5c-7f30c06e4c55`,
    `437746a9-6e03-54b3-96cc-81c10acfd104`,
    `c2156823-ed9a-51e3-8767-c9347fdd1977`,
    `9a308297-8358-540c-b3b4-96934ef243d8`.
  - **43 of the 43 `EPM` items** (100%) — the standard, already-documented
    importer-side EPM short-description gap.
  - **2 of the 2 `EXHCOLOUR` (The Use Of Colours In Art) items** (100%) —
    every borrowed item from that project happens to have an empty
    description here; not investigated further, recorded as observed.
- **No item is missing an English title.** All 466 items resolve a
  non-empty `name` in `translations/items.en.json`.
- **EPM author attribution** — same importer-side gap as carpets/coins-medals:
  `preparedBy`/`copyEditedBy` file only onto the Arabic row for EPM items, so
  `author`/`copy_editor` are absent from the English translation of the 43
  EPM-sourced records here too. Not re-verified item by item on this site.
- **`notice` and `notice_c`** are not imported, per the standing rule
  documented on carpets/coins-medals; not specifically re-checked here.

## Package contents

Same shape as [`carpets`](carpets.md#package-contents) and
[`coins-medals`](coins-medals.md#package-contents) — see either for the full
file list and what each holds. Nothing about the package shape is different
here.
