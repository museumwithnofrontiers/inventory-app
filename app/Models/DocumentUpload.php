<?php

namespace App\Models;

use Database\Factories\DocumentUploadFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A transient staging row for one pending document upload (M7 Story A4.2,
 * #1906). Plays the same role for documents that `ImageUpload` plays for
 * images: it carries the metadata entered on `DocumentsRelationManager`'s
 * `upload` form — item, language, title, display_order and uploader —
 * across the hop from that synchronous Filament request to
 * `DocumentUploadListener`, which runs later on the queue. The listener
 * either promotes the row into an `ItemDocument` (same id) or rejects it;
 * either way, the row is deleted at the end of that one cycle. Nothing here
 * is a permanent audit record — `ItemDocument.created_at` is that record.
 *
 * Explicit exception to CLAUDE.md's new-model rule, per Pascal's decision on
 * 2026-09-26 (#1905): `DocumentUpload` is an internal row written only by
 * `DocumentsRelationManager`'s `upload` action (documents, unlike images,
 * are never uploaded from more than one place), so it gets a migration, a
 * factory and tests, and nothing else — no API resource, controller, Form
 * Request, seeder or document-upload API endpoint.
 *
 * @property string $id
 * @property string $item_id
 * @property string|null $language_id
 * @property string $path
 * @property string $original_name
 * @property string $mime_type
 * @property int $size
 * @property string|null $title
 * @property int|null $display_order
 * @property int|null $uploaded_by
 */
class DocumentUpload extends Model
{
    /** @use HasFactory<DocumentUploadFactory> */
    use HasFactory;

    use HasUuids;

    protected $fillable = [
        'item_id',
        'language_id',
        'path',
        'original_name',
        'mime_type',
        'size',
        'title',
        'display_order',
        'uploaded_by',
    ];

    protected $casts = [
        'size' => 'integer',
        'display_order' => 'integer',
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
     * The item this pending document is destined for.
     *
     * @return BelongsTo<Item, $this>
     */
    public function item(): BelongsTo
    {
        return $this->belongsTo(Item::class);
    }

    /**
     * The language selected for this pending document, if any.
     *
     * @return BelongsTo<Language, $this>
     */
    public function language(): BelongsTo
    {
        return $this->belongsTo(Language::class);
    }

    /**
     * The user who uploaded this file, who the rejection notification (if
     * any) is addressed to.
     *
     * @return BelongsTo<User, $this>
     */
    public function uploadedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
