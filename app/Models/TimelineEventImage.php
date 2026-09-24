<?php

namespace App\Models;

use App\Contracts\DetachableImage;
use App\Contracts\HasCopyright;
use App\Contracts\StreamableImageFile;
use App\Traits\HasDisplayOrder;
use App\Traits\ResolvesCopyright;
use Database\Factories\TimelineEventImageFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class TimelineEventImage extends Model implements DetachableImage, HasCopyright, StreamableImageFile
{
    /** @use HasFactory<TimelineEventImageFactory> */
    use HasDisplayOrder, HasFactory, HasUuids, ResolvesCopyright;

    protected $fillable = [
        'timeline_event_id',
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
     * Get the columns that should automatically receive a unique identifier.
     *
     * @return array<int, string>
     */
    public function uniqueIds(): array
    {
        return ['id'];
    }

    /**
     * Get a query builder scoped to this image's siblings (same timeline_event_id).
     *
     * @return Builder<static>
     */
    protected function getSiblingsQuery(): Builder
    {
        /** @var Builder<static> $query */
        $query = static::where('timeline_event_id', $this->timeline_event_id);

        return $query;
    }

    /**
     * Get the timeline event this image belongs to.
     *
     * @return BelongsTo<TimelineEvent, $this>
     */
    public function timelineEvent(): BelongsTo
    {
        return $this->belongsTo(TimelineEvent::class);
    }

    /**
     * Attach an available image to a timeline event, preserving the ID.
     */
    public static function attachFromAvailableImage(AvailableImage $availableImage, string $timelineEventId, ?string $altText = null): static
    {
        /** @var static $result */
        $result = DB::transaction(function () use ($availableImage, $timelineEventId, $altText) {
            $displayOrder = static::getNextDisplayOrderFor(['timeline_event_id' => $timelineEventId]);

            $availableDisk = Config::string('localstorage.available.images.disk');
            $availableDir = trim(Config::string('localstorage.available.images.directory'), '/');
            $picturesDisk = Config::string('localstorage.pictures.disk');
            $picturesDir = trim(Config::string('localstorage.pictures.directory'), '/');

            $filename = $availableImage->path;

            $readStream = Storage::disk($availableDisk)->readStream($availableDir.'/'.$filename);
            if ($readStream === null) {
                throw new \RuntimeException("Failed to open read stream for image: {$filename}");
            }
            Storage::disk($picturesDisk)->writeStream($picturesDir.'/'.$filename, $readStream);
            Storage::disk($availableDisk)->delete($availableDir.'/'.$filename);

            $image = Model::unguarded(fn () => static::create([
                'id' => $availableImage->id,
                'timeline_event_id' => $timelineEventId,
                'path' => $filename,
                'original_name' => $availableImage->original_name ?? '',
                'mime_type' => $availableImage->mime_type ?? '',
                'size' => $availableImage->size ?? 0,
                'alt_text' => $altText ?? $availableImage->comment,
                'display_order' => $displayOrder,
            ]));

            $availableImage->delete();

            return $image;
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
