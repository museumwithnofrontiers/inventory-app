<?php

namespace App\Http\Controllers\Filament;

use App\Http\Controllers\Controller;
use App\Http\Controllers\ItemDocumentController as ApiItemDocumentController;
use App\Models\Item;
use App\Models\ItemDocument;
use Illuminate\Contracts\Support\Responsable;

/**
 * M7 Story A4.3 (#1907): the Filament-only download route for an attached
 * document, registered in AdminPanelProvider::authenticatedRoutes() next to
 * the image routes.
 *
 * Downloading is reading: ItemDocumentPolicy's `view` decides, so a Visitor
 * (who reads everything) may download it, as on the REST API. The document
 * is never served publicly.
 */
class ItemDocumentController extends Controller
{
    public function download(Item $item, ItemDocument $itemDocument): Responsable
    {
        if ($itemDocument->item_id !== $item->id) {
            abort(404);
        }

        $this->authorize('view', $itemDocument);

        // Reuse the API controller's download logic rather than
        // reimplementing the disk/path/FileResponse handling.
        return (new ApiItemDocumentController)->download($itemDocument);
    }
}
