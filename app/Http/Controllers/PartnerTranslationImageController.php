<?php

namespace App\Http\Controllers;

use App\Http\Requests\Api\AttachFromAvailablePartnerTranslationImageRequest;
use App\Http\Requests\Api\IndexPartnerTranslationImageRequest;
use App\Http\Requests\Api\ShowPartnerTranslationImageRequest;
use App\Http\Requests\Api\StorePartnerTranslationImageRequest;
use App\Http\Requests\Api\UpdatePartnerTranslationImageRequest;
use App\Http\Resources\OperationSuccessResource;
use App\Http\Resources\PartnerTranslationImageResource;
use App\Http\Responses\Image\DownloadImageResponse;
use App\Http\Responses\Image\InlineImageResponse;
use App\Models\AvailableImage;
use App\Models\PartnerTranslation;
use App\Models\PartnerTranslationImage;
use App\Support\Includes\AllowList;
use App\Support\Includes\IncludeParser;
use Illuminate\Contracts\Support\Responsable;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class PartnerTranslationImageController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(IndexPartnerTranslationImageRequest $request): AnonymousResourceCollection
    {
        $includes = $request->getIncludeParams();
        $pagination = $request->getPaginationParams();

        $query = PartnerTranslationImage::query()->with($includes);
        $paginator = $query->paginate(
            $pagination['per_page'],
            ['*'],
            'page',
            $pagination['page']
        );

        return PartnerTranslationImageResource::collection($paginator);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StorePartnerTranslationImageRequest $request): PartnerTranslationImageResource
    {
        $validated = $request->validated();
        $partnerTranslationImage = PartnerTranslationImage::create($validated);
        $partnerTranslationImage->refresh();
        $includes = IncludeParser::fromRequest($request, AllowList::for('partner_translation_image'));
        $partnerTranslationImage->load($includes);

        return new PartnerTranslationImageResource($partnerTranslationImage);
    }

    /**
     * Display the specified resource.
     */
    public function show(ShowPartnerTranslationImageRequest $request, PartnerTranslationImage $partnerTranslationImage): PartnerTranslationImageResource
    {
        $includes = $request->getIncludeParams();
        $partnerTranslationImage->load($includes);

        return new PartnerTranslationImageResource($partnerTranslationImage);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdatePartnerTranslationImageRequest $request, PartnerTranslationImage $partnerTranslationImage): PartnerTranslationImageResource
    {
        $validated = $request->validated();
        $partnerTranslationImage->update($validated);
        $partnerTranslationImage->refresh();
        $includes = IncludeParser::fromRequest($request, AllowList::for('partner_translation_image'));
        $partnerTranslationImage->load($includes);

        return new PartnerTranslationImageResource($partnerTranslationImage);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(PartnerTranslationImage $partnerTranslationImage): Response
    {
        $partnerTranslationImage->delete();

        return response()->noContent();
    }

    /**
     * Move partner translation image up in display order.
     */
    public function moveUp(PartnerTranslationImage $partnerTranslationImage): PartnerTranslationImageResource
    {
        $partnerTranslationImage->moveUp();

        // Refresh the model to get updated data
        $partnerTranslationImage->refresh();

        return new PartnerTranslationImageResource($partnerTranslationImage);
    }

    /**
     * Move partner translation image down in display order.
     */
    public function moveDown(PartnerTranslationImage $partnerTranslationImage): PartnerTranslationImageResource
    {
        $partnerTranslationImage->moveDown();

        // Refresh the model to get updated data
        $partnerTranslationImage->refresh();

        return new PartnerTranslationImageResource($partnerTranslationImage);
    }

    /**
     * Tighten ordering for all images of the partner translation.
     */
    public function tightenOrdering(PartnerTranslationImage $partnerTranslationImage): OperationSuccessResource
    {
        $partnerTranslationImage->tightenOrderingForPartnerTranslation();

        return new OperationSuccessResource([
            'success' => true,
            'message' => 'Image ordering tightened successfully',
        ]);
    }

    /**
     * Attach an available image to a partner translation.
     */
    public function attachFromAvailable(AttachFromAvailablePartnerTranslationImageRequest $request, PartnerTranslation $partnerTranslation): PartnerTranslationImageResource
    {
        $validated = $request->validated();

        $idRaw = $validated['available_image_id'] ?? null;
        $availableImage = AvailableImage::findOrFail(is_string($idRaw) ? $idRaw : '');
        $altTextRaw = $validated['alt_text'] ?? null;
        $partnerTranslationImage = PartnerTranslationImage::attachFromAvailableImage($availableImage, $partnerTranslation->id, is_string($altTextRaw) ? $altTextRaw : null);

        $includes = $request->getIncludeParams();
        if (! empty($includes)) {
            $partnerTranslationImage->load($includes);
        }

        return new PartnerTranslationImageResource($partnerTranslationImage);
    }

    /**
     * Detach a partner translation image and convert it back to available image.
     */
    public function detachToAvailable(PartnerTranslationImage $partnerTranslationImage): OperationSuccessResource
    {
        $availableImage = $partnerTranslationImage->detachToAvailableImage();

        return new OperationSuccessResource([
            'success' => true,
            'message' => 'Image detached successfully',
            'available_image_id' => $availableImage->id,
        ]);
    }

    /**
     * Returns the file to the caller.
     */
    public function download(PartnerTranslationImage $partnerTranslationImage): Responsable
    {
        return new DownloadImageResponse($partnerTranslationImage);
    }

    /**
     * Returns the image file for direct viewing (e.g., for use in <img> src attribute).
     */
    public function view(PartnerTranslationImage $partnerTranslationImage): Responsable
    {
        return new InlineImageResponse($partnerTranslationImage);
    }
}
