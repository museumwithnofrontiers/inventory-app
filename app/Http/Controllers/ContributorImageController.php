<?php

namespace App\Http\Controllers;

use App\Http\Requests\Api\AttachFromAvailableContributorImageRequest;
use App\Http\Requests\Api\IndexContributorImageRequest;
use App\Http\Requests\Api\ShowContributorImageRequest;
use App\Http\Requests\Api\StoreContributorImageRequest;
use App\Http\Requests\Api\UpdateContributorImageRequest;
use App\Http\Resources\ContributorImageResource;
use App\Http\Resources\OperationSuccessResource;
use App\Http\Responses\Image\BurnedImageResponse;
use App\Models\AvailableImage;
use App\Models\Contributor;
use App\Models\ContributorImage;
use App\Support\Includes\AllowList;
use App\Support\Includes\IncludeParser;
use Illuminate\Contracts\Support\Responsable;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class ContributorImageController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(IndexContributorImageRequest $request): AnonymousResourceCollection
    {
        $includes = $request->getIncludeParams();
        $pagination = $request->getPaginationParams();

        $query = ContributorImage::query()->with($includes);
        $paginator = $query->paginate(
            $pagination['per_page'],
            ['*'],
            'page',
            $pagination['page']
        );

        return ContributorImageResource::collection($paginator);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreContributorImageRequest $request): ContributorImageResource
    {
        $validated = $request->validated();
        $contributorImage = ContributorImage::create($validated);
        $contributorImage->refresh();
        $includes = IncludeParser::fromRequest($request, AllowList::for('contributor_image'));
        $contributorImage->load($includes);

        return new ContributorImageResource($contributorImage);
    }

    /**
     * Display the specified resource.
     */
    public function show(ShowContributorImageRequest $request, ContributorImage $contributorImage): ContributorImageResource
    {
        $includes = $request->getIncludeParams();
        $contributorImage->load($includes);

        return new ContributorImageResource($contributorImage);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdateContributorImageRequest $request, ContributorImage $contributorImage): ContributorImageResource
    {
        $validated = $request->validated();
        $contributorImage->update($validated);
        $contributorImage->refresh();
        $includes = IncludeParser::fromRequest($request, AllowList::for('contributor_image'));
        $contributorImage->load($includes);

        return new ContributorImageResource($contributorImage);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(ContributorImage $contributorImage): Response
    {
        $contributorImage->delete();

        return response()->noContent();
    }

    /**
     * Move contributor image up in display order.
     */
    public function moveUp(ContributorImage $contributorImage): ContributorImageResource
    {
        $contributorImage->moveUp();
        $contributorImage->refresh();

        return new ContributorImageResource($contributorImage);
    }

    /**
     * Move contributor image down in display order.
     */
    public function moveDown(ContributorImage $contributorImage): ContributorImageResource
    {
        $contributorImage->moveDown();
        $contributorImage->refresh();

        return new ContributorImageResource($contributorImage);
    }

    /**
     * Tighten ordering for all images of the contributor.
     */
    public function tightenOrdering(ContributorImage $contributorImage): OperationSuccessResource
    {
        $contributorImage->tightenOrdering();

        return new OperationSuccessResource([
            'success' => true,
            'message' => 'Image ordering tightened successfully',
        ]);
    }

    /**
     * Attach an available image to a contributor.
     */
    public function attachFromAvailable(AttachFromAvailableContributorImageRequest $request, Contributor $contributor): ContributorImageResource
    {
        $validated = $request->validated();

        $idRaw = $validated['available_image_id'] ?? null;
        $availableImage = AvailableImage::findOrFail(is_string($idRaw) ? $idRaw : '');
        $altTextRaw = $validated['alt_text'] ?? null;
        $contributorImage = ContributorImage::attachFromAvailableImage($availableImage, $contributor->id, is_string($altTextRaw) ? $altTextRaw : null);

        $includes = $request->getIncludeParams();
        if (! empty($includes)) {
            $contributorImage->load($includes);
        }

        return new ContributorImageResource($contributorImage);
    }

    /**
     * Detach a contributor image and convert it back to available image.
     */
    public function detachToAvailable(ContributorImage $contributorImage): OperationSuccessResource
    {
        $availableImage = $contributorImage->detachToAvailableImage();

        return new OperationSuccessResource([
            'success' => true,
            'message' => 'Image detached successfully',
            'available_image_id' => $availableImage->id,
        ]);
    }

    /**
     * Returns the image, with its copyright burned in, as a download.
     */
    public function download(ContributorImage $contributorImage): Responsable
    {
        return BurnedImageResponse::download($contributorImage);
    }

    /**
     * Returns the image, with its copyright burned in, for direct viewing: the bytes /pub serves.
     */
    public function view(ContributorImage $contributorImage): Responsable
    {
        return BurnedImageResponse::view($contributorImage);
    }
}
