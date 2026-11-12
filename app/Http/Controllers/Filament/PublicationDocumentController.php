<?php

namespace App\Http\Controllers\Filament;

use App\Http\Controllers\Controller;
use App\Http\Controllers\PublicationDocumentController as ApiPublicationDocumentController;
use App\Http\Requests\Api\ShowPublicationDocumentRequest;
use App\Models\Publication;
use App\Models\PublicationDocument;
use Illuminate\Contracts\Support\Responsable;

class PublicationDocumentController extends Controller
{
    public function download(ShowPublicationDocumentRequest $request, Publication $publication, PublicationDocument $publicationDocument): Responsable
    {
        if ($publicationDocument->publication_id !== $publication->id) {
            abort(404);
        }

        $this->authorize('update', $publication);

        // The API controller's download: one disk/path/FileResponse handling
        return (new ApiPublicationDocumentController)->download($request, $publicationDocument);
    }
}
