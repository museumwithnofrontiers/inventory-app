<?php

namespace App\Models;

use App\Traits\HasDisplayOrder;
use Database\Factories\TimelineEventFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property string $id
 * @property string|null $display_label
 */
class TimelineEvent extends Model
{
    use HasDisplayOrder;

    /** @use HasFactory<TimelineEventFactory> */
    use HasFactory;

    use HasUuids;

    protected $fillable = [
        'timeline_id',
        'internal_name',
        'year_from',
        'year_to',
        'year_from_ah',
        'year_to_ah',
        'date_from',
        'date_to',
        'display_order',
        'backward_compatibility',
        'extra',
    ];

    protected $casts = [
        'year_from' => 'integer',
        'year_to' => 'integer',
        'year_from_ah' => 'integer',
        'year_to_ah' => 'integer',
        'date_from' => 'date',
        'date_to' => 'date',
        'display_order' => 'integer',
        'extra' => 'object',
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
     * Get a query builder scoped to this event's siblings (same timeline_id).
     *
     * @return Builder<static>
     */
    protected function getSiblingsQuery(): Builder
    {
        /** @var Builder<static> $query */
        $query = static::where('timeline_id', $this->timeline_id);

        return $query;
    }

    /**
     * Get the timeline that owns this event.
     *
     * @return BelongsTo<Timeline, $this>
     */
    public function timeline(): BelongsTo
    {
        return $this->belongsTo(Timeline::class);
    }

    /**
     * @return HasMany<TimelineEventTranslation, $this>
     */
    public function translations(): HasMany
    {
        return $this->hasMany(TimelineEventTranslation::class);
    }

    /**
     * Get the images for this event.
     *
     * @return HasMany<TimelineEventImage, $this>
     */
    public function images(): HasMany
    {
        return $this->hasMany(TimelineEventImage::class)->orderBy('display_order');
    }

    /**
     * Get the items associated with this event.
     *
     * @return BelongsToMany<Item, $this>
     */
    public function items(): BelongsToMany
    {
        return $this->belongsToMany(Item::class, 'timeline_event_item')
            ->withPivot('display_order', 'backward_compatibility', 'extra')
            ->withTimestamps();
    }
}
