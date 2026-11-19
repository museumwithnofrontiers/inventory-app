<?php

namespace App\Http\Controllers;

use App\Http\Requests\Api\IndexCollectionItemExploreMonumentRequest;
use App\Http\Requests\Api\ShowCollectionItemExploreMonumentRequest;
use App\Http\Requests\Api\StoreCollectionItemExploreMonumentRequest;
use App\Http\Requests\Api\UpdateCollectionItemExploreMonumentRequest;
use App\Http\Resources\CollectionItemExploreMonumentResource;
use App\Models\CollectionItemExploreMonument;
use App\Support\Includes\AllowList;
use App\Support\Includes\IncludeParser;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

/**
 * The Explore monuments a placement stands for (M16 C4).
 */
class CollectionItemExploreMonumentController extends Controller
{
    /**
     * Display a listing of the resource, optionally for one placement.
     */
    public function index(IndexCollectionItemExploreMonumentRequest $request): AnonymousResourceCollection
    {
        $includes = $request->getIncludeParams();
        $pagination = $request->getPaginationParams();

        $query = CollectionItemExploreMonument::query()->with(['partners:id', ...$includes])
            ->orderBy('collection_item_id')
            ->orderBy('position');

        $placement = $request->validated('collection_item_id');
        if (is_string($placement)) {
            $query->where('collection_item_id', $placement);
        }

        $paginator = $query->paginate($pagination['per_page'], ['*'], 'page', $pagination['page']);

        return CollectionItemExploreMonumentResource::collection($paginator);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreCollectionItemExploreMonumentRequest $request): CollectionItemExploreMonumentResource
    {
        $validated = $request->validated();
        $partnerIds = $validated['partner_ids'] ?? null;
        unset($validated['include'], $validated['partner_ids']);

        $monument = CollectionItemExploreMonument::create($validated);
        if (is_array($partnerIds)) {
            $monument->partners()->sync(self::ordered($partnerIds));
        }

        return $this->respond($monument, $request);
    }

    /**
     * Display the specified resource.
     */
    public function show(ShowCollectionItemExploreMonumentRequest $request, CollectionItemExploreMonument $collectionItemExploreMonument): CollectionItemExploreMonumentResource
    {
        $collectionItemExploreMonument->load(['partners:id', ...$request->getIncludeParams()]);

        return new CollectionItemExploreMonumentResource($collectionItemExploreMonument);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdateCollectionItemExploreMonumentRequest $request, CollectionItemExploreMonument $collectionItemExploreMonument): CollectionItemExploreMonumentResource
    {
        $validated = $request->validated();
        $partnerIds = $validated['partner_ids'] ?? null;
        $syncPartners = array_key_exists('partner_ids', $validated);
        unset($validated['include'], $validated['partner_ids']);

        $collectionItemExploreMonument->update($validated);
        if ($syncPartners) {
            $collectionItemExploreMonument->partners()->sync(self::ordered(is_array($partnerIds) ? $partnerIds : []));
        }

        return $this->respond($collectionItemExploreMonument, $request);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(CollectionItemExploreMonument $collectionItemExploreMonument): Response
    {
        $collectionItemExploreMonument->delete();

        return response()->noContent();
    }

    private function respond(CollectionItemExploreMonument $monument, StoreCollectionItemExploreMonumentRequest|UpdateCollectionItemExploreMonumentRequest $request): CollectionItemExploreMonumentResource
    {
        $monument->refresh();
        $monument->load(['partners:id', ...IncludeParser::fromRequest($request, AllowList::for('collection_item_explore_monument'))]);

        return new CollectionItemExploreMonumentResource($monument);
    }

    /**
     * The partners with their order, as given.
     *
     * @param  array<int, mixed>  $partnerIds
     * @return array<string, array{display_order: int}>
     */
    private static function ordered(array $partnerIds): array
    {
        $ordered = [];
        foreach (array_values($partnerIds) as $index => $partnerId) {
            $ordered[(string) $partnerId] = ['display_order' => $index + 1];
        }

        return $ordered;
    }
}
