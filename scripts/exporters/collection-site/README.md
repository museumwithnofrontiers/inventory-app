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
| R5 | Partners are the holders of members, plus the tree's `collection_partner` rows as stored (`level`, `visible`, `parent_partner_id`). A partner's own collections are the top-level collections that list it (`partner_collections.json`). |
| R6 | Timelines are those whose `collection_id` is in the tree. |
| R7 | Links are the tree's and the items' `links`, one entry each, as stored. |
| R8 | Item links ship in two cases: links in the site's context between records that ship (the site's related pictures), and a member's links in the Default Context or in its text's context (its sheet's related records). A target outside the site ships as a reference in `outside_items.json`. |

Drafts never ship: the shared `drafts.mjs` filters them out, and the export
fails if a draft item's id appears in any file it wrote.

## Package

Each entity is one file, an array: `collections`, `placements`, `items`,
`partners`, `collection_partners`, `partner_collections`, `top_collections`,
`links`, `contributors`, `timelines`, `timeline_events`, `item_links`,
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
