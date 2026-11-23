<?php

namespace App\Listeners;

use App\Events\AvailableImageEvent;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * Class AvailableImageListener
 *
 * This listener handles the event when an image becomes available for further processing.
 * It moves the image from the uploads disk to the private originals disk
 * (localstorage.available.images) and updates the database record accordingly.
 *
 * ImageUploadListener already writes the processed original there, so in the canonical flow
 * this listener only confirms it; it moves a file only when one is still on the uploads disk.
 *
 * It is triggered after an image is uploaded, checked and processed. The original stays
 * private from then on, attached or not; the public sees only its burned rendition at /pub.
 */
class AvailableImageListener
{
    use InteractsWithQueue;

    /**
     * Create the event listener.
     */
    public function __construct()
    {
        //
    }

    /**
     * Handle the event.
     */
    public function handle(AvailableImageEvent $event): void
    {
        $file = $event->availableImage;

        if ($file->path === null) {
            Log::error('AvailableImage has no path.', ['id' => $file->id]);

            return;
        }

        // Get disk and directory where uploaded images are stored
        $uploadDisk = Config::string('localstorage.uploads.images.disk');
        $uploadeDir = trim(Config::string('localstorage.uploads.images.directory'), '/');
        // Get disk and directory where the private originals are stored
        $finalDisk = Config::string('localstorage.available.images.disk');
        $finalDir = trim(Config::string('localstorage.available.images.directory'), '/');

        // Get filename (path should already be just filename)
        $filename = basename($file->path);

        // ImageUploadListener writes the processed original to the originals
        // disk before it creates the AvailableImage, so it is normally there
        // already, with nothing left to move.
        if (Storage::disk($finalDisk)->exists($finalDir.'/'.$filename)) {
            return;
        }

        // Otherwise move the file from the source disk to the destination disk
        $readStream = Storage::disk($uploadDisk)->readStream($uploadeDir.'/'.$filename);
        if ($readStream === null) {
            Log::error('Available image has no original and no upload to move.', ['filename' => $filename]);

            return;
        }
        Storage::disk($finalDisk)->writeStream($finalDir.'/'.$filename, $readStream);
        // Delete the file from the source disk
        Storage::disk($uploadDisk)->delete($uploadeDir.'/'.$filename);

        // Update the file model with just the filename (no directory)
        $file->path = $filename;
        $file->save();
    }
}
