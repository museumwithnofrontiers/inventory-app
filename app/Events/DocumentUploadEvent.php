<?php

namespace App\Events;

use App\Models\DocumentUpload;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Dispatched once a `DocumentUpload` has been staged by
 * `DocumentsRelationManager`'s `upload` action (M7 Story A4.2, #1906).
 *
 * The file it points to has only landed on the private pending disk; it has
 * not been validated yet. `DocumentUploadListener` (queued) does that, then
 * either promotes it into an `ItemDocument` or rejects it.
 */
class DocumentUploadEvent
{
    use Dispatchable, SerializesModels;

    public function __construct(public DocumentUpload $documentUpload) {}
}
