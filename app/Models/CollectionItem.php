<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\Pivot;

/**
 * A placement: an item on a collection (M16 C1, #2641).
 *
 * A row of the collection_item table, with its own UUID `id`;
 * `(collection_id, item_id)` stays unique. It holds the order, the variant
 * and parent variant numbers as legacy wrote them, the picture it shows and
 * the curator flag. Its texts per language are its translations
 * (CollectionItemTranslation, M16 C2, #2642).
 *
 * @property string $id
 * @property string $collection_id
 * @property string $item_id
 * @property int|null $display_order
 * @property int|null $variant_order
 * @property int|null $parent_variant_order
 * @property string|null $picture_item_id
 * @property bool|null $curator_selected
 * @property array<string, mixed>|null $extra
 */
class CollectionItem extends Pivot
{
    use HasUuids;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'collection_item';

    /**
     * Indicates if the IDs are auto-incrementing.
     *
     * @var bool
     */
    public $incrementing = false;

    /**
     * The primary key: the placement's own UUID.
     *
     * @var string
     */
    protected $primaryKey = 'id';

    /**
     * The data type of the primary key.
     *
     * @var string
     */
    protected $keyType = 'string';

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
        'collection_id',
        'item_id',
        'display_order',
        'variant_order',
        'parent_variant_order',
        'picture_item_id',
        'curator_selected',
        'extra',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'display_order' => 'integer',
        'variant_order' => 'integer',
        'parent_variant_order' => 'integer',
        'curator_selected' => 'boolean',
        'extra' => 'array',
    ];

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
     * Get the item that owns the pivot.
     *
     * @return BelongsTo<Item, $this>
     */
    public function item(): BelongsTo
    {
        return $this->belongsTo(Item::class);
    }

    /**
     * Get the picture the placement shows: a picture item of the placed item.
     *
     * @return BelongsTo<Item, $this>
     */
    public function picture(): BelongsTo
    {
        return $this->belongsTo(Item::class, 'picture_item_id');
    }

    /**
     * The Explore monuments the placement stands for, in order (M16 C4).
     *
     * @return HasMany<CollectionItemExploreMonument, $this>
     */
    public function exploreMonuments(): HasMany
    {
        return $this->hasMany(CollectionItemExploreMonument::class, 'collection_item_id')->orderBy('position');
    }

    /**
     * The placement's texts, one per language (M16 C2).
     *
     * @return HasMany<CollectionItemTranslation, $this>
     */
    public function translations(): HasMany
    {
        return $this->hasMany(CollectionItemTranslation::class, 'collection_item_id');
    }

    /**
     * The placement's description per language: language id → text.
     *
     * @return array<string, string>
     */
    public function contextualDescriptions(): array
    {
        return $this->textsByLanguage('description');
    }

    /**
     * Return the description for a specific language, or null.
     */
    public function contextualDescriptionForLanguage(string $languageId): ?string
    {
        return $this->contextualDescriptions()[$languageId] ?? null;
    }

    /**
     * Return the language keys that have a description.
     *
     * @return array<int, string>
     */
    public function contextualDescriptionLanguages(): array
    {
        return array_keys($this->contextualDescriptions());
    }

    /**
     * Each text's own legacy key per language: language id → key.
     *
     * @return array<string, string>
     */
    public function sourceBackwardCompatibilityByLanguage(): array
    {
        return $this->textsByLanguage('backward_compatibility');
    }

    /**
     * Return the legacy key of the text in a specific language, or null.
     */
    public function sourceBackwardCompatibilityForLanguage(string $languageId): ?string
    {
        return $this->sourceBackwardCompatibilityByLanguage()[$languageId] ?? null;
    }

    /**
     * One column of the translations, by language, without the empty ones.
     *
     * @return array<string, string>
     */
    private function textsByLanguage(string $column): array
    {
        $texts = [];
        foreach ($this->translations->sortBy('language_id') as $translation) {
            $value = $translation->getAttribute($column);
            if (is_string($value) && $value !== '') {
                $texts[$translation->language_id] = $value;
            }
        }

        return $texts;
    }
}
