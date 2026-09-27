<?php

namespace App\Models;

use App\Enums\ItemType;
use App\Traits\HasDisplayOrder;
use Database\Factories\ItemFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * @property string $id
 * @property string $internal_name
 * @property string|null $backward_compatibility
 * @property ItemType $type
 * @property string|null $parent_id
 * @property string $collection_id
 * @property string|null $project_id
 * @property int|null $display_order
 * @property int|null $start_date
 * @property int|null $end_date
 * @property string|null $display_label
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class Item extends Model
{
    use HasDisplayOrder;

    /** @use HasFactory<ItemFactory> */
    use HasFactory;

    use HasUuids;

    // No model-level eager loads. Use request-scoped includes in controllers.

    /**
     * Delete the model from the database.
     * Ensures atomic deletion of the Item, its translations,
     * and all spelling links from those translations.
     *
     * @return bool|null
     *
     * @throws \LogicException
     */
    public function delete()
    {
        // If the model doesn't exist, nothing to delete
        if (! $this->exists) {
            return false;
        }

        // Fire the deleting event
        if ($this->fireModelEvent('deleting') === false) {
            return false;
        }

        // Perform atomic deletion in a transaction
        return DB::transaction(function () {
            // 1. For each translation, detach all spelling links
            foreach ($this->translations as $translation) {
                $translation->spellings()->detach();
            }

            // 2. Delete all translations
            $this->translations()->delete();

            // 3. Delete all item images
            $this->itemImages()->delete();

            // 4. Detach all many-to-many relationships
            $this->tags()->detach();
            $this->workshops()->detach();
            $this->attachedToCollections()->detach();

            // 6. Finally, delete the item itself
            $this->performDeleteOnModel();

            // Mark the model as non-existing
            $this->exists = false;

            // Fire the deleted event
            $this->fireModelEvent('deleted', false);

            return true;
        });
    }

    protected $fillable = [
        // 'id',
        'partner_id',
        'parent_id',
        'internal_name',
        'type',
        'backward_compatibility',
        'country_id',
        'project_id',
        'collection_id',
        'owner_reference',
        'mwnf_reference',
        'display_order',
        // Datation
        'start_date',
        'end_date',
        // GPS Location
        'latitude',
        'longitude',
        'map_zoom',
    ];

    protected $casts = [
        'type' => ItemType::class,
        'display_order' => 'integer',
        'start_date' => 'integer',
        'end_date' => 'integer',
        'latitude' => 'decimal:8',
        'longitude' => 'decimal:8',
        'map_zoom' => 'integer',
    ];

    /**
     * The partner owning or responsible for the Item.
     *
     * @return BelongsTo<Partner, $this>
     */
    public function partner(): BelongsTo
    {
        return $this->belongsTo(Partner::class);
    }

    /**
     * The country of the Item.
     *
     * @return BelongsTo<Country, $this>
     */
    public function country(): BelongsTo
    {
        return $this->belongsTo(Country::class);
    }

    /**
     * The project associated with the Item.
     *
     * @return BelongsTo<Project, $this>
     */
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    /**
     * The collection that contains this item.
     *
     * @return BelongsTo<Collection, $this>
     */
    public function collection(): BelongsTo
    {
        return $this->belongsTo(Collection::class);
    }

    /**
     * The parent item (for hierarchical relationships).
     *
     * @return BelongsTo<Item, $this>
     */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(Item::class, 'parent_id');
    }

    /**
     * The child items (for hierarchical relationships).
     *
     * @return HasMany<Item, $this>
     */
    public function children(): HasMany
    {
        return $this->hasMany(Item::class, 'parent_id')->orderBy('display_order');
    }

    /**
     * Get a query builder scoped to this item's siblings (same parent_id).
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
     * The item images attached to this item.
     *
     * @return HasMany<ItemImage, $this>
     */
    public function itemImages(): HasMany
    {
        return $this->hasMany(ItemImage::class)->orderBy('display_order');
    }

    /**
     * The media (audio/video URLs) attached to this item.
     *
     * @return HasMany<ItemMedia, $this>
     */
    public function itemMedia(): HasMany
    {
        return $this->hasMany(ItemMedia::class)->orderBy('type')->orderBy('display_order');
    }

    /**
     * The documents attached to this item.
     *
     * @return HasMany<ItemDocument, $this>
     */
    public function itemDocuments(): HasMany
    {
        return $this->hasMany(ItemDocument::class)->orderBy('display_order');
    }

    /**
     * The tags that belong to this item.
     *
     * @return BelongsToMany<Tag, $this>
     */
    public function tags(): BelongsToMany
    {
        return $this->belongsToMany(Tag::class)->withTimestamps();
    }

    /**
     * Artists associated with this item
     *
     * @return BelongsToMany<Artist, $this>
     */
    public function artists(): BelongsToMany
    {
        return $this->belongsToMany(Artist::class, 'artist_item');
    }

    /**
     * Workshops associated with this item
     *
     * @return BelongsToMany<Workshop, $this>
     */
    public function workshops(): BelongsToMany
    {
        return $this->belongsToMany(Workshop::class, 'item_workshop');
    }

    /**
     * Dynasties associated with this item
     *
     * @return BelongsToMany<Dynasty, $this>
     */
    public function dynasties(): BelongsToMany
    {
        return $this->belongsToMany(Dynasty::class, 'item_dynasty')->withTimestamps();
    }

    /**
     * Get all translations for this item.
     *
     * @return HasMany<ItemTranslation, $this>
     */
    public function translations(): HasMany
    {
        return $this->hasMany(ItemTranslation::class)->chaperone('item');
    }

    /**
     * Get all outgoing links (where this item is the source).
     *
     * @return HasMany<ItemItemLink, $this>
     */
    public function outgoingLinks(): HasMany
    {
        return $this->hasMany(ItemItemLink::class, 'source_id');
    }

    /**
     * Get all incoming links (where this item is the target).
     *
     * @return HasMany<ItemItemLink, $this>
     */
    public function incomingLinks(): HasMany
    {
        return $this->hasMany(ItemItemLink::class, 'target_id');
    }

    /**
     * Get all timeline events this item is associated with.
     *
     * @return BelongsToMany<TimelineEvent, $this, TimelineEventItem>
     */
    public function timelineEvents(): BelongsToMany
    {
        return $this->belongsToMany(TimelineEvent::class, 'timeline_event_item')
            ->using(TimelineEventItem::class)
            ->withPivot('display_order', 'backward_compatibility', 'extra')
            ->withTimestamps();
    }

    /**
     * Get all collections this item is attached to via many-to-many relationship.
     *
     * @return BelongsToMany<Collection, $this, CollectionItem>
     */
    public function attachedToCollections(): BelongsToMany
    {
        return $this->belongsToMany(Collection::class, 'collection_item')
            ->using(CollectionItem::class)
            ->withPivot('display_order', 'extra')
            ->withTimestamps();
    }

    /**
     * Get the default context translation for this item in a specific language.
     */
    public function getDefaultTranslation(string $languageId): ?ItemTranslation
    {
        return $this->translations()->defaultContext()->forLanguage($languageId)->first();
    }

    /**
     * Get a contextualized translation for this item.
     */
    public function getContextualizedTranslation(string $languageId, string $contextId): ?ItemTranslation
    {
        return $this->translations()->forLanguage($languageId)->forContext($contextId)->first();
    }

    /**
     * Get translation with fallback logic: try specific context, then default context.
     */
    public function getTranslationWithFallback(string $languageId, ?string $contextId = null): ?ItemTranslation
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
     * Scope to get only object items.
     *
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeObjects(Builder $query): Builder
    {
        return $query->where('type', ItemType::OBJECT);
    }

    /**
     * Scope to get only monument items.
     *
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeMonuments(Builder $query): Builder
    {
        return $query->where('type', ItemType::MONUMENT);
    }

    /**
     * Scope to get only detail items.
     *
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeDetails(Builder $query): Builder
    {
        return $query->where('type', ItemType::DETAIL);
    }

    /**
     * Scope to get only picture items.
     *
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopePictures(Builder $query): Builder
    {
        return $query->where('type', ItemType::PICTURE);
    }

    /**
     * Scope to get parent items (items with no parent).
     *
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeParents(Builder $query): Builder
    {
        return $query->whereNull('parent_id');
    }

    /**
     * Scope to get child items (items with a parent).
     *
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeChildren(Builder $query): Builder
    {
        return $query->whereNotNull('parent_id');
    }

    /**
     * Scope to get items for a specific tag.
     *
     * @param  Builder<static>  $query
     * @param  string|Tag  $tag  The tag ID or Tag model instance
     * @return Builder<static>
     */
    public function scopeForTag(Builder $query, $tag): Builder
    {
        $tagId = $tag instanceof Tag ? $tag->id : $tag;

        return $query->whereHas('tags', function (Builder $query) use ($tagId) {
            $query->where('tags.id', $tagId);
        });
    }

    /**
     * Scope to get items that have ALL of the specified tags (AND condition).
     *
     * @param  Builder<static>  $query
     * @param  array<int, mixed>  $tags  Array of tag IDs or Tag model instances
     * @return Builder<static>
     */
    public function scopeWithAllTags(Builder $query, array $tags): Builder
    {
        $tagIds = collect($tags)->map(function ($tag) {
            return $tag instanceof Tag ? $tag->id : $tag;
        })->toArray();

        foreach ($tagIds as $tagId) {
            $query->whereHas('tags', function (Builder $query) use ($tagId) {
                $query->where('tags.id', $tagId);
            });
        }

        return $query;
    }

    /**
     * Scope to get items that have ANY of the specified tags (OR condition).
     *
     * @param  Builder<static>  $query
     * @param  array<int, mixed>  $tags  Array of tag IDs or Tag model instances
     * @return Builder<static>
     */
    public function scopeWithAnyTags(Builder $query, array $tags): Builder
    {
        $tagIds = collect($tags)->map(function ($tag) {
            return $tag instanceof Tag ? $tag->id : $tag;
        })->toArray();

        return $query->whereHas('tags', function (Builder $query) use ($tagIds) {
            $query->whereIn('tags.id', $tagIds);
        });
    }

    /**
     * Reorder all item images to eliminate gaps in display order.
     * This is a convenience method to tighten image ordering.
     */
    public function reorderItemImages(): void
    {
        $this->getConnection()->transaction(function () {
            $images = $this->itemImages()
                ->orderBy('display_order')
                ->lockForUpdate()
                ->get();

            foreach ($images as $index => $image) {
                $image->update(['display_order' => $index + 1]);
            }
        });
    }

    /**
     * Get the columns that should automatically receive a unique identifier.
     *
     * @return array<int, string>
     */
    public function uniqueIds(): array
    {
        return ['id'];
    }

    // Accessors and Mutators to ensure null values instead of empty strings
    public function getOwnerReferenceAttribute(?string $value): ?string
    {
        return $value === '' ? null : $value;
    }

    public function setOwnerReferenceAttribute(mixed $value): void
    {
        $this->attributes['owner_reference'] = $value === '' ? null : $value;
    }

    public function getMwnfReferenceAttribute(?string $value): ?string
    {
        return $value === '' ? null : $value;
    }

    public function setMwnfReferenceAttribute(mixed $value): void
    {
        $this->attributes['mwnf_reference'] = $value === '' ? null : $value;
    }

    /**
     * Scope to exclude items with the given IDs.
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
     * Scope to exclude the given item and all its transitive descendants.
     * Prevents a descendant from being set as the item's own parent.
     * Hard-caps traversal at 10 levels.
     *
     * @param  Builder<static>  $query
     * @param  string  $itemId  UUID of the item whose descendants to exclude
     * @return Builder<static>
     */
    public function scopeExcludingDescendantsOf(Builder $query, string $itemId): Builder
    {
        $maxDepth = 10;
        $excludeIds = [$itemId];
        $currentLevel = [$itemId];

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
                    throw new \RuntimeException('Item hierarchy depth exceeds maximum of '.$maxDepth.' levels.');
                }
            }
        }

        return $query->whereNotIn('id', $excludeIds);
    }

    /**
     * Scope to exclude the given item and all its transitive ancestors.
     * Prevents an ancestor from being set as a child of the item.
     * Hard-caps traversal at 10 levels.
     *
     * @param  Builder<static>  $query
     * @param  string  $itemId  UUID of the item whose ancestors to exclude
     * @return Builder<static>
     */
    public function scopeExcludingAncestorsOf(Builder $query, string $itemId): Builder
    {
        $maxDepth = 10;
        $excludeIds = [$itemId];
        $currentId = $itemId;

        for ($depth = 0; $depth < $maxDepth; $depth++) {
            $parentId = static::where('id', $currentId)->value('parent_id');
            if (! is_string($parentId)) {
                break;
            }
            $excludeIds[] = $parentId;
            $currentId = $parentId;

            if ($depth + 1 >= $maxDepth) {
                $hasMore = static::where('id', $currentId)->whereNotNull('parent_id')->exists();
                if ($hasMore) {
                    throw new \RuntimeException('Item hierarchy depth exceeds maximum of '.$maxDepth.' levels.');
                }
            }
        }

        return $query->whereNotIn('id', $excludeIds);
    }
}
