<?php

namespace App\Models;

use App\Enums\PublicationDocumentKind;
use App\Traits\DeletesDocumentFileOnDelete;
use App\Traits\HasDisplayOrder;
use Database\Factories\PublicationDocumentFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A publication's PDF: an edition's sample pages or its credits. Built like
 * ItemDocument, on the same document pipeline (DocumentUpload, the private
 * documents disk). Unlike an ItemDocument, its file is public: /doc/{path}
 * streams it, unstamped (ADR 004).
 *
 * @property string $id
 * @property string $publication_id
 * @property string|null $publication_edition_id
 * @property string|null $language_id
 * @property PublicationDocumentKind $kind
 * @property string $path
 * @property string $original_name
 * @property string $mime_type
 * @property int $size
 * @property int $display_order
 * @property string|null $backward_compatibility
 * @property object|null $extra
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class PublicationDocument extends Model
{
    /** @use HasFactory<PublicationDocumentFactory> */
    use DeletesDocumentFileOnDelete, HasDisplayOrder, HasFactory, HasUuids;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'publication_id',
        'publication_edition_id',
        'language_id',
        'kind',
        'path',
        'original_name',
        'mime_type',
        'size',
        'display_order',
        'backward_compatibility',
        'extra',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'kind' => PublicationDocumentKind::class,
        'size' => 'integer',
        'display_order' => 'integer',
        'extra' => 'object',
    ];

    /**
     * @return array<int, string>
     */
    public function uniqueIds(): array
    {
        return ['id'];
    }

    /**
     * A query scoped to this document's siblings (same publication_id).
     *
     * @return Builder<static>
     */
    protected function getSiblingsQuery(): Builder
    {
        /** @var Builder<static> $query */
        $query = static::where('publication_id', $this->publication_id);

        return $query;
    }

    /**
     * @return BelongsTo<Publication, $this>
     */
    public function publication(): BelongsTo
    {
        return $this->belongsTo(Publication::class);
    }

    /**
     * The edition this document belongs to, if any.
     *
     * @return BelongsTo<PublicationEdition, $this>
     */
    public function publicationEdition(): BelongsTo
    {
        return $this->belongsTo(PublicationEdition::class);
    }

    /**
     * @return BelongsTo<Language, $this>
     */
    public function language(): BelongsTo
    {
        return $this->belongsTo(Language::class);
    }
}
