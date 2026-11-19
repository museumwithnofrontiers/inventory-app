<?php

namespace App\Traits;

use App\Models\ImageTranslation;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphMany;

/**
 * An image with texts per language (M16 F2). The texts follow the image's id:
 * the attach/detach row swap creates the new row before it deletes the old
 * one, so when a row is created its id's texts are moved onto it, and when it
 * is deleted only the texts still on it go.
 *
 * @mixin Model
 */
trait HasImageTranslations
{
    protected static function bootHasImageTranslations(): void
    {
        static::created(function (Model $image): void {
            ImageTranslation::query()
                ->where('image_id', $image->getKey())
                ->where('image_type', '!=', $image->getMorphClass())
                ->update(['image_type' => $image->getMorphClass()]);
        });

        static::deleting(function (Model $image): void {
            /** @var Model&self $image */
            $image->translations()->delete();
        });
    }

    /**
     * The image's texts, one row per language.
     *
     * @return MorphMany<ImageTranslation, $this>
     */
    public function translations(): MorphMany
    {
        return $this->morphMany(ImageTranslation::class, 'image')->orderBy('language_id');
    }
}
