# Unified Legacy Importer

A CLI tool that migrates data from the legacy MWNF databases into the new
Inventory Management System's database.

> **Running this against the OVH-hosted deployment, or want to build a full
> local copy?** Use [`scripts/import-tool/`](../import-tool/README.md) — a
> Docker container that drives this importer for you in two phases
> (`stage` builds a complete local copy from legacy; `ship` sends that copy
> to the server, and a separate `backup-permissions` snapshots auth), with
> sequential exit-code-checked `artisan` commands, image push, and auth
> snapshot/restore.
> Everything below is about running the importer directly/standalone —
> useful for development, debugging a specific importer, or understanding
> what `import-tool` is actually orchestrating.

**Current status**: Covers the full legacy data model — the core `mwnf3`
database (projects, partners, objects, monuments, images) plus every
secondary legacy database this content set has: Sharing History
(`mwnf3_sharing_history`), Explore (`mwnf3_explore`), Travels
(`mwnf3_travels`), and Thematic Galleries (`mwnf3_thematic_gallery`), along
with timelines/HCR and glossary linking. Run `npx tsx src/cli/import.ts
import --list-importers` for the exact, current, numbered list — well over
100 importers across 10 phases — rather than relying on this document to
enumerate them (it won't stay in sync; see "Import Phases" below for the
shape instead).

## Architecture

This importer follows a clean architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                    BaseImporter (Abstract)                   │
│  - import(): Promise<ImportResult>                           │
│  - transform helpers                                         │
│  - logging infrastructure                                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
         ┌─────────────┴─────────────┐
         │                           │
┌────────▼────────┐         ┌───────▼──────────┐
│ SqlWriteStrategy │         │ (Future)         │
│ - Direct SQL     │         │ ApiWriteStrategy │
│ - Fast bulk ops  │         │ - REST API calls │
└─────────────────┘         └──────────────────┘
```

### Legacy Database Interface

The `ILegacyDatabase` interface (defined in `core/base-importer.ts`) provides read access to the legacy database:

```typescript
interface ILegacyDatabase {
  query<T>(sql: string): Promise<T[]>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}
```

**Important Notes:**

- Queries must use actual legacy table names, schema-qualified where the
  table lives outside the core `mwnf3` schema (e.g. `mwnf3.objects`,
  `mwnf3_sharing_history.sh_objects`, `mwnf3_explore.exploremonument`,
  `mwnf3_travels.tr_monuments`, `mwnf3_thematic_gallery.thg_gallery`)
- Each legacy schema has its own naming quirks and structure — transformers
  handle mapping all of them to the new, unified schema
- Languages and countries are loaded from JSON files, NOT from the legacy database
- `LegacyDatabase`/`ResilientConnection` race every query against a 30s
  timeout and auto-reconnect on connection loss — a legacy MySQL connection
  dropping mid-run is expected on long imports, not treated as fatal

### Data Flow

The import process follows a clear data flow:

```
┌──────────────────┐
│  Legacy Database │  (mwnf3.objects, mwnf3.monuments, etc.)
│   + JSON Files   │  (languages.json, countries.json)
└────────┬─────────┘
         │
         │ ILegacyDatabase.query()
         ▼
┌──────────────────┐
│   Transformer    │  (Pure functions in domain/transformers/)
│  - HTML→Markdown │
│  - Field mapping │
│  - Validation    │
└────────┬─────────┘
         │
         │ Transformed data
         ▼
┌──────────────────┐
│  Write Strategy  │  (SqlWriteStrategy with resilient connection)
│  - SQL INSERT    │
│  - Retry logic   │
│  - Transaction   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Target Database │  (inventory.items, inventory.partners, etc.)
└──────────────────┘
```

### Project Creation

Projects have special handling - each legacy project creates THREE new entities:

1. **Context** - Contextual grouping (e.g., "WAL Project")
2. **Collection** - Grouping of items (e.g., "WAL Collection")
3. **Project** - Actual project entity (e.g., "Umayyad Route")

All three share the same `backward_compatibility` value (e.g., `mwnf3:projects:WAL`) to facilitate linking.

Each project also gets its `site_url`, `related_database_url` and
`artistic_introduction_url` columns populated from a small, hand-maintained
map keyed on the legacy `project_id` — see
[Project Site & Related-Database URLs](#project-site--related-database-urls)
below.

### Directory Structure

```
src/
├── core/                   # Core interfaces and abstractions
│   ├── types.ts           # Data types and interfaces
│   ├── tracker.ts         # Entity tracking (ITracker, UnifiedTracker)
│   ├── strategy.ts        # Write strategy interface
│   ├── file-logger.ts     # Dual console/file logging
│   └── base-importer.ts   # Base importer class
├── domain/
│   ├── types/              # Legacy data types (per legacy schema)
│   └── transformers/       # Business logic (pure functions, per entity)
├── strategies/
│   └── sql-strategy.ts     # SQL-based write strategy
├── helpers/                 # Shared helper classes (tags, authors, artists)
├── importers/                # Importer implementations, one directory per phase
│   ├── phase-00/            # Reference data (languages, countries, default context)
│   ├── phase-01/            # Core mwnf3 data (projects, partners, items, authors, dynasties)
│   ├── phase-02/            # Core mwnf3 images
│   ├── phase-03/            # Sharing History (mwnf3_sharing_history)
│   ├── phase-04/            # Glossary
│   ├── phase-05/            # Timelines (HCR)
│   ├── phase-06/            # Explore (mwnf3_explore)
│   ├── phase-07/            # Travels (mwnf3_travels)
│   ├── phase-08/            # Media & documents
│   ├── phase-10/            # Thematic Galleries (mwnf3_thematic_gallery) + cross-schema links
│   └── phase-11/            # Post-import linking & cleanup (needs everything else imported first)
├── tools/
│   └── image-sync.ts       # Image file synchronization
├── utils/                    # HTML→Markdown, code mappings, backward-compatibility helpers
└── cli/
    └── import.ts            # CLI entry point (import, validate, image-sync)
```

## Key Design Principles

### 1. Single Source of Truth for Business Logic

All transformation logic is in the `domain/transformers/` directory. These are **pure functions** that:

- Take legacy data as input
- Return transformed data ready for persistence
- Have no side effects
- Can be easily tested in isolation

### 2. Strategy Pattern for Write Operations

The `IWriteStrategy` interface abstracts how data is written:

- `SqlWriteStrategy`: Direct SQL INSERT statements (fast, resilient with retry logic)
- `ApiWriteStrategy`: REST API calls (future, for validation)

Importers don't know which strategy is being used - they just call `strategy.writeItem()`.

### 3. Unified Tracker

The `ITracker` interface provides a consistent way to track imported entities:

- Prevents duplicate imports
- Resolves dependencies between entities
- Tracks default language and default context
- Works with both in-memory Map and persistent storage

### 4. Resilient Connections

`LegacyDatabase` and `ResilientConnection` (the target-DB wrapper) both:

- Reconnect automatically on connection loss
- Retry failed queries up to 5 times with backoff
- Race every query against a 30-second timeout — needed because attaching
  a custom `'error'` listener to the underlying `mysql2` connection (for
  reconnect handling) means a socket dying mid-query can otherwise leave
  the query's own promise hanging forever, silently, with the retry loop
  never getting a chance to run

### 5. Comprehensive Logging

All import operations are logged to both console and timestamped files in `logs/`:

- Detailed progress tracking
- Error context with full stack traces
- Phase summaries with duration and counts
- Warning tracking for data quality issues

### 6. DRY (Don't Repeat Yourself)

Business logic is written once in transformers:

- HTML to Markdown conversion
- Field truncation and validation
- Tag parsing logic
- Artist extraction

## Usage

### Typical Workflow

The importer is designed to run as part of a complete database initialization:

1. **Create auth snapshot** - Preserve user accounts, MFA setup, role assignments, direct permissions, and API tokens (`php artisan auth:snapshot auth-snapshots/pre-import.json.enc --force`)
2. **Wipe database** - Create or empty the database schema (e.g. `php artisan db:wipe --force; php artisan migrate --force`)
3. **Seed and sync permissions** - Run `php artisan db:seed --class=MinimalDatabaseSeeder --force` and `php artisan permissions:sync`
4. **Restore auth snapshot** - Restore users after migrations and permission sync (`php artisan auth:restore auth-snapshots/pre-import.json.enc --force`)
5. **Run the importer** - `import`, then `image-sync`
6. **Glossary resync** - Re-link glossary spellings to imported translations via `php artisan glossary:bulk-resync` (required post-import step)
7. **Done** - Database is ready with both reference and legacy data

[`import-tool`](../import-tool/README.md) automates steps 1–6 end to end
(and adds a way to build this all locally first, then ship it — see its
`stage`/`ship` modes). Auth snapshots are encrypted with Laravel's current
`APP_KEY`; the key is not written into the snapshot file. Restore the
snapshot only into an application using the same `APP_KEY`, because Fortify
MFA secrets are encrypted with that key.

All operations are logged to timestamped files in the `logs/` directory for later review.

### Post-Import: Glossary Resync

After the importer finishes, glossary-to-translation links must be rebuilt. The importer does **not** create these links — they are managed by the Laravel glossary sync system.

```bash
# From the inventory-app root directory:

php artisan glossary:bulk-resync
```

`glossary:bulk-resync` scans all ItemTranslation, CollectionTranslation, and TimelineEventTranslation records for glossary spelling matches and creates pivot links, one combined regex pattern per language checked once per translation. This is a **required post-import step** — without it, glossary terms will not be highlighted in translation content. It runs synchronously (no queue, no `queue:work` step needed) and finishes in minutes even on the full dataset.

Every run fully recomputes each translation's spelling links from the current glossary and current translation text, so stale links (spellings that no longer match, or that have since been deleted) are always dropped — there's no separate "remove existing first" flag to remember, unlike the older `glossary:resync` command below.

Add `--dry-run` to report match counts without writing any links, and `--chunk=<n>` to change how many translations are processed per chunk (default 200).

There is also an older, per-spelling command, `glossary:resync --remove-existing --force` followed by `php artisan queue:work --queue=glossary`, which dispatches one queued job per glossary spelling and re-scans every translation of that spelling's language for each one — O(spellings × translations), which takes hours on the full dataset. It still exists for the reactive single-spelling case (editing one glossary entry in the admin panel dispatches just its own job), but `glossary:bulk-resync` is what to run after a bulk import.

### Running the importer

```bash
cd scripts/importer
npm install                # First run only (installs dependencies)
npx tsx src/cli/import.ts import
```

### Available Commands

```bash
npx tsx src/cli/import.ts --help
```

#### 1. `import` — Import legacy data

```bash
npx tsx src/cli/import.ts import
npx tsx src/cli/import.ts import --list-importers   # numbered list of every importer, in run order
npx tsx src/cli/import.ts import --only partner      # run a single importer
npx tsx src/cli/import.ts import --start-at project  # resume from a given point
npx tsx src/cli/import.ts import --stop-at partner   # run up to and including a given point
```

- `--dry-run` - Simulate without writing data
- `--only <importer>` / `--start-at <importer>` / `--stop-at <importer>` -
  target a subset; respects the dependency order shown by `--list-importers`
- `--list-importers` - the authoritative, current list — use this instead of
  looking for a hardcoded list in this document

Exits with code 1 whenever any individual row failed to import (tracked as
a warning/error in its own summary, not necessarily a sign the whole run
failed) — see [`import-tool`](../import-tool/README.md)'s note on this for
how downstream automation handles it.

#### 2. `validate` — Test database connections

```bash
npx tsx src/cli/import.ts validate
```

#### 3. `image-sync` — Synchronize legacy images

```bash
npx tsx src/cli/import.ts image-sync
```

- `--copy` - Copy files instead of symlinking (symlink is the default)
- `--clear-destination` - Clear destination image folder before synchronization starts
- `--target-dir <path>` - Target image directory (overrides `NEW_IMAGES_ROOT` env var and the artisan fallback, `php artisan storage:image-path available`: the app's private originals directory)
- `--dry-run` - Simulate without making changes

**Image Sync Details:**

- Finds ItemImage/PartnerImage/etc. records with `size=1` (legacy placeholders)
- Copies or symlinks actual image files from legacy storage
- Updates database records with correct path, size, and metadata
- Only connects to the new database (not the legacy database)
- Requires `LEGACY_IMAGES_ROOT` environment variable
- Same exit-code behavior as `import`: nonzero whenever any individual file
  failed (e.g. a legacy path that doesn't exist on disk), not necessarily a
  sign the whole sync failed

### Logging

All import operations are logged to timestamped files in the `logs/` directory:

```
logs/
├── import-2025-12-13T20-47-35-804Z.log
├── import-2025-12-13T21-07-20-361Z.log
└── import-2025-12-14T01-30-07-715Z.log
```

**Log Contents**:

- Import start time and configuration
- Per-importer progress (imported, skipped, errors)
- Warnings with context
- Error details with stack traces
- Phase summaries with durations
- Final statistics

**Console Output**:

- Real-time progress indicators (`.` = imported, `s` = skipped, `×` = error)
- Phase headers and summaries
- Final success/failure status

## Import Phases

Importers run in strict dependency order — each depends on its listed
`dependencies` in the CLI registry, resolved automatically via
`orderConfigsByDependencies`, not on the order they happen to be declared in.
Run `--list-importers` for the definitive, numbered, current list. Shape,
not an exhaustive enumeration:

| Phase | Legacy source | Covers |
|---|---|---|
| 0 | JSON files + `mwnf3` translations | Reference data: default context, languages, countries |
| 1 | `mwnf3` | Core data: projects, partners (museums/institutions/schools), objects, monuments, monument details, authors, dynasties, item-item links, the mwnf3 exhibition system |
| 2 | `mwnf3` | Images for the above (object/monument/monument-detail pictures, partner pictures/logos) |
| 3 | `mwnf3_sharing_history` | Sharing History: projects, partners, objects, monuments, monument details, images, exhibitions, national context, bibliography |
| 4 | `mwnf3` | Glossary terms, translations, spellings |
| 5 | (HCR) | Timelines and timeline events |
| 6 | `mwnf3_explore` | Explore: contexts, countries, regions, locations, monuments, itineraries, thematic cycles, cross-references, filters, and their images/translations |
| 7 | `mwnf3_travels` | Travels: contexts, trails, itineraries, locations, monuments, and their images/translations |
| 8 | `mwnf3` | Item media and documents |
| 10 | `mwnf3_thematic_gallery` | Thematic Galleries: galleries, themes, contributors, tags, timelines, gallery content, and cross-schema links from galleries to items originating in every other legacy schema above |
| 11 | (post-import) | Collection media (needs THG collections), partner-monument linking, project exhibition-root keying (see below), project cleanup (drops projects left with no items) |

### Project exhibition-root keying (standalone-friendly)

`project-exhibition-root-keying` (phase 11, before `project-cleanup`) creates
a "Virtual Exhibitions" marker collection `mwnf3:exhibitions:root:{KEY}` under
each non-ISL project collection and re-parents that project's exhibition
collections beneath it. This gives every dataset's exporter/viewer an
unambiguous structural anchor for exhibitions — neither `type='exhibition'`
nor the `mwnf3:exhibitions:{id}` keys are project-scoped in the legacy
schema. ISL is untouched: its exhibitions already nest under the original
`mwnf3:exhibitions:root` marker.

Because the importer is meant to run **once** (inventory-app is the source of
truth afterwards), this step is designed to be run **standalone** against an
already-imported database when a new dataset needs keying — seconds instead
of a full multi-hour import:

```bash
npx tsx src/cli/import.ts import --only project-exhibition-root-keying            # dry-run first:
npx tsx src/cli/import.ts import --only project-exhibition-root-keying --dry-run
```

It is idempotent (existing roots/parents are skipped) and only needs the
`mwnf3.exhibitions` table on the legacy side — a scratch database loaded from
`.legacy-database/` dumps is sufficient if the live legacy DB is unreachable.
Sharing History and Explore use different keyspaces and are future extensions
of this step (#1464, #1465).

### Museum → project link (legacy MWNF-384)

`mwnf3.museums.project_id` is the project a museum record was *created* under,
and it is the only input to the third branch of legacy's gallery partner query
(`app/MWNF/SQL/mwnf3/Partners.blade.php`): a museum created in the gallery's own
project is listed even when it holds nothing. The importer used to discard the
column, so no gallery exporter could reproduce that branch — the carpets package
shipped 70 partners against legacy's 72.

`PartnerImporter` now resolves it onto `partners.project_id` (the column already
existed; `SchoolImporter` was its only writer, for ten ISL schools). Because
`mwnf3.museums` is `PRIMARY KEY (museum_id, country)` — exactly the key the
importer groups on — one inventory partner maps to one legacy row and therefore
one project, so a single FK is enough; no join table is needed.

For databases imported before that, the same link is repaired standalone:

```bash
npx tsx src/cli/import.ts import --only museum-project-link-backfill --dry-run
npx tsx src/cli/import.ts import --only museum-project-link-backfill
```

It reads only `mwnf3.museums`, writes only where `partners.project_id` is still
null (so schools and reruns are never overwritten), and warns rather than fails
on a museum whose project was never imported or was removed by
`project-cleanup`.

## Environment Variables

Create a `.env` file in the `scripts/importer` directory with:

```env
# Legacy Database (source) - for reading projects, partners, and items
LEGACY_DB_HOST=localhost
LEGACY_DB_PORT=3306
LEGACY_DB_USER=root
LEGACY_DB_PASSWORD=secret
LEGACY_DB_DATABASE=mwnf3

# New Database (target) - where data will be imported to
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=secret
DB_DATABASE=inventory

# Legacy Images Root - for image synchronization
LEGACY_IMAGES_ROOT=C:\mwnf-server\pictures\images

# New Images Root - override target storage path (optional)
# If not set, resolved via: php artisan storage:image-path available
# (the private originals directory; the public pictures directory is only a
# cache of burned renditions, never a target)
NEW_IMAGES_ROOT=C:\path\to\inventory-app\storage\app\private\image-originals\images
```

Note: only `LEGACY_DB_DATABASE` (the core `mwnf3` schema) is configurable —
the secondary legacy schemas (`mwnf3_sharing_history`, `mwnf3_explore`,
`mwnf3_travels`, `mwnf3_thematic_gallery`) are referenced schema-qualified
directly in each phase's queries and are expected to exist alongside it on
the same `LEGACY_DB_HOST`.

### Required Environment Variables

| Variable             | Description                                        | Default                                           |
| -------------------- | -------------------------------------------------- | -------------------------------------------------- |
| `LEGACY_DB_HOST`     | Legacy database hostname                           | `localhost`                                       |
| `LEGACY_DB_PORT`     | Legacy database port                               | `3306`                                            |
| `LEGACY_DB_USER`     | Legacy database username                           | `root`                                            |
| `LEGACY_DB_PASSWORD` | Legacy database password                           | (empty)                                           |
| `LEGACY_DB_DATABASE` | Legacy database name (core `mwnf3` schema)         | `mwnf3`                                           |
| `DB_HOST`            | Target database hostname                           | `localhost`                                       |
| `DB_PORT`            | Target database port                               | `3306`                                            |
| `DB_USERNAME`        | Target database username                           | `root`                                            |
| `DB_PASSWORD`        | Target database password                           | (empty)                                           |
| `DB_DATABASE`        | Target database name                               | `inventory`                                       |
| `LEGACY_IMAGES_ROOT` | Root directory of legacy images                    | `C:\mwnf-server\pictures\images`                  |
| `NEW_IMAGES_ROOT`    | Target image storage directory (overrides artisan) | _(resolved via `php artisan storage:image-path available`)_ |

### Validating Database Connections

Before running the import, validate your database connections:

```bash
npx tsx src/cli/import.ts validate
```

This will test both legacy and target database connections and report any issues.

## Data Sources

### Reference Data (Languages & Countries)

Languages and countries are **NOT** imported from the legacy database. Instead, they are loaded from production JSON files:

- `database/seeders/data/languages.json` - ISO 639-3 language codes
- `database/seeders/data/countries.json` - ISO 3166-1 alpha-3 country codes

These files are the same sources used by Laravel seeders and the API importer.

### Legacy Database Schemas

| Schema | What it holds |
|---|---|
| `mwnf3` | Core content: projects, partners, objects, monuments, monument details, pictures, glossary, exhibitions, media/documents |
| `mwnf3_sharing_history` | The Sharing History sub-site's own parallel project/partner/object/monument/exhibition data |
| `mwnf3_explore` | The Explore sub-site: countries, regions, locations, monuments, itineraries, thematic cycles |
| `mwnf3_travels` | The Travels sub-site: trails, itineraries, locations, monuments |
| `mwnf3_thematic_gallery` | Thematic Galleries: curated cross-cutting collections linking back to items from every schema above |

## Adding New Importers

1. Create legacy type in `domain/types/`
2. Create transformer in `domain/transformers/`
3. Create importer in `importers/phase-XX/` (existing phase, or a new one if it's a genuinely new stage)
4. Add to the CLI registry in `cli/import.ts`, with accurate `dependencies`

## Special Transformations

### EPM Context

Items in the EPM project receive special handling:

- **description2** field → becomes a second translation in EPM context
- First translation uses the default context
- Second translation uses the EPM context (identified by backward_compatibility)

### Legacy Country Codes

Special handling for non-standard legacy country codes:

- `ww` → country=null + extra: `{country: "Other"}`
- `fx` → country=null + extra: `{country: "Disputed"}`
- `yu` → country=null + extra: `{country: "Former Yugoslavia"}`
- `px` → country=pse (State of Palestine) + extra: `{country: "Palestinian Territories"}`

### Project Site & Related-Database URLs

`src/utils/project-urls.ts` holds `PROJECT_URL_MAP`, a small, versioned map
from legacy `project_id` (e.g. `ISL`, `BAR`, `AWE`) to that project's public
`site_url`, `related_database_url` (the legacy "search related database"
page) and `artistic_introduction_url`. It is looked up (via
`lookupProjectUrls`) by both `project-transformer.ts` and
`sh-project-transformer.ts` and written onto `projects.site_url` /
`related_database_url` / `artistic_introduction_url` by the importer, rather
than being entered by hand in Filament — a re-import would otherwise wipe
hand-entered data. This mirrors `code-mappings.ts`: legacy knowledge that
used to live in the frontend (`viewer-core`'s `conventions.js`) is captured
here instead (epic #1727).

An unmapped legacy key resolves to all-null fields rather than throwing —
most one-off legacy projects never had a dedicated public site, and that is
an expected outcome, not an error.

**Needs manual maintenance**: like `code-mappings.ts`, nothing derives this
map automatically. Add an entry (or correct a placeholder null) whenever a
new legacy project/site is confirmed.

### Artist & Tag Extraction

Legacy data contains artists and tags in text fields:

- **Artists**: Extracted, deduplicated, and created as Author entities
- **Tags**: Parsed from delimited strings, categorized (material, keyword, etc.)
- **Backward compatibility**: Maintains links using `mwnf3:artists:{name}` format

### HTML to Markdown

All legacy HTML content is converted to Markdown:

- Preserves basic formatting (bold, italic, links)
- Converts lists, headings, and paragraphs
- Strips unsupported HTML tags
- Handles malformed HTML gracefully
- Refuses a result that still holds a tag (`assertMarkdownOnly`): a data
  package holds Markdown, and every website renders it through one pipeline
  that escapes raw HTML, so a leak fails the import here rather than reaching
  a page as the characters it is.

A link a curator wrote into a gallery's or an exhibition's own texts by the
legacy site's absolute address (`https://exhibitions.museumwnf.org/water_in_islam/en/themes`)
is rewritten into the hash route the replacing website reaches the same page
by (`#/themes`), by `localiseLegacyLinks` in `utils/legacy-links.ts`, before
the conversion. Only a link into the same gallery is touched; the language
segment is dropped, since the website keeps its language in the query.

## Finding the collection id for an exporter

Every exporter (`scripts/exporters/<dataset>`) is scoped by a hardcoded
collection identifier — a project key (`PROJECT_KEYS`) or a
`backward_compatibility` string (`GALLERY_BACKWARD_COMPATIBILITY`,
`EXHIBITION_BACKWARD_COMPATIBILITY`). Standing up a new site means finding
that identifier, and increasingly the collection's UUID, without querying the
inventory-app database by hand. Two artisan commands (run against
inventory-app, not this importer) do that lookup:

```bash
# Resolve a legacy numeric id, legacy slug, project KEY, or exact English
# title to a collection's UUID, internal_name, type, parent and per-language
# titles.
php artisan importer:find-collection gallery 9
php artisan importer:find-collection gallery carpets
php artisan importer:find-collection exhibition the-use-of-colours-in-art
php artisan importer:find-collection exhibition 47
php artisan importer:find-collection project ISL
php artisan importer:find-collection project "Discover Islamic Art"
php artisan importer:find-collection gallery 9 --json

# Browse every collection of a kind when the exact selector isn't known.
php artisan importer:list-collections gallery
php artisan importer:list-collections exhibition --json
php artisan importer:list-collections project
```

`{kind}` is one of `project`, `gallery`, or `exhibition`. For `gallery`/
`exhibition`, `{selector}` may be any of three forms — all are tried and the
command requires exactly one collection to match overall (ambiguous or zero
matches exit non-zero, listing candidates when ambiguous):

- the legacy numeric id, matched against the
  `mwnf3_thematic_gallery:thg_gallery:{id}` / Sharing History
  `mwnf3_sharing_history:sh_exhibitions:{id}` `backward_compatibility`
  patterns these importers write — see `phase-10/thg-gallery-importer.ts` and
  `phase-03/sh-exhibition-importer.ts`;
- the exact, case-sensitive legacy slug — the raw legacy `thg_gallery.link`
  value (e.g. `carpets`, `the-use-of-colours-in-art`), stored verbatim as
  `extra.thg_gallery.slug` by `phase-10/thg-gallery-importer.ts`. This is
  *not* the same string as `internal_name` (`gallery_carpets`,
  `exhibition_the_use_of_colours_in_art`), which slugifies the same value
  further (lower-cases, collapses `-`/`_`/whitespace to a single `_`) — the
  two coincide for simple slugs but diverge whenever the legacy slug itself
  contains a hyphen;
- the exact, case-sensitive English title.

For `project`, `{selector}` is the legacy project KEY (matched against
`mwnf3:projects:{KEY}` / `mwnf3_sharing_history:sh_projects:{key}`, written by
`domain/transformers/project-transformer.ts` and `sh-project-transformer.ts`),
falling back to the exact, case-sensitive English title when the KEY doesn't
match.

Because collection UUIDs are deterministic (`uuidv5` of the collection's
`backward_compatibility`, via `src/utils/deterministic-uuid.ts` — see that
file's own CRITICAL warning about the frozen namespace), a UUID resolved this
way survives a full re-import of the same legacy source, which is what lets
an exporter be parameterised by UUID instead of pinning a legacy id.

## Extending with API Strategy

To add API-based imports:

1. Create `strategies/api-strategy.ts` implementing `IWriteStrategy`
2. Create CLI option to select strategy
3. Importers automatically work with new strategy

## Troubleshooting

### Database Connection Issues

**Error**: `Connection failed`  
**Solution**: Run `npx tsx src/cli/import.ts validate` to test connections. Check `.env` file for correct credentials.

### Import Failures Mid-Process

**Error**: Import stops partway through  
**Solution**: Check the log file in `logs/` directory. `LegacyDatabase`/`ResilientConnection` retry and reconnect automatically on connection loss. For a genuine data issue on one row, fix it and restart from the failing importer using `--start-at`.

### Duplicate Key Violations

**Error**: `Duplicate entry for key 'backward_compatibility'`  
**Solution**: This importer is idempotent by design (safe to re-run without wiping — it detects already-imported rows via `backward_compatibility` and skips them). A duplicate-key error despite that usually means the *target* schema state doesn't match what the importer expects; wiping and re-running from scratch is the reliable fallback.

### Missing Dependencies

**Error**: Importer complains about missing entities  
**Solution**: Ensure importers run in order — `--list-importers` reflects the real, resolved dependency order. Use `--start-at`/`--stop-at`/`--only` carefully; skipping an importer that a later one depends on will surface as a "not found" error partway through.

### Image Sync Issues

**Error**: Image files not found  
**Solution**: Verify `LEGACY_IMAGES_ROOT` path in `.env` points to the correct legacy images directory. Some legacy image paths referenced in the source database genuinely don't exist on disk — `image-sync` reports these individually rather than aborting the whole run; check its summary for the exact list.
