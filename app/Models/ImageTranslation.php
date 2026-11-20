<?php

namespace App\Models;

use Database\Factories\ImageTranslationFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Carbon;

/**
 * An image's texts in one language (M16 F2, #2652), for any model of the
 * AttachedImageRegistry or an AvailableImage (`image_type` is its morph
 * alias). Metadata only: the image's file, its burn and its pipeline are
 * not involved.
 *
 * @property string $id
 * @property string $image_type
 * @property string $image_id
 * @property string $language_id
 * @property string|null $caption
 * @property string|null $name
 * @property string|null $date
 * @property string|null $museum
 * @property string|null $location
 * @property string|null $copyright
 * @property string|null $photographer
 * @property string|null $backward_compatibility
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class ImageTranslation extends Model
{
    /** @use HasFactory<ImageTranslationFactory> */
    use HasFactory, HasUuids;

    protected $fillable = [
        'language_id',
        'caption',
        'name',
        'date',
        'museum',
        'location',
        // A picture's own credit and photographer in this language, as written (M16 B7)
        'copyright',
        'photographer',
        'backward_compatibility',
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
     * The image these texts belong to.
     *
     * @return MorphTo<Model, $this>
     */
    public function image(): MorphTo
    {
        return $this->morphTo();
    }

    /**
     * @return BelongsTo<Language, $this>
     */
    public function language(): BelongsTo
    {
        return $this->belongsTo(Language::class);
    }
}
