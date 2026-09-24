<?php

namespace App\Http\Controllers;

use App\Http\Requests\Api\AttachFromAvailablePartnerImageRequest;
use App\Http\Requests\Api\IndexPartnerImageRequest;
use App\Http\Requests\Api\ShowPartnerImageRequest;
use App\Http\Requests\Api\StorePartnerImageRequest;
use App\Http\Requests\Api\UpdatePartnerImageRequest;
use App\Http\Resources\OperationSuccessResource;
use App\Http\Resources\PartnerImageResource;
use App\Http\Responses\Image\BurnedImageResponse;
use App\Models\AvailableImage;
use App\Models\Partner;
use App\Models\PartnerImage;
use App\Support\Includes\AllowList;
use App\Support\Includes\IncludeParser;
use Illuminate\Contracts\Support\Responsable;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class PartnerImageController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(IndexPartnerImageRequest $request): AnonymousResourceCollection
    {
        $includes = $request->getIncludeParams();
        $pagination = $request->getPaginationParams();

        $query = PartnerImage::query()->with($includes);
        $paginator = $query->paginate(
            $pagination['per_page'],
            ['*'],
            'page',
            $pagination['page']
        );

        return PartnerImageResource::collection($paginator);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StorePartnerImageRequest $request): PartnerImageResource
    {
        $validated = $request->validated();
        $partnerImage = PartnerImage::create($validated);
        $partnerImage->refresh();
        $includes = IncludeParser::fromRequest($request, AllowList::for('partner_image'));
        $partnerImage->load($includes);

        return new PartnerImageResource($partnerImage);
    }

    /**
     * Display the specified resource.
     */
    public function show(ShowPartnerImageRequest $request, PartnerImage $partnerImage): PartnerImageResource
    {
        $includes = $request->getIncludeParams();
        $partnerImage->load($includes);

        return new PartnerImageResource($partnerImage);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdatePartnerImageRequest $request, PartnerImage $partnerImage): PartnerImageResource
    {
        $validated = $request->validated();
        $partnerImage->update($validated);
        $partnerImage->refresh();
        $includes = IncludeParser::fromRequest($request, AllowList::for('partner_image'));
        $partnerImage->load($includes);

        return new PartnerImageResource($partnerImage);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(PartnerImage $partnerImage): Response
    {
        $partnerImage->delete();

        return response()->noContent();
    }

    /**
     * Move partner image up in display order.
     */
    public function moveUp(PartnerImage $partnerImage): PartnerImageResource
    {
        $partnerImage->moveUp();

        // Refresh the model to get updated data
        $partnerImage->refresh();

        return new PartnerImageResource($partnerImage);
    }

    /**
     * Move partner image down in display order.
     */
    public function moveDown(PartnerImage $partnerImage): PartnerImageResource
    {
        $partnerImage->moveDown();

        // Refresh the model to get updated data
        $partnerImage->refresh();

        return new PartnerImageResource($partnerImage);
    }

    /**
     * Tighten ordering for all images of the partner.
     */
    public function tightenOrdering(PartnerImage $partnerImage): OperationSuccessResource
    {
        $partnerImage->tightenOrderingForPartner();

        return new OperationSuccessResource([
            'success' => true,
            'message' => 'Image ordering tightened successfully',
        ]);
    }

    /**
     * Attach an available image to a partner.
     */
    public function attachFromAvailable(AttachFromAvailablePartnerImageRequest $request, Partner $partner): PartnerImageResource
    {
        $validated = $request->validated();

        $idRaw = $validated['available_image_id'] ?? null;
        $availableImage = AvailableImage::findOrFail(is_string($idRaw) ? $idRaw : '');
        $altTextRaw = $validated['alt_text'] ?? null;
        $partnerImage = PartnerImage::attachFromAvailableImage($availableImage, $partner->id, is_string($altTextRaw) ? $altTextRaw : null);

        $includes = $request->getIncludeParams();
        if (! empty($includes)) {
            $partnerImage->load($includes);
        }

        return new PartnerImageResource($partnerImage);
    }

    /**
     * Detach a partner image and convert it back to available image.
     */
    public function detachToAvailable(PartnerImage $partnerImage): OperationSuccessResource
    {
        $availableImage = $partnerImage->detachToAvailableImage();

        return new OperationSuccessResource([
            'success' => true,
            'message' => 'Image detached successfully',
            'available_image_id' => $availableImage->id,
        ]);
    }

    /**
     * Returns the image, with its copyright burned in, as a download.
     */
    public function download(PartnerImage $partnerImage): Responsable
    {
        return BurnedImageResponse::download($partnerImage);
    }

    /**
     * Returns the image, with its copyright burned in, for direct viewing (e.g., for use in <img> src attribute): the bytes /pub serves.
     */
    public function view(PartnerImage $partnerImage): Responsable
    {
        return BurnedImageResponse::view($partnerImage);
    }
}
