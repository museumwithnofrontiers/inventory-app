<?php

namespace App\Traits;

use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Storage;

/**
 * Deletes an ItemDocument's file from the private documents disk whenever
 * the model row is deleted, regardless of entry point (Filament, API,
 * console, direct ->delete()). Storage::delete() is a no-op on a missing
 * file, so this is safe to run even when the file is already gone.
 *
 * This is a standalone trait, not App\Traits\DeletesImageFilesOnDelete:
 * ItemDocument has no StreamableImageFile shape to hang that trait off (M7
 * documents design, docs/frontend-filament/document-upload.md "Contrast with
 * the image pipeline"), and there is no burned-rendition cache to clean up -
 * documents are never burned or served publicly.
 *
 * A database cascade (the owning Item being deleted) skips Eloquent's
 * `deleting` event entirely, so this hook never runs for a row removed that
 * way - the same known gap DeletesImageFilesOnDelete has for images.
 * `documents:cleanup-orphans` is the backstop that sweeps the file left
 * behind on disk.
 *
 * @property string $path
 */
trait DeletesDocumentFileOnDelete
{
    protected static function bootDeletesDocumentFileOnDelete(): void
    {
        static::deleting(function (self $document): void {
            $disk = Config::string('localstorage.documents.disk');
            $directory = trim(Config::string('localstorage.documents.directory'), '/');

            Storage::disk($disk)->delete($directory.'/'.$document->path);
        });
    }
}
