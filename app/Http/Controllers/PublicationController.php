<?php

namespace App\Http\Controllers;

use App\Http\Requests\Api\AttachCollectionPublicationRequest;
use App\Http\Requests\Api\AttachItemPublicationRequest;
use App\Http\Requests\Api\AttachTagPublicationRequest;
use App\Http\Requests\Api\AttachTagsPublicationRequest;
use App\Http\Requests\Api\DetachCollectionPublicationRequest;
use App\Http\Requests\Api\DetachItemPublicationRequest;
use App\Http\Requests\Api\DetachTagPublicationRequest;
use App\Http\Requests\Api\DetachTagsPublicationRequest;
use App\Http\Requests\Api\IndexPublicationRequest;
use App\Http\Requests\Api\ShowPublicationRequest;
use App\Http\Requests\Api\StorePublicationRequest;
use App\Http\Requests\Api\UpdatePublicationRequest;
use App\Http\Resources\PublicationResource;
use App\Models\Publication;
use App\Support\Includes\AllowList;
use App\Support\Includes\IncludeParser;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class PublicationController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(IndexPublicationRequest $request): AnonymousResourceCollection
    {
        $includes = $request->getIncludeParams();
        $pagination = $request->getPaginationParams();

        $paginator = Publication::query()
            ->with($includes)
            ->orderBy('internal_name')
            ->paginate($pagination['per_page'], ['*'], 'page', $pagination['page']);

        return PublicationResource::collection($paginator);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StorePublicationRequest $request): PublicationResource
    {
        $validated = $request->validated();
        unset($validated['include']);

        $publication = Publication::create($validated);
        $publication->refresh();
        $publication->load(IncludeParser::fromRequest($request, AllowList::for('publication')));

        return new PublicationResource($publication);
    }

    /**
     * Display the specified resource.
     */
    public function show(ShowPublicationRequest $request, Publication $publication): PublicationResource
    {
        $publication->load($request->getIncludeParams());

        return new PublicationResource($publication);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdatePublicationRequest $request, Publication $publication): PublicationResource
    {
        $validated = $request->validated();
        unset($validated['include']);

        $publication->update($validated);
        $publication->refresh();
        $publication->load(IncludeParser::fromRequest($request, AllowList::for('publication')));

        return new PublicationResource($publication);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Publication $publication): Response
    {
        $publication->delete();

        return response()->noContent();
    }

    /**
     * Attach a collection the publication accompanies, or update its pivot.
     */
    public function attachCollection(AttachCollectionPublicationRequest $request, Publication $publication): PublicationResource
    {
        $validated = $request->validated();

        $publication->collections()->syncWithoutDetaching([
            $validated['collection_id'] => [
                'display_order' => $validated['display_order'] ?? null,
                'extra' => $validated['extra'] ?? null,
            ],
        ]);

        return $this->fresh($publication, $request->getIncludeParams());
    }

    /**
     * Detach a collection from the publication.
     */
    public function detachCollection(DetachCollectionPublicationRequest $request, Publication $publication): PublicationResource
    {
        $publication->collections()->detach($request->validated('collection_id'));

        return $this->fresh($publication, $request->getIncludeParams());
    }

    /**
     * Attach an item the publication cites, or update its pivot.
     */
    public function attachItem(AttachItemPublicationRequest $request, Publication $publication): PublicationResource
    {
        $validated = $request->validated();

        $publication->items()->syncWithoutDetaching([
            $validated['item_id'] => [
                'display_order' => $validated['display_order'] ?? null,
                'extra' => $validated['extra'] ?? null,
            ],
        ]);

        return $this->fresh($publication, $request->getIncludeParams());
    }

    /**
     * Detach an item from the publication.
     */
    public function detachItem(DetachItemPublicationRequest $request, Publication $publication): PublicationResource
    {
        $publication->items()->detach($request->validated('item_id'));

        return $this->fresh($publication, $request->getIncludeParams());
    }

    /**
     * Attach a single tag to the publication.
     */
    public function attachTag(AttachTagPublicationRequest $request, Publication $publication): PublicationResource
    {
        $publication->tags()->syncWithoutDetaching([$request->validated('tag_id')]);

        return $this->fresh($publication, $request->getIncludeParams());
    }

    /**
     * Detach a single tag from the publication.
     */
    public function detachTag(DetachTagPublicationRequest $request, Publication $publication): PublicationResource
    {
        $publication->tags()->detach($request->validated('tag_id'));

        return $this->fresh($publication, $request->getIncludeParams());
    }

    /**
     * Attach several tags to the publication.
     */
    public function attachTags(AttachTagsPublicationRequest $request, Publication $publication): PublicationResource
    {
        /** @var array<int, string> $tagIds */
        $tagIds = $request->validated('tag_ids');
        $publication->tags()->syncWithoutDetaching($tagIds);

        return $this->fresh($publication, $request->getIncludeParams());
    }

    /**
     * Detach several tags from the publication.
     */
    public function detachTags(DetachTagsPublicationRequest $request, Publication $publication): PublicationResource
    {
        /** @var array<int, string> $tagIds */
        $tagIds = $request->validated('tag_ids');
        $publication->tags()->detach($tagIds);

        return $this->fresh($publication, $request->getIncludeParams());
    }

    /**
     * @param  array<int, string>  $includes
     */
    private function fresh(Publication $publication, array $includes): PublicationResource
    {
        $publication->refresh();
        $publication->load($includes);

        return new PublicationResource($publication);
    }
}
