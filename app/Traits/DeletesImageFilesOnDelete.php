<?php

namespace App\Traits;

use App\Contracts\StreamableImageFile;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Storage;

/**
 * Deletes both files an attached image owns - the private original and the
 * public burned-rendition cache, if one exists - whenever the model row is
 * deleted, regardless of entry point (Filament, API, console, direct
 * ->delete()). Storage::delete() is a no-op on a missing file, so this is
 * safe to run even when no public cache file was ever generated.
 *
 * detachToAvailableImage() deletes the row too (to recreate it as an
 * AvailableImage, preserving the id/path), but must keep the private
 * original in place - it sets $suppressImageFileCleanup first so this
 * trait's hook steps aside for that one delete.
 *
 * @property string $path
 */
trait DeletesImageFilesOnDelete
{
    protected bool $suppressImageFileCleanup = false;

    protected static function bootDeletesImageFilesOnDelete(): void
    {
        static::deleting(function (self $image): void {
            if ($image->suppressImageFileCleanup) {
                return;
            }

            /** @var self&StreamableImageFile $image */
            Storage::disk($image->imageDisk())->delete($image->imageStoragePath());

            $picturesDisk = Config::string('localstorage.pictures.disk');
            $picturesDir = trim(Config::string('localstorage.pictures.directory'), '/');
            Storage::disk($picturesDisk)->delete($picturesDir.'/'.$image->path);
        });
    }
}
