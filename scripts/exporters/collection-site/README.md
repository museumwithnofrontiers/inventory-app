# Collection site exporter

Exports what the inventory holds for **one collection tree**, under the
model's own names, for a website built from the inventory's own concepts
only ([#2727](https://github.com/museumwithnofrontiers/inventory-app/issues/2727)).
It reads no legacy key, no legacy setting and no `extra`.

The site's runtime is the site's own code, never the package's: banner and
home picture, palette, chrome, sponsor logos, which language builds and pages
exist, partners it hides, its facets, its welcome popup.

> **Status: a try.** It is not in `instances/`, so `docker-entrypoint.sh all`
> neither runs nor publishes it. The rules below are #2727's recommendations
> (D1–D9), taken as working assumptions until they are decided.
>
> It was tested on a brand-new exhibition, made through the app's models on a
> throwaway copy of the database, with new collections, items, partners, a
> timeline and links. The readiness check found every gap planted in it.

## Run

```bash
npm ci
DB_HOST=… DB_USERNAME=… DB_PASSWORD=… DB_DATABASE=inventory \
  npm run export -- --instance examples/the-hijaz-railway.json --base-url https://inventory.metanull.eu
```

The package is written to `output/<slug>/`. The instance file holds exactly
`kind` (`"collection"`), `slug`, `name`, `collection_id` and `package_name`.
Any other field is refused, because it would be a site setting.

## Rules

| | Rule |
|---|---|
| R1 | The site is the instance's collection and every collection below it. A draft collection is left out together with its subtree. |
| R2 | Members are the items placed anywhere in the tree. A placed picture or detail stands for its object or monument. A member ships with its pictures and details. |
| R3 | An item's text, per language, comes from the first context that has one: the site's context, then the item's Project's context, then the Default Context. Each text records its `context_id`. |
| R5 | Partners are the holders of members, plus the tree's `collection_partner` rows as stored (`level`, `visible`, `parent_partner_id`). A partner's texts follow R3's order, with its own Project in the middle. |
| R6 | Timelines are those whose `collection_id` is in the tree. |
| R7 | Links are the tree's and the items' `links`, one entry each, as stored. |
| R8 | An item link ships when its source ships and its context is one that R3 reads the source's texts from. A target outside the site ships as a reference in `outside_items.json`. |

Drafts never ship: the shared `drafts.mjs` filters them out, and the export
fails if a draft item's id appears in any file it wrote.

## Readiness check

```bash
npm run check -- output/<slug>
```

The check reads an exported package and lists what an exhibition website
would lack, using the model's facts only. It writes the list to
`output/<slug>.readiness.json` and prints a summary. Each finding is one of:

- `error`: a page can't be built. Examples: a collection or member without a
  title or name in a site language, placements with no or duplicate order,
  a member with no image.
- `warning`: the page is built but visibly lacks something. Examples: no
  description, no holder, no Project.
- `info`: worth knowing. Examples: no dates, no country, no cover.

A site's languages are the languages its root collection has a title in.

## Package

Each entity is one file, an array: `collections`, `placements`, `items`,
`partners`, `collection_partners`, `links`, `contributors`, `timelines`, `timeline_events`, `item_links`,
`outside_items`, `tags`, `dynasties`, `artists`, `authors`, `glossary`,
`glossary_spellings`, `projects`, `countries` and `languages`.

Texts go in `translations/<entity>.<language id>.json`: an object keyed by
record id, using the inventory's language ids (`eng`, `fra` …).

`manifest.json` holds:
- `format: "collection-site"` and `format_version`;
- the site's slug and name;
- the root collection and the site's context;
- the languages present;
- the static rights block.
