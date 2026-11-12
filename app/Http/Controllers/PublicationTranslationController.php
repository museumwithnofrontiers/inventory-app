<?php

namespace App\Http\Controllers;

use App\Http\Requests\Api\IndexPublicationTranslationRequest;
use App\Http\Requests\Api\ShowPublicationTranslationRequest;
use App\Http\Requests\Api\StorePublicationTranslationRequest;
use App\Http\Requests\Api\UpdatePublicationTranslationRequest;
use App\Http\Resources\PublicationTranslationResource;
use App\Models\PublicationTranslation;
use App\Support\Includes\AllowList;
use App\Support\Includes\IncludeParser;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class PublicationTranslationController extends Controller
{
    /**
     * Display a listing of the resource, optionally for one publication,
     * language or context.
     */
    public function index(IndexPublicationTranslationRequest $request): AnonymousResourceCollection
    {
        $includes = $request->getIncludeParams();
        $pagination = $request->getPaginationParams();

        $query = PublicationTranslation::query()->with($includes);

        foreach (['publication_id', 'language_id', 'context_id'] as $filter) {
            $value = $request->validated($filter);
            if (is_string($value)) {
                $query->where($filter, $value);
            }
        }

        $paginator = $query->paginate($pagination['per_page'], ['*'], 'page', $pagination['page']);

        return PublicationTranslationResource::collection($paginator);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StorePublicationTranslationRequest $request): PublicationTranslationResource
    {
        $validated = $request->validated();
        unset($validated['include']);

        $translation = PublicationTranslation::create($validated);
        $translation->refresh();
        $translation->load(IncludeParser::fromRequest($request, AllowList::for('publication_translation')));

        return new PublicationTranslationResource($translation);
    }

    /**
     * Display the specified resource.
     */
    public function show(ShowPublicationTranslationRequest $request, PublicationTranslation $publicationTranslation): PublicationTranslationResource
    {
        $publicationTranslation->load($request->getIncludeParams());

        return new PublicationTranslationResource($publicationTranslation);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdatePublicationTranslationRequest $request, PublicationTranslation $publicationTranslation): PublicationTranslationResource
    {
        $validated = $request->validated();
        unset($validated['include']);

        $publicationTranslation->update($validated);
        $publicationTranslation->refresh();
        $publicationTranslation->load(IncludeParser::fromRequest($request, AllowList::for('publication_translation')));

        return new PublicationTranslationResource($publicationTranslation);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(PublicationTranslation $publicationTranslation): Response
    {
        $publicationTranslation->delete();

        return response()->noContent();
    }
}
