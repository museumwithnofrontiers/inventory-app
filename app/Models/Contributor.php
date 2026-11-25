<?php

namespace App\Models;

use App\Enums\ContributorCategory;
use App\Traits\HasDisplayOrder;
use Database\Factories\ContributorFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property ContributorCategory $category
 */
class Contributor extends Model
{
    /** @use HasFactory<ContributorFactory> */
    use HasDisplayOrder, HasFactory, HasUuids;

    protected $fillable = [
        'collection_id',
        'category',
        'display_order',
        'visible',
        'backward_compatibility',
        'internal_name',
    ];

    protected $casts = [
        'display_order' => 'integer',
        'visible' => 'boolean',
        'category' => ContributorCategory::class,
    ];

    /**
     * @return array<int, string>
     */
    public function uniqueIds(): array
    {
        return ['id'];
    }

    /**
     * Get a query builder scoped to this contributor's siblings (same collection_id).
     *
     * @return Builder<static>
     */
    protected function getSiblingsQuery(): Builder
    {
        /** @var Builder<static> $query */
        $query = static::where('collection_id', $this->collection_id);

        return $query;
    }

    /**
     * Get the collection this contributor belongs to.
     *
     * @return BelongsTo<Collection, $this>
     */
    public function collection(): BelongsTo
    {
        return $this->belongsTo(Collection::class);
    }

    /**
     * Get the translations for this contributor.
     *
     * @return HasMany<ContributorTranslation, $this>
     */
    public function translations(): HasMany
    {
        return $this->hasMany(ContributorTranslation::class);
    }

    /**
     * Get the images for this contributor.
     *
     * @return HasMany<ContributorImage, $this>
     */
    public function contributorImages(): HasMany
    {
        return $this->hasMany(ContributorImage::class)->orderBy('display_order');
    }
}
