<?php

namespace App\Http\Controllers;

use App\Http\Requests\Api\DestroyPublicationEditionRequest;
use App\Http\Requests\Api\IndexPublicationEditionRequest;
use App\Http\Requests\Api\ShowPublicationEditionRequest;
use App\Http\Requests\Api\StorePublicationEditionRequest;
use App\Http\Requests\Api\UpdatePublicationEditionRequest;
use App\Http\Resources\PublicationEditionResource;
use App\Models\PublicationEdition;
use App\Support\Includes\AllowList;
use App\Support\Includes\IncludeParser;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

/**
 * Editions have no policy of their own: every mutation requires `update` on
 * the publication (see the Store/Update/Destroy requests).
 */
class PublicationEditionController extends Controller
{
    /**
     * Display a listing of the resource, optionally for one publication.
     */
    public function index(IndexPublicationEditionRequest $request): AnonymousResourceCollection
    {
        $includes = $request->getIncludeParams();
        $pagination = $request->getPaginationParams();

        $query = PublicationEdition::query()->with($includes);

        $publicationId = $request->validated('publication_id');
        if (is_string($publicationId)) {
            $query->where('publication_id', $publicationId);
        }

        $paginator = $query
            ->orderBy('display_order')
            ->paginate($pagination['per_page'], ['*'], 'page', $pagination['page']);

        return PublicationEditionResource::collection($paginator);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StorePublicationEditionRequest $request): PublicationEditionResource
    {
        $validated = $request->validated();
        unset($validated['include']);

        $edition = PublicationEdition::create($validated);
        $edition->refresh();
        $edition->load(IncludeParser::fromRequest($request, AllowList::for('publication_edition')));

        return new PublicationEditionResource($edition);
    }

    /**
     * Display the specified resource.
     */
    public function show(ShowPublicationEditionRequest $request, PublicationEdition $publicationEdition): PublicationEditionResource
    {
        $publicationEdition->load($request->getIncludeParams());

        return new PublicationEditionResource($publicationEdition);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdatePublicationEditionRequest $request, PublicationEdition $publicationEdition): PublicationEditionResource
    {
        $validated = $request->validated();
        unset($validated['include']);

        $publicationEdition->update($validated);
        $publicationEdition->refresh();
        $publicationEdition->load(IncludeParser::fromRequest($request, AllowList::for('publication_edition')));

        return new PublicationEditionResource($publicationEdition);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(DestroyPublicationEditionRequest $request, PublicationEdition $publicationEdition): Response
    {
        $publicationEdition->delete();

        return response()->noContent();
    }
}
