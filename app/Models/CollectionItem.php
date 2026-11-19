<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\Pivot;

/**
 * A placement: an item on a collection (M16 C1, #2641).
 *
 * A row of the collection_item table, with its own UUID `id`;
 * `(collection_id, item_id)` stays unique. It holds the order, the variant
 * and parent variant numbers as legacy wrote them, the picture it shows and
 * the curator flag, and exposes the contextual descriptions and source
 * backward-compatibility values still in `extra` through named helpers.
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
     * Return all language-keyed contextual descriptions.
     *
     * @return array<string, string>
     */
    public function contextualDescriptions(): array
    {
        $extra = is_array($this->extra) ? $this->extra : [];

        /** @var array<string, string> */
        return (array) ($extra['contextual_descriptions'] ?? []);
    }

    /**
     * Return the contextual description for a specific language, or null.
     */
    public function contextualDescriptionForLanguage(string $languageId): ?string
    {
        $descriptions = $this->contextualDescriptions();

        return isset($descriptions[$languageId]) && $descriptions[$languageId] !== ''
            ? (string) $descriptions[$languageId]
            : null;
    }

    /**
     * Return the language keys that have a contextual description.
     *
     * @return array<int, string>
     */
    public function contextualDescriptionLanguages(): array
    {
        return array_keys($this->contextualDescriptions());
    }

    /**
     * Return all language-keyed source backward-compatibility values.
     *
     * @return array<string, string>
     */
    public function sourceBackwardCompatibilityByLanguage(): array
    {
        $extra = is_array($this->extra) ? $this->extra : [];

        /** @var array<string, string> */
        return (array) ($extra['source_bc_by_language'] ?? []);
    }

    /**
     * Return the source backward-compatibility value for a specific language, or null.
     */
    public function sourceBackwardCompatibilityForLanguage(string $languageId): ?string
    {
        $sources = $this->sourceBackwardCompatibilityByLanguage();

        return isset($sources[$languageId]) && $sources[$languageId] !== ''
            ? (string) $sources[$languageId]
            : null;
    }
}
