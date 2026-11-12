<?php

namespace App\Models;

use Database\Factories\TagFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Tag extends Model
{
    /** @use HasFactory<TagFactory> */
    use HasFactory;

    use HasUuids;

    protected $fillable = [
        'internal_name',
        'category',
        'language_id',
        'backward_compatibility',
        'description',
    ];

    /**
     * The items that belong to this tag.
     *
     * @return BelongsToMany<Item, $this>
     */
    public function items(): BelongsToMany
    {
        return $this->belongsToMany(Item::class)->withTimestamps();
    }

    /**
     * The collection images that belong to this tag.
     *
     * @return BelongsToMany<CollectionImage, $this>
     */
    public function collectionImages(): BelongsToMany
    {
        return $this->belongsToMany(CollectionImage::class, 'collection_image_tag')->withTimestamps();
    }

    /**
     * The item images that belong to this tag.
     *
     * @return BelongsToMany<ItemImage, $this>
     */
    public function itemImages(): BelongsToMany
    {
        return $this->belongsToMany(ItemImage::class, 'item_image_tag')->withTimestamps();
    }

    /**
     * Get the language this tag belongs to (optional).
     *
     * @return BelongsTo<Language, $this>
     */
    public function language(): BelongsTo
    {
        return $this->belongsTo(Language::class);
    }

    /**
     * Scope to get tags for a specific item.
     *
     * @param  Builder<static>  $query
     * @param  string|Item  $item  The item ID or Item model instance
     * @return Builder<static>
     */
    public function scopeForItem(Builder $query, $item): Builder
    {
        $itemId = $item instanceof Item ? $item->id : $item;

        return $query->whereHas('items', function (Builder $query) use ($itemId) {
            $query->where('items.id', $itemId);
        });
    }

    /**
     * Scope to get tags by category.
     *
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeByCategory(Builder $query, string $category): Builder
    {
        return $query->where('category', $category);
    }

    /**
     * Scope to get tags by language.
     *
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeByLanguage(Builder $query, string $languageId): Builder
    {
        return $query->where('language_id', $languageId);
    }

    /**
     * Scope to exclude tags already attached to the given item.
     *
     * @param  Builder<static>  $query
     * @param  string  $itemId  UUID of the item to check attachment against
     * @return Builder<static>
     */
    public function scopeNotAttachedTo(Builder $query, string $itemId): Builder
    {
        return $query->whereDoesntHave('items', fn (Builder $q) => $q->whereKey($itemId));
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

    /**
     * The publications that carry this tag.
     *
     * @return BelongsToMany<Publication, $this>
     */
    public function publications(): BelongsToMany
    {
        return $this->belongsToMany(Publication::class, 'publication_tag')
            ->withTimestamps();
    }
}
