# Instance files

An instance file is what turns a parameterised DXA exporter (`dxa-gallery`,
`dxa-exhibition`) into "the exporter for this one site". It replaces the
hardcoded legacy id, site slug and package name that a forked exporter used to
bake into its own source: with an instance file, no legacy id appears
anywhere in the exporters' code, and adding a new site is authoring a JSON
file, not copying a directory.

## Naming

One file per site, named `<slug>.json`, where `<slug>` is the site's own
slug — the value used for the output directory, the data-package name and
`manifest.site.key`. It is passed to the exporter with `--instance <slug>`
(a bare name, resolved against this directory) or `--instance <path>` (any
path containing a `/` or `\`, or ending in `.json`, used as-is).

A `<slug>.md` next to a `<slug>.json` is that site's note: legacy scope,
membership and borrowed-record reasoning, gaps, decisions and other
per-site quirks that do not belong in the shared exporter or its
specification doc. It is prose for humans, read by nothing at export time.

## Fields

- `kind` — which exporter this instance is for. `"gallery"` is read by
  `dxa-gallery`; `"exhibition"` is read by `dxa-exhibition` (arriving with
  story #1912). Each exporter refuses an instance file of the other kind,
  naming the exporter that should be used instead — a copy-pasted instance
  file must fail loudly, not export the wrong shape.
- `slug` — the site slug (`^[a-z0-9]+(-[a-z0-9]+)*$`). This is deliberately
  a separate field from the collection's own DB slug (see `collection_id`
  below): the two can differ, and conflating them would leak a legacy naming
  accident into the site.
- `name` — a non-empty display name for the site, used in the exporter's own
  console output.
- `collection_id` — the UUID of the `collections` row (type `gallery` or
  `exhibition`) this site is scoped to. This is the one field that replaces
  what used to be a hardcoded legacy id: the exporter resolves the collection
  by this UUID alone and never touches a legacy identifier.
- `package_name` — the npm package name the export becomes
  (`^@museumwnf\/[a-z0-9-]+-data$`).

Any field not in this list is rejected: an instance file is hand-authored, so
a typo in a field name (`"sulg"` for `"slug"`) must fail the load rather than
silently produce an instance with a missing field.

## Obtaining a `collection_id`

Collection UUIDs are importer-deterministic, not assigned by hand. Look one
up with the artisan command, run inside the `app` (or `staging-app`)
container:

```
php artisan importer:find-collection gallery <legacy id|slug|exact English title> --json
php artisan importer:find-collection exhibition <legacy id|slug|exact English title> --json
```

## Why `languages` is not a field

The epic that introduced this exporter family originally proposed a
`languages` field. It was dropped: the languages a site publishes are
curatorial data the importer already stores on the collection (from
`thg_gallery_lang` and the equivalent exhibition table), and the exporter
reads them from there. A copy of that list in the instance file would have no
way to stay in sync with a re-import and would drift the first time a
language is added or removed upstream.
