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
 * Unlike the existing Filament image controllers (which rely only on the
 * referential-integrity check below plus the panel's login requirement),
 * this route also requires `update` on the Item via ItemPolicy - #1907's own
 * rule ("Edit/Delete/Download require update on the Item via ItemPolicy"). A
 * `view data`-only user must not be able to pull a document off an Item they
 * can't edit.
 */
class ItemDocumentController extends Controller
{
    public function download(Item $item, ItemDocument $itemDocument): Responsable
    {
        if ($itemDocument->item_id !== $item->id) {
            abort(404);
        }

        $this->authorize('update', $item);

        // Reuse the API controller's download logic rather than
        // reimplementing the disk/path/FileResponse handling.
        return (new ApiItemDocumentController)->download($itemDocument);
    }
}
