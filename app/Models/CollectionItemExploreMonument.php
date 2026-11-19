<?php

namespace App\Models;

use Database\Factories\CollectionItemExploreMonumentFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Carbon;

/**
 * An Explore monument a placement stands for (M16 C4, #2644). Explore lists
 * its monuments by its own ids, which the model doesn't hold; one placed item
 * can stand for several. Everything is kept as legacy wrote it.
 *
 * @property string $id
 * @property string $collection_item_id
 * @property int $position
 * @property string $backward_compatibility
 * @property float|null $latitude
 * @property float|null $longitude
 * @property int|null $map_zoom
 * @property string|null $location_collection_id
 * @property string|null $description_types
 * @property string|null $travels_description_ref
 * @property string|null $explore_description_ref
 * @property string|null $virtual_museum_description_ref
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class CollectionItemExploreMonument extends Model
{
    /** @use HasFactory<CollectionItemExploreMonumentFactory> */
    use HasFactory, HasUuids;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'collection_item_id',
        'position',
        'backward_compatibility',
        'latitude',
        'longitude',
        'map_zoom',
        'location_collection_id',
        'description_types',
        'travels_description_ref',
        'explore_description_ref',
        'virtual_museum_description_ref',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'position' => 'integer',
        'latitude' => 'float',
        'longitude' => 'float',
        'map_zoom' => 'integer',
    ];

    /**
     * @return array<int, string>
     */
    public function uniqueIds(): array
    {
        return ['id'];
    }

    /**
     * The placement that stands for this Explore monument.
     *
     * @return BelongsTo<CollectionItem, $this>
     */
    public function collectionItem(): BelongsTo
    {
        return $this->belongsTo(CollectionItem::class);
    }

    /**
     * On an itinerary: the Explore location the monument is visited in.
     *
     * @return BelongsTo<Collection, $this>
     */
    public function locationCollection(): BelongsTo
    {
        return $this->belongsTo(Collection::class, 'location_collection_id');
    }

    /**
     * The museums Explore shows the monument as, in order.
     *
     * @return BelongsToMany<Partner, $this>
     */
    public function partners(): BelongsToMany
    {
        return $this->belongsToMany(Partner::class, 'collection_item_explore_monument_partner')
            ->withPivot('display_order')
            ->withTimestamps()
            ->orderByPivot('display_order');
    }
}
