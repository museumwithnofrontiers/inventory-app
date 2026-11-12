<?php

namespace App\Http\Controllers\Filament;

use App\Http\Controllers\Controller;
use App\Http\Responses\Image\DownloadImageResponse;
use App\Http\Responses\Image\InlineImageResponse;
use App\Models\Publication;
use App\Models\PublicationImage;

class PublicationImageController extends Controller
{
    public function view(Publication $publication, PublicationImage $publicationImage): InlineImageResponse
    {
        if ($publicationImage->publication_id !== $publication->id) {
            abort(404);
        }

        return new InlineImageResponse($publicationImage);
    }

    public function download(Publication $publication, PublicationImage $publicationImage): DownloadImageResponse
    {
        if ($publicationImage->publication_id !== $publication->id) {
            abort(404);
        }

        return new DownloadImageResponse($publicationImage);
    }
}
