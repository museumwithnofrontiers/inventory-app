# Instance files

An instance file is what turns a parameterised DXA exporter (`dxa-gallery`,
`dxa-exhibition`) into "the exporter for this one site". It replaces the
hardcoded legacy id, site slug and package name that a forked exporter used to
bake into its own source: with an instance file, no legacy id appears
anywhere in the exporters' code, and adding a new site is authoring a JSON
file, not copying a directory.

`docker-entrypoint.sh all` ([story #1922](https://github.com/museumwithnofrontiers/inventory-app/issues/1922))
reads every file here to build its batch plan — including the `kind:
"standalone"` files below, which exist only for that batch and are never read
by `dxa-gallery` or `dxa-exhibition` themselves.

For a `gallery`/`exhibition` site, authoring an instance file is one step of
a larger procedure — see
[`docs/deployment/new-website.md`](../../../docs/deployment/new-website.md)
for the full ordered recipe, from looking up the legacy collection to a
live, discovered site.

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
  `dxa-gallery`; `"exhibition"` is read by `dxa-exhibition`. Each of those two
  exporters refuses an instance file of the other kind, naming the exporter
  that should be used instead — a copy-pasted instance file must fail loudly,
  not export the wrong shape.

  `"standalone"` is a third kind, read only by `docker-entrypoint.sh all`
  (never by `dxa-gallery` or `dxa-exhibition`, which know only `gallery` and
  `exhibition` — see below): it names one of the three forked exporters
  (`islamicart`, `baroqueart`, `sharinghistory`) that predate the instance-file
  design and keep their own hardcoded scope in `src/cli/export.ts` (see the
  *Why forked per dataset* section of `../README.md`). A `standalone` file
  carries `slug`, `name`, `exporter` and `package_name` — no `collection_id`,
  since the exporter it names does not take `--instance` at all.
- `slug` — the site slug (`^[a-z0-9]+(-[a-z0-9]+)*$`). This is deliberately
  a separate field from the collection's own DB slug (see `collection_id`
  below): the two can differ, and conflating them would leak a legacy naming
  accident into the site.
- `name` — a non-empty display name for the site, used in the exporter's own
  console output.
- `collection_id` — the UUID of the `collections` row (type `gallery` or
  `exhibition`) this site is scoped to. This is the one field that replaces
  what used to be a hardcoded legacy id: the exporter resolves the collection
  by this UUID alone and never touches a legacy identifier. Required for
  `kind: "gallery"` and `kind: "exhibition"`; absent from a `standalone` file.
- `package_name` — the npm package name the export becomes
  (`^@museumwnf\/[a-z0-9-]+-data$`).
- `exporter` — `kind: "standalone"` only: the exporter directory name
  (`islamicart`, `baroqueart` or `sharinghistory`) that `docker-entrypoint.sh
  all` runs for this instance, with no `--instance` argument.
- `languages_enabled` — `kind: "exhibition"` only, optional: a non-empty array
  of lowercase, de-duplicated 2-char language codes (e.g. `["en", "de"]`).
  When present, it overrides `exhibition.json`'s `languages_enabled` and
  `manifest.site.languages`, which otherwise derive from legacy's
  per-language `exhibition_i18n.enabled` flag. Use it only when that legacy
  flag is wrong for this site — for example, a record under development that
  legacy currently enables no language for, but that should still ship a
  working build. Each code must be one `dxa-exhibition` already knows about
  the exhibition's languages (i.e. present in the `languages` table); an
  unrecognised code fails the export rather than silently shipping nothing.

Any field not in the list a loader knows (`dxa-gallery`: `kind`, `slug`,
`name`, `collection_id`, `package_name`; `dxa-exhibition`: the same five plus
`languages_enabled`) is rejected by that loader: an instance file is
hand-authored, so a typo in a field name (`"sulg"` for `"slug"`) must fail the
load rather than silently produce an instance with a missing field. This is
also why a `standalone` file's `exporter` field — and `kind: "standalone"`
itself — makes both DXA loaders refuse it outright, on purpose: running
`dxa-gallery --instance islamicart` after adding `islamicart.json` below fails
before touching the database, with

```
Error: Instance file .../scripts/exporters/instances/islamicart.json has unknown field(s): exporter. A typo here would otherwise pass silently — known fields are: kind, slug, name, collection_id, package_name.
```

— `dxa-gallery`'s own field check, not `docker-entrypoint.sh all`'s. (A
`standalone` file with no `exporter` field — nothing left to reject — would
instead reach the `kind` check and fail with `must have "kind": "gallery"
(got "standalone")`; either way, the wrong exporter never reaches the
database.) `docker-entrypoint.sh all` itself never invokes `dxa-gallery` or
`dxa-exhibition` for a `standalone` instance in the first place — see the
*Batch* section of `../README.md`.

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

`languages_enabled` (exhibition only, see above) is not that field reborn: it
does not name the exhibition's full language roster, only overrides which of
its *already-known* languages are published, and only for a site where
legacy's own `enabled` flag is wrong. It still drifts if left in place after
legacy is corrected — remove it once a re-import fixes the underlying data.
