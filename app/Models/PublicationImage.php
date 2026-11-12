<?php

namespace App\Models;

use App\Contracts\BurnsCopyright;
use App\Contracts\DetachableImage;
use App\Contracts\StreamableImageFile;
use App\Enums\PublicationImageKind;
use App\Traits\DeletesImageFilesOnDelete;
use App\Traits\HasDisplayOrder;
use App\Traits\ResolvesCopyright;
use Database\Factories\PublicationImageFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * A publication's cover or sample page: the seventh attached-image model.
 * Its pristine original lives on the private originals disk, its public
 * rendition (burned with the resolved copyright) is served at /pub only
 * through PublicRenditions.
 *
 * @property string $id
 * @property string $publication_id
 * @property string|null $publication_edition_id
 * @property PublicationImageKind $kind
 * @property string $path
 * @property string $original_name
 * @property string $mime_type
 * @property int $size
 * @property string|null $alt_text
 * @property string|null $copyright
 * @property int $display_order
 * @property array<string, mixed>|null $extra
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class PublicationImage extends Model implements BurnsCopyright, DetachableImage, StreamableImageFile
{
    /** @use HasFactory<PublicationImageFactory> */
    use DeletesImageFilesOnDelete, HasDisplayOrder, HasFactory, HasUuids, ResolvesCopyright;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'publication_id',
        'publication_edition_id',
        'kind',
        'path',
        'original_name',
        'mime_type',
        'size',
        'alt_text',
        'copyright',
        'display_order',
        'extra',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'kind' => PublicationImageKind::class,
        'size' => 'integer',
        'display_order' => 'integer',
        'extra' => 'array',
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
     * Get the publication this image belongs to.
     *
     * @return BelongsTo<Publication, $this>
     */
    public function publication(): BelongsTo
    {
        return $this->belongsTo(Publication::class);
    }

    /**
     * The edition whose cover this image is, if any.
     *
     * @return BelongsTo<PublicationEdition, $this>
     */
    public function publicationEdition(): BelongsTo
    {
        return $this->belongsTo(PublicationEdition::class);
    }

    protected function copyrightProject(): ?Project
    {
        return $this->publication?->project;
    }

    /**
     * Get a query builder scoped to this image's siblings (same publication_id).
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
     * Attach an available image to a publication, preserving the ID.
     */
    public static function attachFromAvailableImage(
        AvailableImage $availableImage,
        string $publicationId,
        ?string $altText = null,
        PublicationImageKind $kind = PublicationImageKind::PAGE,
        ?string $publicationEditionId = null,
    ): static {
        /** @var static $result */
        $result = DB::transaction(function () use ($availableImage, $publicationId, $altText, $kind, $publicationEditionId) {
            $displayOrder = static::getNextDisplayOrderFor(['publication_id' => $publicationId]);

            // The file already lives on the private originals disk under this
            // filename (that disk is shared with AvailableImage - see
            // localstorage.available.*): attaching is a pure ownership swap,
            // never a file move.
            $publicationImage = Model::unguarded(fn () => static::create([
                'id' => $availableImage->id, // Preserve the ID
                'publication_id' => $publicationId,
                'publication_edition_id' => $publicationEditionId,
                'kind' => $kind,
                'path' => $availableImage->path, // Keep filename unchanged
                'original_name' => $availableImage->original_name ?? '',
                'mime_type' => $availableImage->mime_type ?? '',
                'size' => $availableImage->size ?? 0,
                'alt_text' => $altText ?? $availableImage->comment,
                'copyright' => $availableImage->copyright,
                'display_order' => $displayOrder,
            ]));

            $availableImage->delete();

            return $publicationImage;
        });

        return $result;
    }

    /**
     * Detach this image and convert it back to an available image, preserving the ID.
     */
    public function detachToAvailableImage(): AvailableImage
    {
        return $this->getConnection()->transaction(function () {
            // The private original stays put (see attachFromAvailableImage) -
            // only the public cache, if any, is removed: nothing to serve
            // once detached (M9 §10 "Two disks").
            $picturesDisk = Config::string('localstorage.pictures.disk');
            $picturesDir = trim(Config::string('localstorage.pictures.directory'), '/');
            Storage::disk($picturesDisk)->delete($picturesDir.'/'.$this->path);

            $availableImage = Model::unguarded(fn () => AvailableImage::create([
                'id' => $this->id, // Preserve the ID
                'path' => $this->path, // Keep filename unchanged
                'original_name' => $this->original_name ?: $this->path,
                'mime_type' => $this->mime_type ?: null,
                'size' => $this->size ?: null,
                'comment' => $this->alt_text,
                'copyright' => $this->copyright,
            ]));

            // The row is deleted to recreate it as an AvailableImage above,
            // not to discard the image: keep the private original in place.
            $this->suppressImageFileCleanup = true;
            $this->delete();

            return $availableImage;
        });
    }

    public function imageDisk(): string
    {
        return Config::string('localstorage.available.images.disk');
    }

    public function imageStoragePath(): string
    {
        return trim(Config::string('localstorage.available.images.directory'), '/').'/'.$this->path;
    }

    public function imageMimeType(): ?string
    {
        return $this->mime_type;
    }

    /**
     * The stored filename, never `original_name`: for imported records
     * `original_name` holds the legacy source path, and "/" is not allowed in
     * a Content-Disposition header (see CollectionImage).
     */
    public function imageDownloadFilename(): string
    {
        return basename($this->path);
    }
}
