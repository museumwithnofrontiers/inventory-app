<?php

namespace App\Models;

use App\Enums\PartnerCategory;
use App\Traits\HasLinks;
use Database\Factories\PartnerFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $internal_name
 * @property string|null $backward_compatibility
 * @property string $type
 * @property string|null $project_id
 * @property string|null $latitude
 * @property string|null $longitude
 * @property int $map_zoom
 * @property bool $visible
 * @property PartnerCategory|null $category
 * @property bool $featured
 * @property string|null $city
 * @property string|null $display_label
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class Partner extends Model
{
    /** @use HasFactory<PartnerFactory> */
    use HasFactory;

    use HasLinks;
    use HasUuids;

    // No model-level eager loads. Use request-scoped includes in controllers.

    protected $fillable = [
        // 'id',
        'internal_name',
        'type',
        'backward_compatibility',
        'country_id',
        // GPS Location
        'latitude',
        'longitude',
        'map_zoom',
        // Relationships
        'project_id',
        'monument_item_id',
        // Visibility
        'visible',
        // M16 D2 (decision 7)
        'category',
        'featured',
        'city',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'latitude' => 'decimal:8',
        'longitude' => 'decimal:8',
        'map_zoom' => 'integer',
        'visible' => 'boolean',
        'category' => PartnerCategory::class,
        'featured' => 'boolean',
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
     * Get the items belonging to this partner.
     *
     * @return HasMany<Item, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(Item::class)->chaperone('partner');
    }

    /**
     * The country of the partner.
     *
     * @return BelongsTo<Country, $this>
     */
    public function country(): BelongsTo
    {
        return $this->belongsTo(Country::class);
    }

    /**
     * Get the project this partner is associated with.
     *
     * @return BelongsTo<Project, $this>
     */
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    /**
     * Get the monument item this partner is linked to.
     *
     * @return BelongsTo<Item, $this>
     */
    public function monumentItem(): BelongsTo
    {
        return $this->belongsTo(Item::class, 'monument_item_id');
    }

    /**
     * Get the translations for this partner.
     *
     * @return HasMany<PartnerTranslation, $this>
     */
    public function translations(): HasMany
    {
        return $this->hasMany(PartnerTranslation::class);
    }

    /**
     * Get the images for this partner.
     *
     * @return HasMany<PartnerImage, $this>
     */
    public function partnerImages(): HasMany
    {
        return $this->hasMany(PartnerImage::class)->orderBy('display_order');
    }

    /**
     * Get the logos for this partner.
     *
     * @return HasMany<PartnerLogo, $this>
     */
    public function partnerLogos(): HasMany
    {
        return $this->hasMany(PartnerLogo::class)->orderBy('display_order');
    }

    /**
     * Get the collections this partner is associated with.
     *
     * @return BelongsToMany<Collection, $this, CollectionPartner>
     */
    public function collections(): BelongsToMany
    {
        return $this->belongsToMany(Collection::class, 'collection_partner')
            ->withPivot(['collection_type', 'level', 'visible'])
            ->withTimestamps()
            ->using(CollectionPartner::class);
    }

    /**
     * Scope a query to only include visible partners.
     *
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeVisible(Builder $query): Builder
    {
        return $query->where('visible', true);
    }

    /**
     * Get the default translation for a specific language.
     */
    public function getDefaultTranslation(string $languageId): ?PartnerTranslation
    {
        return $this->translations()->defaultContext()->forLanguage($languageId)->first();
    }

    /**
     * Get a contextualized translation for a specific language and context.
     */
    public function getContextualizedTranslation(string $languageId, string $contextId): ?PartnerTranslation
    {
        return $this->translations()->forLanguage($languageId)->forContext($contextId)->first();
    }

    /**
     * Get a translation with fallback logic.
     * First tries the specified context, then falls back to default context.
     */
    public function getTranslationWithFallback(string $languageId, string $contextId): ?PartnerTranslation
    {
        // Try to get the specified context translation
        $translation = $this->getContextualizedTranslation($languageId, $contextId);

        // If not found, fall back to default context
        if (! $translation) {
            $translation = $this->getDefaultTranslation($languageId);
        }

        return $translation;
    }

    /**
     * Its visit information, per language and context (M16 D1, #2645).
     *
     * @return HasMany<VisitInformation, $this>
     */
    public function visitInformation(): HasMany
    {
        return $this->hasMany(VisitInformation::class);
    }

    /**
     * The partner's contact persons, in legacy's order (M16 D2, #2646).
     *
     * @return HasMany<PartnerContact, $this>
     */
    public function contacts(): HasMany
    {
        return $this->hasMany(PartnerContact::class)->orderBy('display_order');
    }
}
