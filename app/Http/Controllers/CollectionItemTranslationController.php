<?php

namespace App\Http\Controllers;

use App\Http\Requests\Api\IndexCollectionItemTranslationRequest;
use App\Http\Requests\Api\ShowCollectionItemTranslationRequest;
use App\Http\Requests\Api\StoreCollectionItemTranslationRequest;
use App\Http\Requests\Api\UpdateCollectionItemTranslationRequest;
use App\Http\Resources\CollectionItemTranslationResource;
use App\Models\CollectionItemTranslation;
use App\Support\Includes\AllowList;
use App\Support\Includes\IncludeParser;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

/**
 * A placement's texts per language (M16 C2).
 */
class CollectionItemTranslationController extends Controller
{
    /**
     * Display a listing of the resource, optionally for one placement or
     * language.
     */
    public function index(IndexCollectionItemTranslationRequest $request): AnonymousResourceCollection
    {
        $includes = $request->getIncludeParams();
        $pagination = $request->getPaginationParams();

        $query = CollectionItemTranslation::query()->with($includes)
            ->orderBy('collection_item_id')
            ->orderBy('language_id');

        foreach (['collection_item_id', 'language_id'] as $filter) {
            $value = $request->validated($filter);
            if (is_string($value)) {
                $query->where($filter, $value);
            }
        }

        $paginator = $query->paginate($pagination['per_page'], ['*'], 'page', $pagination['page']);

        return CollectionItemTranslationResource::collection($paginator);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreCollectionItemTranslationRequest $request): CollectionItemTranslationResource
    {
        $validated = $request->validated();
        unset($validated['include']);

        $translation = CollectionItemTranslation::create($validated);
        $translation->refresh();
        $translation->load(IncludeParser::fromRequest($request, AllowList::for('collection_item_translation')));

        return new CollectionItemTranslationResource($translation);
    }

    /**
     * Display the specified resource.
     */
    public function show(ShowCollectionItemTranslationRequest $request, CollectionItemTranslation $collectionItemTranslation): CollectionItemTranslationResource
    {
        $collectionItemTranslation->load($request->getIncludeParams());

        return new CollectionItemTranslationResource($collectionItemTranslation);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdateCollectionItemTranslationRequest $request, CollectionItemTranslation $collectionItemTranslation): CollectionItemTranslationResource
    {
        $validated = $request->validated();
        unset($validated['include']);

        $collectionItemTranslation->update($validated);
        $collectionItemTranslation->refresh();
        $collectionItemTranslation->load(IncludeParser::fromRequest($request, AllowList::for('collection_item_translation')));

        return new CollectionItemTranslationResource($collectionItemTranslation);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(CollectionItemTranslation $collectionItemTranslation): Response
    {
        $collectionItemTranslation->delete();

        return response()->noContent();
    }
}
