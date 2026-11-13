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
- [The global search box](#the-global-search-box)
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
docker compose run --rm parity layout                             # the exhibitions' layout rules, gated
docker compose run --rm parity links                              # links that still go to legacy, gated
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
| `layout` | every page type of the six exhibitions at 1920, 1366 and 390px, against the [layout rules](#the-layout-gate); gated, with no legacy request and no baseline |
| `assets` | every non-curatorial image of each page (logos, banners, favicons), matched legacy ↔ new by a difference hash |
| `static` | the static pages' text, sentence by sentence, and the footer links |
| `links` | every link of the new pages the style and static passes open; gated on a link that still goes to the legacy address of a site that has a new one (`tools/links-allow.json` keeps one on purpose, with its reason); links to MWNF legacy pages with no new site are reported (inventory-app#2482) |

What `curatorial` compares, per family:

| Sites | Legacy source | Tools |
|---|---|---|
| 37 galleries, 6 exhibitions | each site's live dxa-api instance (exhibitions per language: `…/<link>/<lang>/api/v2`). An exhibition's address is the one `config/legacy.php` links to (`links.thematic_galleries`), else its link on the dump's host: the Hijaz Railway's is on upgrade-exhibitions | `compare-dxa` |
| islamicart, baroqueart, sharinghistory | the record list from the dump, each record's live `database_item.php` page (raw HTML) | `compare-php`, `compare-collections`, `compare-partners-php` |
| explore | its live API | `compare-explore` |
| galleries (the hub) | its live API | `compare-hub` |
| publications | legacy MWNF Books' API (`books.museumwnf.org/api`): the works and their four category lists, each work's country, project, trail, languages, subjects, theme and target reader, and each version (language × legacy type × edition × publisher) with its texts, counts, cover, sample pages and sample/credits PDFs | `compare-publications` |
| travels | legacy MWNF Travel's Exhibition Trails pages (`travel_et_*.php`, raw HTML): the trails its lists name, and those whose pages still answer at their address (the GPA trail); each trail's header, description, curators and Travel Book; its itineraries' names, main locations and descriptions; each itinerary's gallery, its monuments, their pictures and captions | `compare-travels` |

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

The browser passes (`style`, `layout`, `assets`, `static`) can measure a site before its PR is merged.
Build the site with the base path it is published under, serve `dist/` from a plain web server,
then point the passes at it with `--new-url`. The container reaches the host as
`host.docker.internal`. `vite preview` won't do as it is: it refuses that host name and answers
every page with "Blocked request", which the style pass would record as the page (the layout
pass counts it as a page not opened). Start it with
`__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=host.docker.internal`, or serve `dist/` as below.

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
| `<slug>/dump.md` | the dump comparison, when `compare-dump-exh` is run by hand |
| `layout.md` / `.json` | the layout gate: each finding with its page, place, text and colours |
| `links.md` / `.json` | the links gate: each link to a site with a new address (with that site and the pages it is on), those kept on purpose, and those to legacy pages with no new site |
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

### The layout gate

The gate above compares data: a squeezed column or an unreadable colour changes none of its
counts. The Hijaz review of 2026-10-27 (#2379) found both on every exhibition, with every data
count green. The `layout` mode looks at the pages themselves. It needs no legacy page and no
baseline, so it also runs on a preview build before a platform or site PR is merged
(`--new-url`).

`jobs-layout.mjs` lists every page type of every DXA exhibition (home, about, themes with every
theme opened, the first sub-theme, its gallery, collection, partners, related content, credits,
timeline, one item and one partner) at 1920, 1366 and 390px: 216 pages, about six minutes.
`layout.mjs` opens each, closes the welcome window, reads the page screen by screen down to
6,000px, and applies three rules (`lib/layout-rules.mjs`):

| Rule | Fails when | Found on 2026-10-27 |
|---|---|---|
| `narrow-text` | a block holding more than 20 words is narrower than 200px | the theme text, one word a line in a 52px column |
| `low-contrast` | visible text is below 3:1 against what is painted under it: the first opaque colour, with every translucent layer laid over it. Text over a picture is not judged | the themes page's black rows |
| `h-scroll` | the page scrolls sideways (a window whose overflow is hidden does not) | |

It writes `out/layout.md` and `out/layout.json` and exits 1 on any finding outside
`tools/layout-allow.json`. That list holds what legacy draws the same way, each entry with its
reason: mostly an exhibition's own colours, such as the contrast colour on white or Arts in
Dialogue's white on cornflower blue, and legacy's own unreadable white-on-white captions. An entry
matches by rule and any of site, page, width, a class in the finding's place (`where`), the start
of its text, and its colours (`pair`). Add one only after checking legacy draws it the same.

Run against the Hijaz site as it was on 2026-10-27 (its commit `ca243a7` built with
viewer-layout 3.11.2), it fails on the 52px theme text and on the theme gallery's white-on-white
cards at 390px. Measuring the sites of today, it found Arts in Dialogue's partner location printed
yellow on white (viewer-layout#200).

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

`baselines/2026-10-22` is the run on the packages published after #2294 (per-language picture
credits; Arabic-only credits on the PHP sites), measured with the tool as of #2299: 3,503 real
differences, no regressions. The fall comes from the rule of 2026-10-21 (display only what legacy
displays) and the tool fixes behind it: artist life data composed as legacy prints it, dxa-api's
dropped credits and the PHP sheets' doubled authors recognised as legacy defects, picture credits
and dynasty names compared language by language, Sharing History's notices found in the page.

`baselines/2026-10-22b` is the run after reimport 3, on the packages published from it: 3,348 real
differences. The fall comes from #2296 (an italic inside an italic is one italic run) and #2301
(Sharing History keeps each institution's name in its own language), with the tool reading
Sharing History's original-language institution headings. Its `diff-runs.md` lists two regressions
against 2026-10-22, both on the-hijaz-railway and both accepted: the three items legacy added since
the dump was taken are now imported, and their pictures bring four more image URLs outside `/pub`.

`baselines/2026-10-24` is the run after reimport 4, on the packages published from it: 1,342 real
differences. The fall comes from #2331 (the tool decodes legacy's entities, line breaks and
Markdown escapes, and places shared credit labels), #2332 (Sharing History authors keep their own
spelling; Baroque Art details keep a translation that has only a name, and their artist line as
legacy prints it) and the refreshed copy of legacy's images (image URLs outside `/pub`: 699 → 153;
the files still missing are missing on legacy too). Its `diff-runs.md` lists one regression against
2026-10-22b, baroqueart `detail.heading` (22 → 24). Legacy itself gives two details of the same
monument the same heading (`BAR:cz:Mon11_E:25` and `BAR:it:Mon12:16`, details 2 and 3 of each).
The package now carries both, and the tool, which pairs details by heading, counts the second as
extra.

`baselines/2026-10-25` is the run after reimport 5, on the packages published from it: 287 real
differences. The fall comes from #2335 (the tool compares what each language page shows) and #2336.
Under #2336 the import keeps each legacy field apart: location and province are no longer joined.
It also writes each language's own artist line, reads years as dxa-api reads them, and drops the
stray asterisks of touching italics. It takes Explore's English place names, and it leaves a
gallery's project-only records out of "other galleries". The sites print the artist line in the
page's language only (viewer-core 2.9.0). Its `diff-runs.md` lists one regression against
2026-10-24: the-hijaz-railway `theme.presentation` (3 → 4). Legacy's Hijaz exhibition still
shows placeholder texts ("This is the About section"), and Hijaz is excluded from parity
(decision of 2026-10-18).

`baselines/2026-10-26` is the run after reimport 6, on the packages published from it: 49 real
differences. The fall comes from #2338, #2345, viewer-core 2.10.0 and viewer-layout 3.10.0:
- **Tool (#2338):** it compares what a page prints. A "<" that starts no tag is text, soft hyphens
  are invisible, and Sharing History's two descriptions are matched in the order they print.
  Legacy's data errors are recorded in story #2339 and its child tasks.
- **Import (#2345):** it keeps every row and column legacy holds: the credit columns as written,
  picture rows with no text, Sharing History's fields each in its own key, long alternate names and
  Palaeolithic years.
- **Export (#2345):** it applies each legacy site's own display rule: dxa-api's credit fallback,
  only the pictures with a row in the page's language, and on Sharing History only those with a
  credit.
- **Sites:** they print credits as dxa-api did ("Firstname LASTNAME") and backticks as characters
  (viewer-core 2.10.0), and they show legacy's banner caption (viewer-layout 3.10.0).

Its `diff-runs.md` lists one regression against 2026-10-25: the-hijaz-railway's dump items only in
the package (262 → 263). Hijaz is excluded from parity (decision of 2026-10-18).

`baselines/2026-10-28` is the run after reimport 8, on the 66 packages published from it: the 48
sites and the 18 Islamic Art mini-sites. It has 8 real differences. Reimport 7 brought the fall,
and reimport 8 changed none of it:
- **Import (#2354):** a nameless Sharing History partner translation is no longer named.
- **Export (#2355):** Islamic Art's EPM-only language is the short description, and a mwnf3
  museum is named in every language.
- **Tool (#2356):** it reads partial CV-join credit drops, glossary terms with an apostrophe and
  partners without `i18n`.

The 8 left: stray Markdown emphasis in owner references (Baroque Art, prints-drawings and
scientific-objects), one Baroque Art detail description, and Arts in Dialogue's `site.hidden`.

Its `diff-runs.md` lists 17 regressions against 2026-10-26:
- **The mini-sites (15):** image URLs that are not `/pub/<uuid>`. This is their first baseline.
  The URLs are legacy pictures whose file is missing on legacy too (19 files), or that have no path
  (one). They are kept as legacy shows them (decision of 2026-10-24).
- **Baroque Art (1):** `membership.exhibition_pages` (0 → 1). One custom exhibition photo is
  placed for two different monuments, a legacy data error (#2383).
- **The-hijaz-railway (2):**
  - Dump items only in the package (263 → 285): Hijaz is re-authored on live legacy, so the dump
    falls behind.
  - Image URLs not `/pub/<uuid>` (10 → 17): six of the new ones are Syrian monument pictures
    (`galex5/sy/91`). Legacy serves them, but the image copy that `stage` reads predates them.

`baselines/2026-10-28b` is the run after reimport 9, on the 66 packages published from it. It has
7 real differences: the 8 above less Baroque Art's `membership.exhibition_pages`. Its
`diff-runs.md` lists no regression against 2026-10-28, and three counts that fell:
- **Baroque Art:** image URLs not `/pub/<uuid>` (275 → 6). Since #2387 every detail view is a
  placement linking a picture item, where legacy paths used to go into `extra.details`. Each
  placement of the "Awaiting Image" placeholder links its own item and keeps the placeholder as a
  page image, so no photo is placed for two monuments any more (#2383). The 6 left are legacy
  pictures whose file is missing on legacy too.
- **Photographs and the-hijaz-railway:** image URLs not `/pub/<uuid>` (9 → 2 and 17 → 4). On
  live legacy a curator removed a second picture, which had no file, from seven
  `galex5/uk/Mus92` objects, and the import follows; photographs also compares 7 fields fewer.
  The-hijaz-railway also lost the six Syrian monument pictures (`galex5/sy/91`): the legacy image
  copy now comes from `scripts/import-tool/Sync-LegacyImages.ps1` (#2385), which brought them in.

`baselines/2026-10-31` is the run after reimport 10, on the 85 packages published from it: the 66
above, the Baroque Art and Sharing History mini-sites, and the Artistic Introduction. It has the
same 7 real differences. Its `diff-runs.md` lists 23 regressions against 2026-10-28b:
- **The new mini-sites (17):** image URLs that are not `/pub/<uuid>`. This is their first
  baseline. Each URL is a legacy picture whose file is missing on legacy too. They are kept as
  legacy shows them (decision of 2026-10-24).
- **The Grand Bazaar (5):** on legacy, `monuments/isl/tr/1/28/3.jpg` is gone and `1.jpg` has
  appeared since the last image copy, but the monument still has three picture rows. Picture 3 now has no file. The URL counts
  of islamicart, explore, islamicart-the-ottomans and the-hijaz-railway each grow by one, and
  islamicart's `item.image.count` gains the monument (legacy shows 2 pictures, the package 3).
- **The-hijaz-railway (1):** `theme.picture count` (3 → 4). The package gives the About theme 9
  pictures and a new text, while the cached legacy page still reads "This is the About section".
  Hijaz is re-authored on live legacy.

`baselines/2026-11-02` is the run after reimport 11 (shipped 2026-11-02), on the 85 packages it
published (28 changed, data-packages#10). Real differences go from 7 to 2856. Its `diff-runs.md`
lists 14 regressions against 2026-10-31, and none is a site showing something legacy does not:
- **Location split (4):** baroqueart `item.location` and `item.province` (892 each), and
  islamicart `item.location` (1954) and `item.province` (1347). The packages now carry a
  record's location and its province each in its own field, and the sites compose them (data
  model rule: never merge legacy fields). This tool still compares the package's `location`
  with legacy's composed "location, province, country" and counts `province` as extra. The
  comparison must compose them the way the sites do; until then these counts are the tool's,
  not the sites'.
- **New fields the tool does not map yet (3):** baroqueart `item.period_activity` (213, the
  period of activity of #2417, exported since inventory-app#2442), and islamicart `item.address`
  (682, the monument's address) and `item.credit_ids` (6708, the credited people of
  islamicart-data 1.0.63). Each is a field legacy shows in a section of its own, which this tool
  does not read yet, so it counts them as extra in the package.
- **Dynasty (3):** `item.dynasty (free text)` on islamicart, landscapes and photographs, one record
  (`objects:epm:uk:mus22:1`). Live legacy now prints "Faisal bin Abd al-Aziz al-Saud", exactly
  as the package does; the cached legacy page still has the old "Faisal bin ˋAbd al- ˋAziz
  al-Saud". A live legacy edit; the cache is stale.
- **Sharing History's unpublished exhibitions (4):** `sh_exhibitions` (1) and
  `sh_exhibition_themes` (5) "only in the package", in both membership readings. Since
  inventory-app#2444 the package carries legacy's unlisted exhibition 2 (the political context)
  and its themes, marked `published: false`, for the political context's timeline gallery. The
  site lists none of them. This tool should skip collections with `published: false`.

`baselines/2026-11-02b` is the same packages compared with the tool taught those shapes, and with
the three stale legacy pages of the dynasty record re-read: 7 real differences, no
regressions. None of the 14 regressions above is left:
- **Location split:** the tool composes the Location line from `location`, `province` and the
  country name (and, for an Islamic Art monument, `address` first), as the sites do, and compares
  it with legacy's line. `item.province` and `item.address` are part of it, no longer extra.
- **New fields:** Baroque Art's `period_activity` is compared with legacy's "Period of activity"
  section, and Islamic Art's `credit_ids` with its credit block (the names the site prints from
  `authors.json`). Every one of them prints on legacy's sheet: none is a decided difference.
- **Unpublished collections:** `compare-collections` skips collections marked `published: false`.
- **Dynasty:** the cached answers for `objects:epm:uk:mus22:1` (Islamic Art's English page and the
  landscapes and photographs dxa-api answers) were deleted and fetched again; live legacy prints
  the package's spelling.

`baselines/2026-11-03` is the run after reimport 12, on the packages published from it (data-packages#11, 16 changed), with the tool as of #2465: 7 real differences, no regressions. The reimport brought each monument's details in legacy's order (#2452), Sharing History's bibliographies in legacy's order (#2446) and Baroque Art's monument `contact` (#2462). The first run failed the gate on that new field (`item.contact` 0 → 489): the tool had stripped legacy's Contact Details box. It now reads the box's lines and compares them with the package: 488 match, and the one with only a responsible institution draws no box on either site (expected).

`baselines/2026-11-04` is the run after reimport 13, on the packages published from it (data-packages#12; 13 of its 18 changed packages are published, the five DXA exhibitions' new versions are not yet), with the tool as of #2465: 7 real differences, no regressions. The reimport brought the dynasty texts' glossary links (#2470) and took the sponsor and partner logos out of the exhibition and Sharing History mini-site packages, which the sites now keep themselves (#2471, #2463).

`baselines/2026-11-06` is the first run with the Hijaz Railway compared live (#2379), on the packages of Epic C (#2405): the galleries' "On display in" and the exhibitions' `exhibition_references`. 46 real differences: the 7 of 2026-11-04, and Hijaz's 39, the 13 regressions its `diff-runs.md` lists, each a first measurement (Hijaz had no live comparison before). The first full run also failed every gallery's `item.other galleries` (0 → hundreds): since #2423 the package lists the gallery itself among the galleries showing an item, as legacy's sheet does, and the tool still removed it from legacy's list only. It now compares both lists whole, and every gallery is back to 0. Hijaz's 39:
- **Texts edited on legacy:** legacy's texts now spell "Hijaz" and "kilometre" where the package has "Hejaz" and "kilometer" (`item.description` 21, `item.alternate_name` 3).
- **`item.catalogue_holding_link` (10):** the double underscores of the Qatar National Library catalogue addresses are gone from the package, read as Markdown emphasis (8 carry the tool's reason `stray or misplaced Markdown emphasis`).
- **`item.copyright` (9, extra):** the package carries a rights line for nine Qatar records whose legacy sheet prints none.
- **`site.hidden`:** legacy's `status` hides the exhibition; a gallery with a site is visible (decision of 2026-10-20).
- **Not investigated yet:** partners (4 only in legacy: the institutions `jo_01`, `lb_01`, `sa_01`, `tr_02`; 8 only in the package, museums among them), members only in the package (2: `mwnf3_explore:monument:1806`, `mwnf3_travels:monument:iam:sy:1:i:1:a`), timeline events only in the package (3), `item.image.photographer` (2), `item.start/end` (1) and `exhibition.related content` (legacy 4, package 3).

## The global search box

Legacy sites that link to the overall database search (legacy's `goToFullSearch`, "Search Overall MWNF Database", or
the portal's database search form) get the new global search (M15, ADR 005). The parity check finds those sites, and
turns the box on in each one's `src/dataset.config.js`:

```js
globalSearch: true,
```

It is off by default. viewer-core (2.23.0 or later) builds the link, and viewer-layout (3.75.0 or later) draws the box in
the header, with the texts `layout.globalSearch.*` of viewer-i18n 6.18.0. A site that draws its own header places
viewer-layout's `GlobalSearchBox` where legacy's link was. The box opens `museumwithnofrontiers.github.io/search` with
the site's slug as `from`, so the search site offers "Back to <site>". M15 itself turned it on for no site.

## Known legacy quirks and decided differences

These are not defects of the new sites. The tools mark most of them `expected:` or give them a
reason. The ones that stay real are in the baseline, so they do not fail the gate.

**Decisions** (story #2233):

- **D3 / D8: the Hijaz Railway** (retired 2026-11-06, #2379). Its link in the dump answered
  403, so it was compared through the dump only. Its live legacy is on upgrade-exhibitions
  (`config/legacy.php`), which answers like the other exhibitions, so it is now compared live with
  `compare-dxa`; `compare-dump-exh` stays for an exhibition whose instance does not answer. The
  228 Hijaz Railway (`GalEx5`) objects shown in the galleries, which legacy hides, are kept.
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
- **Two fields are never joined into one** (2026-10-24). A package field holding what legacy
  prints under two headings (Sharing History's second and original-language names, its History
  inside the Description) is `different`, not `format`.
- **Order and letter case** (2026-10-25). Where legacy's code sets no order (no `ORDER BY`), a
  different order is no difference. Where legacy changes the letter case on the page, the site does
  the same at render time and the data stays as written.
- **Legacy data errors** are tracked in #2339, one task per problem, and fixed in the data, never
  worked around in code. `lib/data-errors.mjs` lists the records; the tool counts them as
  `expected:`, citing the task. A record leaves the list once its data is fixed.
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
- The PHP sheets' credit query joins every CV the author has in the page's language, whatever
  its project, so an author with two such CVs is printed twice ("António Pacheco, António
  Pacheco"). The package names them once.
- dxa-api answers some partners in English whatever language is asked.
- Some related-record links point at records that don't exist.
- Legacy galleries answer a bare size folder (`…/zoom/`) as the image of a gallery that has none.
- dxa-api is scoped per instance: other records answer 404. Its `/items` pages after the first
  come back keyed by offset, and `/partners` is a bare array. `legacy-dxa.mjs` handles all three.
- Legacy Baroque Art and Sharing History print "(- )" after an artist whose life-data fields hold
  only spaces (#2344); the site prints the name alone.

**What a page prints**, which the comparison follows rather than the raw text:

- A browser reads `<` as a tag only before a letter, `/`, `!` or `?`. Legacy's `25.<<br/>`
  prints `25.<` and its `<\i>` prints `<\i>`, so neither is stripped. A backtick is a letter on
  both sides (viewer-core 2.10 reads no code spans).
- A soft hyphen (U+00AD) is invisible on both sides.
- dxa-api prints a credit as "Firstname LASTNAME". The tool compares the line the site prints
  from the package's `credit_names` (viewer-core `creditLine`), so letter case counts. An object's
  names are in `authors_objects.priority` order; a monument's query has no `ORDER BY`, so its order
  does not count. The PHP sheets print the names as stored.
- Every legacy sheet lists only the pictures with a row in the page's language; the package
  carries those languages per picture, and the count, captions and credits compare the pictures
  the site shows in that language, within its picture cap (Baroque Art: 15 per monument).
- Islamic Art's and Baroque Art's Location line is the location and the province, each without its
  final period, then the country's name in the page's language ("London, England, United
  Kingdom"); on Islamic Art a monument's address comes first, each of its lines kept. The package
  keeps each part in its own field, and the tool composes the line as the sites' `sheet.js` does
  (`lib/sheet.mjs`), including legacy's rule that names no country for the Palestinian museum's
  objects and some Palestinian monuments.
- Islamic Art prints each credit from the people its `credit_ids` lists (their name, the Arabic
  spelling on an Arabic page); the tool compares that line with legacy's credit block as
  `item.credit_ids`, where the page prints the role. Where it prints none, the role's own row
  holds the difference. Baroque Art's period of activity prints under its own heading.
- Sharing History's Location line is a monument's address, the location, the province, the
  present-day country and the record's country ("Vienna, Austria, Public domain"); the tool
  composes the package's line the same way. Its two descriptions print under one heading each;
  the second is `description2`.
- Explore names a country from the country reference, as its site does, never from the
  country's collection title.
- Publications: legacy's book API prints each version's own row (BookDetailResource):
  `about_this_book` is `description2`, `more_about_this_book` `description1`, the editors
  `local_coordinator`. The package keeps a work's text per language and an edition's own texts
  where its row differs, under the legacy column (`texts`, D-P9; `''` where the version has none);
  the tool compares what the version shows. Works 48 and 53, in two legacy categories each, are
  compared in the one Pascal gave them (D-P3). A sample or credits PDF legacy names but its image
  host doesn't have is `expected:`, and the package leaves it out.
- Travels: legacy lists no GPA trail ("Comment for avoiding display GPA"), and neither does the
  site; its pages answer at their address and are compared. Legacy's hand-written menu names no
  Algeria, while its home's select and the IAM page list that trail; the site's menu follows the
  menu. A monument's pictures are matched by their number in legacy's path
  (`…/<itinerary>/<location>/<letter>/<n>.jpg`); a monument with no picture is not in legacy's
  gallery, so the monument sets count only the pictured ones on both sides.

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
| `compare-dump-exh.mjs` | one exhibition through the dump, for one whose live instance does not answer (none today; not run by `run.mjs`) |
| `compare-php.mjs`, `compare-collections.mjs`, `compare-partners-php.mjs` | the PHP sites, through `legacy-php.mjs`; `fetch-php.mjs` warms their cache |
| `compare-explore.mjs`, `compare-hub.mjs` | Explore and the galleries hub |
| `check-packages.mjs` | the package gates (`lib/gates.mjs`) |
| `aggregate.mjs` | `overview.md` |
| `diff-runs.mjs` | the gate against the baseline |
| `jobs-*.mjs`, `capture.mjs`, `compare-style.mjs`, `build-style-page.mjs` | the style pass |
| `assets.mjs`, `compare-assets.mjs` | the assets pass |
| `static.mjs`, `compare-static.mjs` | the static pass |
| `jobs-layout.mjs`, `layout.mjs` | the layout gate: `lib/layout-rules.mjs`, `layout-allow.json` |
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
