<?php

namespace App\Http\Controllers;

use App\Enums\CollectionType;
use App\Http\Requests\Api\AttachItemCollectionRequest;
use App\Http\Requests\Api\AttachItemsCollectionRequest;
use App\Http\Requests\Api\ByTypeCollectionRequest;
use App\Http\Requests\Api\DetachItemCollectionRequest;
use App\Http\Requests\Api\DetachItemsCollectionRequest;
use App\Http\Requests\Api\IndexCollectionRequest;
use App\Http\Requests\Api\ShowCollectionRequest;
use App\Http\Requests\Api\StoreCollectionRequest;
use App\Http\Requests\Api\UpdateCollectionRequest;
use App\Http\Resources\CollectionResource;
use App\Models\Collection;
use App\Models\Item;
use App\Support\Includes\AllowList;
use App\Support\Includes\IncludeParser;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

/**
 * Collection Controller
 *
 * Handles CRUD operations for Collections.
 * Provides REST API endpoints for managing museum item collections.
 */
class CollectionController extends Controller
{
    /**
     * Display a listing of the collections.
     */
    public function index(IndexCollectionRequest $request): AnonymousResourceCollection
    {
        $includes = $request->getIncludeParams();
        $pagination = $request->getPaginationParams();

        $query = Collection::query()->with($includes);

        $paginator = $query->paginate(
            $pagination['per_page'],
            ['*'],
            'page',
            $pagination['page']
        );

        return CollectionResource::collection($paginator);
    }

    /**
     * Store a newly created collection in storage.
     */
    public function store(StoreCollectionRequest $request): CollectionResource
    {
        $validated = $request->validated();

        $collection = Collection::create($validated);
        $collection->refresh();

        $includes = IncludeParser::fromRequest($request, AllowList::for('collection'));
        $collection->load($includes);

        return new CollectionResource($collection);
    }

    /**
     * Display the specified collection.
     */
    public function show(ShowCollectionRequest $request, Collection $collection): CollectionResource
    {
        $includes = $request->getIncludeParams();
        $collection->load($includes);

        return new CollectionResource($collection);
    }

    /**
     * Update the specified collection in storage.
     */
    public function update(UpdateCollectionRequest $request, Collection $collection): CollectionResource
    {
        $validated = $request->validated();

        $collection->update($validated);
        $collection->refresh();

        $includes = IncludeParser::fromRequest($request, AllowList::for('collection'));
        $collection->load($includes);

        return new CollectionResource($collection);
    }

    /**
     * Get collections by type.
     */
    public function byType(ByTypeCollectionRequest $request, string $type): AnonymousResourceCollection
    {
        $request->validated();

        $includes = $request->getIncludeParams();

        $query = Collection::query()->with($includes);

        // The request has validated the type against CollectionType.
        $query->where('type', CollectionType::from($type)->value);

        $collections = $query->get();

        return CollectionResource::collection($collections);
    }

    /**
     * Attach an item to a collection via many-to-many relationship.
     */
    public function attachItem(AttachItemCollectionRequest $request, Collection $collection): CollectionResource
    {
        $validated = $request->validated();

        $itemIdRaw = $validated['item_id'] ?? null;
        $item = Item::findOrFail(is_string($itemIdRaw) ? $itemIdRaw : '');
        $collection->attachItem($item);

        $collection->refresh();
        $includes = $request->getIncludeParams();
        $collection->load($includes);

        return new CollectionResource($collection);
    }

    /**
     * Detach an item from a collection.
     */
    public function detachItem(DetachItemCollectionRequest $request, Collection $collection): CollectionResource
    {
        $validated = $request->validated();

        $itemIdRaw = $validated['item_id'] ?? null;
        $item = Item::findOrFail(is_string($itemIdRaw) ? $itemIdRaw : '');
        $collection->detachItem($item);

        $collection->refresh();
        $includes = $request->getIncludeParams();
        $collection->load($includes);

        return new CollectionResource($collection);
    }

    /**
     * Attach multiple items to a collection.
     */
    public function attachItems(AttachItemsCollectionRequest $request, Collection $collection): CollectionResource
    {
        $validated = $request->validated();

        /** @var array<int, string> $itemIds */
        $itemIds = is_array($validated['item_ids'] ?? null) ? $validated['item_ids'] : [];
        $collection->attachItems($itemIds);

        $collection->refresh();
        $includes = $request->getIncludeParams();
        $collection->load($includes);

        return new CollectionResource($collection);
    }

    /**
     * Detach multiple items from a collection.
     */
    public function detachItems(DetachItemsCollectionRequest $request, Collection $collection): CollectionResource
    {
        $validated = $request->validated();

        /** @var array<int, string> $itemIds */
        $itemIds = is_array($validated['item_ids'] ?? null) ? $validated['item_ids'] : [];
        $collection->detachItems($itemIds);

        $collection->refresh();
        $includes = $request->getIncludeParams();
        $collection->load($includes);

        return new CollectionResource($collection);
    }

    /**
     * Remove the specified collection from storage.
     */
    public function destroy(Collection $collection): Response
    {
        $collection->delete();

        return response()->noContent();
    }
}
