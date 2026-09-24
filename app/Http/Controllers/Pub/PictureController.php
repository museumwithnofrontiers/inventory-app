<?php

namespace App\Http\Controllers\Pub;

use App\Contracts\HasCopyright;
use App\Contracts\StreamableImageFile;
use App\Http\Controllers\Controller;
use App\Support\Images\AttachedImageRegistry;
use App\Support\Images\ImageBurner;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Storage;

class PictureController extends Controller
{
    /**
     * Serve a picture at its stable, UUID-keyed public URL - burned with the
     * currently-resolved copyright text, generated lazily and cached.
     *
     * Route: GET /pub/{filename}  (filename constrained to {uuid}.jpg)
     *
     * The URL never changes on a copyright edit - downstream npm data
     * packages bake it in - so invalidation happens through a content-based
     * ETag (derived from the resolved copyright text) rather than a
     * versioned URL. A matching If-None-Match short-circuits to 304 before
     * anything is read from disk or burned (M9 epic A3).
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
        $etag = '"'.sha1($filename.'|'.$copyright).'"';

        $ifNoneMatch = $request->header('If-None-Match');
        if ($ifNoneMatch !== null && $ifNoneMatch === $etag) {
            return response('', 304);
        }

        $picturesDisk = Config::string('localstorage.pictures.disk');
        $picturesDirectory = trim(Config::string('localstorage.pictures.directory'), '/');
        $picturePath = $picturesDirectory.'/'.$filename;
        $etagCacheKey = 'image-copyright-etag:'.$filename;

        if (Cache::get($etagCacheKey) === $etag && Storage::disk($picturesDisk)->exists($picturePath)) {
            $contents = Storage::disk($picturesDisk)->get($picturePath);
        } else {
            $original = Storage::disk($record->imageDisk())->get($record->imageStoragePath());
            $contents = (new ImageBurner)->burn($original ?? '', $copyright);
            Storage::disk($picturesDisk)->put($picturePath, $contents);
            Cache::forever($etagCacheKey, $etag);
        }

        return response($contents, 200, [
            'Content-Type' => $record->imageMimeType() ?? 'image/jpeg',
            'Cache-Control' => 'public, max-age=86400, must-revalidate',
            'ETag' => $etag,
        ]);
    }
}
