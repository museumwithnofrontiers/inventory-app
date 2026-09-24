<?php

namespace App\Http\Controllers;

use App\Http\Requests\Api\AttachFromAvailableCollectionImageRequest;
use App\Http\Requests\Api\IndexCollectionImageRequest;
use App\Http\Requests\Api\ShowCollectionImageRequest;
use App\Http\Requests\Api\StoreCollectionImageRequest;
use App\Http\Requests\Api\UpdateCollectionImageRequest;
use App\Http\Resources\CollectionImageResource;
use App\Http\Resources\OperationSuccessResource;
use App\Http\Responses\Image\BurnedImageResponse;
use App\Models\AvailableImage;
use App\Models\Collection;
use App\Models\CollectionImage;
use Illuminate\Contracts\Support\Responsable;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class CollectionImageController extends Controller
{
    /**
     * Display a listing of collection images for a specific collection.
     */
    public function index(IndexCollectionImageRequest $request, Collection $collection): AnonymousResourceCollection
    {
        $includes = $request->getIncludeParams();
        $collectionImages = $collection->collectionImages()->orderBy('display_order');

        if (! empty($includes)) {
            $collectionImages->with($includes);
        }

        return CollectionImageResource::collection($collectionImages->get());
    }

    /**
     * Store a newly created collection image.
     */
    public function store(StoreCollectionImageRequest $request, Collection $collection): CollectionImageResource
    {
        $validated = $request->validated();
        $validated['collection_id'] = $collection->id;
        $validated['display_order'] = CollectionImage::getNextDisplayOrderForCollection($collection->id);

        $collectionImage = CollectionImage::create($validated);

        return new CollectionImageResource($collectionImage);
    }

    /**
     * Display the specified collection image.
     */
    public function show(ShowCollectionImageRequest $request, CollectionImage $collectionImage): CollectionImageResource
    {
        $includes = $request->getIncludeParams();

        if (! empty($includes)) {
            $collectionImage->load($includes);
        }

        return new CollectionImageResource($collectionImage);
    }

    /**
     * Update the specified collection image.
     */
    public function update(UpdateCollectionImageRequest $request, CollectionImage $collectionImage): CollectionImageResource
    {
        $validated = $request->validated();
        $collectionImage->update($validated);

        $includes = $request->getIncludeParams();
        if (! empty($includes)) {
            $collectionImage->load($includes);
        }

        return new CollectionImageResource($collectionImage);
    }

    /**
     * Move collection image up in display order.
     */
    public function moveUp(CollectionImage $collectionImage): CollectionImageResource
    {
        $collectionImage->moveUp();

        // Refresh the model to get updated data
        $collectionImage->refresh();

        return new CollectionImageResource($collectionImage);
    }

    /**
     * Move collection image down in display order.
     */
    public function moveDown(CollectionImage $collectionImage): CollectionImageResource
    {
        $collectionImage->moveDown();

        // Refresh the model to get updated data
        $collectionImage->refresh();

        return new CollectionImageResource($collectionImage);
    }

    /**
     * Tighten ordering for all images of the collection.
     */
    public function tightenOrdering(CollectionImage $collectionImage): OperationSuccessResource
    {
        $collectionImage->tightenOrderingForCollection();

        return new OperationSuccessResource([
            'success' => true,
            'message' => 'Image ordering tightened successfully',
        ]);
    }

    /**
     * Attach an available image to a collection.
     */
    public function attachFromAvailable(AttachFromAvailableCollectionImageRequest $request, Collection $collection): CollectionImageResource
    {
        $validated = $request->validated();

        $idRaw = $validated['available_image_id'] ?? null;
        $availableImage = AvailableImage::findOrFail(is_string($idRaw) ? $idRaw : '');
        $altTextRaw = $validated['alt_text'] ?? null;
        $collectionImage = CollectionImage::attachFromAvailableImage($availableImage, $collection->id, is_string($altTextRaw) ? $altTextRaw : null);

        $includes = $request->getIncludeParams();
        if (! empty($includes)) {
            $collectionImage->load($includes);
        }

        return new CollectionImageResource($collectionImage);
    }

    /**
     * Detach a collection image and convert it back to available image.
     */
    public function detachToAvailable(CollectionImage $collectionImage): OperationSuccessResource
    {
        $availableImage = $collectionImage->detachToAvailableImage();

        return new OperationSuccessResource([
            'success' => true,
            'message' => 'Image detached successfully',
            'available_image_id' => $availableImage->id,
        ]);
    }

    /**
     * Remove the specified collection image.
     */
    public function destroy(CollectionImage $collectionImage): Response
    {
        $collectionImage->delete();

        return response()->noContent();
    }

    /**
     * Returns the image, with its copyright burned in, as a download.
     */
    public function download(CollectionImage $collectionImage): Responsable
    {
        return BurnedImageResponse::download($collectionImage);
    }

    /**
     * Returns the image, with its copyright burned in, for direct viewing (e.g., for use in <img> src attribute): the bytes /pub serves.
     */
    public function view(CollectionImage $collectionImage): Responsable
    {
        return BurnedImageResponse::view($collectionImage);
    }
}
