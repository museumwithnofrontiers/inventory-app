<?php

namespace App\Http\Controllers\Pub;

use App\Contracts\HasCopyright;
use App\Contracts\StreamableImageFile;
use App\Http\Controllers\Controller;
use App\Support\Images\AttachedImageRegistry;
use App\Support\Images\PublicRenditions;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

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
        $etag = $this->renditions->etag($record);

        // A 304 carries the headers the 200 would have had (RFC 9110 §15.4.5)
        $ifNoneMatch = $request->header('If-None-Match');
        if ($ifNoneMatch !== null && $ifNoneMatch === $etag) {
            return response('', 304, [
                'Cache-Control' => self::CACHE_CONTROL,
                'ETag' => $etag,
            ]);
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
}
