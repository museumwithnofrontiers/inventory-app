<?php

namespace App\Traits;

use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Storage;

/**
 * Deletes a document's file (ItemDocument, PublicationDocument) from the
 * private documents disk whenever the model row is deleted, regardless of
 * entry point (Filament, API, console, direct ->delete()). Storage::delete()
 * is a no-op on a missing file, so this is safe to run even when the file is
 * already gone.
 *
 * This is a standalone trait, not App\Traits\DeletesImageFilesOnDelete:
 * documents have no StreamableImageFile shape to hang that trait off (M7
 * documents design, docs/frontend-filament/document-upload.md "Contrast with
 * the image pipeline"), and there is no rendition cache to clean up -
 * documents are never burned. An ItemDocument is never served publicly; a
 * PublicationDocument is, at /doc/{filename}, streamed from this same
 * private disk as stored (ADR 004), so deleting the file here is all there
 * is to remove.
 *
 * A database cascade (the owning Item or Publication being deleted) skips Eloquent's
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
