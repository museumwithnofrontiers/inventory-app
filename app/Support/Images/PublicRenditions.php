<?php

namespace App\Support\Images;

use App\Contracts\HasCopyright;
use App\Contracts\StreamableImageFile;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Storage;

/**
 * The public rendition of an attached image: the original burned with its
 * currently resolved copyright, generated lazily and cached on the pictures
 * disk. /pub serves it at the image's stable URL, and the API's view and
 * download serve the same bytes, so the two can't drift apart.
 *
 * The ETag is derived from the resolved copyright and the burner's version,
 * so it can be computed - and a conditional request answered - without
 * reading or burning anything. Regeneration is coalesced through a
 * per-image lock: a burst of requests for the same just-invalidated image
 * (e.g. right after a popular Project's copyright changes) burns once, not
 * N times.
 */
class PublicRenditions
{
    public function __construct(private readonly ImageBurner $burner) {}

    /**
     * @param  Model&StreamableImageFile&HasCopyright  $record
     */
    public function etag(Model $record): string
    {
        return '"'.sha1(ImageBurner::VERSION.'|'.$this->filename($record).'|'.$record->resolveCopyright()).'"';
    }

    /**
     * The current rendition, from the cache or freshly burned. Null when
     * another request holds the lock for too long and there is nothing
     * cached to fall back on; the caller should ask the client to retry.
     *
     * A request that can't take the lock in time gets the cached file if
     * there is one: briefly stale is harmless.
     *
     * @param  Model&StreamableImageFile&HasCopyright  $record
     */
    public function get(Model $record): ?PublicRendition
    {
        $etag = $this->etag($record);

        if ($this->isCached($record, $etag)) {
            return new PublicRendition($this->pictures()->get($this->cachePath($record)) ?? '', $etag);
        }

        try {
            return Cache::lock('image-burn:'.$this->filename($record), 10)->block(
                5,
                fn (): PublicRendition => $this->regenerate($record, $etag)
            );
        } catch (LockTimeoutException) {
            if ($this->pictures()->exists($this->cachePath($record))) {
                return new PublicRendition(
                    $this->pictures()->get($this->cachePath($record)) ?? '',
                    Cache::get($this->markerKey($record)) ?? $etag
                );
            }

            return null;
        }
    }

    /**
     * Burn a fresh rendition and cache it. Re-checks the cache first - now
     * inside the lock - since a concurrent request may have just finished
     * regenerating this exact image while this one was waiting.
     *
     * @param  Model&StreamableImageFile&HasCopyright  $record
     */
    private function regenerate(Model $record, string $etag): PublicRendition
    {
        if ($this->isCached($record, $etag)) {
            return new PublicRendition($this->pictures()->get($this->cachePath($record)) ?? '', $etag);
        }

        $original = Storage::disk($record->imageDisk())->get($record->imageStoragePath());

        if ($original === null) {
            abort(404);
        }

        $burned = $this->burner->burn($original, $record->resolveCopyright());

        $this->pictures()->put($this->cachePath($record), $burned);
        Cache::forever($this->markerKey($record), $etag);

        return new PublicRendition($burned, $etag);
    }

    /**
     * The marker records the ETag the cached file was burned for; the file
     * can still be missing (deleted, or a failed write).
     */
    private function isCached(Model $record, string $etag): bool
    {
        return Cache::get($this->markerKey($record)) === $etag
            && $this->pictures()->exists($this->cachePath($record));
    }

    private function filename(Model $record): string
    {
        return (string) $record->getAttribute('path');
    }

    private function cachePath(Model $record): string
    {
        return trim(Config::string('localstorage.pictures.directory'), '/').'/'.$this->filename($record);
    }

    private function markerKey(Model $record): string
    {
        return 'image-copyright-etag:'.$this->filename($record);
    }

    private function pictures(): Filesystem
    {
        return Storage::disk(Config::string('localstorage.pictures.disk'));
    }
}
