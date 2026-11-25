<?php

namespace App\Models;

use App\Enums\CollectionPartnerType;
use App\Enums\PartnerLevel;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\Pivot;
use Illuminate\Support\Facades\DB;

/**
 * CollectionPartner Pivot Model
 *
 * Represents the many-to-many relationship between Collections and Partners
 * with additional pivot data including partner contribution level.
 *
 * @property CollectionPartnerType $collection_type
 * @property PartnerLevel|null $level
 */
class CollectionPartner extends Pivot
{
    use HasUuids;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'collection_partner';

    /**
     * Indicates if the IDs are auto-incrementing.
     *
     * @var bool
     */
    public $incrementing = false;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'collection_id',
        'collection_type',
        'partner_id',
        'level',
        'visible',
        'parent_partner_id',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'level' => PartnerLevel::class,
        'collection_type' => CollectionPartnerType::class,
        'visible' => 'boolean',
    ];

    /**
     * Get the unique identifiers for the model.
     *
     * @return array<int, string>
     */
    public function uniqueIds(): array
    {
        return ['collection_id', 'collection_type', 'partner_id'];
    }

    /**
     * Get the collection that owns the pivot.
     *
     * @return BelongsTo<Collection, $this>
     */
    public function collection(): BelongsTo
    {
        return $this->belongsTo(Collection::class);
    }

    /**
     * The partner this one belongs to in the project (legacy's associated
     * partners), on project-tier rows only (M16 J2, #2709).
     *
     * @return BelongsTo<Partner, $this>
     */
    public function parentPartner(): BelongsTo
    {
        return $this->belongsTo(Partner::class, 'parent_partner_id');
    }

    /**
     * Get the partner that owns the pivot.
     *
     * @return BelongsTo<Partner, $this>
     */
    public function partner(): BelongsTo
    {
        return $this->belongsTo(Partner::class);
    }

    /**
     * Delete the pivot record using the composite primary key.
     *
     * Overrides AsPivot::delete() to handle the composite primary key
     * (collection_id, collection_type, partner_id) which the base method
     * cannot resolve because getKeyName() returns an array.
     */
    public function delete(): int
    {
        return DB::table($this->table)
            ->where('collection_id', $this->collection_id)
            ->where('collection_type', $this->collection_type->value)
            ->where('partner_id', $this->partner_id)
            ->delete();
    }
}
