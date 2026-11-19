<?php

namespace App\Http\Controllers;

use App\Http\Requests\Api\IndexPartnerContactRequest;
use App\Http\Requests\Api\ShowPartnerContactRequest;
use App\Http\Requests\Api\StorePartnerContactRequest;
use App\Http\Requests\Api\UpdatePartnerContactRequest;
use App\Http\Resources\PartnerContactResource;
use App\Models\PartnerContact;
use App\Support\Includes\AllowList;
use App\Support\Includes\IncludeParser;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class PartnerContactController extends Controller
{
    /**
     * Display a listing of the resource, optionally for one partner, in legacy order.
     */
    public function index(IndexPartnerContactRequest $request): AnonymousResourceCollection
    {
        $includes = $request->getIncludeParams();
        $pagination = $request->getPaginationParams();

        $query = PartnerContact::query()->with($includes)->orderBy('partner_id')->orderBy('display_order');

        foreach (['partner_id'] as $filter) {
            $value = $request->validated($filter);
            if (is_string($value)) {
                $query->where($filter, $value);
            }
        }

        $paginator = $query->paginate($pagination['per_page'], ['*'], 'page', $pagination['page']);

        return PartnerContactResource::collection($paginator);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StorePartnerContactRequest $request): PartnerContactResource
    {
        $validated = $request->validated();
        unset($validated['include']);

        $partnerContact = PartnerContact::create($validated);
        $partnerContact->refresh();
        $partnerContact->load(IncludeParser::fromRequest($request, AllowList::for('partner_contact')));

        return new PartnerContactResource($partnerContact);
    }

    /**
     * Display the specified resource.
     */
    public function show(ShowPartnerContactRequest $request, PartnerContact $partnerContact): PartnerContactResource
    {
        $partnerContact->load($request->getIncludeParams());

        return new PartnerContactResource($partnerContact);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdatePartnerContactRequest $request, PartnerContact $partnerContact): PartnerContactResource
    {
        $validated = $request->validated();
        unset($validated['include']);

        $partnerContact->update($validated);
        $partnerContact->refresh();
        $partnerContact->load(IncludeParser::fromRequest($request, AllowList::for('partner_contact')));

        return new PartnerContactResource($partnerContact);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(PartnerContact $partnerContact): Response
    {
        $partnerContact->delete();

        return response()->noContent();
    }
}
