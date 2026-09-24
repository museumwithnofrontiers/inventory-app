<?php

namespace App\Http\Controllers\Pub;

use App\Contracts\BurnsCopyright;
use App\Contracts\StreamableImageFile;
use App\Http\Controllers\Controller;
use App\Support\Images\AttachedImageRegistry;
use App\Support\Images\PublicRenditions;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;

class PictureController extends Controller
{
    /**
     * Clients and CDNs may keep a picture but must revalidate it on every
     * use, so a copyright edit shows on the very next request. Revalidating
     * is cheap: the 304 path reads no file and burns nothing.
     */
    private const string CACHE_CONTROL = 'public, no-cache';

    public function __construct(private readonly PublicRenditions $renditions) {}

    /**
     * Serve a picture at its stable, UUID-keyed public URL - burned with the
     * currently-resolved copyright text, generated lazily and cached.
     *
     * Route: GET /pub/{filename}  (filename constrained to {uuid}.jpg)
     *
     * The URL never changes on a copyright edit - downstream npm data
     * packages bake it in - so invalidation happens through a content-based
     * ETag (derived from the resolved copyright text and the burner's
     * version) rather than a versioned URL. A matching If-None-Match
     * short-circuits to 304 before anything is read from disk or burned
     * (M9 epic A3). Generation, caching and lock coalescing live in
     * PublicRenditions, shared with the API's view and download.
     *
     * An image that isn't burned (PartnerLogo) is served as its original.
     */
    public function show(Request $request, string $filename): Response
    {
        // Reject query string parameters — public image URLs must be clean
        if ($request->query->count() > 0) {
            abort(400, 'Query parameters are not accepted.');
        }

        /** @var (Model&StreamableImageFile)|null $record */
        $record = AttachedImageRegistry::findByPath($filename);

        if ($record === null) {
            abort(404);
        }

        if (! $record instanceof BurnsCopyright) {
            return $this->original($request, $record);
        }

        $etag = $this->renditions->etag($record);

        if ($this->matches($request, $etag)) {
            return $this->notModified($etag);
        }

        $rendition = $this->renditions->get($record);

        if ($rendition === null) {
            return response('', 503, ['Retry-After' => '5']);
        }

        $headers = ['Content-Type' => $record->imageMimeType() ?? 'image/jpeg'];

        if ($rendition->etag === null) {
            // Cached bytes nothing vouches for: serve them, but nobody keeps them
            $headers['Cache-Control'] = 'no-store';
        } else {
            $headers['Cache-Control'] = self::CACHE_CONTROL;
            $headers['ETag'] = $rendition->etag;
        }

        return response($rendition->contents, 200, $headers);
    }

    /**
     * The original bytes, with no pictures cache, no lock and no burn. The
     * ETag comes from the file itself, so replacing the file changes it.
     *
     * @param  Model&StreamableImageFile  $record
     */
    private function original(Request $request, Model $record): Response
    {
        $disk = Storage::disk($record->imageDisk());
        $path = $record->imageStoragePath();

        if (! $disk->exists($path)) {
            abort(404);
        }

        $etag = '"'.sha1($path.'|'.$disk->size($path).'|'.$disk->lastModified($path)).'"';

        if ($this->matches($request, $etag)) {
            return $this->notModified($etag);
        }

        return response($disk->get($path) ?? '', 200, [
            'Content-Type' => $record->imageMimeType() ?? 'image/jpeg',
            'Cache-Control' => self::CACHE_CONTROL,
            'ETag' => $etag,
        ]);
    }

    private function matches(Request $request, string $etag): bool
    {
        return $request->header('If-None-Match') === $etag;
    }

    /**
     * A 304 carries the headers the 200 would have had (RFC 9110 §15.4.5).
     */
    private function notModified(string $etag): Response
    {
        return response('', 304, [
            'Cache-Control' => self::CACHE_CONTROL,
            'ETag' => $etag,
        ]);
    }
}
