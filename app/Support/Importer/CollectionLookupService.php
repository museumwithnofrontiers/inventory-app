<?php

namespace App\Support\Importer;

use App\Models\Collection;
use App\Models\CollectionTranslation;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;

/**
 * Resolves a "kind" (project|gallery|exhibition) plus a legacy selector (a
 * legacy numeric id, a legacy slug, a project KEY, or an exact English title)
 * to the Collection row(s) the importer created for it.
 *
 * Backing facts (confirmed against the importer sources, not invented):
 * - Galleries/exhibitions: scripts/importer/src/importers/phase-10/thg-gallery-importer.ts
 *   writes `backward_compatibility = "mwnf3_thematic_gallery:thg_gallery:{legacy_gallery_id}"`
 *   for BOTH kinds; only `type` (gallery|exhibition) tells them apart.
 * - Sharing History exhibitions: scripts/importer/src/importers/phase-03/sh-exhibition-importer.ts
 *   writes `backward_compatibility = "mwnf3_sharing_history:sh_exhibitions:{exhibition_id}"`
 *   with `type = 'exhibition'` — a second source for kind=exhibition.
 * - mwnf3 project roots: scripts/importer/src/domain/transformers/project-transformer.ts
 *   (`transformProject`) writes `backward_compatibility = "mwnf3:projects:{KEY}"` (KEY
 *   case as stored in legacy `mwnf3.projects.project_id`, e.g. "ISL"), `type` left
 *   unset which defaults to 'collection' (migration
 *   database/migrations/2025_09_28_072143_add_type_to_collections.php).
 * - Sharing History project roots: scripts/importer/src/domain/transformers/sh-project-transformer.ts
 *   (`transformShProject`/`formatShBackwardCompatibility`) writes
 *   `backward_compatibility = "mwnf3_sharing_history:sh_projects:{key}"`, KEY
 *   lower-cased, also `type = 'collection'` (default).
 *
 * `type = 'collection'` is shared by many unrelated root/anchor collections
 * (galleries-root, exhibitions-root, artintro-root, ...), so kind=project
 * additionally restricts to collections whose `backward_compatibility` carries
 * one of the two recognised project prefixes.
 *
 * - Gallery/exhibition legacy slug: `thg-gallery-importer.ts` also stores the
 *   raw legacy `thg_gallery.link` value verbatim as `extra.thg_gallery.slug`
 *   (`buildAnchor()`) — e.g. "carpets", "the-use-of-colours-in-art". This is
 *   distinct from `internal_name` (`{type}_{slugify(link)}`, e.g.
 *   "gallery_carpets", "exhibition_the_use_of_colours_in_art"), which further
 *   slugifies the same value (lower-cases, collapses `-`/`_`/whitespace to a
 *   single `_`) — the two coincide for simple slugs but diverge whenever the
 *   legacy slug itself contains a hyphen, so the raw `extra.thg_gallery.slug`
 *   is the correct source for an exact, case-sensitive slug selector.
 */
class CollectionLookupService
{
    public const KIND_PROJECT = 'project';

    public const KIND_GALLERY = 'gallery';

    public const KIND_EXHIBITION = 'exhibition';

    /**
     * @var list<string>
     */
    public const KINDS = [
        self::KIND_PROJECT,
        self::KIND_GALLERY,
        self::KIND_EXHIBITION,
    ];

    /**
     * The ISO 639-3 id of the English language row (confirmed via
     * App\Models\Language::scopeEnglish()).
     */
    public const ENGLISH_LANGUAGE_ID = 'eng';

    /**
     * Recognised `backward_compatibility` prefixes for a kind, in the order
     * they are tried.
     *
     * @return list<string>
     */
    public static function backwardCompatibilityPrefixes(string $kind): array
    {
        return match ($kind) {
            self::KIND_GALLERY => [
                'mwnf3_thematic_gallery:thg_gallery:',
            ],
            self::KIND_EXHIBITION => [
                'mwnf3_thematic_gallery:thg_gallery:',
                'mwnf3_sharing_history:sh_exhibitions:',
            ],
            self::KIND_PROJECT => [
                'mwnf3:projects:',
                'mwnf3_sharing_history:sh_projects:',
            ],
            default => [],
        };
    }

    /**
     * The `collections.type` value collections of this kind carry.
     */
    public static function collectionType(string $kind): string
    {
        return match ($kind) {
            self::KIND_GALLERY => Collection::TYPE_GALLERY,
            self::KIND_EXHIBITION => Collection::TYPE_EXHIBITION,
            self::KIND_PROJECT => Collection::TYPE_COLLECTION,
            default => throw new \InvalidArgumentException("Unknown collection kind '{$kind}'."),
        };
    }

    public static function isValidKind(string $kind): bool
    {
        return in_array($kind, self::KINDS, true);
    }

    /**
     * Base query for every collection that could plausibly belong to this
     * kind: right `type`, and (for project) a recognised backward_compatibility
     * prefix.
     *
     * @return Builder<Collection>
     */
    public static function baseQuery(string $kind): Builder
    {
        $query = Collection::query()->where('type', self::collectionType($kind));

        if ($kind === self::KIND_PROJECT) {
            $prefixes = self::backwardCompatibilityPrefixes($kind);
            $query->where(function (Builder $prefixQuery) use ($prefixes): void {
                foreach ($prefixes as $prefix) {
                    $prefixQuery->orWhere('backward_compatibility', 'like', $prefix.'%');
                }
            });
        }

        return $query;
    }

    /**
     * Resolve a selector to the matching collection(s) of a kind.
     *
     * - gallery/exhibition: three selector forms are acceptable — a legacy
     *   numeric id, the exact legacy slug (`extra.thg_gallery.slug`,
     *   case-sensitive), and an exact, case-sensitive English title. All
     *   applicable forms are tried and merged into one set of *distinct*
     *   collections, rather than trying them in a priority order — a priority
     *   order could silently prefer the wrong match if two different forms
     *   happened to point at two different collections. Callers decide what
     *   "not found" (0) or "ambiguous" (>1) means for the merged set.
     * - project: the selector is first matched as the legacy KEY (exact
     *   backward_compatibility match, case-sensitive for the mwnf3 pattern,
     *   lower-cased for the Sharing History pattern); if nothing matches, it
     *   falls back to an exact, case-sensitive English title match.
     *
     * @return EloquentCollection<int, Collection>
     */
    public static function resolveBySelector(string $kind, string $selector): EloquentCollection
    {
        if ($selector === '') {
            return self::emptyCollection();
        }

        if ($kind === self::KIND_PROJECT) {
            $byKey = self::byProjectKey($selector);
            if ($byKey->isNotEmpty()) {
                return $byKey;
            }

            return self::byEnglishTitle($kind, $selector);
        }

        $matches = self::emptyCollection();

        if (ctype_digit($selector)) {
            $matches = $matches->merge(self::byLegacyId($kind, $selector));
        }

        $matches = $matches->merge(self::bySlug($kind, $selector));
        $matches = $matches->merge(self::byEnglishTitle($kind, $selector));

        return $matches->unique('id')->values();
    }

    /**
     * Match gallery/exhibition collections by their legacy numeric id.
     *
     * @return EloquentCollection<int, Collection>
     */
    public static function byLegacyId(string $kind, string $legacyId): EloquentCollection
    {
        $candidates = array_map(
            fn (string $prefix): string => $prefix.$legacyId,
            self::backwardCompatibilityPrefixes($kind)
        );

        if ($candidates === []) {
            return self::emptyCollection();
        }

        return self::baseQuery($kind)->whereIn('backward_compatibility', $candidates)->get();
    }

    /**
     * Match project collections by their legacy KEY.
     *
     * @return EloquentCollection<int, Collection>
     */
    public static function byProjectKey(string $key): EloquentCollection
    {
        $candidates = [
            'mwnf3:projects:'.$key,
            'mwnf3_sharing_history:sh_projects:'.mb_strtolower($key),
        ];

        return self::baseQuery(self::KIND_PROJECT)->whereIn('backward_compatibility', $candidates)->get();
    }

    /**
     * Match gallery/exhibition collections by their exact, case-sensitive
     * legacy slug (`extra.thg_gallery.slug`).
     *
     * @return EloquentCollection<int, Collection>
     */
    public static function bySlug(string $kind, string $slug): EloquentCollection
    {
        // Same case-sensitivity caveat as byEnglishTitle(): the JSON path
        // comparison at the DB level uses the column's collation (case
        // insensitive on MySQL), so filter the candidate set again in PHP.
        return self::baseQuery($kind)
            ->where('extra->thg_gallery->slug', $slug)
            ->get()
            ->filter(fn (Collection $collection): bool => self::slug($collection) === $slug)
            ->values();
    }

    /**
     * Match collections of a kind by an exact, case-sensitive English title
     * (default context).
     *
     * @return EloquentCollection<int, Collection>
     */
    public static function byEnglishTitle(string $kind, string $title): EloquentCollection
    {
        // MySQL's default collation compares case-insensitively, so filter the
        // (small) candidate set again in PHP with a strict `===` to enforce the
        // case-sensitive match the command promises.
        $collectionIds = CollectionTranslation::query()
            ->where('title', $title)
            ->whereHas('language', fn (Builder $q) => $q->where('id', self::ENGLISH_LANGUAGE_ID))
            ->whereHas('context', fn (Builder $q) => $q->where('is_default', true))
            ->get(['collection_id', 'title'])
            ->filter(fn (CollectionTranslation $translation): bool => $translation->title === $title)
            ->pluck('collection_id')
            ->unique();

        if ($collectionIds->isEmpty()) {
            return self::emptyCollection();
        }

        return self::baseQuery($kind)->whereIn('id', $collectionIds)->get();
    }

    /**
     * Extract the legacy selector (numeric id, or project KEY) from a
     * collection's backward_compatibility, using the recognised prefixes for
     * its kind. Returns null when no recognised prefix matches.
     */
    public static function legacySelectorFromBackwardCompatibility(string $kind, ?string $backwardCompatibility): ?string
    {
        if ($backwardCompatibility === null || $backwardCompatibility === '') {
            return null;
        }

        foreach (self::backwardCompatibilityPrefixes($kind) as $prefix) {
            if (str_starts_with($backwardCompatibility, $prefix)) {
                return substr($backwardCompatibility, strlen($prefix));
            }
        }

        return null;
    }

    /**
     * The legacy slug stored on a gallery/exhibition collection
     * (`extra.thg_gallery.slug`), or null when absent (e.g. project
     * collections, or a gallery/exhibition imported without one).
     */
    public static function slug(Collection $collection): ?string
    {
        $extra = $collection->extra;
        $thgGallery = is_object($extra) ? ($extra->thg_gallery ?? null) : null;

        if (! is_object($thgGallery)) {
            return null;
        }

        $slug = $thgGallery->slug ?? null;

        return is_string($slug) && $slug !== '' ? $slug : null;
    }

    /**
     * All translated titles for a collection (default context), keyed by
     * language id.
     *
     * @return array<string, string>
     */
    public static function titles(Collection $collection): array
    {
        /** @var array<string, string> $titles */
        $titles = $collection->translations()
            ->defaultContext()
            ->get(['language_id', 'title'])
            ->mapWithKeys(fn (CollectionTranslation $translation): array => [
                $translation->language_id => (string) $translation->title,
            ])
            ->all();

        return $titles;
    }

    /**
     * Build the presentation payload shared by the table and --json output of
     * `importer:find-collection`.
     *
     * @return array{
     *     id: string,
     *     internal_name: string,
     *     type: string,
     *     parent_id: string|null,
     *     parent_internal_name: string|null,
     *     backward_compatibility: string|null,
     *     titles: array<string, string>,
     * }
     */
    public static function present(Collection $collection): array
    {
        return [
            'id' => $collection->id,
            'internal_name' => $collection->internal_name,
            'type' => $collection->type,
            'parent_id' => $collection->parent_id,
            'parent_internal_name' => $collection->parent?->internal_name,
            'backward_compatibility' => $collection->backward_compatibility,
            'titles' => self::titles($collection),
        ];
    }

    /**
     * @return EloquentCollection<int, Collection>
     */
    private static function emptyCollection(): EloquentCollection
    {
        /** @var EloquentCollection<int, Collection> $empty */
        $empty = new EloquentCollection;

        return $empty;
    }
}
