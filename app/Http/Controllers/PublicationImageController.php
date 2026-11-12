<?php

namespace App\Http\Controllers;

use App\Enums\PublicationImageKind;
use App\Http\Requests\Api\AttachFromAvailablePublicationImageRequest;
use App\Http\Requests\Api\IndexPublicationImageRequest;
use App\Http\Requests\Api\ShowPublicationImageRequest;
use App\Http\Requests\Api\StorePublicationImageRequest;
use App\Http\Requests\Api\UpdatePublicationImageRequest;
use App\Http\Resources\OperationSuccessResource;
use App\Http\Resources\PublicationImageResource;
use App\Http\Responses\Image\BurnedImageResponse;
use App\Models\AvailableImage;
use App\Models\Publication;
use App\Models\PublicationImage;
use Illuminate\Contracts\Support\Responsable;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class PublicationImageController extends Controller
{
    /**
     * Display a listing of the images of a publication.
     */
    public function index(IndexPublicationImageRequest $request, Publication $publication): AnonymousResourceCollection
    {
        $pagination = $request->getPaginationParams();

        $paginator = $publication->publicationImages()
            ->with($request->getIncludeParams())
            ->orderBy('display_order')
            ->paginate($pagination['per_page'], ['*'], 'page', $pagination['page']);

        return PublicationImageResource::collection($paginator);
    }

    /**
     * Store a newly created publication image.
     */
    public function store(StorePublicationImageRequest $request, Publication $publication): PublicationImageResource
    {
        $validated = $request->validated();
        $validated['publication_id'] = $publication->id;
        $validated['display_order'] = PublicationImage::getNextDisplayOrderFor(['publication_id' => $publication->id]);

        $publicationImage = PublicationImage::create($validated);

        return new PublicationImageResource($publicationImage);
    }

    /**
     * Display the specified publication image.
     */
    public function show(ShowPublicationImageRequest $request, PublicationImage $publicationImage): PublicationImageResource
    {
        $publicationImage->load($request->getIncludeParams());

        return new PublicationImageResource($publicationImage);
    }

    /**
     * Update the specified publication image.
     */
    public function update(UpdatePublicationImageRequest $request, PublicationImage $publicationImage): PublicationImageResource
    {
        $validated = $request->validated();
        unset($validated['include']);

        $publicationImage->update($validated);
        $publicationImage->load($request->getIncludeParams());

        return new PublicationImageResource($publicationImage);
    }

    /**
     * Move the publication image up in display order.
     */
    public function moveUp(PublicationImage $publicationImage): PublicationImageResource
    {
        $publicationImage->moveUp();
        $publicationImage->refresh();

        return new PublicationImageResource($publicationImage);
    }

    /**
     * Move the publication image down in display order.
     */
    public function moveDown(PublicationImage $publicationImage): PublicationImageResource
    {
        $publicationImage->moveDown();
        $publicationImage->refresh();

        return new PublicationImageResource($publicationImage);
    }

    /**
     * Tighten ordering for all images of the publication.
     */
    public function tightenOrdering(PublicationImage $publicationImage): OperationSuccessResource
    {
        $publicationImage->tightenOrdering();

        return new OperationSuccessResource([
            'success' => true,
            'message' => 'Image ordering tightened successfully',
        ]);
    }

    /**
     * Attach an available image to a publication.
     */
    public function attachFromAvailable(AttachFromAvailablePublicationImageRequest $request, Publication $publication): PublicationImageResource
    {
        $validated = $request->validated();

        $idRaw = $validated['available_image_id'] ?? null;
        $availableImage = AvailableImage::findOrFail(is_string($idRaw) ? $idRaw : '');
        $altTextRaw = $validated['alt_text'] ?? null;
        $kindRaw = $validated['kind'] ?? null;
        $editionRaw = $validated['publication_edition_id'] ?? null;

        $publicationImage = PublicationImage::attachFromAvailableImage(
            $availableImage,
            $publication->id,
            is_string($altTextRaw) ? $altTextRaw : null,
            is_string($kindRaw) ? PublicationImageKind::from($kindRaw) : PublicationImageKind::PAGE,
            is_string($editionRaw) ? $editionRaw : null,
        );

        $publicationImage->load($request->getIncludeParams());

        return new PublicationImageResource($publicationImage);
    }

    /**
     * Detach a publication image and convert it back to an available image.
     */
    public function detachToAvailable(PublicationImage $publicationImage): OperationSuccessResource
    {
        $availableImage = $publicationImage->detachToAvailableImage();

        return new OperationSuccessResource([
            'success' => true,
            'message' => 'Image detached successfully',
            'available_image_id' => $availableImage->id,
        ]);
    }

    /**
     * Remove the specified publication image.
     */
    public function destroy(PublicationImage $publicationImage): Response
    {
        $publicationImage->delete();

        return response()->noContent();
    }

    /**
     * Returns the image, with its copyright burned in, as a download.
     */
    public function download(PublicationImage $publicationImage): Responsable
    {
        return BurnedImageResponse::download($publicationImage);
    }

    /**
     * Returns the image, with its copyright burned in, for direct viewing (e.g., for use in <img> src attribute): the bytes /pub serves.
     */
    public function view(PublicationImage $publicationImage): Responsable
    {
        return BurnedImageResponse::view($publicationImage);
    }
}
