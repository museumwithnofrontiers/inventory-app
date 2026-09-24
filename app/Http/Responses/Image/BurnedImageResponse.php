<?php

namespace App\Http\Responses\Image;

use App\Contracts\HasCopyright;
use App\Contracts\StreamableImageFile;
use App\Support\Images\PublicRenditions;
use finfo;
use Illuminate\Contracts\Support\Responsable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Serves an attached image's public rendition - the bytes /pub serves, with
 * the copyright burned in - inline or as a download. The API uses it; the
 * admin panel serves the original instead (InlineImageResponse,
 * DownloadImageResponse).
 */
class BurnedImageResponse implements Responsable
{
    /**
     * @param  Model&StreamableImageFile&HasCopyright  $image
     */
    private function __construct(
        private readonly Model $image,
        private readonly bool $download,
    ) {}

    /**
     * @param  Model&StreamableImageFile&HasCopyright  $image
     */
    public static function view(Model $image): self
    {
        return new self($image, false);
    }

    /**
     * @param  Model&StreamableImageFile&HasCopyright  $image
     */
    public static function download(Model $image): self
    {
        return new self($image, true);
    }

    /**
     * @param  Request  $request
     */
    public function toResponse($request): Response|StreamedResponse
    {
        $rendition = app(PublicRenditions::class)->get($this->image);

        if ($rendition === null) {
            return response('', 503, ['Retry-After' => '5']);
        }

        $headers = [
            'Content-Type' => $this->image->imageMimeType()
                ?? ((new finfo(FILEINFO_MIME_TYPE))->buffer($rendition->contents) ?: 'application/octet-stream'),
            // An authenticated response: only the caller may keep it, and it
            // revalidates, since a copyright edit changes the bytes
            'Cache-Control' => 'private, no-cache',
            'ETag' => $rendition->etag,
        ];

        if ($this->download) {
            return response()->streamDownload(
                function () use ($rendition): void {
                    echo $rendition->contents;
                },
                $this->image->imageDownloadFilename(),
                $headers
            );
        }

        return response($rendition->contents, 200, $headers + ['Content-Disposition' => 'inline']);
    }
}
