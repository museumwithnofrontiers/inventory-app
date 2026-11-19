<?php

namespace App\Http\Controllers;

use App\Http\Requests\Api\IndexVisitInformationRequest;
use App\Http\Requests\Api\ShowVisitInformationRequest;
use App\Http\Requests\Api\StoreVisitInformationRequest;
use App\Http\Requests\Api\UpdateVisitInformationRequest;
use App\Http\Resources\VisitInformationResource;
use App\Models\VisitInformation;
use App\Support\Includes\AllowList;
use App\Support\Includes\IncludeParser;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class VisitInformationController extends Controller
{
    /**
     * Display a listing of the resource, optionally for one item, collection, partner,
     * language or context.
     */
    public function index(IndexVisitInformationRequest $request): AnonymousResourceCollection
    {
        $includes = $request->getIncludeParams();
        $pagination = $request->getPaginationParams();

        $query = VisitInformation::query()->with($includes);

        foreach (['item_id', 'collection_id', 'partner_id', 'language_id', 'context_id'] as $filter) {
            $value = $request->validated($filter);
            if (is_string($value)) {
                $query->where($filter, $value);
            }
        }

        $paginator = $query->paginate($pagination['per_page'], ['*'], 'page', $pagination['page']);

        return VisitInformationResource::collection($paginator);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreVisitInformationRequest $request): VisitInformationResource
    {
        $validated = $request->validated();
        unset($validated['include']);

        $visitInformation = VisitInformation::create($validated);
        $visitInformation->refresh();
        $visitInformation->load(IncludeParser::fromRequest($request, AllowList::for('visit_information')));

        return new VisitInformationResource($visitInformation);
    }

    /**
     * Display the specified resource.
     */
    public function show(ShowVisitInformationRequest $request, VisitInformation $visitInformation): VisitInformationResource
    {
        $visitInformation->load($request->getIncludeParams());

        return new VisitInformationResource($visitInformation);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdateVisitInformationRequest $request, VisitInformation $visitInformation): VisitInformationResource
    {
        $validated = $request->validated();
        unset($validated['include']);

        $visitInformation->update($validated);
        $visitInformation->refresh();
        $visitInformation->load(IncludeParser::fromRequest($request, AllowList::for('visit_information')));

        return new VisitInformationResource($visitInformation);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(VisitInformation $visitInformation): Response
    {
        $visitInformation->delete();

        return response()->noContent();
    }
}
