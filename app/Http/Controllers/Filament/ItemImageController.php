<?php

namespace App\Http\Controllers\Filament;

use App\Http\Controllers\Controller;
use App\Http\Responses\Image\DownloadImageResponse;
use App\Http\Responses\Image\InlineImageResponse;
use App\Models\Item;
use App\Models\ItemImage;

class ItemImageController extends Controller
{
    public function view(Item $item, ItemImage $itemImage): InlineImageResponse
    {
        $this->authorize('view', $itemImage);

        if ($itemImage->item_id !== $item->id) {
            abort(404);
        }

        return new InlineImageResponse($itemImage);
    }

    public function download(Item $item, ItemImage $itemImage): DownloadImageResponse
    {
        $this->authorize('view', $itemImage);

        if ($itemImage->item_id !== $item->id) {
            abort(404);
        }

        return new DownloadImageResponse($itemImage);
    }
}
