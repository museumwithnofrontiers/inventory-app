<?php

namespace App\Models;

use App\Contracts\DetachableImage;
use App\Contracts\HasCopyright;
use App\Contracts\StreamableImageFile;
use App\Traits\HasDisplayOrder;
use App\Traits\ResolvesCopyright;
use Database\Factories\CollectionImageFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class CollectionImage extends Model implements DetachableImage, HasCopyright, StreamableImageFile
{
    /** @use HasFactory<CollectionImageFactory> */
    use HasDisplayOrder, HasFactory, HasUuids, ResolvesCopyright;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'collection_id',
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
     * Get the collection this image belongs to.
     *
     * @return BelongsTo<Collection, $this>
     */
    public function collection(): BelongsTo
    {
        return $this->belongsTo(Collection::class);
    }

    /**
     * Get the tags associated with this collection image.
     *
     * @return BelongsToMany<Tag, $this>
     */
    public function tags(): BelongsToMany
    {
        return $this->belongsToMany(Tag::class, 'collection_image_tag')->withTimestamps();
    }

    /**
     * Scope to get collection images that have a specific tag.
     *
     * @param  Builder<static>  $query
     * @param  string  $tagInternalName  The tag's internal_name
     * @return Builder<static>
     */
    public function scopeWithTag(Builder $query, string $tagInternalName): Builder
    {
        return $query->whereHas('tags', function (Builder $query) use ($tagInternalName) {
            $query->where('tags.internal_name', $tagInternalName);
        });
    }

    /**
     * Scope to get collection images that do not have a specific tag.
     *
     * @param  Builder<static>  $query
     * @param  string  $tagInternalName  The tag's internal_name
     * @return Builder<static>
     */
    public function scopeWithoutTag(Builder $query, string $tagInternalName): Builder
    {
        return $query->whereDoesntHave('tags', function (Builder $query) use ($tagInternalName) {
            $query->where('tags.internal_name', $tagInternalName);
        });
    }

    /**
     * Get the next available display order for a collection.
     *
     * @deprecated Use static::getNextDisplayOrderFor(['collection_id' => $collectionId]) instead
     */
    public static function getNextDisplayOrderForCollection(string $collectionId): int
    {
        return static::getNextDisplayOrderFor(['collection_id' => $collectionId]);
    }

    /**
     * Get a query builder scoped to this image's siblings (same collection_id).
     *
     * @return Builder<static>
     */
    protected function getSiblingsQuery(): Builder
    {
        /** @var Builder<static> $query */
        $query = static::where('collection_id', $this->collection_id);

        return $query;
    }

    /**
     * Tighten the display order for all images of a collection, eliminating gaps.
     *
     * @deprecated Use tightenOrdering() instead
     */
    public function tightenOrderingForCollection(): void
    {
        $this->tightenOrdering();
    }

    /**
     * Attach an available image to a collection, preserving the ID.
     */
    public static function attachFromAvailableImage(AvailableImage $availableImage, string $collectionId, ?string $altText = null): static
    {
        /** @var static $result */
        $result = DB::transaction(function () use ($availableImage, $collectionId, $altText) {
            $displayOrder = static::getNextDisplayOrderForCollection($collectionId);

            // Move file from available storage to pictures storage
            $availableDisk = Config::string('localstorage.available.images.disk');
            $availableDir = trim(Config::string('localstorage.available.images.directory'), '/');
            $picturesDisk = Config::string('localstorage.pictures.disk');
            $picturesDir = trim(Config::string('localstorage.pictures.directory'), '/');

            $filename = $availableImage->path; // Already just filename

            // Move the file from images/ to pictures/
            $readStream = Storage::disk($availableDisk)->readStream($availableDir.'/'.$filename);
            if ($readStream === null) {
                throw new \RuntimeException("Failed to open read stream for image: {$filename}");
            }
            Storage::disk($picturesDisk)->writeStream($picturesDir.'/'.$filename, $readStream);
            Storage::disk($availableDisk)->delete($availableDir.'/'.$filename);

            $collectionImage = Model::unguarded(fn () => static::create([
                'id' => $availableImage->id, // Preserve the ID
                'collection_id' => $collectionId,
                'path' => $filename, // Keep filename unchanged
                'original_name' => $availableImage->original_name ?? '',
                'mime_type' => $availableImage->mime_type ?? '',
                'size' => $availableImage->size ?? 0,
                'alt_text' => $altText ?? $availableImage->comment,
                'display_order' => $displayOrder,
            ]));

            $availableImage->delete();

            return $collectionImage;
        });

        return $result;
    }

    /**
     * Detach this image and convert it back to an available image, preserving the ID.
     */
    public function detachToAvailableImage(): AvailableImage
    {
        return $this->getConnection()->transaction(function () {
            // Move file from pictures storage back to available storage
            $picturesDisk = Config::string('localstorage.pictures.disk');
            $picturesDir = trim(Config::string('localstorage.pictures.directory'), '/');
            $availableDisk = Config::string('localstorage.available.images.disk');
            $availableDir = trim(Config::string('localstorage.available.images.directory'), '/');

            $filename = $this->path; // Already just filename

            // Move the file from pictures/ back to images/
            $readStream = Storage::disk($picturesDisk)->readStream($picturesDir.'/'.$filename);
            if ($readStream === null) {
                throw new \RuntimeException("Failed to open read stream for image: {$filename}");
            }
            Storage::disk($availableDisk)->writeStream($availableDir.'/'.$filename, $readStream);
            Storage::disk($picturesDisk)->delete($picturesDir.'/'.$filename);

            $availableImage = Model::unguarded(fn () => AvailableImage::create([
                'id' => $this->id, // Preserve the ID
                'path' => $filename, // Keep filename unchanged
                'original_name' => $this->original_name ?: $filename,
                'mime_type' => $this->mime_type ?: null,
                'size' => $this->size ?: null,
                'comment' => $this->alt_text,
            ]));

            $this->delete();

            return $availableImage;
        });
    }

    public function imageDisk(): string
    {
        return Config::string('localstorage.pictures.disk');
    }

    public function imageStoragePath(): string
    {
        return trim(Config::string('localstorage.pictures.directory'), '/').'/'.$this->path;
    }

    public function imageMimeType(): ?string
    {
        return $this->mime_type;
    }

    /**
     * The stored filename, never `original_name`.
     *
     * `original_name` is provenance, not a filename: for imported records it
     * holds the legacy source path (e.g. "monuments/bar/hu/11/4/10.jpg"), and
     * Symfony rejects "/" in a Content-Disposition header - which made every
     * download of an imported image a 500. `path` is the name the file
     * actually has on disk, so it is both legal and unambiguous.
     */
    public function imageDownloadFilename(): string
    {
        return basename($this->path);
    }
}
