# Legacy parity

Compares every new MWNF website with the legacy site it replaces, and gates a data-package
publish on that comparison. The new side is the data package a site installs
(`@museumwnf/<slug>-data`) and the site on GitHub Pages; the legacy side is the live legacy site
and the legacy dumps.

It began as the one-off check of 2026-10-18 (story
[#2233](https://github.com/museumwithnofrontiers/inventory-app/issues/2233)). After the fixes
(#2232, #2234) and a reimport, the 2026-10-19 re-run measured 58,194 → 9,144 real differences.
The same day, two regressions reached production because the comparison ran only after
publishing: relative image URLs on all 48 sites, and raw HTML in 111 texts. Running this tool
before the publish catches both.

**What it touches.** It only reads: the live legacy sites, the npm registry, jsDelivr, GitHub
Pages, and the legacy dumps on disk. It never connects to a database. Every request carries the
user agent `mwnf-parity-check/0.1 (read-only)`, at most 3 at a time (`--concurrency` goes up to
5, no further: the legacy servers are shared), and every answer is cached, so a re-run asks the
legacy servers for nothing they already answered.

## Table of contents

- [Running it](#running-it)
- [Modes and options](#modes-and-options)
- [Before a publish: the gate](#before-a-publish-the-gate)
- [After a release](#after-a-release)
- [Reading the reports](#reading-the-reports)
- [The gate](#the-gate)
- [Baselines](#baselines)
- [Known legacy quirks and decided differences](#known-legacy-quirks-and-decided-differences)
- [The cache](#the-cache)
- [Investigating a field](#investigating-a-field)
- [The tools](#the-tools)
- [Development](#development)

## Running it

Docker only, through the `parity` compose service. It runs the Playwright image
`mcr.microsoft.com/playwright:v1.63.0-jammy` for every mode; the curatorial mode simply doesn't
start a browser.

```powershell
docker compose run --rm parity                                    # curatorial, every site, npm latest
docker compose run --rm parity --only carpets,islamicart          # two sites
docker compose run --rm parity --packages local --only carpets    # the export on disk (pre-publish)
docker compose run --rm parity packages --packages local          # package gates only, no legacy request
docker compose run --rm parity style assets static                # the browser passes
```

The service mounts three host directories. Each has a default relative to the checkout, and
each can be pointed elsewhere with an environment variable:

| Variable | Default | Holds |
|---|---|---|
| `PARITY_WORK_PATH` | `./tmp/parity` | the working area (git-ignored): `cache/`, `pkg/`, `out/`, and the browser passes' `shots/`, `assets/`, `static/`, `site/` |
| `LEGACY_DATABASE_PATH` | `./.legacy-database` | the legacy mysqldump files (`ddl/`, `data/`) |
| `LEGACY_CODE_PATH` | `./.legacy-code` | the legacy sources; the sitemap reads `dxa-client/environment/.env.*` |

From a worktree, none of the three exists in the worktree itself. Point them at the main
checkout, so that every worktree shares one cache:

```powershell
$env:PARITY_WORK_PATH = "E:\inventory\inventory-app\tmp\parity"
$env:LEGACY_DATABASE_PATH = "E:\inventory\inventory-app\.legacy-database"
$env:LEGACY_CODE_PATH = "E:\inventory\inventory-app\.legacy-code"
```

`node_modules` lives in the `parity-modules` volume. The entry point runs `npm ci`
whenever `package-lock.json` changes.

With a warm cache, the time goes into reading the cache from the host disk. Measured on
2026-10-20 with the cache on the main checkout's drive: carpets 31 s, calligraphy 7 min, and
Islamic Art 16 min (7,815 pages).

## Modes and options

`node run.mjs [mode…] [options]`. The service passes its arguments straight through. The default
mode is `curatorial`.

| Mode | What it does |
|---|---|
| `curatorial` | `sitemap`, then for every site: the records and fields of its package against live legacy. Then the package gates, the overview, and the gate against the baseline |
| `packages` | `sitemap` and the package gates only. Makes no legacy request: the quick check of an export |
| `style` | screenshots and style signatures of every home page and of each page type of the representative sites, then the review page (`site/style-parity.html`) |
| `assets` | every non-curatorial image of each page (logos, banners, favicons), matched legacy ↔ new by a difference hash |
| `static` | the static pages' text, sentence by sentence, and the footer links |

What `curatorial` compares, per family:

| Sites | Legacy source | Tools |
|---|---|---|
| 37 galleries, 5 exhibitions | each site's live dxa-api instance (exhibitions per language: `…/<link>/<lang>/api/v2`) | `compare-dxa` |
| the-hijaz-railway | the dump (its legacy instance answers 403); water-in-islam runs the same comparison to calibrate it | `compare-dump-exh` |
| islamicart, baroqueart, sharinghistory | the record list from the dump, each record's live `database_item.php` page (raw HTML) | `compare-php`, `compare-collections`, `compare-partners-php` |
| explore | its live API | `compare-explore` |
| galleries (the hub) | its live API | `compare-hub` |

| Option | Meaning |
|---|---|
| `--only a,b` | only these sites, by slug (`scripts/exporters/instances/<slug>.json`). The gate then judges only them |
| `--packages latest` | default: the version npm calls `latest`, which the sitemap asks for afresh on every run |
| `--packages local` | the exporters' output on disk: `scripts/exporters/<exporter>/output/<slug>/` |
| `--packages local:<dir>` | the same layout under `<dir>` (or `<dir>/<slug>/`), as the container sees it, e.g. `/var/www/app/…` or `/parity/…` |
| `--baseline <path>` | a baseline other than the newest under `baselines/` |
| `--no-gate` | report, but exit 0 whatever the numbers |
| `--refresh` | read the legacy home pages again, not just npm |
| `--warm` | read the PHP sites' pages in parallel before comparing them (only worth it with a cold cache) |
| `--concurrency N` | parallel requests, 1 to 5 (default 3) |
| `--new-url slug=url` | measure the new site at `url` instead of its published address, e.g. a local preview build. Repeatable, one site each |

Exit code: `0` when everything ran and the gate passed, `1` when the gate failed, `2` when a step
failed to run (`out/run.log` names it).

## Before a publish: the gate

This is the check that would have stopped both 2026-10-19 regressions. Export without
publishing, compare the export, and publish only when the gate passes:

1. Export without `--publish`, always with the base URL (without it, every image URL comes out
   relative):

   ```powershell
   $env:HOME = $env:USERPROFILE
   docker compose --profile jobs run --rm --no-deps exporter all --force --base-url https://inventory.metanull.eu
   ```

   Or one instance, e.g. `exporter dxa-gallery --instance carpets --force --base-url …`.
2. Run the package gates on the export. It takes seconds and makes no legacy request:

   ```powershell
   docker compose run --rm parity packages --packages local
   ```

3. Compare the export with legacy, for the sites the change touches, or for every site:

   ```powershell
   docker compose run --rm parity --packages local --only carpets,islamicart
   ```

4. Read `tmp/parity/out/diff-runs.md`, and `packages.md` when the package gates failed. Exit 0
   means no field, record set or package got worse. Then publish as
   [Release and Propagation §3](../../docs/deployment/release-and-propagation.md#3-data-packages-exporters)
   describes. Exit 1 lists every regression. Fix the export, or, when the change is deliberate,
   say so in the PR that ships it and take a new baseline after the publish.

A local run writes `packageVersion: "local"` in `out/sitemap.json`. The reports name the export
directory and its date.

## After a release

After every publish, and after each site or platform release (viewer-core, viewer-layout,
viewer-i18n, a site repository):

```powershell
docker compose run --rm parity                 # what the sites now install
docker compose run --rm parity style static    # when the release changes what a page shows
```

The sitemap re-reads npm on every run, so the comparison always covers what `latest` resolves to
at that moment. Before 2026-10-20 it did not: a cached registry answer once made a whole run
compare the previous release without saying so. If a publish happened minutes ago and the
sitemap still shows the old version, that is npm's lag: wait, and run again.

## Before a site or platform PR is merged: a preview build

The browser passes (`style`, `assets`, `static`) can measure a site before its PR is merged.
Build the site with the base path it is published under, serve `dist/` from a plain web server,
then point the passes at it with `--new-url`. The container reaches the host as
`host.docker.internal`. `vite preview` won't do: it refuses that host name and answers every
page with "Blocked request", which the passes would record as the page.

```powershell
# in the site's repository, after building with BASE_PATH=/islamicart/
docker run -d --name islamicart-preview -p 4173:80 -v "${PWD}/dist:/usr/share/nginx/html/islamicart:ro" nginx:1.26-alpine
```

```powershell
docker compose run --rm parity style assets static --only islamicart --new-url islamicart=http://host.docker.internal:4173/islamicart/
```

The address must be the build's root, where the site's own routes start (`#/…` follows it). A
capture is reused only for the address it was taken from, so the preview's captures and the
published site's never stand in for each other: the next run without `--new-url` takes the
published site's again. To capture the same address again (a new build), first delete the
files of `shots/`, `assets/` and `static/` whose name holds `--new`.

The `static` pass pairs each standalone site's rebuilt pages with legacy's
(`STANDALONE_PAGES` in `tools/jobs-static.mjs`: Islamic Art's Mission Statement and Recommended
Links, Baroque Art's Sponsors, Sharing History's About, Team and Sponsors pages). A route a site
names differently goes in that table. Islamic Art's Dynasties section (legacy's `/dynasties/`
client) is paired in both the static and the style pass: the start page, and the profile and
related objects of one dynasty (Umayyads of al-Andalus, legacy's 31, matched to the package by
its English name).

## Reading the reports

Everything lands in `out/` (`tmp/parity/out` on the host):

| File | Content |
|---|---|
| `sitemap.md` / `.json` | every new site, its legacy site and key, package version, HTTP status of both |
| `<slug>/report.md` / `.json` | one site: record sets, every field's verdict counts, the known reasons, samples |
| `<slug>/collections.md`, `partners.md` | the PHP sites' exhibitions, themes and partners |
| `<slug>/dump.md` | the dump comparison (the-hijaz-railway, water-in-islam) |
| `packages.md` / `.json` | the package gates per site |
| `overview.md` / `.json` | every site in one table; the causes found; what has no cause yet |
| `diff-runs.md` / `.json` | the run against the baseline, and the gate's verdict |
| `run.log` | every step, its duration and exit code |

A comparison is one record × language × field. Its verdict:

| Verdict | Meaning |
|---|---|
| `same` | equal once both sides are reduced to text (HTML on legacy, Markdown in the package) |
| `both-empty` | neither side has a value |
| `format` | equal once case, punctuation at the end, quotes, dashes and whitespace are set aside, or the same list in another order |
| `expected:<reason>` | differs for a reason that is known and accepted, most often a legacy-side defect (below) |
| `different` | both sides have a value and the values differ |
| `missing-in-package` | legacy shows a value, the package has none |
| `extra-in-package` | the package has a value legacy does not show |

**Real** differences are `different`, `missing-in-package` and `extra-in-package`. The overview's
"real" column counts `different` and `missing-in-package` only, the figure quoted as
58,194 → 9,144. A real difference may still carry a **reason** (the report's "Known reasons" table,
e.g. "package keeps only the first of several names"). The overview's last column is what
has no reason yet: start there.

**Record sets** compare which records exist on each side (items, item × language, partners,
countries, tags, timeline events, themes): "only legacy" is missing from the package, "only
package" is extra.

## The gate

`diff-runs.mjs` judges a run against the baseline. It fails when, for any site of the run:

- a field has more real differences than in the baseline;
- a record set has more records on one side only than in the baseline;
- the package has more image URLs that are not `https://inventory.metanull.eu/pub/<uuid>.<ext>`
  than in the baseline. That check covers every value under a `url` key and any value pointing
  at the inventory or at `pub/`. Legacy paths such as `image_path` or `portal_image` are
  resolved on the legacy image host on purpose, so they are not checked;
- the package has more texts holding a raw HTML tag than in the baseline (`<i>`, `<br/>`,
  `<p …>` and the like, in any JSON file of the package, `extra` included). `< 5 cm` and
  `<https://…>` are not tags.

The two package checks run in `check-packages.mjs` and need no legacy request; `diff-runs.mjs`
judges their counts. The `packages` mode does that alone, in about three minutes for all 48
sites.

**The gate is a means, not the goal.** The goal is new sites that match legacy. Every count the
gate tracks is a place where a site can differ from legacy. The gate stops a publish from adding
to those places; it does not make the ones already there acceptable. They are listed under
**Open package defects** in `diff-runs.md`, and per URL and text in `packages.md`. On 2026-10-20,
43 of the 48 published packages had some:

- image URLs: legacy paths under `/pub/objects/…`, `/pub/museums/…` (partner logos),
  `/pub/monuments/…` and `/pub/sharing_history/…`, largely the missing legacy source files of
  C4 on #2233, plus a few bare `https://inventory.metanull.eu/pub/`. Whether legacy shows a
  picture there is the question that matters; the image counts per record in the reports
  answer it;
- raw HTML: mostly `<i>` and `<br/>` in the indented lines of Arabic `bibliography` texts. The
  sites escape HTML, so these print the tags where legacy prints italics and line breaks.

A site the baseline doesn't know (a new site) has no field or record-set gate, and its package
checks are judged strictly: one bad URL or HTML text fails. Fewer than the baseline never fails;
take a new baseline to lock the improvement in.

## Baselines

`baselines/<date>/` holds the summary of an accepted full run. The newest one is the default:

| File | Use |
|---|---|
| `diff-runs.json` | per site, every field's verdict totals, every record set's one-sided counts, and the package checks' counts (`perSite`): what the gate compares with |
| `overview.json` / `.md` | the per-site totals and causes of that run |
| `diff-runs.md` | that run against the one before it |
| `packages.md` | the package checks of that run, per URL and text |
| `sitemap.md` | the package versions it compared |

The legacy cache, the packages and the full per-site reports stay out of git.

To take a new baseline, after a full run with no `--only`, on `latest`, whose result you accept:

```powershell
$d = "scripts/parity/baselines/$(Get-Date -Format yyyy-MM-dd)"
New-Item -ItemType Directory $d
foreach ($f in 'diff-runs.json','diff-runs.md','overview.json','overview.md','packages.md','sitemap.md') { Copy-Item "tmp/parity/out/$f" $d }
```

Commit it in its own PR, and say in the PR why the numbers moved.

`baselines/2026-10-19` is the 2026-10-19 re-run: 9,144 real differences (overview), every site on
the package versions in its `sitemap.md`. It was summarised by this tool from that run's reports.
Its package counts come from the package checks of 2026-10-20, on the same 48 versions: 60
open defects on 43 sites.
Its `diff-runs.md` is the gate's verdict on 2026-10-18 → 2026-10-19. The total fell, but it lists
34 regressions: 26 fields and 8 record sets. 14 of those fields are `item.bibliography`, on 14
sites. The gate would have flagged every one of them before the publish.

`baselines/2026-10-21` is the run after reimport 2 (#2240, #2250), on the package versions in its
`sitemap.md`: 4,128 real differences. Its `diff-runs.md` lists two regressions against 2026-10-19,
both accepted:
- **arts-in-dialogue `site.hidden`:** legacy hides the site through `status`, which is no longer
  imported. A gallery with a site is visible (decision of 2026-10-20).
- **baroqueart `item.artist`:** most are artist life data the tool doesn't read from the package.
  The rest came from the tool itself, which split legacy's line at its commas (#2272) and counted
  another order as a difference (#2290).

`baselines/2026-10-21b` is the same packages compared with the fixed tool: 4,111 real
differences, no regressions. Baroque Art `item.artist` is down to 212, of which 202 are artist life
data. A name that holds a comma is compared whole, and the same names in another order count as a
format difference: legacy prints them as typed, with no explicit order.

## Known legacy quirks and decided differences

These are not defects of the new sites. The tools mark most of them `expected:` or give them a
reason. The ones that stay real are in the baseline, so they do not fail the gate.

**Decisions** (story #2233):

- **D3 / D8: the Hijaz Railway.** Its legacy instance answers 403, and legacy Hijaz is to be
  republished. It is out of this analysis: it is compared through the dump only (`dump.md`),
  and the dump is stale for exhibitions (on water-in-islam it lists 167 members where live
  legacy shows 492). Its record-set numbers are not a verdict. The 228 Hijaz Railway
  (`GalEx5`) objects shown in the galleries, which legacy hides, are kept.
- **Keep all data, display only what legacy displays** (2026-10-21, replacing D6). The import is
  exhaustive; a site shows a value only where legacy shows it, never more. So no fallback to
  English where legacy shows nothing in a language (dynasty names, captions, credits), and data
  legacy never prints stays in the inventory. An `extra-in-package` count is therefore a defect,
  unless the site does not display that field.
- **D4: credits in the page's script.** Legacy prints a credit in the script of the page where
  `authors_objects` has it (Arabic and others). On an Arabic page, the PHP sheets print only the
  Arabic spelling and nothing for a person who has none; the galleries (dxa-api) print the Latin
  name instead. Picture credits are per language too, like captions.
- **Keywords and materials sorted** by the package: `format`, accepted.
- **Layouts and text.** The style and static passes measure the new sites against legacy, and
  legacy is the target. Text that legacy doesn't have is dropped, never added.

**Legacy-side defects**, not counted against the new sites. The tools mark them `expected:` or
`format`, or give them a reason:

- Arabic pages with nested glossary links print `,'ar');"` residue (the PHP sites).
- A glossary term with an apostrophe (Shi'ite, mina'i) breaks legacy's link, and the word
  disappears from the page.
- Some texts are stored double-encoded, and print `&Aacute;` literally.
- dxa-api inverts `featured`.
- dxa-api's credit query keeps an author only when they have no CV in the project or one in the
  page's language. An author with CVs in other languages only drops out of that page's credits,
  although `authors_objects` credits them there. `lib/credits-cv.mjs` finds these in the dump.
- dxa-api answers some partners in English whatever language is asked.
- Some related-record links point at records that don't exist.
- The PHP pages print the Location line with the country name at the end (`format`: "page adds
  the country name"). On monuments they also print the address first. The package doesn't ship
  the address, and that one is a real difference.
- Legacy galleries answer a bare size folder (`…/zoom/`) as the image of a gallery that has none.
- dxa-api is scoped per instance: other records answer 404. Its `/items` pages after the first
  come back keyed by offset, and `/partners` is a bare array. `legacy-dxa.mjs` handles all three.

## The cache

`cache/<2>/<sha1 of the URL>.json` holds one answer each: its status, final URL, the time it was
fetched, and the body. A 404 is an answer and is cached; a 5xx is retried up to four times,
then reported, not cached. Legacy content changes rarely, so the cache stays valid for a long
time:

- npm and the org site's `sites.json` are re-read on every run, and so are the new sites' home
  pages.
- `--refresh` also re-reads the legacy home pages.
- To re-read one legacy page, delete its file: the name is the URL's sha1. To re-read a whole
  site, delete the files whose `url` starts with its host.
- Deleting `cache/` makes the next full run refetch about 40,000 pages. Don't.

`pkg/` keeps every package version a run unpacked. They never change once published.

## Investigating a field

```powershell
docker compose run --rm parity tools/samples.mjs item.author 10   # per site, and samples, of a field's real differences
docker compose run --rm parity tools/reasons.mjs 20               # every real difference by field × verdict × reason
docker compose run --rm parity tools/rawpeek.mjs <url> <needle>   # a slice of a cached legacy page
docker compose run --rm parity tools/probe.mjs <url>…             # the shape of a cached JSON answer
```

These read `out/` and the cache. They make no request a run hasn't already made, except for a
URL that isn't cached yet.

## The tools

All under `tools/`; `run.mjs` calls them in this order. Each takes its arguments and reads its
paths from `tools/lib/paths.mjs`.

| Tool | Role |
|---|---|
| `sitemap.mjs` | legacy roster (dumps, dxa-client `.env`) ↔ exporter instances ↔ npm versions ↔ live sites |
| `compare-dxa.mjs` | one gallery or exhibition, through `legacy-dxa.mjs` and `exhibition-themes.mjs` |
| `compare-dump-exh.mjs` | one exhibition through the dump |
| `compare-php.mjs`, `compare-collections.mjs`, `compare-partners-php.mjs` | the PHP sites, through `legacy-php.mjs`; `fetch-php.mjs` warms their cache |
| `compare-explore.mjs`, `compare-hub.mjs` | Explore and the galleries hub |
| `check-packages.mjs` | the package gates (`lib/gates.mjs`) |
| `aggregate.mjs` | `overview.md` |
| `diff-runs.mjs` | the gate against the baseline |
| `jobs-*.mjs`, `capture.mjs`, `compare-style.mjs`, `build-style-page.mjs` | the style pass |
| `assets.mjs`, `compare-assets.mjs` | the assets pass |
| `static.mjs`, `compare-static.mjs` | the static pass |
| `shots-check.mjs` | lists captures that failed or look like error pages |

`notes/*.json` holds the hand-written review notes that the style page shows next to each pass.
`lib/text.mjs` holds the text normalisation behind every verdict. Change it with care: every
count moves, and a new baseline is due.

## Development

`playwright` is pinned to the image's version, 1.63.0; 1.55.1 and later fix GHSA-7mvr-c777-76hp.
Its browsers come from the image, so the two only ever move together: change the `image:` line
in `compose.yml` and the pin in `package.json` in the same PR. Dependabot leaves `playwright`
alone for that reason. The image ships Node 24.

CI runs lint and the tests (`parity-validation`). Locally:

```powershell
docker compose run --rm parity npm run lint:check
docker compose run --rm parity npm test
```

The tests cover the package gates and the baseline gate, with no network. The comparison
itself never runs in CI: it needs the live legacy sites and the local cache.
