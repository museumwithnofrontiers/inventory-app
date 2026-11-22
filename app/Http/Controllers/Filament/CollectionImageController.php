<?php

namespace App\Http\Controllers\Filament;

use App\Http\Controllers\Controller;
use App\Http\Responses\Image\DownloadImageResponse;
use App\Http\Responses\Image\InlineImageResponse;
use App\Models\Collection;
use App\Models\CollectionImage;

class CollectionImageController extends Controller
{
    public function view(Collection $collection, CollectionImage $collectionImage): InlineImageResponse
    {
        $this->authorize('view', $collectionImage);

        if ($collectionImage->collection_id !== $collection->id) {
            abort(404);
        }

        return new InlineImageResponse($collectionImage);
    }

    public function download(Collection $collection, CollectionImage $collectionImage): DownloadImageResponse
    {
        $this->authorize('view', $collectionImage);

        if ($collectionImage->collection_id !== $collection->id) {
            abort(404);
        }

        return new DownloadImageResponse($collectionImage);
    }
}
