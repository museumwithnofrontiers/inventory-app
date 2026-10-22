# Data packages MCP

A read-only [MCP](https://modelcontextprotocol.io) server that lets an AI
assistant browse the **published** `@museumwnf/*-data` npm packages: the
static JSON data packages the exporters under
[`../exporters/`](../exporters/README.md) publish and the public websites
install. It is meant for import-quality assessment: compare what two published
versions contain, inspect individual records, and follow a record back to the
inventory (its `id`) and to legacy (its `backward_compatibility` key).

```
legacy DBs ─▶ importer ─▶ inventory DB ─▶ exporter ─▶ npmjs @museumwnf/<site>-data ─▶ websites
                                                              ▲
                                                  this server reads only here
```

What it never does:

- read the inventory database, or an exporter's local `output/` directory;
- publish, authenticate, or write anywhere except its own cache;
- fetch anything but the npm registry and the `/pub/` images a package
  references.

## Running it

Docker only, like every tool in this repository. The repo-root
[`.mcp.json`](../../.mcp.json) registers the server with Claude Code as
`mwnf-data-packages`:

```json
"command": "docker",
"args": ["compose", "--progress", "quiet", "run", "--rm", "-T", "--build", "--quiet-pull", "data-packages-mcp"]
```

Open the repository in Claude Code and approve the project MCP server when it
asks (or run `/mcp` in an interactive `claude` terminal). The first start
builds the `mwnf/data-packages-mcp` image; later starts reuse the build cache,
so they take a second or two and always run the current sources.

`--progress quiet` is not cosmetic: without it `docker compose run --build`
writes BuildKit's progress to **stdout**, which is the MCP channel, and the
client sees garbage instead of the handshake.

From a worktree, run it from the worktree's root: compose resolves the build
context relative to `compose.yml`.

Without compose:

```bash
docker build -t mwnf/data-packages-mcp scripts/data-packages-mcp
docker run -i --rm -v mwnf-pkg-cache:/cache mwnf/data-packages-mcp
```

Both share the `mwnf-pkg-cache` volume. Published versions are immutable, so
nothing in it expires; `docker volume rm mwnf-pkg-cache` only costs a
re-download.

### Settings

All optional, as environment variables (add `environment:` to the compose
service, or `-e` to `docker run`):

| Variable | Default | |
|---|---|---|
| `NPM_REGISTRY_URL` | `https://registry.npmjs.org` | Registry to read |
| `DATA_PACKAGES_SCOPE` | `museumwnf` | Only `@<scope>/<name>-data` packages are served |
| `DATA_PACKAGES_CACHE` | `/cache` in the image | Where extracted versions are kept |
| `MAX_TARBALL_MB` | `200` | Largest tarball accepted |
| `MAX_EXTRACTED_MB` | `1024` | Largest unpacked package (gzip bombs stop here) |
| `MAX_TARBALL_ENTRIES` | `20000` | Most files in one tarball |
| `MAX_IMAGE_KB` | `4096` | Largest image `view_image` returns |
| `MAX_OUTPUT_CHARS` | `60000` | Longest tool answer before it is cut, with a hint to page |

## Tools

Every tool except `list_packages`, `list_versions`, `select` and
`diff_versions` works on the **selected** package version, or on an explicit
`package` (+ `version`) passed to that one call. Package names may be short:
`islamicart`, `islamicart-data` and `@museumwnf/islamicart-data` are the same.
A version is an exact version or a dist-tag (`latest` by default); `select`
pins a tag to the version it names at that moment.

Every lookup (`ref`, `id`, `collection`, `partner`…) accepts either the
inventory `id` or the legacy `backward_compatibility` key, and every listing
leads with both.

| Tool | What it answers |
|---|---|
| `list_packages` | Every published `@museumwnf/*-data` package, with latest version and publish date. Discovered from the registry each time (search ∪ org listing), never a fixed list. |
| `list_versions(package)` | Published versions, newest first, with dist-tags, dates, file counts and sizes. |
| `select(package, version)` | Downloads (once), verifies and opens a version, and makes it the default. Returns its family, languages and entity files. |
| `get_manifest` | `manifest.json` and `package.json`, and the detected family. |
| `list_files(prefix?)` | Every file with its size, and the record count of each top-level array. |
| `read_file(path, page)` | One file, paged: arrays by records, translation maps by entries, text by characters. |
| `query(file, expression)` | [JMESPath](https://jmespath.org) over any JSON file of any family. Array results are paged. |
| `list_items(filters)` | Items, filtered by `type`, `collection` (with or without sub-collections), `partner`, `country`, `has_images`, `text`, `language`, `tag`. |
| `get_item(ref)` | The base record merged with its `translations/items.<lang>.json` entries, with partner, project, collections, tags, dynasties, glossary, parent/children and related items resolved, and declared languages checked against the translations that exist. |
| `list_collections` / `get_collection(ref)` | The collection tree (see families below), with depth, children and item counts; one node with its translations, ancestors, children and paged members. |
| `list_partners` / `get_partner(ref)` | Partners, with their declared `item_count` beside the items the package actually ships for them. |
| `list_glossary` / `get_glossary(ref)` | Glossary words and spellings; one entry with every translation and the items using it. |
| `list_timelines` / `get_timeline(ref)` | Timelines with event counts (and orphan events); one timeline's events with their texts. |
| `get_record(file, ref)` | Any record of any entity file (dynasties, tags, themes, galleries, related content, countries…) merged with its translations. |
| `stats(file?)` | Records per type, translation coverage per language, fields left empty, items without images or translations, declared-vs-actual languages, partner `item_count` checks. With `file`: one entity in depth, with per-language field fill rates. |
| `diff_versions(package, from?, to?, file?, id?)` | What changed between two versions — see below. |
| `view_image(url)` | Fetches an image a record references and returns it as an image. |

Files are also exposed as MCP resources,
`datapackage://<name>@<version>/<path>` (e.g.
`datapackage://islamicart-data@1.0.51/translations/items.fr.json`); the
resource list shows the selected version's files.

### `diff_versions`: the assessment tool

Three levels, each pointing at the next:

1. **Summary** (no `file`, no `id`): one line per changed file — records
   added, removed and changed, and which fields moved and how often. Files
   added or removed are listed apart. Fields that change on every export
   whatever the data did (`manifest.json` `generatedAt` and `version`,
   `package.json` `version`) are reported under `volatile` and do not make a
   file count as changed.
2. **File** (`file=items.json`): the records behind a line, paged, each with
   its key, `backward_compatibility`, name and the changed field paths.
3. **Record** (`id=<id or backward_compatibility>`, optionally with `file`):
   that record field by field, before and after, in every file that holds it
   — the entity file and each `translations/<entity>.<lang>.json`.

Defaults: `to` is the selected version (else `latest`), `from` is the version
published just before `to`. Arrays of objects are matched by key (`id`,
`picture_item_id`, `legacy_id`, `url`, `code`), so a reordering reads as
`images[order]` and an edit inside one image as
`images[url=…/pub/….jpg].copyrights`, not as every element changing.

### `view_image`

Only `https://<host>/pub/<filename>` URLs whose host is one the package itself
uses for its `/pub/` images; no query string, no credentials, no redirects,
an `image/*` content type and a size cap. It is not a general fetcher. Each
request may make the inventory host burn and cache a rendition, so view what
you need rather than sweeping a package.

## Package families

The family is read from `manifest.json` `kind`, else from the file set. The
generic tools (`list_files`, `read_file`, `query`, `stats`, `diff_versions`,
`get_record`) work the same on every family; the typed ones map each family's
own structure onto one shape:

| Family | Packages | Collections are | Items |
|---|---|---|---|
| `project` | islamicart, baroqueart, sharinghistory | the `collections.json` tree (`parent_id`), members in `items[]` | `items.json` |
| `explore` | explore | the same tree, rooted at the Explore root; Travels locations whose parents are not shipped show as roots | `items.json`, details under their monument (`parent_id`) |
| `dxa-gallery` | carpets, amulets and the other thematic galleries | the gallery itself (`gallery.json`), holding every item | `items.json`, tags through `tag_ids` → `tags.json` |
| `dxa-exhibition` | the-use-of-colours-in-art, water-in-islam… | exhibition → themes → sub-themes (`themes.json`); a theme's members are its pictures' `parent_item_id`s, its per-picture texts come back under `<lang>:pictures` | `items.json` |
| `galleries-hub` | galleries | the hub (`manifest.hub`) and its galleries (`galleries.json`) | none |

The specs behind these shapes are in
[`../exporters/docs/`](../exporters/docs/).

## Verifying what it downloads

- **Discovery**: the registry's `scope:` search qualifier returns nothing on
  npmjs, so the server searches for the text `@museumwnf`, keeps names under
  that scope ending in `-data`, and adds anything the public org listing
  (`/-/org/museumwnf/package`) knows that search missed.
- **Integrity**: each tarball is checked against the packument's
  `dist.integrity` (the strongest of sha512/sha384/sha256), or the legacy
  sha1 `shasum` when no SRI hash is usable. A tarball with neither is refused.
  Tarballs are fetched only from the registry's own origin.
- **Extraction**: the tarball is parsed in memory by a small reader of our own
  (`src/tar.ts`) rather than a general-purpose library, so every rule is
  visible: only regular files; links, devices and duplicates refused;
  absolute paths, drive letters, backslashes and `..` refused; size and
  entry-count caps applied before inflating. Files are written to a staging
  directory and renamed into place with a `meta.json` marker last, so a
  half-written version is never mistaken for a complete one.
- **Reads**: every path a tool receives is resolved inside the extracted
  package and must be one of its files.

Calls run one at a time: parsing and diffing tens of megabytes of JSON is
synchronous, so running them side by side would only stall one call's
network timeouts behind another's CPU work.

## Why JMESPath

`query` uses JMESPath rather than JSONPath. JMESPath has one written
specification with a compliance suite, so an expression means the same thing
in every implementation, while JSONPath implementations disagreed for years
before RFC 9535. It also reshapes and aggregates (`length(@)`, `sort_by`,
multi-select hashes, pipes), where JSONPath only selects nodes — and
assessment questions are mostly counts and projections:

```text
items.json                    [?type=='monument'] | length(@)
items.json                    [?length(images)==`0`].{id: id, bc: backward_compatibility}
translations/items.fr.json    values(@)[?!description] | length(@)
partners.json                 [?item_count==`0`].backward_compatibility
```

## Development

Tests use fixture packages for every family, an in-memory registry and an
in-memory MCP client; nothing touches the network. Run everything CI runs:

```bash
docker build --target check scripts/data-packages-mcp
```

or, iterating, with the dependencies in a named volume:

```bash
docker run --rm -v "$PWD/scripts/data-packages-mcp:/app" -v dpmcp-modules:/app/node_modules -w /app node:24-alpine sh -c "npm ci && npm test"
```

`npm run type-check`, `npm run lint:check` and `npm test` are the three
scripts the `Data Packages MCP Validation` CI job runs; it also builds the
server image. Dependabot watches this directory through the tools entry and
the docker entry of `.github/dependabot.yml`.

| File | |
|---|---|
| `src/index.ts` | stdio entry point |
| `src/server.ts` | tool and resource registration, selection, output limits |
| `src/registry.ts` | npm registry client: search, org listing, packuments, tarballs |
| `src/integrity.ts`, `src/tar.ts`, `src/store.ts` | verification, safe extraction, the cache |
| `src/package-view.ts` | safe file access to one extracted version |
| `src/family.ts` | family detection and the collection tree per family |
| `src/browse.ts` | items, collections, partners, glossary, timelines, any record |
| `src/stats.ts`, `src/diff.ts`, `src/query.ts`, `src/images.ts`, `src/files.ts` | the generic tools |
