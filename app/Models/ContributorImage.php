<?php

namespace App\Models;

use App\Contracts\DetachableImage;
use App\Contracts\HasCopyright;
use App\Contracts\StreamableImageFile;
use App\Traits\HasDisplayOrder;
use App\Traits\ResolvesCopyright;
use Database\Factories\ContributorImageFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class ContributorImage extends Model implements DetachableImage, HasCopyright, StreamableImageFile
{
    /** @use HasFactory<ContributorImageFactory> */
    use HasDisplayOrder, HasFactory, HasUuids, ResolvesCopyright;

    protected $fillable = [
        'contributor_id',
        'path',
        'original_name',
        'mime_type',
        'size',
        'alt_text',
        'copyright',
        'display_order',
    ];

    protected $casts = [
        'size' => 'integer',
        'display_order' => 'integer',
    ];

    /**
     * @return array<int, string>
     */
    public function uniqueIds(): array
    {
        return ['id'];
    }

    /**
     * Get the contributor this image belongs to.
     *
     * @return BelongsTo<Contributor, $this>
     */
    public function contributor(): BelongsTo
    {
        return $this->belongsTo(Contributor::class);
    }

    /**
     * Get a query builder scoped to this image's siblings (same contributor_id).
     *
     * @return Builder<static>
     */
    protected function getSiblingsQuery(): Builder
    {
        /** @var Builder<static> $query */
        $query = static::where('contributor_id', $this->contributor_id);

        return $query;
    }

    /**
     * Attach an available image to a contributor, preserving the ID.
     */
    public static function attachFromAvailableImage(AvailableImage $availableImage, string $contributorId, ?string $altText = null): static
    {
        /** @var static $result */
        $result = DB::transaction(function () use ($availableImage, $contributorId, $altText) {
            $displayOrder = static::getNextDisplayOrderFor(['contributor_id' => $contributorId]);

            // Move file from available storage to pictures storage
            $availableDisk = Config::string('localstorage.available.images.disk');
            $availableDir = trim(Config::string('localstorage.available.images.directory'), '/');
            $picturesDisk = Config::string('localstorage.pictures.disk');
            $picturesDir = trim(Config::string('localstorage.pictures.directory'), '/');

            $filename = $availableImage->path;

            // Move the file from images/ to pictures/
            $readStream = Storage::disk($availableDisk)->readStream($availableDir.'/'.$filename);
            if ($readStream === null) {
                throw new \RuntimeException("Failed to open read stream for image: {$filename}");
            }
            Storage::disk($picturesDisk)->writeStream($picturesDir.'/'.$filename, $readStream);
            Storage::disk($availableDisk)->delete($availableDir.'/'.$filename);

            $contributorImage = Model::unguarded(fn () => static::create([
                'id' => $availableImage->id,
                'contributor_id' => $contributorId,
                'path' => $filename,
                'original_name' => $availableImage->original_name ?? '',
                'mime_type' => $availableImage->mime_type ?? '',
                'size' => $availableImage->size ?? 0,
                'alt_text' => $altText ?? $availableImage->comment,
                'copyright' => $availableImage->copyright,
                'display_order' => $displayOrder,
            ]));

            $availableImage->delete();

            return $contributorImage;
        });

        return $result;
    }

    /**
     * Detach this image and convert it back to an available image, preserving the ID.
     */
    public function detachToAvailableImage(): AvailableImage
    {
        return $this->getConnection()->transaction(function () {
            $picturesDisk = Config::string('localstorage.pictures.disk');
            $picturesDir = trim(Config::string('localstorage.pictures.directory'), '/');
            $availableDisk = Config::string('localstorage.available.images.disk');
            $availableDir = trim(Config::string('localstorage.available.images.directory'), '/');

            $filename = $this->path;

            // Move the file from pictures/ back to images/
            $readStream = Storage::disk($picturesDisk)->readStream($picturesDir.'/'.$filename);
            if ($readStream === null) {
                throw new \RuntimeException("Failed to open read stream for image: {$filename}");
            }
            Storage::disk($availableDisk)->writeStream($availableDir.'/'.$filename, $readStream);
            Storage::disk($picturesDisk)->delete($picturesDir.'/'.$filename);

            $availableImage = Model::unguarded(fn () => AvailableImage::create([
                'id' => $this->id,
                'path' => $filename,
                'original_name' => $this->original_name ?: $filename,
                'mime_type' => $this->mime_type,
                'size' => $this->size,
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
