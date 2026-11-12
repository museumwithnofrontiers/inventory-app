<?php

namespace App\Http\Controllers;

use App\Http\Requests\Api\DestroyPublicationDocumentRequest;
use App\Http\Requests\Api\IndexPublicationDocumentRequest;
use App\Http\Requests\Api\ShowPublicationDocumentRequest;
use App\Http\Requests\Api\StorePublicationDocumentRequest;
use App\Http\Requests\Api\UpdatePublicationDocumentRequest;
use App\Http\Resources\PublicationDocumentResource;
use App\Http\Responses\FileResponse;
use App\Models\Publication;
use App\Models\PublicationDocument;
use Illuminate\Contracts\Support\Responsable;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Config;

/**
 * A publication's documents. Every change requires `update` on the
 * publication (PublicationDocumentPolicy and the Form Requests).
 */
class PublicationDocumentController extends Controller
{
    /**
     * Display a listing of the documents of a publication.
     */
    public function index(IndexPublicationDocumentRequest $request, Publication $publication): AnonymousResourceCollection
    {
        $pagination = $request->getPaginationParams();

        $paginator = $publication->documents()
            ->with($request->getIncludeParams())
            ->orderBy('display_order')
            ->paginate($pagination['per_page'], ['*'], 'page', $pagination['page']);

        return PublicationDocumentResource::collection($paginator);
    }

    /**
     * Record a document whose file is on the private documents disk.
     */
    public function store(StorePublicationDocumentRequest $request, Publication $publication): PublicationDocumentResource
    {
        $validated = $request->validated();
        $validated['publication_id'] = $publication->id;
        $validated['display_order'] ??= PublicationDocument::getNextDisplayOrderFor([
            'publication_id' => $publication->id,
        ]);

        $document = PublicationDocument::create($validated);

        return new PublicationDocumentResource($document);
    }

    /**
     * Display the specified document.
     */
    public function show(ShowPublicationDocumentRequest $request, PublicationDocument $publicationDocument): PublicationDocumentResource
    {
        $publicationDocument->load($request->getIncludeParams());

        return new PublicationDocumentResource($publicationDocument);
    }

    /**
     * Update the specified document's metadata.
     */
    public function update(UpdatePublicationDocumentRequest $request, PublicationDocument $publicationDocument): PublicationDocumentResource
    {
        $publicationDocument->update($request->validated());
        $publicationDocument->refresh();

        return new PublicationDocumentResource($publicationDocument);
    }

    /**
     * Remove the specified document and its file.
     */
    public function destroy(DestroyPublicationDocumentRequest $request, PublicationDocument $publicationDocument): Response
    {
        $publicationDocument->delete();

        return response()->noContent();
    }

    /**
     * Returns the document file for download, to a signed-in user.
     */
    public function download(ShowPublicationDocumentRequest $request, PublicationDocument $publicationDocument): Responsable
    {
        $disk = Config::string('localstorage.documents.disk');
        $directory = trim(Config::string('localstorage.documents.directory'), '/');

        return FileResponse::download(
            $disk,
            $directory.'/'.$publicationDocument->path,
            $publicationDocument->original_name ?: basename($publicationDocument->path),
            $publicationDocument->mime_type
        );
    }
}
