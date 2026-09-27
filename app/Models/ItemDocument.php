<?php

namespace App\Models;

use App\Traits\DeletesDocumentFileOnDelete;
use App\Traits\HasDisplayOrder;
use Database\Factories\ItemDocumentFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ItemDocument extends Model
{
    /** @use HasFactory<ItemDocumentFactory> */
    use DeletesDocumentFileOnDelete, HasDisplayOrder, HasFactory, HasUuids;

    protected $fillable = [
        'item_id',
        'language_id',
        'path',
        'original_name',
        'mime_type',
        'size',
        'title',
        'display_order',
        'extra',
        'backward_compatibility',
    ];

    protected $casts = [
        'size' => 'integer',
        'display_order' => 'integer',
        'extra' => 'object',
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
     * Get a query builder scoped to this document's siblings (same item_id).
     *
     * @return Builder<static>
     */
    protected function getSiblingsQuery(): Builder
    {
        /** @var Builder<static> $query */
        $query = static::where('item_id', $this->item_id);

        return $query;
    }

    /**
     * Get the item this document belongs to.
     *
     * @return BelongsTo<Item, $this>
     */
    public function item(): BelongsTo
    {
        return $this->belongsTo(Item::class);
    }

    /**
     * Get the language of this document.
     *
     * @return BelongsTo<Language, $this>
     */
    public function language(): BelongsTo
    {
        return $this->belongsTo(Language::class);
    }
}
