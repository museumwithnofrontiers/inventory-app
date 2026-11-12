<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\Pivot;

/**
 * The publication_collection pivot: a collection a publication accompanies.
 *
 * @property string $publication_id
 * @property string $collection_id
 * @property int|null $display_order
 * @property array<string, mixed>|null $extra
 */
class PublicationCollection extends Pivot
{
    /**
     * @var string
     */
    protected $table = 'publication_collection';

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
        'collection_id',
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
     * @return BelongsTo<Collection, $this>
     */
    public function collection(): BelongsTo
    {
        return $this->belongsTo(Collection::class);
    }
}
