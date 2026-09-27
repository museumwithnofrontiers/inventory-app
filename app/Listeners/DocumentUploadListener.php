<?php

namespace App\Listeners;

use App\Events\DocumentUploadEvent;
use App\Models\DocumentUpload;
use App\Models\Item;
use App\Models\ItemDocument;
use App\Models\User;
use App\Notifications\ItemDocumentUploadRejected;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Http\UploadedFile;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator as ValidatorFacade;
use Illuminate\Validation\Rules\File;
use Throwable;

/**
 * Class DocumentUploadListener
 *
 * Validates a queued `DocumentUpload` (M7 Story A4.2, #1906) — framework-level
 * checks only, per Pascal's decision: size range, extension allow-list,
 * declared/guessed MIME allow-list. No content parsing, no virus scanning.
 *
 * On success, moves the file from the pending disk to the private documents
 * disk, creates the `ItemDocument` (attach is implicit — there is no reuse
 * pool for documents, unlike images), and deletes the `DocumentUpload` row.
 *
 * On failure — a bad file, a missing/unreadable pending file, or any
 * unexpected exception — this is one unified "rejected" path: the pending
 * file and the `DocumentUpload` row are deleted, the reason is logged, and
 * the uploader is emailed a short, generic reason (never an exception
 * message).
 *
 * Unlike `ImageUploadListener`, this listener genuinely runs on the queue
 * (`ShouldQueue`): the point of queuing documents is to keep the Filament
 * `Upload` action from blocking on validation at all.
 */
class DocumentUploadListener implements ShouldQueue
{
    use InteractsWithQueue;

    /**
     * Handle the event.
     */
    public function handle(DocumentUploadEvent $event): void
    {
        $documentUpload = $event->documentUpload;

        $pendingDisk = Config::string('localstorage.uploads.documents.disk');
        $pendingDirectory = trim(Config::string('localstorage.uploads.documents.directory'), '/');
        $filename = basename($documentUpload->path);
        $pendingPath = $pendingDirectory === '' ? $filename : $pendingDirectory.'/'.$filename;

        try {
            if (! Storage::disk($pendingDisk)->exists($pendingPath)) {
                $this->reject($documentUpload, $pendingDisk, $pendingPath, 'the pending file could not be found');

                return;
            }

            if (! $this->passesValidation($pendingDisk, $pendingPath, $documentUpload->original_name, $documentUpload->mime_type)) {
                $this->reject($documentUpload, $pendingDisk, $pendingPath, 'file type or size not allowed');

                return;
            }

            $this->promote($documentUpload, $pendingDisk, $pendingPath, $filename);
        } catch (Throwable $e) {
            Log::error('Failed to process document upload.', [
                'id' => $documentUpload->id,
                'disk' => $pendingDisk,
                'path' => $pendingPath,
                'error' => $e->getMessage(),
            ]);

            $this->reject($documentUpload, $pendingDisk, $pendingPath, 'an unexpected error occurred', alreadyLogged: true);
        }
    }

    /**
     * Framework-level validation only: size range, extension allow-list,
     * declared/guessed MIME allow-list — Laravel's own `File` rule, working
     * against a stand-in `UploadedFile` built from the file already on the
     * pending disk plus the metadata captured at upload time. `test: true`
     * is what lets us construct one from a path that was never part of an
     * HTTP request; `getMimeType()` still guesses from the real bytes
     * (Symfony's guesser), and `getClientOriginalExtension()` reads the
     * original filename captured on the upload form.
     */
    private function passesValidation(string $disk, string $path, string $originalName, string $declaredMimeType): bool
    {
        $minKb = Config::integer('localstorage.uploads.documents.min_size');
        $maxKb = Config::integer('localstorage.uploads.documents.max_size');
        $extensions = $this->allowList('localstorage.uploads.documents.extensions');
        $mimeTypes = $this->allowList('localstorage.uploads.documents.mime');

        $file = new UploadedFile(
            Storage::disk($disk)->path($path),
            $originalName,
            $declaredMimeType,
            null,
            true,
        );

        $rule = File::types($mimeTypes)
            ->extensions($extensions)
            ->min($minKb)
            ->max($maxKb);

        return ValidatorFacade::make(['file' => $file], ['file' => $rule])->passes();
    }

    /**
     * @return array<int, string>
     */
    private function allowList(string $configKey): array
    {
        return array_values(array_filter(array_map('trim', explode(',', Config::string($configKey)))));
    }

    /**
     * Move the validated file to the documents disk and create the
     * `ItemDocument` directly — promotion and attachment are the same step,
     * because documents have no reuse pool to attach from.
     */
    private function promote(DocumentUpload $documentUpload, string $pendingDisk, string $pendingPath, string $filename): void
    {
        $finalDisk = Config::string('localstorage.documents.disk');
        $finalDirectory = trim(Config::string('localstorage.documents.directory'), '/');
        $finalPath = $finalDirectory === '' ? $filename : $finalDirectory.'/'.$filename;

        $readStream = Storage::disk($pendingDisk)->readStream($pendingPath);

        if ($readStream === null) {
            $this->reject($documentUpload, $pendingDisk, $pendingPath, 'the pending file could not be read');

            return;
        }

        Storage::disk($finalDisk)->writeStream($finalPath, $readStream);
        Storage::disk($pendingDisk)->delete($pendingPath);

        // Recommended by the design: give the ItemDocument the same id as
        // the DocumentUpload it came from, mirroring how AvailableImage
        // preserves ImageUpload's id.
        $itemDocument = new ItemDocument([
            'item_id' => $documentUpload->item_id,
            'language_id' => $documentUpload->language_id,
            'path' => $filename,
            'original_name' => $documentUpload->original_name,
            'mime_type' => $documentUpload->mime_type,
            'size' => $documentUpload->size,
            'title' => $documentUpload->title,
            'display_order' => $documentUpload->display_order
                ?? ItemDocument::getNextDisplayOrderFor(['item_id' => $documentUpload->item_id]),
        ]);
        $itemDocument->id = $documentUpload->id;
        $itemDocument->save();

        $documentUpload->delete();
    }

    /**
     * One unified rejection path: delete the pending file and the staging
     * row, log the reason, and email the uploader a generic explanation.
     */
    private function reject(DocumentUpload $documentUpload, string $disk, string $path, string $reason, bool $alreadyLogged = false): void
    {
        if (! $alreadyLogged) {
            Log::error('Rejected document upload.', [
                'id' => $documentUpload->id,
                'disk' => $disk,
                'path' => $path,
                'reason' => $reason,
            ]);
        }

        if (Storage::disk($disk)->exists($path)) {
            Storage::disk($disk)->delete($path);
        }

        $uploadedBy = $documentUpload->uploaded_by;
        $item = Item::find($documentUpload->item_id);
        $originalName = $documentUpload->original_name;

        $documentUpload->delete();

        if ($uploadedBy === null) {
            // No uploader to notify (e.g. their account was deleted before
            // the job ran) — an acceptable, rare gap per the design.
            return;
        }

        $user = User::find($uploadedBy);

        if ($user === null) {
            return;
        }

        Notification::send($user, new ItemDocumentUploadRejected($originalName, $item, $reason));
    }
}
