<?php

namespace App\Models;

use App\Contracts\DetachableImage;
use App\Contracts\HasCopyright;
use App\Contracts\StreamableImageFile;
use App\Traits\HasDisplayOrder;
use App\Traits\ResolvesCopyright;
use Database\Factories\PartnerImageFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class PartnerImage extends Model implements DetachableImage, HasCopyright, StreamableImageFile
{
    /** @use HasFactory<PartnerImageFactory> */
    use HasDisplayOrder, HasFactory, HasUuids, ResolvesCopyright;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'partner_id',
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
     * Get the partner this image belongs to.
     *
     * @return BelongsTo<Partner, $this>
     */
    public function partner(): BelongsTo
    {
        return $this->belongsTo(Partner::class);
    }

    protected function copyrightProject(): ?Project
    {
        return $this->partner?->project;
    }

    /**
     * Get the next available display order for a partner.
     *
     * @deprecated Use static::getNextDisplayOrderFor(['partner_id' => $partnerId]) instead
     */
    public static function getNextDisplayOrderForPartner(string $partnerId): int
    {
        return static::getNextDisplayOrderFor(['partner_id' => $partnerId]);
    }

    /**
     * Get a query builder scoped to this image's siblings (same partner_id).
     *
     * @return Builder<static>
     */
    protected function getSiblingsQuery(): Builder
    {
        /** @var Builder<static> $query */
        $query = static::where('partner_id', $this->partner_id);

        return $query;
    }

    /**
     * Tighten the display order for all images of a partner, eliminating gaps.
     *
     * @deprecated Use tightenOrdering() instead
     */
    public function tightenOrderingForPartner(): void
    {
        $this->tightenOrdering();
    }

    /**
     * Attach an available image to a partner, preserving the ID.
     */
    public static function attachFromAvailableImage(AvailableImage $availableImage, string $partnerId, ?string $altText = null): static
    {
        /** @var static $result */
        $result = DB::transaction(function () use ($availableImage, $partnerId, $altText) {
            $displayOrder = static::getNextDisplayOrderForPartner($partnerId);

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

            $partnerImage = Model::unguarded(fn () => static::create([
                'id' => $availableImage->id, // Preserve the ID
                'partner_id' => $partnerId,
                'path' => $filename, // Keep filename unchanged
                'original_name' => $availableImage->original_name ?? '',
                'mime_type' => $availableImage->mime_type ?? '',
                'size' => $availableImage->size ?? 0,
                'alt_text' => $altText ?? $availableImage->comment,
                'copyright' => $availableImage->copyright,
                'display_order' => $displayOrder,
            ]));

            $availableImage->delete();

            return $partnerImage;
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
                'copyright' => $this->copyright,
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
