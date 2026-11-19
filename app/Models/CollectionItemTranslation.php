<?php

namespace App\Models;

use Database\Factories\CollectionItemTranslationFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A placement's texts in one language (M16 C2, #2642): the texts an item has
 * on one collection, not everywhere it appears. Every text is kept as legacy
 * wrote it, each in its own column.
 *
 * @property string $id
 * @property string $collection_item_id
 * @property string $language_id
 * @property string|null $title
 * @property string|null $description
 * @property string|null $curator_justification
 * @property string|null $partner_justification
 * @property string|null $justification
 * @property string|null $caption
 * @property string|null $item_name
 * @property string|null $item_date
 * @property string|null $item_location
 * @property string|null $item_museum
 * @property string|null $item_dynasty
 * @property string|null $item_artist
 * @property string|null $item_material
 * @property string|null $backward_compatibility
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class CollectionItemTranslation extends Model
{
    /** @use HasFactory<CollectionItemTranslationFactory> */
    use HasFactory, HasUuids;

    /**
     * The text columns, in the order the panel and the API show them.
     */
    public const TEXT_COLUMNS = [
        'title',
        'description',
        'curator_justification',
        'partner_justification',
        'justification',
        'caption',
        'item_name',
        'item_date',
        'item_location',
        'item_museum',
        'item_dynasty',
        'item_artist',
        'item_material',
    ];

    /**
     * @var list<string>
     */
    protected $fillable = [
        'collection_item_id',
        'language_id',
        ...self::TEXT_COLUMNS,
        'backward_compatibility',
    ];

    /**
     * @return array<int, string>
     */
    public function uniqueIds(): array
    {
        return ['id'];
    }

    /**
     * The placement these texts belong to.
     *
     * @return BelongsTo<CollectionItem, $this>
     */
    public function collectionItem(): BelongsTo
    {
        return $this->belongsTo(CollectionItem::class);
    }

    /**
     * @return BelongsTo<Language, $this>
     */
    public function language(): BelongsTo
    {
        return $this->belongsTo(Language::class);
    }
}
