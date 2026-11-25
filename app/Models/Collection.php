<?php

namespace App\Models;

use App\Enums\CollectionPartnerType;
use App\Enums\CollectionPurpose;
use App\Enums\CollectionType;
use App\Enums\PartnerLevel;
use App\Traits\HasDisplayOrder;
use App\Traits\HasJsonFields;
use App\Traits\HasLinks;
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
 * @property CollectionType $type
 * @property CollectionPurpose|null $purpose
 * @property string|null $parent_id
 * @property string|null $context_id
 * @property string|null $backward_compatibility
 * @property object|null $extra
 * @property string|null $cover_item_id
 * @property int|null $days
 * @property bool $draft
 * @property string|null $display_label
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class Collection extends Model
{
    /** @use HasFactory<CollectionFactory> */
    use HasDisplayOrder, HasFactory, HasJsonFields, HasUuids;

    use HasLinks;

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
        // The picture shown as the collection's cover
        'cover_item_id',
        // A Travels itinerary's number of days
        'days',
        // Not ready for any site (M17, #2741): a draft and its subtree ship nowhere
        'draft',
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
        'days' => 'integer',
        'draft' => 'boolean',
        'type' => CollectionType::class,
        'purpose' => CollectionPurpose::class,
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
     * The other countries the collection covers, besides its main country, in
     * their order.
     *
     * @return BelongsToMany<Country, $this>
     */
    public function countries(): BelongsToMany
    {
        return $this->belongsToMany(Country::class, 'collection_country')
            ->withPivot('display_order')
            ->withTimestamps()
            ->orderByPivot('display_order');
    }

    /**
     * The collections this one links to, by kind (CollectionRelationKind), in
     * their order.
     *
     * @return BelongsToMany<Collection, $this>
     */
    public function relatedCollections(): BelongsToMany
    {
        return $this->belongsToMany(self::class, 'collection_collection', 'collection_id', 'related_collection_id')
            ->withPivot('kind', 'display_order')
            ->withTimestamps()
            ->orderByPivot('kind')
            ->orderByPivot('display_order');
    }

    /**
     * The collections that link to this one.
     *
     * @return BelongsToMany<Collection, $this>
     */
    public function relatingCollections(): BelongsToMany
    {
        return $this->belongsToMany(self::class, 'collection_collection', 'related_collection_id', 'collection_id')
            ->withPivot('kind', 'display_order')
            ->withTimestamps();
    }

    /**
     * The picture shown as the collection's cover.
     *
     * @return BelongsTo<Item, $this>
     */
    public function coverItem(): BelongsTo
    {
        return $this->belongsTo(Item::class, 'cover_item_id');
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
            ->withPivot('id', 'display_order', 'variant_order', 'parent_variant_order', 'picture_item_id', 'curator_selected', 'extra')
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
        return $query->where('type', CollectionType::COLLECTION->value);
    }

    /**
     * Scope to get only exhibition type collections.
     *
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeExhibitions(Builder $query): Builder
    {
        return $query->where('type', CollectionType::EXHIBITION->value);
    }

    /**
     * Scope to get only gallery type collections.
     *
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeGalleries(Builder $query): Builder
    {
        return $query->where('type', CollectionType::GALLERY->value);
    }

    /**
     * Scope to get only theme type collections.
     *
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeThemes(Builder $query): Builder
    {
        return $query->where('type', CollectionType::THEME->value);
    }

    /**
     * Scope to get only exhibition trail type collections.
     *
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeExhibitionTrails(Builder $query): Builder
    {
        return $query->where('type', CollectionType::EXHIBITION_TRAIL->value);
    }

    /**
     * Scope to get only itinerary type collections.
     *
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeItineraries(Builder $query): Builder
    {
        return $query->where('type', CollectionType::ITINERARY->value);
    }

    /**
     * Scope to get only location type collections.
     *
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeLocations(Builder $query): Builder
    {
        return $query->where('type', CollectionType::LOCATION->value);
    }

    /**
     * Scope to get only subtheme type collections.
     *
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeSubthemes(Builder $query): Builder
    {
        return $query->where('type', CollectionType::SUBTHEME->value);
    }

    /**
     * Scope to get only region type collections.
     *
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeRegions(Builder $query): Builder
    {
        return $query->where('type', CollectionType::REGION->value);
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
            ->wherePivot('collection_type', '=', CollectionPartnerType::COLLECTION->value)
            ->withPivot(['collection_type', 'level', 'visible', 'parent_partner_id'])
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

    /**
     * The publications that accompany this collection.
     *
     * @return BelongsToMany<Publication, $this, PublicationCollection>
     */
    public function publications(): BelongsToMany
    {
        return $this->belongsToMany(Publication::class, 'publication_collection')
            ->using(PublicationCollection::class)
            ->withPivot('display_order', 'extra')
            ->withTimestamps();
    }

    /**
     * Its visit information, per language and context (M16 D1, #2645).
     *
     * @return HasMany<VisitInformation, $this>
     */
    public function visitInformation(): HasMany
    {
        return $this->hasMany(VisitInformation::class);
    }
}
