<?php

namespace App\Http\Controllers;

use App\Http\Requests\Api\IndexPartnerLogoRequest;
use App\Http\Requests\Api\ShowPartnerLogoRequest;
use App\Http\Requests\Api\StorePartnerLogoRequest;
use App\Http\Requests\Api\UpdatePartnerLogoRequest;
use App\Http\Resources\OperationSuccessResource;
use App\Http\Resources\PartnerLogoResource;
use App\Http\Responses\Image\DownloadImageResponse;
use App\Http\Responses\Image\InlineImageResponse;
use App\Models\PartnerLogo;
use App\Support\Includes\AllowList;
use App\Support\Includes\IncludeParser;
use Illuminate\Contracts\Support\Responsable;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class PartnerLogoController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(IndexPartnerLogoRequest $request): AnonymousResourceCollection
    {
        $includes = $request->getIncludeParams();
        $pagination = $request->getPaginationParams();

        $query = PartnerLogo::query()->with($includes);
        $paginator = $query->paginate(
            $pagination['per_page'],
            ['*'],
            'page',
            $pagination['page']
        );

        return PartnerLogoResource::collection($paginator);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StorePartnerLogoRequest $request): PartnerLogoResource
    {
        $validated = $request->validated();
        $partnerLogo = PartnerLogo::create($validated);
        $partnerLogo->refresh();
        $includes = IncludeParser::fromRequest($request, AllowList::for('partner_logo'));
        $partnerLogo->load($includes);

        return new PartnerLogoResource($partnerLogo);
    }

    /**
     * Display the specified resource.
     */
    public function show(ShowPartnerLogoRequest $request, PartnerLogo $partnerLogo): PartnerLogoResource
    {
        $includes = $request->getIncludeParams();
        $partnerLogo->load($includes);

        return new PartnerLogoResource($partnerLogo);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdatePartnerLogoRequest $request, PartnerLogo $partnerLogo): PartnerLogoResource
    {
        $validated = $request->validated();
        $partnerLogo->update($validated);
        $partnerLogo->refresh();
        $includes = IncludeParser::fromRequest($request, AllowList::for('partner_logo'));
        $partnerLogo->load($includes);

        return new PartnerLogoResource($partnerLogo);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(PartnerLogo $partnerLogo): Response
    {
        $partnerLogo->delete();

        return response()->noContent();
    }

    /**
     * Move partner logo up in display order.
     */
    public function moveUp(PartnerLogo $partnerLogo): PartnerLogoResource
    {
        $partnerLogo->moveUp();

        // Refresh the model to get updated data
        $partnerLogo->refresh();

        return new PartnerLogoResource($partnerLogo);
    }

    /**
     * Move partner logo down in display order.
     */
    public function moveDown(PartnerLogo $partnerLogo): PartnerLogoResource
    {
        $partnerLogo->moveDown();

        // Refresh the model to get updated data
        $partnerLogo->refresh();

        return new PartnerLogoResource($partnerLogo);
    }

    /**
     * Tighten ordering for all logos of the partner.
     */
    public function tightenOrdering(PartnerLogo $partnerLogo): OperationSuccessResource
    {
        $partnerLogo->tightenOrderingForPartner();

        return new OperationSuccessResource([
            'success' => true,
            'message' => 'Logo ordering tightened successfully',
        ]);
    }

    /**
     * Returns the file to the caller.
     */
    public function download(PartnerLogo $partnerLogo): Responsable
    {
        return new DownloadImageResponse($partnerLogo);
    }

    /**
     * Returns the logo file for direct viewing (e.g., for use in <img> src attribute).
     */
    public function view(PartnerLogo $partnerLogo): Responsable
    {
        return new InlineImageResponse($partnerLogo);
    }
}
