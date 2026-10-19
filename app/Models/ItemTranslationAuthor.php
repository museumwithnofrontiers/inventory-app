<?php

namespace App\Models;

use App\Enums\CreditRole;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\Pivot;

/**
 * ItemTranslationAuthor Pivot Model
 *
 * One person credited on an item translation, in one role, at one position.
 */
class ItemTranslationAuthor extends Pivot
{
    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'item_translation_author';

    /**
     * Indicates if the IDs are auto-incrementing.
     *
     * @var bool
     */
    public $incrementing = false;

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
        'item_translation_id',
        'author_id',
        'role',
        'display_order',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'role' => CreditRole::class,
        'display_order' => 'integer',
    ];

    /**
     * A pivot row is keyed by translation and author only; the same person can
     * hold two roles on one translation, so an update must also match the role.
     *
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    protected function setKeysForSaveQuery($query)
    {
        parent::setKeysForSaveQuery($query);

        return $query->where('role', $this->getOriginal('role', $this->getAttribute('role')));
    }

    /**
     * Same as {@see self::setKeysForSaveQuery()}, for deletes.
     *
     * @return Builder<static>
     */
    protected function getDeleteQuery()
    {
        return parent::getDeleteQuery()
            ->where('role', $this->getOriginal('role', $this->getAttribute('role')));
    }

    /**
     * Get the item translation that owns the pivot.
     *
     * @return BelongsTo<ItemTranslation, $this>
     */
    public function itemTranslation(): BelongsTo
    {
        return $this->belongsTo(ItemTranslation::class);
    }

    /**
     * Get the credited author.
     *
     * @return BelongsTo<Author, $this>
     */
    public function author(): BelongsTo
    {
        return $this->belongsTo(Author::class);
    }
}
