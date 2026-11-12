<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\Pivot;

/**
 * The publication_item pivot: an item a publication cites that is not
 * reached through the collections it accompanies. `extra` keeps the legacy
 * code as written.
 *
 * @property string $publication_id
 * @property string $item_id
 * @property int|null $display_order
 * @property array<string, mixed>|null $extra
 */
class PublicationItem extends Pivot
{
    /**
     * @var string
     */
    protected $table = 'publication_item';

    /**
     * @var bool
     */
    public $incrementing = false;

    /**
     * @var bool
     */
    public $timestamps = true;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'publication_id',
        'item_id',
        'display_order',
        'extra',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'display_order' => 'integer',
        'extra' => 'array',
    ];

    /**
     * @return BelongsTo<Publication, $this>
     */
    public function publication(): BelongsTo
    {
        return $this->belongsTo(Publication::class);
    }

    /**
     * @return BelongsTo<Item, $this>
     */
    public function item(): BelongsTo
    {
        return $this->belongsTo(Item::class);
    }
}
