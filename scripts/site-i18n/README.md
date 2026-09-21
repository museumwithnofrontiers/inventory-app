# Site i18n extractor

Extracts the UI strings and editorial page content of a legacy DXA gallery or
exhibition website into [vue-i18n](https://vue-i18n.intlify.dev/) message files,
so a rebuilt site can be scaffolded with its text already in place.

Implements **THG G3** ([#1521](https://github.com/museumwithnofrontiers/inventory-app/issues/1521))
and the layered output of
[#1537](https://github.com/museumwithnofrontiers/inventory-app/issues/1537), sub-stories of
[#1517](https://github.com/museumwithnofrontiers/inventory-app/issues/1517).

## Why this is not an importer

Legacy DXA sites keep per-site editorial pages (`galleryAbout`, `galleryCredits`,
`galleryPartners`, `searchHowTo`) and UI labels in `mwnf3.translation`, grouped by
`group_id`. The decision recorded on #1517 is that **these do not belong in the
inventory model**: they are website copy, not inventory data — they describe a
particular website's chrome, not an object, a collection or a partner.

So they travel legacy → website repo and stop there. This tool has no connection
to the inventory database and no write path of any kind; every statement it
issues against the legacy database is a `SELECT`.

## Running it

Node runs in a container, never on the host — the repository rule in
[`CLAUDE.md`](../../CLAUDE.md). Every command below is a complete invocation;
run them from `scripts/site-i18n`.

Two details make them work:

- **`-v site-i18n-node-modules:/app/node_modules`** keeps dependencies in a named
  volume. Installing into the bind-mounted working copy would leave Linux
  binaries in a directory Windows tooling also reads.
- **`--network host`** lets the container reach the legacy server across the VPN.
  Without it the container gets bridge routes, which do not include the tunnel.

First, install dependencies into the volume and create the configuration:

```powershell
docker run --rm -v "${PWD}:/app" -v site-i18n-node-modules:/app/node_modules -w /app node:22-alpine npm ci
```

```powershell
Copy-Item .env.example .env    # then fill in the legacy credentials
```

The variables use the same names as the importer, so `scripts/importer/.env` can
be copied verbatim.

> **`.env` normally points at the live production legacy database.** Check which
> block is uncommented before running anything. The tool only reads, but the VPN
> has to be up or the run fails at the first query.

List the registry — which sites exist, and which i18n groups each is registered
against:

```powershell
docker run --rm --network host -v "${PWD}:/app" -v site-i18n-node-modules:/app/node_modules -w /app node:22-alpine npm run list
```

Extract every active site. A selector is a gallery id, a slug, or an mwnf3
project code, so `9`, `carpets` and `DCA` all name the same site; `--all` takes
the lot:

```powershell
docker run --rm --network host -v "${PWD}:/app" -v site-i18n-node-modules:/app/node_modules -w /app node:22-alpine npm run extract -- --all --force
```

```powershell
docker run --rm --network host -v "${PWD}:/app" -v site-i18n-node-modules:/app/node_modules -w /app node:22-alpine npm run extract -- 9 amulets EXHCOLOUR --force
```

`--force` **deletes the whole output directory** before writing, so a run that
needs to sit alongside another one needs its own `--output-dir` (see Portraits,
below).

## Output

```
output/
  extraction-report.md         what the run did, across every site
  _common/
    59/
      common.json              the shared layer's provenance: group id, row count
      i18n/
        index.json             locales and key counts of the shared layer
        en.json                the common group, written once
        …
  <slug>/
    site.json                  gallery id, project, slug, host, i18n groups, extends
    i18n/
      index.json               the site's *effective* locales and key counts
      en.json                  only what this site overrides or adds
      fr.json
```

A site's effective catalogue is the shared layer with the site's own files
overlaid, key by key within a locale — `site.json` names the shared layer it
extends, so the merge order lives in the data rather than in this paragraph.

A locale file holds exactly the messages legacy has in that language. It is not
padded with English: `index.json` names `en` as the `fallbackLocale`, and
vue-i18n resolves the rest — the same arrangement the legacy client used. Padding
would turn "this string was never translated" into "this string is English on
purpose", which is not a distinction worth destroying.

Keys are sorted, so re-running against unchanged legacy data produces a
byte-identical file and a diff shows only real edits.

## The layered layout

Almost nothing a site carries is its own. Measured across the 41 active sites:
six of the ten locales (`cs`, `de`, `el`, `it`, `pt`, `tr`) are byte-identical
everywhere; `ar`, `es` and `fr` differ by the single key `goToFullSearch`;
English differs by `galleryAbout` and `galleryCredits`. Of 18 559 (locale, key)
instances across all sites, **95 differ — 0.5%**.

So the extractor writes the common group once and gives each site only its own
messages. A typical gallery owns five: `galleryAbout` and `galleryCredits` in
English, and `goToFullSearch` in Arabic, Spanish and French. Output drops from
1.65 MB across 492 files to 215 kB across 239.

That is worth more than the disk it saves. A common-layer correction is applied
once instead of 41 times, and a reviewer can see what a site actually customises
without diffing it against a sibling. Portraits makes the point: under its
registered group its directory comes out **empty**, which is the registry damage
described below, stated in one line instead of hidden behind 450 identical keys.

### Why the split is by provenance, not by comparing sites

The shared layer is the common group — group 59 for every site in the registry —
and never "whatever the sites in this run happen to agree on". Two consequences
follow, and both matter:

- **The shared layer is byte-identical whichever sites you extract.** Diffing the
  extracted catalogues against each other instead would make it a function of the
  run's selection: one site would have no shared layer at all, five would produce
  a different one from forty-one, and no two runs would be comparable.
- **The boundary survives editorial drift.** Under a value diff, a curator
  editing one gallery's `galleryAbout` could push the key across the shared/own
  boundary and dirty every other site's diff.

Values are still compared, but only to drop **no-op overrides**: a site group
that restates a common pair with a value that converts to the same Markdown owns
nothing. This is not a corner case — a gallery group overrides 11 messages and
**9 of them change nothing** (`overallDatabase` and `searchRelatedDatabase` in
four languages each, plus `goToFullSearch` in English). They are listed in the
report, because a redundant row in the legacy data is worth knowing about.

The flip side: `goToFullSearch` in `ar`/`es`/`fr` is stored per site group in
legacy, so all 35 galleries carry an identical copy. Hoisting it would mean
value-diffing, and the two properties above are worth more than three duplicated
strings.

### The flat layout

```powershell
docker run --rm --network host -v "${PWD}:/app" -v site-i18n-node-modules:/app/node_modules -w /app node:22-alpine npm run extract -- --all --force --layout flat
```

`--layout flat` writes each site's merged catalogue whole, with no `_common/` and
no `extends`. It is the form to diff against the legacy API's own output when
verifying an extraction, and the escape hatch if a scaffold cannot merge two
layers.

There is one shape the layered layout cannot express: a site group that
overrides a common message with a **blank** value. The blank is dropped rather
than written — an empty message shadows vue-i18n's fallback chain — so the key
disappears from the merged catalogue while the shared layer still carries it, and
shallow-merging the layers would resurrect it. No site does this today. The
extractor checks every split against the merged catalogue and **aborts** rather
than writing output that silently disagrees with it, naming the site and telling
you to use `--layout flat`.

### The website layout

```powershell
docker run --rm --network host -v "${PWD}:/app" -v site-i18n-node-modules:/app/node_modules -w /app node:22-alpine npm run extract -- carpets --layout website --namespace carpets --force
```

`--layout website` writes exactly one site's own texts, in the keys a rebuilt
site's `locales/` directory expects — this is the extraction step of the site
generator recipe (epic #1735), and its output is what the recipe copies straight
into the site repo for the texts PR. It takes exactly one selector — a batch has
no meaning here, a website layout is one site's texts, and `--all` is refused —
and requires `--namespace <ns>`: one lowercase-led word of letters and digits, no
hyphens (`carpets`, `waterInIslam`, `colours`), because the namespace is a site's
own decision, not something derivable from its slug.

Only two legacy keys are a site's own editorial copy, and which one carries the
credits depends on kind: a gallery's credits are `galleryCredits`, an
exhibition's are `exhibitionCredits` — the legacy exhibitions client renders
that key, and it is the text the two live exhibition sites
(the-use-of-colours-in-art, water-in-islam) actually carry, not the common
group's `galleryCredits` fallback. `galleryAbout` is the other, and only a
gallery renders it — an exhibition has no About page (`standardRoutes('exhibition',
…)` in `viewer-layout` has none, blocked on the Theme epic, inventory-app#1729).
They are renamed into the keys the viewer-i18n dictionary expects:

| Legacy key | Kind | viewer-i18n key |
| --- | --- | --- |
| `galleryCredits` | gallery only | `<namespace>.credits.body` |
| `exhibitionCredits` | exhibition only | `<namespace>.credits.body` |
| `galleryAbout` | gallery only | `gallery.about.body` |

Output: `output/<slug>/locales/<lang>.json`, one file per legacy language that has
at least one of the site's own texts — never padded with English, same rule as
the other layouts. `en.json` always exists, even empty, because it is the
fallback locale a site loads unconditionally; a site-owned key legacy has no
English value for is omitted (not written with a blank value) and the run warns.

Every other legacy key of the site — the UI labels, `galleryPartners`,
`searchHowTo`, `thg_about_text`, `txt*` and the rest — is provided by the
viewer-i18n dictionary and deliberately **not emitted**.
`extraction-report.md`'s "Website output" section names every one of them per
site, so a reviewer sees exactly what the site does not own before the texts PR
is opened.

## Values are Markdown, not HTML

The legacy strings are HTML fragments — the legacy client renders them straight
into the page with `v-html`. Markup is not an accepted content format anywhere in
this project: the importer converts every legacy string to Markdown before it
reaches the database, and these strings follow the same rule. The Turndown
configuration is identical to
[`scripts/importer/src/utils/html-to-markdown.ts`](../importer/src/utils/html-to-markdown.ts),
so the same fragment yields the same Markdown whichever pipeline it travels
through.

In practice the legacy markup is narrow — `<br>`, `<b>`, `<i>`, `<a>` and a
handful of `<span>`s — and converts cleanly. A scaffolded site renders these
values through a Markdown component rather than `v-html`.

## How the merge works

Each site is registered against two groups: its own, and a common group shared
across sites (59 for every gallery and every exhibition but one). The legacy DXA
API merges them in `Translations.blade.php`:

```sql
from (select * from translation where group_id = :groupId) t_specific
right join (select * from translation where group_id = :commonGroupId) t_common
  on (t_common.word_id = t_specific.word_id and t_common.lang_id = t_specific.lang_id)
```

The `RIGHT JOIN` makes the **common group** define the whole key × language
universe: a site-specific string whose (key, language) pair has no counterpart in
the common group is silently discarded before it ever reaches a browser.

**This extractor merges as a union instead** — common group as the base, site
group overriding pair by pair and free to add pairs of its own. That is a
deliberate deviation, and it recovers **120 messages across the 48 sites**:

| Key | Messages recovered | Why legacy drops them |
| --- | --- | --- |
| `goToFullSearch` | 108 | Every gallery has it in Arabic, Spanish and French; the common group carries that key in English only. |
| `Search Related Database` | 4 | A capitalised, spaced variant of `searchRelatedDatabase` used by gallery 45. |
| `Footer_logo_section_1`, `Footer_logo_section_2` | 6 | Exhibitions 52, 55 and 56 capitalise the `F`; the common group does not. |
| `galleryAbout`, `galleryNewPartners` | 2 | Gallery 45 only. |

Every message recovered this way is listed in `extraction-report.md`, per site,
so the deviation is auditable rather than invisible. Nothing is lost relative to
legacy: the union is a superset.

Rows with an empty `word_id` (legacy junk that no client can address) and values
that are empty after conversion are dropped, and both are counted in the report.

## The registry

`mwnf3_thematic_gallery.thg_gallery` is the registry of record. It carries
`i18n_group_id`, `i18n_common_group_id`, `link` (the slug) and
`mwnf3_project_id` for all 48 galleries and exhibitions, and
`thg_gallery_url.link` carries the canonical host. This is the same anchor the
importer writes to `collections.extra.thg_gallery`
([#1520](https://github.com/museumwithnofrontiers/inventory-app/issues/1520)).

The legacy deployment scripts keep a second, partial copy of the mapping in
`E:\mwnf-server\apps\<site>\api\environment\config.sh` (`sites`/`projects`/
`themes`/`i18ns` parallel arrays). Prefer the database: `config.sh` lists 38
gallery instances and knows nothing about the six exhibitions, Precious Stones,
Historical Cars or the hidden galleries. Run `npm run list` rather than reading
either by hand.

The two sources agree everywhere except one entry, and there `config.sh` is
right:

| Site | `thg_gallery` | `config.sh` | Reality |
| --- | --- | --- | --- |
| Portraits (gallery 31, POT) | group 63 | group 45 | Group 63 has no rows at all; group 45 has the expected 5 keys × 4 languages. Extract it with `--group 45`. |

Because `--force` deletes the output directory, the Portraits override run needs
its own:

```powershell
docker run --rm --network host -v "${PWD}:/app" -v site-i18n-node-modules:/app/node_modules -w /app node:22-alpine npm run extract -- portraits --group 45 --output-dir output-portraits-45
```

That run writes its own `_common/59/`, byte-identical to the one the `--all` run
wrote — which is the reproducibility property above, doing its job. Copy the
`portraits/` directory over the empty one from the batch run.

### Known registry damage

`npm run extract` warns about each of these as it runs, and `--all` completes
regardless — a damaged entry costs that site its own strings, not the run.

As of 2026-08-25, five of the 48 sites warn:

| Site | Problem |
| --- | --- |
| 31 Portraits (**active**) | Registered against group 63, which has no rows. `config.sh` says 45, and 45 has the expected content: extract it with `--group 45`, which restores a gallery-specific `galleryAbout` and `galleryCredits`. |
| 15 Curiosities (H), 42 Unclear (H), 43 Doubts (H), 44 Excluded (H) | Registered against groups 69 and 56, which have no rows, so each falls back entirely to the common group. All four are hidden, so this is likely deliberate. Three also have no `thg_gallery_url` row. |

Under the layered layout these sites are the ones whose directory holds an
`index.json` and nothing else — the report's "Shared vs. own" table lists them
with zero own keys.

A site whose `i18n_common_group_id` is `NULL` warns too — the legacy API binds
NULL into its join and serves that site nothing at all. Such a site gets
`"extends": null` and owns its whole catalogue. Gallery 56 was in that state when
this tool was written and has since been repaired in the legacy data; the check
stays because the shape can recur.

Gallery 55's slug contains a colon
(`lost_memories_along_the_hijaz_railway:_from_istanbul_to_mecca`), which is legal
in a URL and illegal in a Windows path, so its output directory drops the colon.
`site.json` always carries the true slug.

## Scaffolding a site

The platform is `@museumwnf/viewer-i18n` (the shared dictionary) plus a site's own
`locales/` directory plus `viewerI18n.class`/`namespace` in the site's
`package.json` — not vue-i18n's `mergeLocaleMessage`, not a
`dxa-client/_variables.scss` copy. In outline:

1. `npm run list` — find the site's gallery id and slug.
2. Extract it with `--layout website --namespace <ns>` (above), and read the
   warnings it prints.
3. Copy `output/<slug>/locales/` into the new site repo as-is, and open the
   texts PR.
4. CI's `ci / Texts` job on that repo validates the copied keys against the
   viewer-i18n dictionary.

The full ordered recipe — repo creation, Pages enablement, the Dependabot entry,
the `.new-architecture` submodule pointer, `dependents.json` — is
`docs/deployment/new-website.md` (story #1921); this step is one line in it.

## Tests

```powershell
docker run --rm -v "${PWD}:/app" -v site-i18n-node-modules:/app/node_modules -w /app node:22-alpine npm test
```

The merge, the layer split and the registry logic are pure functions and are
covered directly; the cases are drawn from the shapes the legacy data actually
contains, not invented ones. Nothing in the test suite touches a database.

The property the layer tests exist for is the round trip: merging the two layers
back has to reproduce the flat catalogue byte for byte. The extractor asserts the
same thing on every site of every run.

## TL;DR — a full extraction, copy-paste

Every command needed to extract all 41 active sites, in order, for a PowerShell
prompt in `scripts/site-i18n`. Lines marked `# OPTIONAL` are setup and
diagnostics — run them when the check above them says to.

The VPN to the legacy network must be up for every step that talks to the
database (4 onwards).

```powershell
# ── 1. DEPENDENCIES ──────────────────────────────────────────────────────────
# Into a named volume, never into the bind-mounted working copy: npm would
# leave Linux binaries in a node_modules that Windows tooling also reads.
docker run --rm -v "${PWD}:/app" -v site-i18n-node-modules:/app/node_modules -w /app node:22-alpine npm ci

# ── 2. CONFIGURATION ─────────────────────────────────────────────────────────
# OPTIONAL — first time on this machine only. Same variable names as the
# importer, so scripts/importer/.env can be copied verbatim.
Copy-Item .env.example .env

# WHICH DATABASE? The .env normally has the PRODUCTION block uncommented.
# The tool only ever issues SELECTs, but know which one you are pointed at.
Select-String -Path .env -Pattern "^LEGACY_DB_HOST"

# ── 3. CHECKS ────────────────────────────────────────────────────────────────
# OPTIONAL — after changing the tool. Neither touches the database.
docker run --rm -v "${PWD}:/app" -v site-i18n-node-modules:/app/node_modules -w /app node:22-alpine npm run type-check
docker run --rm -v "${PWD}:/app" -v site-i18n-node-modules:/app/node_modules -w /app node:22-alpine npm test

# ── 4. THE REGISTRY (VPN from here on) ───────────────────────────────────────
# 48 galleries and exhibitions, with the i18n groups each is registered
# against. --network host is what reaches the legacy server across the tunnel.
docker run --rm --network host -v "${PWD}:/app" -v site-i18n-node-modules:/app/node_modules -w /app node:22-alpine npm run list

# ── 5. EXTRACT EVERY ACTIVE SITE ─────────────────────────────────────────────
# --force DELETES output/ first. Layered is the default: the common group is
# written once to output/_common/59/, each site keeps only what it owns.
# Expect: 41 sites, ~5 own messages each, and warnings for Portraits.
docker run --rm --network host -v "${PWD}:/app" -v site-i18n-node-modules:/app/node_modules -w /app node:22-alpine npm run extract -- --all --force

# ── 6. PORTRAITS (gallery 31) ────────────────────────────────────────────────
# Registered against group 63, which is empty, so step 5 leaves its directory
# with no messages at all. Group 45 is the one its live site serves. Separate
# --output-dir because --force would delete the batch run.
docker run --rm --network host -v "${PWD}:/app" -v site-i18n-node-modules:/app/node_modules -w /app node:22-alpine npm run extract -- portraits --group 45 --output-dir output-portraits-45

# Its _common/59/ is byte-identical to the batch run's; only the site differs.
Remove-Item -Recurse output/portraits
Copy-Item -Recurse output-portraits-45/portraits output/portraits

# ── 7. READ THE REPORT ───────────────────────────────────────────────────────
# "Shared vs. own" is the section to check: it names, per site, exactly which
# messages that site customises. A site with 0 own keys is registry damage.
code output/extraction-report.md

# ── 8. OPTIONAL — THE FLAT FORM ──────────────────────────────────────────────
# One self-contained catalogue per site, ~8x larger. Use it to diff against the
# legacy API's own output, or if a scaffold cannot merge two layers.
docker run --rm --network host -v "${PWD}:/app" -v site-i18n-node-modules:/app/node_modules -w /app node:22-alpine npm run extract -- --all --layout flat --output-dir output-flat
```
