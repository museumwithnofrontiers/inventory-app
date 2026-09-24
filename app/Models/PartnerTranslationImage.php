<?php

namespace App\Models;

use App\Contracts\DetachableImage;
use App\Contracts\HasCopyright;
use App\Contracts\StreamableImageFile;
use App\Traits\DeletesImageFilesOnDelete;
use App\Traits\HasDisplayOrder;
use App\Traits\ResolvesCopyright;
use Database\Factories\PartnerTranslationImageFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class PartnerTranslationImage extends Model implements DetachableImage, HasCopyright, StreamableImageFile
{
    /** @use HasFactory<PartnerTranslationImageFactory> */
    use DeletesImageFilesOnDelete, HasDisplayOrder, HasFactory, HasUuids, ResolvesCopyright;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'partner_translation_id',
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
     * Get the partner translation this image belongs to.
     *
     * @return BelongsTo<PartnerTranslation, $this>
     */
    public function partnerTranslation(): BelongsTo
    {
        return $this->belongsTo(PartnerTranslation::class);
    }

    protected function copyrightProject(): ?Project
    {
        return $this->partnerTranslation?->partner?->project;
    }

    /**
     * Get the next available display order for a partner translation.
     *
     * @deprecated Use static::getNextDisplayOrderFor(['partner_translation_id' => $id]) instead
     */
    public static function getNextDisplayOrderForPartnerTranslation(string $partnerTranslationId): int
    {
        return static::getNextDisplayOrderFor(['partner_translation_id' => $partnerTranslationId]);
    }

    /**
     * Get a query builder scoped to this image's siblings (same partner_translation_id).
     *
     * @return Builder<static>
     */
    protected function getSiblingsQuery(): Builder
    {
        /** @var Builder<static> $query */
        $query = static::where('partner_translation_id', $this->partner_translation_id);

        return $query;
    }

    /**
     * Tighten the display order for all images of a partner translation, eliminating gaps.
     *
     * @deprecated Use tightenOrdering() instead
     */
    public function tightenOrderingForPartnerTranslation(): void
    {
        $this->tightenOrdering();
    }

    /**
     * Attach an available image to a partner translation, preserving the ID.
     */
    public static function attachFromAvailableImage(AvailableImage $availableImage, string $partnerTranslationId, ?string $altText = null): static
    {
        /** @var static $result */
        $result = DB::transaction(function () use ($availableImage, $partnerTranslationId, $altText) {
            $displayOrder = static::getNextDisplayOrderForPartnerTranslation($partnerTranslationId);

            // The file already lives on the private originals disk under this
            // filename (that disk is shared with AvailableImage - see
            // localstorage.available.*): attaching is a pure ownership swap,
            // never a file move.
            $partnerTranslationImage = Model::unguarded(fn () => static::create([
                'id' => $availableImage->id, // Preserve the ID
                'partner_translation_id' => $partnerTranslationId,
                'path' => $availableImage->path, // Keep filename unchanged
                'original_name' => $availableImage->original_name ?? '',
                'mime_type' => $availableImage->mime_type ?? '',
                'size' => $availableImage->size ?? 0,
                'alt_text' => $altText ?? $availableImage->comment,
                'copyright' => $availableImage->copyright,
                'display_order' => $displayOrder,
            ]));

            $availableImage->delete();

            return $partnerTranslationImage;
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
                'mime_type' => $this->mime_type,
                'size' => $this->size,
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
