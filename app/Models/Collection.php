<?php

namespace App\Models;

use App\Enums\PartnerLevel;
use App\Traits\HasDisplayOrder;
use App\Traits\HasJsonFields;
use Database\Factories\CollectionFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Collection Model
 *
 * Represents a collection of museum items with translation and partner support.
 * Collections organize items and provide context for display purposes.
 *
 * @property string $id
 * @property string $internal_name
 * @property string $type
 * @property string|null $purpose
 * @property string|null $parent_id
 * @property string|null $context_id
 * @property string|null $backward_compatibility
 * @property object|null $extra
 * @property string|null $display_label
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class Collection extends Model
{
    /** @use HasFactory<CollectionFactory> */
    use HasDisplayOrder, HasFactory, HasJsonFields, HasUuids;

    // Type constants
    public const TYPE_COLLECTION = 'collection';

    public const TYPE_EXHIBITION = 'exhibition';

    public const TYPE_GALLERY = 'gallery';

    public const TYPE_THEME = 'theme';

    public const TYPE_EXHIBITION_TRAIL = 'exhibition trail';

    public const TYPE_ITINERARY = 'itinerary';

    public const TYPE_LOCATION = 'location';

    public const TYPE_SUBTHEME = 'subtheme';

    public const TYPE_REGION = 'region';

    /**
     * All valid collection types.
     *
     * @var list<string>
     */
    public const TYPES = [
        self::TYPE_COLLECTION,
        self::TYPE_EXHIBITION,
        self::TYPE_GALLERY,
        self::TYPE_THEME,
        self::TYPE_EXHIBITION_TRAIL,
        self::TYPE_ITINERARY,
        self::TYPE_LOCATION,
        self::TYPE_SUBTHEME,
        self::TYPE_REGION,
    ];

    // Purpose constants: machine-readable functional role of a collection within
    // its context (section anchors, editorial overlays). Orthogonal to `type`,
    // which describes the presentation shape. Null for ordinary collections.
    public const PURPOSE_EXHIBITIONS_ROOT = 'exhibitions-root';

    public const PURPOSE_ARTISTIC_INTRODUCTION_ROOT = 'artistic-introduction-root';

    public const PURPOSE_HISTORICAL_PROFILES_ROOT = 'historical-profiles-root';

    public const PURPOSE_HISTORICAL_BACKGROUND_ROOT = 'historical-background-root';

    public const PURPOSE_TOPICS_ROOT = 'topics-root';

    public const PURPOSE_GALLERIES_ROOT = 'galleries-root';

    public const PURPOSE_TRAVELS_ROOT = 'travels-root';

    public const PURPOSE_EXPLORE_THEMES_ROOT = 'explore-themes-root';

    public const PURPOSE_EXPLORE_COUNTRIES_ROOT = 'explore-countries-root';

    public const PURPOSE_EXPLORE_ITINERARIES_ROOT = 'explore-itineraries-root';

    public const PURPOSE_NATIONAL_CONTEXT = 'national-context';

    /**
     * Controlled vocabulary for the `purpose` column.
     * `*-root` values are unique per context (one section anchor per context);
     * `national-context` may occur many times per context.
     *
     * @var list<string>
     */
    public const PURPOSES = [
        self::PURPOSE_EXHIBITIONS_ROOT,
        self::PURPOSE_ARTISTIC_INTRODUCTION_ROOT,
        self::PURPOSE_HISTORICAL_PROFILES_ROOT,
        self::PURPOSE_HISTORICAL_BACKGROUND_ROOT,
        self::PURPOSE_TOPICS_ROOT,
        self::PURPOSE_GALLERIES_ROOT,
        self::PURPOSE_TRAVELS_ROOT,
        self::PURPOSE_EXPLORE_THEMES_ROOT,
        self::PURPOSE_EXPLORE_COUNTRIES_ROOT,
        self::PURPOSE_EXPLORE_ITINERARIES_ROOT,
        self::PURPOSE_NATIONAL_CONTEXT,
    ];

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'internal_name',
        'type',
        'purpose',
        'language_id',
        'context_id',
        'parent_id',
        'display_order',
        'backward_compatibility',
        // Collection-level structured attributes (not per-language)
        'extra',
        // GPS Location
        'latitude',
        'longitude',
        'map_zoom',
        // Country reference
        'country_id',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'display_order' => 'integer',
        'extra' => 'object',
        'latitude' => 'decimal:8',
        'longitude' => 'decimal:8',
        'map_zoom' => 'integer',
    ];

    /**
     * Get the columns that should automatically receive a unique identifier.
     *
     * @return array<int, string>
     */
    public function uniqueIds(): array
    {
        return ['id'];
    }

    /**
     * Get the extra field decoded as an associative array.
     *
     * @return Attribute<mixed, never>
     */
    protected function extraDecoded(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->normalizedJson('extra')
        );
    }

    /**
     * Get a query builder scoped to this collection's siblings (same parent_id).
     *
     * @return Builder<static>
     */
    protected function getSiblingsQuery(): Builder
    {
        /** @var Builder<static> $query */
        $query = $this->parent_id
            ? static::where('parent_id', $this->parent_id)
            : static::whereNull('parent_id');

        return $query;
    }

    /**
     * Get all translations for this collection.
     *
     * @return HasMany<CollectionTranslation, $this>
     */
    public function translations(): HasMany
    {
        return $this->hasMany(CollectionTranslation::class);
    }

    /**
     * Get the default language for this collection.
     *
     * @return BelongsTo<Language, $this>
     */
    public function language(): BelongsTo
    {
        return $this->belongsTo(Language::class);
    }

    /**
     * Get the default context for this collection.
     *
     * @return BelongsTo<Context, $this>
     */
    public function context(): BelongsTo
    {
        return $this->belongsTo(Context::class);
    }

    /**
     * Get the country associated with this collection.
     *
     * @return BelongsTo<Country, $this>
     */
    public function country(): BelongsTo
    {
        return $this->belongsTo(Country::class);
    }

    /**
     * Get the parent collection (for hierarchical organization).
     *
     * @return BelongsTo<Collection, $this>
     */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(Collection::class, 'parent_id');
    }

    /**
     * Get all child collections.
     *
     * @return HasMany<Collection, $this>
     */
    public function children(): HasMany
    {
        return $this->hasMany(Collection::class, 'parent_id');
    }

    /**
     * Get all items belonging to this collection (primary relationship).
     *
     * @return HasMany<Item, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(Item::class);
    }

    /**
     * Get all items attached to this collection via many-to-many relationship.
     *
     * @return BelongsToMany<Item, $this, CollectionItem>
     */
    public function attachedItems(): BelongsToMany
    {
        return $this->belongsToMany(Item::class, 'collection_item')
            ->using(CollectionItem::class)
            ->withPivot('display_order', 'extra')
            ->withTimestamps();
    }

    /**
     * Get all images belonging to this collection.
     *
     * @return HasMany<CollectionImage, $this>
     */
    public function collectionImages(): HasMany
    {
        return $this->hasMany(CollectionImage::class);
    }

    /**
     * Get all media (audio/video URLs) belonging to this collection.
     *
     * @return HasMany<CollectionMedia, $this>
     */
    public function collectionMedia(): HasMany
    {
        return $this->hasMany(CollectionMedia::class)->orderBy('type')->orderBy('display_order');
    }

    /**
     * Get all contributors belonging to this collection.
     *
     * @return HasMany<Contributor, $this>
     */
    public function contributors(): HasMany
    {
        return $this->hasMany(Contributor::class)->orderBy('display_order');
    }

    /**
     * Scope to get only collection type collections.
     *
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeCollections(Builder $query): Builder
    {
        return $query->where('type', self::TYPE_COLLECTION);
    }

    /**
     * Scope to get only exhibition type collections.
     *
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeExhibitions(Builder $query): Builder
    {
        return $query->where('type', self::TYPE_EXHIBITION);
    }

    /**
     * Scope to get only gallery type collections.
     *
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeGalleries(Builder $query): Builder
    {
        return $query->where('type', self::TYPE_GALLERY);
    }

    /**
     * Scope to get only theme type collections.
     *
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeThemes(Builder $query): Builder
    {
        return $query->where('type', self::TYPE_THEME);
    }

    /**
     * Scope to get only exhibition trail type collections.
     *
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeExhibitionTrails(Builder $query): Builder
    {
        return $query->where('type', self::TYPE_EXHIBITION_TRAIL);
    }

    /**
     * Scope to get only itinerary type collections.
     *
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeItineraries(Builder $query): Builder
    {
        return $query->where('type', self::TYPE_ITINERARY);
    }

    /**
     * Scope to get only location type collections.
     *
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeLocations(Builder $query): Builder
    {
        return $query->where('type', self::TYPE_LOCATION);
    }

    /**
     * Scope to get only subtheme type collections.
     *
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeSubthemes(Builder $query): Builder
    {
        return $query->where('type', self::TYPE_SUBTHEME);
    }

    /**
     * Scope to get only region type collections.
     *
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeRegions(Builder $query): Builder
    {
        return $query->where('type', self::TYPE_REGION);
    }

    /**
     * Scope to get only root collections (no parent).
     *
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeRoots(Builder $query): Builder
    {
        return $query->whereNull('parent_id');
    }

    /**
     * Scope to get child collections of a specific parent.
     *
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeChildrenOf(Builder $query, string $parentId): Builder
    {
        return $query->where('parent_id', $parentId);
    }

    /**
     * Get all partners associated with this collection.
     *
     * @return BelongsToMany<Partner, $this, CollectionPartner>
     */
    public function partners(): BelongsToMany
    {
        return $this->belongsToMany(Partner::class, 'collection_partner', 'collection_id', 'partner_id')
            ->wherePivot('collection_type', '=', 'collection')
            ->withPivot(['collection_type', 'level', 'visible'])
            ->withTimestamps()
            ->using(CollectionPartner::class);
    }

    /**
     * Get the default context translation for this collection in a specific language.
     */
    public function getDefaultTranslation(string $languageId): ?CollectionTranslation
    {
        return $this->translations()->defaultContext()->forLanguage($languageId)->first();
    }

    /**
     * Get a contextualized translation for this collection.
     */
    public function getContextualizedTranslation(string $languageId, string $contextId): ?CollectionTranslation
    {
        return $this->translations()->forLanguage($languageId)->forContext($contextId)->first();
    }

    /**
     * Get translation with fallback logic: try specific context, then default context.
     */
    public function getTranslationWithFallback(string $languageId, ?string $contextId = null): ?CollectionTranslation
    {
        if ($contextId) {
            $translation = $this->getContextualizedTranslation($languageId, $contextId);
            if ($translation) {
                return $translation;
            }
        }

        return $this->getDefaultTranslation($languageId);
    }

    /**
     * Get partners by level.
     *
     * @return BelongsToMany<Partner, $this, CollectionPartner>
     */
    public function partnersByLevel(PartnerLevel $level): BelongsToMany
    {
        return $this->partners()->wherePivot('level', $level->value);
    }

    /**
     * Get direct partners (level: partner).
     *
     * @return BelongsToMany<Partner, $this, CollectionPartner>
     */
    public function directPartners(): BelongsToMany
    {
        return $this->partnersByLevel(PartnerLevel::PARTNER);
    }

    /**
     * Get associated partners (level: associated_partner).
     *
     * @return BelongsToMany<Partner, $this, CollectionPartner>
     */
    public function associatedPartners(): BelongsToMany
    {
        return $this->partnersByLevel(PartnerLevel::ASSOCIATED_PARTNER);
    }

    /**
     * Get minor contributors (level: minor_contributor).
     *
     * @return BelongsToMany<Partner, $this, CollectionPartner>
     */
    public function minorContributors(): BelongsToMany
    {
        return $this->partnersByLevel(PartnerLevel::MINOR_CONTRIBUTOR);
    }

    /**
     * Attach an item to this collection via many-to-many relationship.
     */
    public function attachItem(Item $item): void
    {
        $this->attachedItems()->syncWithoutDetaching([$item->id]);
    }

    /**
     * Detach an item from this collection.
     */
    public function detachItem(Item $item): void
    {
        $this->attachedItems()->detach($item->id);
    }

    /**
     * Attach multiple items to this collection.
     *
     * @param  array<int, string>  $itemIds
     */
    public function attachItems(array $itemIds): void
    {
        $this->attachedItems()->syncWithoutDetaching($itemIds);
    }

    /**
     * Detach multiple items from this collection.
     *
     * @param  array<int, string>  $itemIds
     */
    public function detachItems(array $itemIds): void
    {
        $this->attachedItems()->detach($itemIds);
    }

    /**
     * Scope to exclude collections with the given IDs.
     *
     * @param  Builder<static>  $query
     * @param  array<int, string>  $ids
     * @return Builder<static>
     */
    public function scopeExcludingIds(Builder $query, array $ids): Builder
    {
        return empty($ids) ? $query : $query->whereNotIn('id', $ids);
    }

    /**
     * Scope to exclude the given collection and all its transitive descendants.
     * Prevents circular hierarchies when selecting a parent collection.
     * Hard-caps traversal at 10 levels.
     *
     * @param  Builder<static>  $query
     * @param  string  $collectionId  UUID of the collection whose descendants to exclude
     * @return Builder<static>
     */
    public function scopeExcludingDescendantsOf(Builder $query, string $collectionId): Builder
    {
        $maxDepth = 10;
        $excludeIds = [$collectionId];
        $currentLevel = [$collectionId];

        for ($depth = 0; $depth < $maxDepth; $depth++) {
            $nextLevel = static::whereIn('parent_id', $currentLevel)->pluck('id')->all();
            if (empty($nextLevel)) {
                break;
            }
            $excludeIds = array_merge($excludeIds, $nextLevel);
            $currentLevel = $nextLevel;

            if ($depth + 1 >= $maxDepth) {
                $hasMore = static::whereIn('parent_id', $currentLevel)->exists();
                if ($hasMore) {
                    throw new \RuntimeException('Collection hierarchy depth exceeds maximum of '.$maxDepth.' levels.');
                }
            }
        }

        return $query->whereNotIn('id', $excludeIds);
    }

    /**
     * Scope to exclude the given collection and all its transitive ancestors.
     * Prevents an ancestor from being set as a child of the collection.
     * Hard-caps traversal at 10 levels.
     *
     * @param  Builder<static>  $query
     * @param  string  $collectionId  UUID of the collection whose ancestors to exclude
     * @return Builder<static>
     */
    public function scopeExcludingAncestorsOf(Builder $query, string $collectionId): Builder
    {
        $maxDepth = 10;
        $excludeIds = [$collectionId];
        $currentId = $collectionId;

        for ($depth = 0; $depth < $maxDepth; $depth++) {
            $parentId = static::where('id', $currentId)->value('parent_id');
            if ($parentId === null) {
                break;
            }
            $excludeIds[] = $parentId;
            $currentId = $parentId;

            if ($depth + 1 >= $maxDepth) {
                $hasMore = static::where('id', $currentId)->whereNotNull('parent_id')->exists();
                if ($hasMore) {
                    throw new \RuntimeException('Collection hierarchy depth exceeds maximum of '.$maxDepth.' levels.');
                }
            }
        }

        return $query->whereNotIn('id', $excludeIds);
    }
}
