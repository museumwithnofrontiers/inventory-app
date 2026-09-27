<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\Pivot;

/**
 * TimelineEventItem Pivot Model
 *
 * Typed representation of a row in the timeline_event_item table, mirroring
 * CollectionItem's shape (M7 story A2.3, #1902). Needed so the `extra` JSON
 * column round-trips as an array instead of raising when Filament's
 * AttachAction/EditAction write an array attribute to it — the generic
 * `Pivot` base class Item::timelineEvents()/TimelineEvent::items() used
 * before this story has no cast for it.
 *
 * `backward_compatibility` is deliberately left out of $fillable: it is
 * importer-owned and never appears in the Attach or Edit-pivot forms.
 */
class TimelineEventItem extends Pivot
{
    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'timeline_event_item';

    /**
     * Indicates if the IDs are auto-incrementing.
     *
     * @var bool
     */
    public $incrementing = false;

    /**
     * Indicates if the model should be timestamped.
     *
     * @var bool
     */
    public $timestamps = true;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'timeline_event_id',
        'item_id',
        'display_order',
        'extra',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'display_order' => 'integer',
        'extra' => 'array',
    ];

    /**
     * Get the timeline event that owns the pivot.
     *
     * @return BelongsTo<TimelineEvent, $this>
     */
    public function timelineEvent(): BelongsTo
    {
        return $this->belongsTo(TimelineEvent::class);
    }

    /**
     * Get the item that owns the pivot.
     *
     * @return BelongsTo<Item, $this>
     */
    public function item(): BelongsTo
    {
        return $this->belongsTo(Item::class);
    }
}
