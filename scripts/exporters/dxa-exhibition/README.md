# DXA Exhibition Exporter

Reads the `inventory-app` database directly and writes a set of denormalized,
static JSON files for a DXA exhibition website — no API server, no auth, no
runtime database dependency. Optionally packages and publishes that output as
a public npm package (`@museumwnf/<site>-data`) on npmjs.

Unlike the four single-site forks it replaces (`the-use-of-colours-in-art`,
`water-in-islam`, and the gallery-only `carpets`/`amulets`), this exporter is
not built for one site: **which exhibition it exports is a runtime parameter**,
read from an *instance file* — see [Instance files](#instance-files) below.
The package specification it implements is
[`../docs/dxa-exhibition-data-package.md`](../docs/dxa-exhibition-data-package.md).
Reference material for the sites it currently serves — legacy figures,
per-site gaps and validation notes — stays with the forks for now
(`../the-use-of-colours-in-art/`, `../water-in-islam/`); a later story retires
them once every DXA exhibition site runs from this directory.

## An exhibition is a gallery plus a curated layer

Everything the gallery layer exports applies unchanged — the membership union,
facet tags, partners, glossary, countries, languages, the worldwide timeline —
so those scoping rules are inherited from
[`../dxa-gallery`](../dxa-gallery/README.md) rather than re-derived. Three
things are new on top of a gallery package:

- **`exhibition.json` replaces `gallery.json`.** Same site anchor plus the
  curated per-language chrome: titles, sub-titles, banner headlines, About
  bodies, pop-up logo blocks, the sponsor-logo strip, the partner strip, and
  `languages_enabled`.
- **`themes.json`** is the curated theme tree — the site's own picture
  selections, nested one level (themes and sub-themes), each with its own
  per-exhibition text and related-picture links.
- **`related_content.json`** is the categorized reading list on `/related`.

An exhibition can also carry its own narrative timeline
(`mwnf3_thematic_gallery.hcr`) alongside the worldwide one every gallery gets;
`timelines.json` ships both and tags each row with its `source`.

## Instance files

`--instance <name|path>` tells the exporter which exhibition to export. A bare
name (no path separator, no `.json` suffix) is looked up in the shared
`scripts/exporters/instances/` directory next to every exporter package; a
value that looks like a path is read from there instead. See
[`../instances/README.md`](../instances/README.md) for the file format,
validation rules and how to add a new site.

This directory contributes two instance files:

- [`../instances/the-use-of-colours-in-art.json`](../instances/the-use-of-colours-in-art.json)
- [`../instances/water-in-islam.json`](../instances/water-in-islam.json)

An instance file with `kind: 'gallery'` is refused — an exhibition exporter run
against a collection with no curated theme tree would produce an empty
`themes.json`/`related_content.json` with nothing to say why. Use
[`../dxa-gallery`](../dxa-gallery/README.md) for a gallery instance instead.

## Run

The exporters run inside Docker; there is no host-side Node tooling required.

```bash
docker compose --profile jobs run --rm exporter dxa-exhibition --instance the-use-of-colours-in-art --force
```

Add `--publish` to bump the version, generate `package.json`/`README.md` and
push to npmjs — see [`NPM_PUBLISH.md`](NPM_PUBLISH.md).

The compose service points at the **staging** database (`staging-mysql`), which
is where the exporter should be developed and verified.
`scripts/exporters/dxa-exhibition/.env` is only consulted when running outside
compose, and by convention those files point at **production** — read it
before running anything that way.

Outside Docker (Node ≥ 20 on the host), from this directory:

```bash
npm ci
npm run export -- --instance water-in-islam --force
```

## Output layout

Each run writes to `output/<slug>/`, where `<slug>` is the instance's `slug`
field (the site's kebab-case identity, e.g. `the-use-of-colours-in-art`) —
never the exhibition's legacy underscore slug, which stays in the data as
`exhibition.slug`. `--force` deletes and recreates only that subdirectory, so
two instances can be exported into the same `output/` without clobbering each
other.

The version counter for `--publish` lives next to it, per instance, at
`output/.version-<slug>` — outside the package directory so `--force` does not
reset it. See [`NPM_PUBLISH.md`](NPM_PUBLISH.md) for the publishing mechanics
and version-management rules, which are unchanged from the single-site forks
other than being keyed by instance slug instead of being hardcoded.

## Package contents

| File | Contents |
|---|---|
| `manifest.json` | Export metadata, `site.key` (from the instance), the languages present, item and theme counts, and `projects`: one entry per referenced project UUID with a per-language name and the three URL columns |
| `exhibition.json` | Site anchor: slug, legacy host, titles/subtitles/headlines/abouts, enabled languages, logos, partner strip, chrome flags, sibling sites |
| `themes.json` | The curated theme tree — themes and sub-themes, each with its curated pictures, cover picture and related-picture links |
| `related_content.json` | The categorized reading-list entries |
| `items.json` | The exhibition's member items — full sheets, facet tag ids, images, references |
| `tags.json` | The facet tags reachable from member items, with their category |
| `partners.json` | Museums and institutions holding a member item, plus any created under the exhibition's own project. One shape across every dataset (museumwithnofrontiers/inventory-app#1699) |
| `countries.json` | Countries of the member items, their holders, and the worldwide timeline |
| `languages.json` | Languages the site can display — the UI roster plus every language carried by a borrowed record or a partner |
| `dynasties.json` | Dynasties member items reference |
| `glossary.json` | Terms reachable from member item texts, with spelling lists |
| `timelines.json` / `timeline_events.json` | The worldwide country timelines, plus the exhibition's own narrative chronology when it has one |
| `translations/<entity>.<lang>.json` | All human-readable text, one file per entity per language |

Entity files hold language-independent data; every human-readable string lives
under `translations/`. Image URLs are absolute, built from `BASE_URL`. A file
is absent when that entity has no translation in that language — viewers must
tolerate this.

## Licence

The published package is Content of the MWNF Website under the
[MWNF legal notice](https://www.museumwnf.org/about/legal-notice) (story
museumwithnofrontiers/inventory-app#1690): `package.json`'s `license` defaults
to `SEE LICENSE IN LICENSE.md` (override with `PACKAGE_LICENSE`), the notice
text itself ships as `LICENSE.md` — a copy of the single shared
`scripts/exporters/docs/LICENSE.md.template` every exporter copies from, so
the terms cannot drift between packages — and `manifest.json` carries a
`rights` block (`rights_holder`, `terms_url`, `attribution`) a consuming
website reads to render a source credit.
