<?php

namespace App\Http\Controllers\Pub;

use App\Contracts\HasCopyright;
use App\Contracts\StreamableImageFile;
use App\Http\Controllers\Controller;
use App\Support\Images\AttachedImageRegistry;
use App\Support\Images\ImageBurner;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Storage;

class PictureController extends Controller
{
    public function __construct(private readonly ImageBurner $burner) {}

    /**
     * Serve a picture at its stable, UUID-keyed public URL - burned with the
     * currently-resolved copyright text, generated lazily and cached.
     *
     * Route: GET /pub/{filename}  (filename constrained to {uuid}.jpg)
     *
     * The URL never changes on a copyright edit - downstream npm data
     * packages bake it in - so invalidation happens through a content-based
     * ETag (derived from the resolved copyright text and the burner's
     * version) rather than a versioned URL. A matching If-None-Match short-circuits to 304 before
     * anything is read from disk or burned (M9 epic A3).
     *
     * Regeneration on a miss or mismatch is coalesced through a per-image
     * lock: a burst of concurrent requests for the same just-invalidated
     * image (e.g. right after a popular Project's copyright changes) burns
     * once, not N times. A request that can't acquire the lock in time
     * falls back to the existing cached file if there is one - briefly
     * stale is harmless - or a 503 asking the client to retry shortly.
     */
    public function show(Request $request, string $filename): Response
    {
        // Reject query string parameters — public image URLs must be clean
        if ($request->query->count() > 0) {
            abort(400, 'Query parameters are not accepted.');
        }

        $record = AttachedImageRegistry::findByPath($filename);

        if ($record === null) {
            abort(404);
        }

        /** @var Model&StreamableImageFile&HasCopyright $record */
        $copyright = $record->resolveCopyright();
        $etag = '"'.sha1(ImageBurner::VERSION.'|'.$filename.'|'.$copyright).'"';

        $ifNoneMatch = $request->header('If-None-Match');
        if ($ifNoneMatch !== null && $ifNoneMatch === $etag) {
            return response('', 304);
        }

        $picturesDisk = Config::string('localstorage.pictures.disk');
        $picturesDirectory = trim(Config::string('localstorage.pictures.directory'), '/');
        $picturePath = $picturesDirectory.'/'.$filename;
        $etagCacheKey = 'image-copyright-etag:'.$filename;

        if (Cache::get($etagCacheKey) === $etag && Storage::disk($picturesDisk)->exists($picturePath)) {
            return $this->respond(Storage::disk($picturesDisk)->get($picturePath) ?? '', $etag, $record);
        }

        try {
            $contents = Cache::lock('image-burn:'.$filename, 10)->block(
                5,
                fn (): string => $this->regenerate($record, $copyright, $etag, $etagCacheKey, $picturesDisk, $picturePath)
            );

            return $this->respond($contents, $etag, $record);
        } catch (LockTimeoutException) {
            if (Storage::disk($picturesDisk)->exists($picturePath)) {
                return $this->respond(
                    Storage::disk($picturesDisk)->get($picturePath) ?? '',
                    Cache::get($etagCacheKey) ?? $etag,
                    $record
                );
            }

            return response('', 503, ['Retry-After' => '5']);
        }
    }

    /**
     * Burn a fresh rendition and cache it. Re-checks the cache marker first
     * - now inside the lock - since a concurrent request may have already
     * finished regenerating this exact image while this one was waiting.
     *
     * @param  Model&StreamableImageFile&HasCopyright  $record
     */
    private function regenerate(Model $record, string $copyright, string $etag, string $etagCacheKey, string $picturesDisk, string $picturePath): string
    {
        if (Cache::get($etagCacheKey) === $etag && Storage::disk($picturesDisk)->exists($picturePath)) {
            return Storage::disk($picturesDisk)->get($picturePath) ?? '';
        }

        $original = Storage::disk($record->imageDisk())->get($record->imageStoragePath());
        $burned = $this->burner->burn($original ?? '', $copyright);

        Storage::disk($picturesDisk)->put($picturePath, $burned);
        Cache::forever($etagCacheKey, $etag);

        return $burned;
    }

    /**
     * @param  Model&StreamableImageFile  $record
     */
    private function respond(string $contents, string $etag, Model $record): Response
    {
        return response($contents, 200, [
            'Content-Type' => $record->imageMimeType() ?? 'image/jpeg',
            'Cache-Control' => 'public, max-age=86400, must-revalidate',
            'ETag' => $etag,
        ]);
    }
}
