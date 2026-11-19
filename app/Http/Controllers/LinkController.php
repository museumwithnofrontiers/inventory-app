<?php

namespace App\Http\Controllers;

use App\Http\Requests\Api\StoreLinkRequest;
use App\Http\Requests\Api\UpdateLinkRequest;
use App\Http\Resources\LinkResource;
use App\Models\Collection;
use App\Models\Item;
use App\Models\Link;
use App\Models\Partner;
use App\Models\PublicationEdition;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

/**
 * The links of items, collections, partners and publication editions
 * (M16 F3). The owner is always the one in the route.
 */
class LinkController extends Controller
{
    /**
     * List an item's links.
     */
    public function indexForItem(Item $item): AnonymousResourceCollection
    {
        return $this->indexFor($item);
    }

    /**
     * List a collection's links.
     */
    public function indexForCollection(Collection $collection): AnonymousResourceCollection
    {
        return $this->indexFor($collection);
    }

    /**
     * List a partner's links.
     */
    public function indexForPartner(Partner $partner): AnonymousResourceCollection
    {
        return $this->indexFor($partner);
    }

    /**
     * List a publication edition's links.
     */
    public function indexForPublicationEdition(PublicationEdition $publicationEdition): AnonymousResourceCollection
    {
        return $this->indexFor($publicationEdition);
    }

    /**
     * Add a link to an item.
     */
    public function storeForItem(StoreLinkRequest $request, Item $item): LinkResource
    {
        return $this->storeFor($request, $item);
    }

    /**
     * Add a link to a collection.
     */
    public function storeForCollection(StoreLinkRequest $request, Collection $collection): LinkResource
    {
        return $this->storeFor($request, $collection);
    }

    /**
     * Add a link to a partner.
     */
    public function storeForPartner(StoreLinkRequest $request, Partner $partner): LinkResource
    {
        return $this->storeFor($request, $partner);
    }

    /**
     * Add a link to a publication edition.
     */
    public function storeForPublicationEdition(StoreLinkRequest $request, PublicationEdition $publicationEdition): LinkResource
    {
        return $this->storeFor($request, $publicationEdition);
    }

    /**
     * Display the specified link.
     */
    public function show(Link $link): LinkResource
    {
        return new LinkResource($link);
    }

    /**
     * Update the specified link.
     */
    public function update(UpdateLinkRequest $request, Link $link): LinkResource
    {
        $link->update($request->validated());
        $link->refresh();

        return new LinkResource($link);
    }

    /**
     * Move a link up among its owner's links of its type.
     */
    public function moveUp(Link $link): LinkResource
    {
        $link->moveUp();
        $link->refresh();

        return new LinkResource($link);
    }

    /**
     * Move a link down among its owner's links of its type.
     */
    public function moveDown(Link $link): LinkResource
    {
        $link->moveDown();
        $link->refresh();

        return new LinkResource($link);
    }

    /**
     * Remove the specified link.
     */
    public function destroy(Link $link): Response
    {
        $link->delete();

        return response()->noContent();
    }

    private function indexFor(Model $owner): AnonymousResourceCollection
    {
        $links = Link::query()
            ->where('linkable_type', $owner->getMorphClass())
            ->where('linkable_id', $owner->getKey())
            ->orderBy('type')
            ->orderBy('display_order')
            ->get();

        return LinkResource::collection($links);
    }

    private function storeFor(StoreLinkRequest $request, Model $owner): LinkResource
    {
        $validated = $request->validated();
        $link = new Link($validated);
        $link->linkable_type = $owner->getMorphClass();
        $link->linkable_id = (string) $owner->getKey();
        $link->display_order = $validated['display_order'] ?? Link::getNextDisplayOrderFor([
            'linkable_type' => $link->linkable_type,
            'linkable_id' => $link->linkable_id,
            'type' => $validated['type'],
        ]);
        $link->save();

        return new LinkResource($link);
    }
}
