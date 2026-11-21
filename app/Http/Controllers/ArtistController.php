<?php

namespace App\Http\Controllers;

use App\Http\Requests\Api\IndexArtistRequest;
use App\Http\Requests\Api\ShowArtistRequest;
use App\Http\Requests\Api\StoreArtistRequest;
use App\Http\Requests\Api\UpdateArtistRequest;
use App\Http\Resources\ArtistResource;
use App\Models\Artist;
use App\Support\Includes\AllowList;
use App\Support\Includes\IncludeParser;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class ArtistController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(IndexArtistRequest $request): AnonymousResourceCollection
    {
        $includes = $request->getIncludeParams();
        $pagination = $request->getPaginationParams();

        $paginator = Artist::query()
            ->with($includes)
            ->orderBy('name')
            ->paginate(
                $pagination['per_page'],
                ['*'],
                'page',
                $pagination['page']
            );

        return ArtistResource::collection($paginator);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreArtistRequest $request): ArtistResource
    {
        $artist = Artist::create($request->validated());
        $artist->refresh();
        $artist->load(IncludeParser::fromRequest($request, AllowList::for('artist')));

        return new ArtistResource($artist);
    }

    /**
     * Display the specified resource.
     */
    public function show(ShowArtistRequest $request, Artist $artist): ArtistResource
    {
        $artist->load($request->getIncludeParams());

        return new ArtistResource($artist);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdateArtistRequest $request, Artist $artist): ArtistResource
    {
        $artist->update($request->validated());
        $artist->refresh();
        $artist->load(IncludeParser::fromRequest($request, AllowList::for('artist')));

        return new ArtistResource($artist);
    }

    /**
     * Remove the specified resource from storage. Its links to items go with
     * it (the artist_item rows cascade); the items themselves stay.
     */
    public function destroy(Artist $artist): Response
    {
        $artist->delete();

        return response()->noContent();
    }
}
