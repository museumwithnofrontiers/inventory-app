<?php

namespace App\Models;

use App\Contracts\DetachableImage;
use App\Contracts\HasCopyright;
use App\Contracts\StreamableImageFile;
use App\Traits\DeletesImageFilesOnDelete;
use App\Traits\HasDisplayOrder;
use App\Traits\ResolvesCopyright;
use Database\Factories\ItemImageFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class ItemImage extends Model implements DetachableImage, HasCopyright, StreamableImageFile
{
    /** @use HasFactory<ItemImageFactory> */
    use DeletesImageFilesOnDelete, HasDisplayOrder, HasFactory, HasUuids, ResolvesCopyright;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'item_id',
        'path',
        'original_name',
        'mime_type',
        'size',
        'alt_text',
        'copyright',
        'display_order',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
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
     * Get the item this image belongs to.
     *
     * @return BelongsTo<Item, $this>
     */
    public function item(): BelongsTo
    {
        return $this->belongsTo(Item::class);
    }

    protected function copyrightProject(): ?Project
    {
        return $this->item?->project;
    }

    /**
     * Get the tags associated with this item image.
     *
     * @return BelongsToMany<Tag, $this>
     */
    public function tags(): BelongsToMany
    {
        return $this->belongsToMany(Tag::class, 'item_image_tag')->withTimestamps();
    }

    /**
     * Scope to get item images that have a specific tag.
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
     * Scope to get item images that do not have a specific tag.
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
     * Get the next available display order for an item.
     *
     * @deprecated Use static::getNextDisplayOrderFor(['item_id' => $itemId]) instead
     */
    public static function getNextDisplayOrderForItem(string $itemId): int
    {
        return static::getNextDisplayOrderFor(['item_id' => $itemId]);
    }

    /**
     * Get a query builder scoped to this image's siblings (same item_id).
     *
     * @return Builder<static>
     */
    protected function getSiblingsQuery(): Builder
    {
        /** @var Builder<static> $query */
        $query = static::where('item_id', $this->item_id);

        return $query;
    }

    /**
     * Tighten the display order for all images of an item, eliminating gaps.
     *
     * @deprecated Use tightenOrdering() instead
     */
    public function tightenOrderingForItem(): void
    {
        $this->tightenOrdering();
    }

    /**
     * Attach an available image to an item, preserving the ID.
     */
    public static function attachFromAvailableImage(AvailableImage $availableImage, string $itemId, ?string $altText = null): static
    {
        /** @var static $result */
        $result = DB::transaction(function () use ($availableImage, $itemId, $altText) {
            $displayOrder = static::getNextDisplayOrderForItem($itemId);

            // The file already lives on the private originals disk under this
            // filename (that disk is shared with AvailableImage - see
            // localstorage.available.*): attaching is a pure ownership swap,
            // never a file move.
            $itemImage = Model::unguarded(fn () => static::create([
                'id' => $availableImage->id, // Preserve the ID
                'item_id' => $itemId,
                'path' => $availableImage->path, // Keep filename unchanged
                'original_name' => $availableImage->original_name ?? '',
                'mime_type' => $availableImage->mime_type ?? '',
                'size' => $availableImage->size ?? 0,
                'alt_text' => $altText ?? $availableImage->comment,
                'copyright' => $availableImage->copyright,
                'display_order' => $displayOrder,
            ]));

            $availableImage->delete();

            return $itemImage;
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
