<?php

namespace App\Models;

use Database\Factories\DynastyFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property string|null $display_label
 */
class Dynasty extends Model
{
    /** @use HasFactory<DynastyFactory> */
    use HasFactory;

    use HasUuids;

    protected $fillable = [
        'from_ah',
        'to_ah',
        'from_ad',
        'to_ad',
        'backward_compatibility',
    ];

    protected $casts = [
        'from_ah' => 'integer',
        'to_ah' => 'integer',
        'from_ad' => 'integer',
        'to_ad' => 'integer',
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
     * @return HasMany<DynastyTranslation, $this>
     */
    public function translations(): HasMany
    {
        return $this->hasMany(DynastyTranslation::class);
    }

    /**
     * Get the items associated with this dynasty.
     *
     * @return BelongsToMany<Item, $this>
     */
    public function items(): BelongsToMany
    {
        return $this->belongsToMany(Item::class, 'item_dynasty')->withTimestamps();
    }
}
