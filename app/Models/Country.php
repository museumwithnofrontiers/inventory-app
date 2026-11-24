<?php

namespace App\Models;

use Database\Factories\CountryFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property string $internal_name
 * @property string|null $backward_compatibility
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class Country extends Model
{
    /** @use HasFactory<CountryFactory> */
    use HasFactory;

    public $incrementing = false; // Disable auto-incrementing

    protected $keyType = 'string'; // Specify the key type as string

    protected $fillable = [
        'id',
        'internal_name',
        'backward_compatibility',
    ];

    /**
     * Get the collections that name this country: the way back from
     * Collection::countries(), which the panel's Attach action uses to leave
     * out the collection's countries.
     *
     * @return BelongsToMany<Collection, $this>
     */
    public function collections(): BelongsToMany
    {
        return $this->belongsToMany(Collection::class, 'collection_country')
            ->withPivot('display_order')
            ->withTimestamps();
    }

    /**
     * Get the items belonging to this country.
     *
     * @return HasMany<Item, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(Item::class)->chaperone('country');
    }

    /**
     * Get the partners belonging to this country.
     *
     * @return HasMany<Partner, $this>
     */
    public function partners(): HasMany
    {
        return $this->hasMany(Partner::class)->chaperone('country');
    }

    /**
     * Get the translations for this country.
     *
     * @return HasMany<CountryTranslation, $this>
     */
    public function translations(): HasMany
    {
        return $this->hasMany(CountryTranslation::class, 'country_id');
    }
}
